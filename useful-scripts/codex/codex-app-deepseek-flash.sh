#!/usr/bin/env bash
set -euo pipefail

# Launch Codex GUI with DeepSeek V4 Flash.
# Wrapper around codex-app-deepseek.sh that sets the model to deepseek-v4-flash
# and uses a separate proxy port (18088) so both Pro and Flash can run side by side.
#
# Env:
#   DEEPSEEK_API_KEY (required)

# Wrapper that launches codex-app-deepseek.sh with deepseek-v4-flash
export CODEX_DEEPSEEK_MODEL="deepseek-v4-flash"
export CODEX_DEEPSEEK_HOME="${CODEX_DEEPSEEK_HOME:-/tmp/deepseek-flash-codex-gui-home}"
export CODEX_DEEPSEEK_USER_DATA="${CODEX_DEEPSEEK_USER_DATA:-/tmp/deepseek-flash-codex-gui-user-data}"
# Use a different proxy port so both pro and flash can run simultaneously
export CODEX_DEEPSEEK_PROXY_PORT="${CODEX_DEEPSEEK_PROXY_PORT:-18088}"

exec "$(dirname "$0")/codex-app-deepseek.sh" "$@"
