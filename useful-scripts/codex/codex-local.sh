#!/usr/bin/env bash
set -euo pipefail

# Launch CLI codex with a local OpenAI-compatible endpoint.
# Unlike codex-app-local.sh, this uses a temporary catalog file and execs
# the CLI 'codex' binary directly (no GUI).
#
# Env:
#   CODEX_LOCAL_BASE_URL (default: http://localhost:8000/v1)
#   CODEX_LOCAL_MODEL    (default: Qwen3.6-35B-A3B-8bit)
#   OPENAI_API_KEY       (default: XXXXX-XXXXXX)

BASE_URL="${CODEX_LOCAL_BASE_URL:-http://localhost:8000/v1}"
DEFAULT_MODEL="${CODEX_LOCAL_MODEL:-Qwen3.6-35B-A3B-8bit}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-XXXXX-XXXXXX}"

catalog_file="$(mktemp /tmp/local-codex-model-catalog.XXXXXX.json)"
cleanup() {
  rm -f "$catalog_file"
}
trap cleanup EXIT

models_json=""
if models_json="$(curl -fsS -H "Authorization: Bearer ${OPENAI_API_KEY}" "${BASE_URL%/}/models" 2>/dev/null)"; then
  printf '%s\n' "$models_json" | jq --arg fallback "$DEFAULT_MODEL" '
    def model_entry($id): {
      slug: $id,
      display_name: $id,
      description: "Local OpenAI-compatible model",
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
    {models: ((.data // [] | map(.id // .name // empty) | unique | map(model_entry(.))) as $models | if ($models | length) > 0 then $models else [model_entry($fallback)] end)}
  ' > "$catalog_file"
else
  jq -n --arg id "$DEFAULT_MODEL" '{models: [{
    slug: $id,
    display_name: $id,
    description: "Local OpenAI-compatible model",
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
  }]}' > "$catalog_file"
fi

codex \
  -m "$DEFAULT_MODEL" \
  -c model_provider=local-openai \
  -c "model_catalog_json=$catalog_file" \
  -c "model_providers.local-openai={name=\"Local OpenAI\",base_url=\"${BASE_URL%/}\",env_key=\"OPENAI_API_KEY\",wire_api=\"responses\"}" \
  "$@"
