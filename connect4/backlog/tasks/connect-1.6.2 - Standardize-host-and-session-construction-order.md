---
id: CONNECT-1.6.2
title: Standardize host and session construction order
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 10:49'
updated_date: '2026-08-26 10:50'
labels:
  - plan-review
dependencies: []
parent_task_id: CONNECT-1.6
priority: high
type: docs
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accepted reviewer finding. Practical likelihood: High because every startup must reconcile host-owned secret creation with composition-owned imports. Impact: parallel tracks could create mismatched secrets, fail to compile, or break presenter authentication. Scope: required. Define one construction direction without changing the DAG.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONNECT-1.5 and CONNECT-1.6 define one compatible construction order with the host owning secret generation and session creation through the injected factory
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
State that server/main.ts passes createGameSession into the host runtime; the host creates one presenter secret, invokes the factory, attaches the session, and publishes the discovered tunnel URL.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with backlog task views: CONNECT-1.6 passes createGameSession into the host runtime; CONNECT-1.5 generates the single presenter secret, invokes the factory, attaches the session, and publishes the tunnel URL.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Standardized startup construction while preserving the existing parallel dependency graph.
<!-- SECTION:FINAL_SUMMARY:END -->
