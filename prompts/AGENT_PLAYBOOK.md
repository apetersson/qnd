# Agent Playbook Pattern

A living file of do's and don'ts that make a repo faster and safer to work in.

## Format
- Concise bullet points with exact commands and workspace-relative paths
- Keep guidance repo-specific; if advice applies only in a subdir, name it
- State required working directory (e.g. repo root or `frontend/`)
- Do not contradict direct user instructions; note trade-offs if unsure
- Add notes as you discover them

## Template
```markdown
- Do: …
- Don't: …
```

## Examples from practice

### IntelliJ tool fallbacks
IntelliJ's `create_new_file` often fails for top-level paths — fall back to `apply_patch` or shell redirection for adding files.

### Playwright patterns
- Stub backend calls using `page.route` with toggleable flags so real requests run early and mocked payloads kick in only for the sections needing isolation.
- Structure long journeys with `test.step` to make failures actionable and keep run output readable.

### Debugging patterns
- When chart markers should mirror a live summary metric, source the marker from the latest summary payload first and treat historical samples as a fallback.
- When normalising price/unit data from external inputs, inspect the magnitude before applying conversions — values in base units often ship without an explicit unit field.
