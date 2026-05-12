#!/usr/bin/env bash
set -euo pipefail

# Launch Codex GUI with DeepSeek V4 Pro via a local Responses-to-Chat proxy.
# Starts the proxy automatically, fetches model catalog, writes config to /tmp/.
#
# Env:
#   DEEPSEEK_API_KEY (required)
#   CODEX_DEEPSEEK_MODEL     (default: deepseek-v4-pro)
#   CODEX_DEEPSEEK_PROXY_PORT (default: 18087)
#   CODEX_DEEPSEEK_UPSTREAM_BASE_URL (default: https://api.deepseek.com/v1)

# DeepSeek configuration
# Requires DEEPSEEK_API_KEY.
API_KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$API_KEY" ]; then
  echo "ERROR: DEEPSEEK_API_KEY is not set in the environment." >&2
  exit 1
fi

UPSTREAM_BASE_URL="${CODEX_DEEPSEEK_UPSTREAM_BASE_URL:-https://api.deepseek.com/v1}"
PROXY_HOST="${CODEX_DEEPSEEK_PROXY_HOST:-127.0.0.1}"
PROXY_PORT="${CODEX_DEEPSEEK_PROXY_PORT:-18087}"
PROXY_VERSION="2026-05-08-mcp-namespace-2"
BASE_URL="http://${PROXY_HOST}:${PROXY_PORT}/v1"
PREFERRED_MODEL="${CODEX_DEEPSEEK_MODEL:-deepseek-v4-pro}"
LOCAL_HOME="${CODEX_DEEPSEEK_HOME:-/tmp/deepseek-codex-gui-home}"
USER_DATA_DIR="${CODEX_DEEPSEEK_USER_DATA:-/tmp/deepseek-codex-gui-user-data}"
CATALOG_FILE="$LOCAL_HOME/model-catalog.json"
CONFIG_FILE="$LOCAL_HOME/config.toml"
PROXY_LOG="$LOCAL_HOME/deepseek-responses-proxy.log"
APP_BIN="${CODEX_DEEPSEEK_APP_BIN:-/Applications/Codex.app/Contents/MacOS/Codex}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_BIN="${SCRIPT_DIR}/codex-deepseek-responses-proxy.mjs"
NODE_BIN="${CODEX_DEEPSEEK_NODE:-/Applications/Codex.app/Contents/Resources/node}"
export OPENAI_API_KEY="$API_KEY"
export DEEPSEEK_API_KEY="$API_KEY"
export DEEPSEEK_BASE_URL="$UPSTREAM_BASE_URL"
export CODEX_HOME="$LOCAL_HOME"
export CODEX_DEEPSEEK_PROXY_HOST="$PROXY_HOST"
export CODEX_DEEPSEEK_PROXY_PORT="$PROXY_PORT"

mkdir -p "$LOCAL_HOME" "$USER_DATA_DIR"

if [ ! -x "$PROXY_BIN" ]; then
  echo "ERROR: Missing executable DeepSeek proxy helper: $PROXY_BIN" >&2
  exit 1
fi

started_proxy=0
health_version="$(curl -fsS "$BASE_URL/__health" 2>/dev/null | jq -r '.version // empty' 2>/dev/null || true)"
if [ "$health_version" != "$PROXY_VERSION" ]; then
  if [ -n "$health_version" ]; then
    echo "Restarting stale DeepSeek proxy on ${PROXY_HOST}:${PROXY_PORT} ($health_version -> $PROXY_VERSION)" >&2
  fi
  if command -v lsof >/dev/null 2>&1; then
    old_pids="$(lsof -tiTCP:"$PROXY_PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$old_pids" ]; then
      kill $old_pids 2>/dev/null || true
      sleep 0.2
    fi
  fi
  : > "$PROXY_LOG"
  "$NODE_BIN" "$PROXY_BIN" >> "$PROXY_LOG" 2>&1 &
  proxy_pid=$!
  started_proxy=1
  for _ in $(seq 1 50); do
    if curl -fsS "$BASE_URL/models" >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$proxy_pid" 2>/dev/null; then
      echo "ERROR: DeepSeek proxy exited during startup. Log:" >&2
      tail -80 "$PROXY_LOG" >&2 || true
      exit 1
    fi
    sleep 0.1
  done
fi

MODELS_JSON="$(curl -fsS "$BASE_URL/models" 2>/dev/null || true)"
SELECTED_MODEL="$PREFERRED_MODEL"
if [ -n "$MODELS_JSON" ] && command -v jq >/dev/null 2>&1; then
  if ! jq -e --arg id "$PREFERRED_MODEL" '(.data // []) | map(.id // .name // empty) | index($id)' >/dev/null <<<"$MODELS_JSON"; then
    SELECTED_MODEL="$(jq -r --arg preferred "deepseek-v4-pro" '
      [(.data // [])[] | (.id // .name // empty)] as $ids |
      if ($ids | index($preferred)) then $preferred
      elif ($ids | length) > 0 then $ids[0]
      else empty end
    ' <<<"$MODELS_JSON")"
    SELECTED_MODEL="${SELECTED_MODEL:-$PREFERRED_MODEL}"
  fi
fi

write_catalog_from_models() {
  jq --arg fallback "$SELECTED_MODEL" '
    def model_entry($id): {
      slug: $id,
      display_name: $id,
      description: "DeepSeek model via local Responses-to-Chat proxy",
      default_reasoning_level: "low",
      supported_reasoning_levels: [],
      shell_type: "shell_command",
      visibility: "list",
      supported_in_api: true,
      priority: 0,
      base_instructions: "You are Codex, a coding agent.",
      supports_reasoning_summaries: false,
      default_reasoning_summary: "none",
      support_verbosity: false,
      default_verbosity: "low",
      apply_patch_tool_type: "freeform",
      web_search_tool_type: "text",
      truncation_policy: {mode: "tokens", limit: 10000},
      supports_parallel_tool_calls: false,
      supports_image_detail_original: false,
      context_window: 262144,
      max_context_window: 262144,
      effective_context_window_percent: 95,
      experimental_supported_tools: [],
      input_modalities: ["text"],
      supports_search_tool: false
    };
    [(.data // [])[] | (.id // .name // empty)] as $ids |
    {models: ((if ($ids | length) > 0 then $ids else [$fallback] end) | unique | map(model_entry(.)))}
  ' > "$CATALOG_FILE"
}

write_fallback_catalog() {
  jq -n --arg id "$SELECTED_MODEL" '{models: [{
    slug: $id,
    display_name: $id,
    description: "DeepSeek model via local Responses-to-Chat proxy",
    default_reasoning_level: "low",
    supported_reasoning_levels: [],
    shell_type: "shell_command",
    visibility: "list",
    supported_in_api: true,
    priority: 0,
    base_instructions: "You are Codex, a coding agent.",
    supports_reasoning_summaries: false,
    default_reasoning_summary: "none",
    support_verbosity: false,
    default_verbosity: "low",
    apply_patch_tool_type: "freeform",
    web_search_tool_type: "text",
    truncation_policy: {mode: "tokens", limit: 10000},
    supports_parallel_tool_calls: false,
    supports_image_detail_original: false,
    context_window: 262144,
    max_context_window: 262144,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: ["text"],
    supports_search_tool: false
  }]}' > "$CATALOG_FILE"
}

if [ -n "$MODELS_JSON" ]; then
  printf '%s' "$MODELS_JSON" | write_catalog_from_models || write_fallback_catalog
else
  write_fallback_catalog
fi

cat > "$CONFIG_FILE" <<CONFIG
model = "$SELECTED_MODEL"
model_provider = "deepseek-openai"
model_catalog_json = "$CATALOG_FILE"
developer_instructions = """
When using the Browser Use plugin or in-app browser, use the Codex privileged Node REPL js tool for browser-client.mjs setup and browser control. Do not run browser-client.mjs with shell node or exec_command; shell Node lacks the Codex native pipe and cannot control the in-app browser. If the js tool is unavailable, use the configured browser MCP server tools when available; note that MCP resources can be empty even when MCP tools are available, so prefer browser/playwright MCP tools for navigation, clicking, typing, screenshots, and inspection before claiming browser automation is unavailable.
"""
js_repl_node_path = "/Applications/Codex.app/Contents/Resources/node"
js_repl_node_module_dirs = ["/Applications/Codex.app/Contents/Resources/app.asar.unpacked/node_modules", "/Applications/Codex.app/Contents/Resources/node_modules"]

[model_providers.deepseek-openai]
name = "DeepSeek"
base_url = "${BASE_URL%/}"
env_key = "OPENAI_API_KEY"
wire_api = "responses"

[mcp_servers.node_repl]
command = "/Applications/Codex.app/Contents/Resources/node_repl"

[mcp_servers.browser]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--isolated", "--browser", "chrome"]

[plugins."github@openai-curated"]
enabled = true

[plugins."documents@openai-primary-runtime"]
enabled = true

[plugins."spreadsheets@openai-primary-runtime"]
enabled = true

[plugins."presentations@openai-primary-runtime"]
enabled = true

[plugins."browser-use@openai-bundled"]
enabled = true

[marketplaces.openai-bundled]
source_type = "local"
source = "$HOME/.codex/.tmp/bundled-marketplaces/openai-bundled"

[marketplaces.openai-primary-runtime]
source_type = "local"
source = "$HOME/.cache/codex-runtimes/codex-primary-runtime/plugins/openai-primary-runtime"

[features]
goals = true
js_repl = true
js_repl_tools_only = false
in_app_browser = true
browser_use = true
tool_search = true
tool_search_always_defer_mcp_tools = false
enable_mcp_apps = true
CONFIG

cleanup() {
  if [ "$started_proxy" -eq 1 ] && [ -n "${proxy_pid:-}" ]; then
    kill "$proxy_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ "$#" -eq 0 ]; then
  "$APP_BIN" --user-data-dir="$USER_DATA_DIR" "$PWD"
else
  "$APP_BIN" --user-data-dir="$USER_DATA_DIR" "$@"
fi
