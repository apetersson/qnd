# Useful Scripts

A collection of utility scripts originally from `~/bin`, organized for reference and reuse.

## Structure

```
useful-scripts/
├── codex/       # Codex (coding IDE/agent) launchers and proxy
├── pi/          # pi (coding agent) update helpers
└── comfyui/     # ComfyUI server launcher
```

## Codex (`codex/`)

These scripts launch [Codex](https://codex.ai) with different model backends.

| Script | Purpose |
|---|---|
| `codex-app-deepseek.sh` | Launch Codex GUI with DeepSeek V4 Pro via a local Responses-to-Chat proxy. Starts the proxy automatically, fetches model catalog, writes config to `/tmp/deepseek-codex-gui-*`. |
| `codex-app-deepseek-flash.sh` | Same as above but uses `deepseek-v4-flash`. Runs on a separate proxy port (18088) so both Pro and Flash can run simultaneously. |
| `codex-app-local.sh` | Launch Codex GUI with a local OpenAI-compatible endpoint (e.g. llama.cpp, vLLM). Writes config to `/tmp/local-codex-gui-*`. |
| `codex-local.sh` | Launch the CLI version of Codex (`codex -m ...`) against a local OpenAI-compatible endpoint. Uses a temp catalog file. |
| `codex-deepseek-responses-proxy.mjs` | Node.js HTTP proxy that translates the OpenAI Responses API wire format into Chat Completions for DeepSeek. Handles: message conversion, namespace tool flattening, tool history sanitization, reasoning content caching. |

### Environment Variables (Codex scripts)

- **DeepSeek**: `DEEPSEEK_API_KEY` (required), `CODEX_DEEPSEEK_MODEL`, `CODEX_DEEPSEEK_PROXY_PORT`, `CODEX_DEEPSEEK_UPSTREAM_BASE_URL`
- **Local**: `CODEX_LOCAL_BASE_URL`, `CODEX_LOCAL_MODEL`, `OPENAI_API_KEY`
- **Debug**: `CODEX_DEEPSEEK_DEBUG_TOOLS=1` logs tool names in the proxy

## Pi (`pi/`)

| Script | Purpose |
|---|---|
| `pi-update.sh` | Migrate from `@mariozechner/pi-coding-agent` to `@earendil-works/pi-coding-agent`. Uninstalls the old package, installs the new one. Temporarily disables `min-release-age` to fetch the latest version. |

## ComfyUI (`comfyui/`)

| Script | Purpose |
|---|---|
| `comfyui-server-launch.sh` | Launch the ComfyUI server from its installed app bundle, pointing at user data/input/output directories in `~/Documents/ComfyUI`. Listens on `0.0.0.0:8188`. |

## Notes

- **User-specific paths** (`$HOME/.codex`, `$HOME/Documents/...`) are referenced via `$HOME` — ensure the session has `$HOME` set correctly.
- **App bundle paths** (`/Applications/Codex.app`, `/Applications/ComfyUI.app`) are machine-specific and may need updating on another system.
- The DeepSeek proxy (`codex-deepseek-responses-proxy.mjs`) is resolved relative to the script directory (`$(dirname 
