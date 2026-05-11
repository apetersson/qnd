#!/bin/zsh
set -euo pipefail

# Launch the ComfyUI server from its installed app bundle.
# Points at user data/input/output directories in ~/Documents/ComfyUI.
# Listens on 0.0.0.0:8188.

cd "$HOME/Documents/ComfyUI"
exec "$HOME/Documents/ComfyUI/.venv/bin/python" \
  "/Applications/ComfyUI.app/Contents/Resources/ComfyUI/main.py" \
  --user-directory "$HOME/Documents/ComfyUI/user" \
  --input-directory "$HOME/Documents/ComfyUI/input" \
  --output-directory "$HOME/Documents/ComfyUI/output" \
  --front-end-root "/Applications/ComfyUI.app/Contents/Resources/ComfyUI/web_custom_versions/desktop_app" \
  --base-directory "$HOME/Documents/ComfyUI" \
  --database-url "sqlite:///$HOME/Documents/ComfyUI/user/comfyui.db" \
  --extra-model-paths-config "$HOME/Library/Application Support/ComfyUI/extra_models_config.yaml" \
  --log-stdout \
  --listen 0.0.0.0 \
  --port 8188 \
  --enable-manager
