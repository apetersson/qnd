---
id: CONNECT-1.5
title: Create the one-command TryCloudflare host runtime
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
updated_date: '2026-08-26 10:50'
labels:
  - runtime
  - cloudflare
dependencies:
  - CONNECT-1.1
modified_files:
  - server/host/
parent_task_id: CONNECT-1
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the local Node runtime that serves the built frontend, supplies the HTTP upgrade point expected by the game server boundary, starts cloudflared Quick Tunnel, discovers its public URL, and hands the protected local presenter URL to the presenter. Keep the public service limited to the game and static assets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm run host builds once and starts the composed server entrypoint. The injected host runtime binds loopback on a configurable default port, creates one fresh presenter secret, invokes the injected createGameSession factory with that secret, attaches the returned session, and starts cloudflared against the origin
- [ ] #2 The runtime robustly extracts the first https trycloudflare.com URL from cloudflared output, publishes it to the attached game session for QR rendering, prints both public and local presenter URLs, and best-effort opens the presenter browser without making browser launch a startup requirement
- [ ] #3 Startup fails with an actionable message when cloudflared is missing, exits, or cannot create a Quick Tunnel, including the known conflicting local config-file condition
- [ ] #4 Static serving uses the production build rather than exposing Vite development/HMR endpoints, supports the two client routes, and applies basic same-origin and no-store behavior suitable for the temporary game
- [ ] #5 SIGINT, SIGTERM, early server failure, and tunnel failure close the HTTP/WebSocket runtime and child process without leaving a hidden tunnel running
- [ ] #6 A narrow parser/lifecycle check uses captured representative cloudflared output and a fake child process; it does not contact Cloudflare during automated checks
<!-- AC:END -->
