#!/usr/bin/env bash
set -euo pipefail

# Migrate pi from @mariozechner/pi-coding-agent to @earendil-works/pi-coding-agent.
# Temporarily disables npm min-release-age to fetch the latest version.
#
# Env:
#   NODE_PREFIX  (default: npm prefix -g)

OLD_PACKAGE="@mariozechner/pi-coding-agent"
NEW_PACKAGE="@earendil-works/pi-coding-agent"
CONFIG_KEY="min-release-age"
CONFIG_LOCATION="user"
NODE_PREFIX="${NODE_PREFIX:-$(npm prefix -g)}"

restore_config() {
  if [[ "${RESTORE_NEEDED:-0}" != "1" ]]; then
    return
  fi

  echo "Restoring npm ${CONFIG_KEY}..."
  if [[ "${ORIGINAL_IS_SET:-0}" == "1" ]]; then
    npm config set "$CONFIG_KEY" "$ORIGINAL_VALUE" --location="$CONFIG_LOCATION" >/dev/null
  else
    npm config delete "$CONFIG_KEY" --location="$CONFIG_LOCATION" >/dev/null || true
  fi
}

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not on PATH." >&2
  exit 1
fi

RAW_ORIGINAL_VALUE="$(npm config get "$CONFIG_KEY" --location="$CONFIG_LOCATION" 2>/dev/null || true)"
RAW_ORIGINAL_VALUE="${RAW_ORIGINAL_VALUE//$'\r'/}"
RAW_ORIGINAL_VALUE="${RAW_ORIGINAL_VALUE//$'\n'/}"

ORIGINAL_IS_SET=1
ORIGINAL_VALUE="$RAW_ORIGINAL_VALUE"
case "$RAW_ORIGINAL_VALUE" in
  ""|undefined|null)
    ORIGINAL_IS_SET=0
    ORIGINAL_VALUE=""
    ;;
esac

RESTORE_NEEDED=1
trap restore_config EXIT

echo "Temporarily disabling npm ${CONFIG_KEY}..."
npm config set "$CONFIG_KEY" 0 --location="$CONFIG_LOCATION" >/dev/null

echo "Updating pi from ${OLD_PACKAGE} to ${NEW_PACKAGE}..."
npm --prefix "$NODE_PREFIX" uninstall -g "$OLD_PACKAGE" >/dev/null || true
npm --prefix "$NODE_PREFIX" cache verify >/dev/null || true
npm --prefix "$NODE_PREFIX" install -g "$NEW_PACKAGE"

echo "Update finished."
echo "Current pi: $(command -v pi || echo not-on-PATH)"
echo "Current pi version: $(pi --version 2>/dev/null || echo unknown)"
