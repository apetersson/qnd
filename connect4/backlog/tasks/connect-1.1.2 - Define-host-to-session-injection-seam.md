---
id: CONNECT-1.1.2
title: Define host-to-session injection seam
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 10:45'
updated_date: '2026-08-26 10:46'
labels:
  - plan-review
dependencies: []
parent_task_id: CONNECT-1.1
priority: high
type: docs
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Coordinator correctness finding. Practical likelihood: High because the tunnel runtime owns the generated public URL and presenter secret while the game session consumes both. Impact: parallel tracks would otherwise invent incompatible injection APIs during integration. Scope: required. Make that boundary explicit without adding a dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONNECT-1.1 defines presenter-secret injection and public-URL publication across the host/game boundary without coupling either implementation directory
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Specify that the game-session factory accepts the presenter secret and exposes a runtime method to publish the discovered public URL into snapshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with `backlog task view CONNECT-1.1 --plain`: the game-session factory accepts the presenter secret and exposes WebSocket attachment plus public-URL publication.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified with `backlog task view CONNECT-1.1 --plain`: the game-session factory accepts the presenter secret and exposes WebSocket attachment plus public-URL publication.
<!-- SECTION:FINAL_SUMMARY:END -->
