# Agent Playbook

## Frontend Screenshot Workflow
- Use `peekaboo__list` to confirm Chrome window title and ID when needed.
- Capture the current viewport with `peekaboo__image`, targeting the Chrome window; request JPEG output and save it under `/tmp/` (for example `/tmp/chrome-localhost-5173.jpg`).
- Reference the saved JPEG path in the reply so the user can open it locally if desired.
- Immediately describe the UI shown in the screenshot so the user receives quick visual feedback without opening the file.
- After the user restarts the frontend or backend, take a fresh capture and highlight any visual deltas in the explanation.

## Tooling Notes
- `peekaboo__list` reliably enumerates Chrome windows; the stem sometimes omits off-screen windows, so fall back to manual selection if no title match.
- `peekaboo__image` works well for JPEG captures; keep `capture_focus` at `foreground` to avoid blank screenshots. Saving under `/tmp` is safe and requires no extra cleanup.
- Local `curl` calls to sandboxed ports fail without escalated permissions; rerun with `with_escalated_permissions: true` and supply a short justification.
- IntelliJ MCP file tools are fast for reads but occasionally reject new file writes; `shell` with a heredoc is a reliable fallback for creating files.
- `yarn` and other package scripts may emit cache warnings in the sandbox; they are harmless, but expect missing global folders on macOS runners.
- Backend config now loads once on startup; if `config.local.yaml` is missing or invalid the process aborts, so confirm the file before booting instead of trying to hot-reload it.
