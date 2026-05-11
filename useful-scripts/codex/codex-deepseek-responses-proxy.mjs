#!/usr/bin/env node

/**
 * HTTP proxy that translates the OpenAI Responses API wire format into
 * Chat Completions for DeepSeek. Handles message conversion, namespace
 * tool flattening, tool history sanitization, and reasoning content caching.
 *
 * Env:
 *   DEEPSEEK_API_KEY or OPENAI_API_KEY (required)
 *   DEEPSEEK_BASE_URL    (default: https://api.deepseek.com/v1)
 *   CODEX_DEEPSEEK_PROXY_HOST (default: 127.0.0.1)
 *   CODEX_DEEPSEEK_PROXY_PORT (default: 18087)
 *   CODEX_DEEPSEEK_DEBUG_TOOLS=1  logs tool names for debugging
 */

import http from 'node:http';

const PROXY_VERSION = '2026-05-08-mcp-namespace-2';
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const upstreamBaseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
const host = process.env.CODEX_DEEPSEEK_PROXY_HOST || '127.0.0.1';
const port = Number(process.env.CODEX_DEEPSEEK_PROXY_PORT || 18081);

if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY or OPENAI_API_KEY');
  process.exit(1);
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.output_text === 'string') return part.output_text;
      if (part.type === 'input_text' && typeof part.text === 'string') return part.text;
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
      if (part.type === 'input_image') return '[image input omitted by DeepSeek proxy]';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

const reasoningByAssistantText = new Map();
const MAX_REASONING_CACHE_ENTRIES = 200;

function rememberReasoning(content, reasoningContent) {
  if (!content || !reasoningContent) return;
  reasoningByAssistantText.set(content, reasoningContent);
  while (reasoningByAssistantText.size > MAX_REASONING_CACHE_ENTRIES) {
    const firstKey = reasoningByAssistantText.keys().next().value;
    reasoningByAssistantText.delete(firstKey);
  }
}

function responseInputToMessages(input, instructions) {
  const messages = [];
  if (instructions) messages.push({ role: 'system', content: instructions });

  const items = Array.isArray(input) ? input : [{ type: 'message', role: 'user', content: input ?? '' }];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'message') {
      let role = item.role || 'user';
      if (role === 'developer') role = 'system';
      if (!['system', 'user', 'assistant', 'tool'].includes(role)) role = 'user';
      const text = contentToText(item.content);
      if (text) {
        const message = { role, content: text };
        if (role === 'assistant') {
          // DeepSeek V4 thinking mode rejects multi-turn histories unless
          // assistant messages carry reasoning_content. Use the captured
          // reasoning when this proxy saw the prior turn; otherwise send an
          // empty field so older app threads created before this fix can
          // continue instead of failing with invalid_request_error.
          message.reasoning_content = reasoningByAssistantText.get(text) || '';
        }
        messages.push(message);
      }
      continue;
    }
    if (item.type === 'function_call_output') {
      messages.push({
        role: 'tool',
        tool_call_id: item.call_id || item.id || 'call_unknown',
        content: typeof item.output === 'string' ? item.output : JSON.stringify(item.output ?? ''),
      });
      continue;
    }
    if (item.type === 'function_call') {
      const toolCalls = [];
      while (index < items.length && items[index]?.type === 'function_call') {
        const functionCall = items[index];
        toolCalls.push({
          id: functionCall.call_id || functionCall.id || `call_unknown_${toolCalls.length}`,
          type: 'function',
          function: {
            name: functionCall.namespace ? `${functionCall.namespace}${functionCall.name || 'unknown'}` : (functionCall.name || 'unknown'),
            arguments: functionCall.arguments || '{}',
          },
        });
        index += 1;
      }
      index -= 1;
      messages.push({
        role: 'assistant',
        content: null,
        reasoning_content: '',
        tool_calls: toolCalls,
      });
    }
  }
  return messages.length ? messages : [{ role: 'user', content: '' }];
}

function responseToolsToChatTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const mapped = [];
  for (const tool of tools) {
    if (tool?.type === 'function' && tool.name) {
      mapped.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.parameters || { type: 'object', properties: {} },
        },
      });
      continue;
    }
    if (tool?.type === 'namespace' && tool.name && Array.isArray(tool.tools)) {
      for (const namespacedTool of tool.tools) {
        if (namespacedTool?.type !== 'function' || !namespacedTool.name) continue;
        // Codex's Responses wire format can expose MCP servers as namespace
        // tools. DeepSeek only understands Chat Completions function tools, so
        // flatten `mcp__browser__` + `browser_navigate` into the function name
        // `mcp__browser__browser_navigate`. Codex routes that name back to the
        // correct namespace/tool pair when it receives the function_call item.
        mapped.push({
          type: 'function',
          function: {
            name: `${tool.name}${namespacedTool.name}`,
            description: `${tool.description || `Tools in namespace ${tool.name}`}\n\n${namespacedTool.description || ''}`,
            parameters: namespacedTool.parameters || { type: 'object', properties: {} },
          },
        });
      }
    }
  }
  return mapped.length ? mapped : undefined;
}

function mapToolChoice(choice) {
  if (!choice || choice === 'auto' || choice === 'none' || choice === 'required') return choice;
  if (typeof choice === 'object') {
    if (choice.type === 'function' && choice.name) {
      return { type: 'function', function: { name: choice.name } };
    }
    if (choice.function?.name) return choice;
  }
  return undefined;
}

function sanitizeToolHistory(messages) {
  const sanitized = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role === 'tool') {
      // DeepSeek/OpenAI Chat Completions reject orphan tool messages. They can
      // appear when Codex Responses history has been compacted or reordered.
      continue;
    }

    sanitized.push(message);

    if (message?.role !== 'assistant' || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      continue;
    }

    const expectedIds = new Set(message.tool_calls.map((toolCall) => toolCall.id).filter(Boolean));
    while (index + 1 < messages.length && messages[index + 1]?.role === 'tool') {
      const toolMessage = messages[index + 1];
      index += 1;
      if (expectedIds.has(toolMessage.tool_call_id)) {
        sanitized.push(toolMessage);
        expectedIds.delete(toolMessage.tool_call_id);
      }
    }

    for (const missingId of expectedIds) {
      sanitized.push({
        role: 'tool',
        tool_call_id: missingId,
        content: 'Tool result unavailable in local Responses history.',
      });
    }
  }
  return sanitized;
}

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function normalizeUsage(usage) {
  if (!usage) return undefined;
  const input = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const output = usage.completion_tokens ?? usage.output_tokens ?? 0;
  return { input_tokens: input, output_tokens: output, total_tokens: usage.total_tokens ?? input + output };
}

async function proxyModels(_req, res) {
  const upstream = await fetch(`${upstreamBaseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
  res.end(text);
}

async function proxyResponses(req, res) {
  const request = JSON.parse(await readBody(req));
  const chatRequest = {
    model: request.model,
    messages: sanitizeToolHistory(responseInputToMessages(request.input, request.instructions)),
    stream: true,
  };
  const namespaceToolNameMap = new Map();
  for (const tool of request.tools || []) {
    if (tool?.type !== 'namespace' || !tool.name || !Array.isArray(tool.tools)) continue;
    for (const namespacedTool of tool.tools) {
      if (namespacedTool?.type === 'function' && namespacedTool.name) {
        namespaceToolNameMap.set(`${tool.name}${namespacedTool.name}`, { namespace: tool.name, name: namespacedTool.name });
      }
    }
  }

  const tools = responseToolsToChatTools(request.tools);
  if (tools) chatRequest.tools = tools;
  const toolChoice = mapToolChoice(request.tool_choice);
  if (toolChoice) chatRequest.tool_choice = toolChoice;
  if (request.temperature != null) chatRequest.temperature = request.temperature;
  if (request.top_p != null) chatRequest.top_p = request.top_p;
  if (request.max_output_tokens != null) chatRequest.max_tokens = request.max_output_tokens;
  else if (request.max_tokens != null) chatRequest.max_tokens = request.max_tokens;

  if (process.env.CODEX_DEEPSEEK_DEBUG_TOOLS === '1') {
    const toolNames = Array.isArray(request.tools) ? request.tools.map((tool) => `${tool.type || '?'}:${tool.name || tool.function?.name || tool.server_label || '?'}`) : [];
    console.error(`DeepSeek proxy request: model=${request.model} tools=${JSON.stringify(toolNames)}`);
    for (const tool of request.tools || []) {
      if (tool.type === 'namespace') console.error(`DeepSeek proxy namespace tool: ${JSON.stringify(tool).slice(0, 4000)}`);
    }
  }

  const upstream = await fetch(`${upstreamBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(chatRequest),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => '');
    sendJson(res, upstream.status || 502, { error: { message: errorText || `DeepSeek upstream HTTP ${upstream.status}` } });
    return;
  }

  const responseId = `resp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const output = [];
  let textItem = null;
  let text = '';
  const toolItemsByIndex = new Map();
  const rawToolNamesByIndex = new Map();
  let reasoningContent = '';
  let usage;

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });

  sse(res, 'response.created', {
    type: 'response.created',
    response: { id: responseId, object: 'response', status: 'in_progress', model: request.model, output: [] },
  });

  function ensureTextItem() {
    if (textItem) return textItem;
    textItem = { id: `msg_${Date.now().toString(36)}`, type: 'message', status: 'in_progress', role: 'assistant', content: [] };
    output.push(textItem);
    sse(res, 'response.output_item.added', { type: 'response.output_item.added', output_index: output.length - 1, item: textItem });
    sse(res, 'response.content_part.added', {
      type: 'response.content_part.added',
      item_id: textItem.id,
      output_index: output.length - 1,
      content_index: 0,
      part: { type: 'output_text', text: '' },
    });
    return textItem;
  }

  function applyToolName(item, rawName) {
    const mappedName = namespaceToolNameMap.get(rawName);
    if (mappedName) {
      item.namespace = mappedName.namespace;
      item.name = mappedName.name;
    } else {
      delete item.namespace;
      item.name = rawName;
    }
  }

  function ensureToolItem(index, delta) {
    if (toolItemsByIndex.has(index)) return toolItemsByIndex.get(index);
    const item = {
      id: `fc_${Date.now().toString(36)}_${index}`,
      type: 'function_call',
      status: 'in_progress',
      call_id: delta.id || `call_${Date.now().toString(36)}_${index}`,
      name: '',
      arguments: '',
    };
    const rawName = delta.function?.name || '';
    rawToolNamesByIndex.set(index, rawName);
    applyToolName(item, rawName);
    toolItemsByIndex.set(index, item);
    output.push(item);
    sse(res, 'response.output_item.added', { type: 'response.output_item.added', output_index: output.length - 1, item });
    return item;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const dataLines = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      const data = dataLines.join('\n');
      if (data === '[DONE]') continue;
      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }
      if (parsed.usage) usage = normalizeUsage(parsed.usage);
      const delta = parsed.choices?.[0]?.delta || {};
      if (delta.reasoning_content) {
        reasoningContent += delta.reasoning_content;
      }
      if (delta.content) {
        const item = ensureTextItem();
        const outputIndex = output.indexOf(item);
        text += delta.content;
        sse(res, 'response.output_text.delta', {
          type: 'response.output_text.delta',
          item_id: item.id,
          output_index: outputIndex,
          content_index: 0,
          delta: delta.content,
        });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const toolDelta of delta.tool_calls) {
          const index = toolDelta.index ?? 0;
          const existed = toolItemsByIndex.has(index);
          const item = ensureToolItem(index, toolDelta);
          if (toolDelta.id && item.call_id.startsWith('call_')) item.call_id = toolDelta.id;
          if (toolDelta.function?.name && existed) {
            const rawName = `${rawToolNamesByIndex.get(index) || ''}${toolDelta.function.name}`;
            rawToolNamesByIndex.set(index, rawName);
            applyToolName(item, rawName);
          }
          if (toolDelta.function?.arguments) {
            item.arguments += toolDelta.function.arguments;
            sse(res, 'response.function_call_arguments.delta', {
              type: 'response.function_call_arguments.delta',
              item_id: item.id,
              output_index: output.indexOf(item),
              delta: toolDelta.function.arguments,
            });
          }
        }
      }
    }
  }

  rememberReasoning(text, reasoningContent);

  if (textItem) {
    const outputIndex = output.indexOf(textItem);
    textItem.status = 'completed';
    textItem.content = [{ type: 'output_text', text }];
    sse(res, 'response.output_text.done', { type: 'response.output_text.done', item_id: textItem.id, output_index: outputIndex, content_index: 0, text });
    sse(res, 'response.content_part.done', { type: 'response.content_part.done', item_id: textItem.id, output_index: outputIndex, content_index: 0, part: { type: 'output_text', text } });
    sse(res, 'response.output_item.done', { type: 'response.output_item.done', output_index: outputIndex, item: textItem });
  }

  for (const item of toolItemsByIndex.values()) {
    item.status = 'completed';
    const outputIndex = output.indexOf(item);
    sse(res, 'response.function_call_arguments.done', { type: 'response.function_call_arguments.done', item_id: item.id, output_index: outputIndex, arguments: item.arguments });
    sse(res, 'response.output_item.done', { type: 'response.output_item.done', output_index: outputIndex, item });
  }

  sse(res, 'response.completed', {
    type: 'response.completed',
    response: { id: responseId, object: 'response', status: 'completed', model: request.model, output, usage: usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
  });
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    if (req.method === 'GET' && url.pathname.endsWith('/__health')) return sendJson(res, 200, { ok: true, version: PROXY_VERSION });
    if (req.method === 'GET' && url.pathname.endsWith('/models')) return await proxyModels(req, res);
    if (req.method === 'POST' && url.pathname.endsWith('/responses')) return await proxyResponses(req, res);
    sendJson(res, 404, { error: { message: `Unsupported path ${req.method} ${url.pathname}` } });
  } catch (error) {
    sendJson(res, 500, { error: { message: error?.stack || String(error) } });
  }
});

server.listen(port, host, () => {
  console.error(`DeepSeek Responses proxy listening on http://${host}:${port}/v1 -> ${upstreamBaseUrl}`);
});
