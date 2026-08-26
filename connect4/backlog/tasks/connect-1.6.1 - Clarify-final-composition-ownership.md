---
id: CONNECT-1.6.1
title: Clarify final composition ownership
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 10:45'
updated_date: '2026-08-26 10:46'
labels:
  - plan-review
dependencies: []
parent_task_id: CONNECT-1.6
priority: high
type: docs
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accepted reviewer finding. Practical likelihood: High because every parallel green-field build needs deterministic client/server composition. Impact: final wiring would otherwise violate task ownership or remain incomplete. Scope: required. Correct CONNECT-1.6 so it owns only the minimal composition entrypoints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONNECT-1.6 explicitly owns the minimal client and server composition entrypoints and must wire feature exports without changing feature internals
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add explicit client and server composition entrypoints to CONNECT-1.6 modified-file ownership and acceptance criteria; leave all current DAG edges unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with `backlog task view CONNECT-1.6 --plain`: composition ownership now includes src/main.tsx and server/main.ts, with an acceptance criterion restricting integration to feature exports.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified with `backlog task view CONNECT-1.6 --plain`: composition ownership now includes src/main.tsx and server/main.ts, with an acceptance criterion restricting integration to feature exports.
<!-- SECTION:FINAL_SUMMARY:END -->
