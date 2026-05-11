#!/usr/bin/env bash
set -euo pipefail

# Launch Codex GUI with a local OpenAI-compatible endpoint (llama.cpp, vLLM, etc.).
# Writes config and user data to /tmp/local-codex-gui-*.
#
# Env:
#   CODEX_LOCAL_BASE_URL (default: http://localhost:8000/v1)
#   CODEX_LOCAL_MODEL    (default: Qwen3.6-35B-A3B-8bit)
#   OPENAI_API_KEY       (default: XXXXX-XXXXXX)

BASE_URL="${CODEX_LOCAL_BASE_URL:-http://localhost:8000/v1}"
DEFAULT_MODEL="${CODEX_LOCAL_MODEL:-Qwen3.6-35B-A3B-8bit}"
LOCAL_HOME="${CODEX_LOCAL_HOME:-/tmp/local-codex-gui-home}"
USER_DATA_DIR="${CODEX_LOCAL_GUI_USER_DATA:-/tmp/local-codex-gui-user-data}"
CATALOG_FILE="$LOCAL_HOME/model-catalog.json"
CONFIG_FILE="$LOCAL_HOME/config.toml"
APP_BIN="/Applications/Codex.app/Contents/MacOS/Codex"
export OPENAI_API_KEY="${OPENAI_API_KEY:-XXXXX-XXXXXX}"
export CODEX_HOME="$LOCAL_HOME"

mkdir -p "$LOCAL_HOME" "$USER_DATA_DIR"

write_catalog_from_models() {
  jq --arg fallback "$DEFAULT_MODEL" '
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
  ' > "$CATALOG_FILE"
}

write_fallback_catalog() {
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
  }]}' > "$CATALOG_FILE"
}

if curl -fsS -H "Authorization: Bearer ${OPENAI_API_KEY}" "${BASE_URL%/}/models" 2>/dev/null | write_catalog_from_models; then
  :
else
  write_fallback_catalog
fi

cat > "$CONFIG_FILE" <<CONFIG
model = "$DEFAULT_MODEL"
model_provider = "local-openai"
model_catalog_json = "$CATALOG_FILE"
developer_instructions = """
When using the Browser Use plugin or in-app browser, use the Codex privileged Node REPL js tool for browser-client.mjs setup and browser control. Do not run browser-client.mjs with shell node or exec_command; shell Node lacks the Codex native pipe and cannot control the in-app browser. If the js tool is unavailable, report that Browser Use is unavailable in this session instead of attempting a shell fallback.
"""
js_repl_node_path = "/Applications/Codex.app/Contents/Resources/node"
js_repl_node_module_dirs = ["/Applications/Codex.app/Contents/Resources/app.asar.unpacked/node_modules", "/Applications/Codex.app/Contents/Resources/node_modules"]

[model_providers.local-openai]
name = "Local OpenAI"
base_url = "${BASE_URL%/}"
env_key = "OPENAI_API_KEY"
wire_api = "responses"

[mcp_servers.node_repl]
command = "/Applications/Codex.app/Contents/Resources/node_repl"

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
tool_search_always_defer_mcp_tools = true
enable_mcp_apps = true
workspace_dependencies = true
CONFIG

if [ "$#" -eq 0 ]; then
  exec "$APP_BIN" --user-data-dir="$USER_DATA_DIR" "$PWD"
else
  exec "$APP_BIN" --user-data-dir="$USER_DATA_DIR" "$@"
fi
