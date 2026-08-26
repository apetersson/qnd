---
id: CONNECT-1.1
title: Establish the app shell and cross-track contracts
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
labels:
  - foundation
dependencies: []
modified_files:
  - package.json
  - src/shared/
  - src/app/
  - server/contracts.ts
parent_task_id: CONNECT-1
priority: high
type: task
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the smallest standalone npm/Vite/React/TypeScript and Node structure that lets the server, participant UI, presenter UI, and tunnel runtime be implemented independently. Lock the shared domain model, versioned WebSocket message union, server adapter boundary, same-origin browser socket adapter, route shells, design tokens, and package scripts. This task owns shared configuration and contracts; feature tasks own their isolated subsystem directories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The project installs with npm and exposes host, build, typecheck, and focused-check scripts without adding a monorepo or deployment framework
- [ ] #2 Shared types cover the 7-by-6 board, colors, lobby/playing/round-over phases, players, scores, connectivity, timeout strikes, current turn, absolute deadlines, turn generation, winning cells, public URL, snapshots, commands, events, and structured rejections
- [ ] #3 The browser socket adapter derives ws or wss from the current origin, reconnects with bounded backoff, delivers authoritative snapshots, and can send typed commands without embedding game rules
- [ ] #4 The server boundary exposes a game-session/WebSocket attachment consumed by the host runtime so those tasks do not need to edit each other
- [ ] #5 The root route and presenter route render isolated feature shells, and common styling supplies accessible Connect 4 colors, typography, focus treatment, and reduced-motion support
<!-- AC:END -->
