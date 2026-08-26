---
id: CONNECT-1.6
title: Integrate and rehearse the presentation build
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
updated_date: '2026-08-26 10:46'
labels:
  - integration
  - presentation
dependencies:
  - CONNECT-1.2
  - CONNECT-1.3
  - CONNECT-1.4
  - CONNECT-1.5
modified_files:
  - README.md
  - src/main.tsx
  - server/main.ts
parent_task_id: CONNECT-1
priority: high
type: task
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect the independently implemented tracks, resolve only integration gaps, and rehearse the exact presenter flow. This is the sole convergence task and owns final wiring/documentation rather than another feature or hardening pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The client composition entrypoint registers the finished player and presenter route exports, and the server composition entrypoint instantiates the finished game session and host runtime without changing feature internals
- [ ] #2 npm install, npm run typecheck, the focused game/launcher checks, and npm run build complete successfully
- [ ] #3 A concise README gives prerequisites and the single host/stop workflow, states that the URL changes per run and is temporary, and documents presenter reset/clear controls
- [ ] #4 A local three-session smoke run confirms first-two seat assignment, third-visitor rejection, synchronized moves, at least one skipped five-second timeout, a completed win, score update, and automatic next round
- [ ] #5 One final physical-device TryCloudflare rehearsal confirms the QR opens over HTTPS on two phones, wss updates reach both phones and the presenter, a reconnect restores the seat, and stopping the host removes local/tunnel processes
- [ ] #6 No Playwright suite, visual snapshots, load tests, persistence, rooms, accounts, analytics, deployment work, or post-rehearsal polish backlog is added
<!-- AC:END -->
