---
id: CONNECT-1.2.1
title: Lock the first-round start transition
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 10:45'
updated_date: '2026-08-26 10:46'
labels:
  - plan-review
dependencies: []
parent_task_id: CONNECT-1.2
priority: high
type: docs
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accepted reviewer finding. Practical likelihood: High because every normal session claims a second seat. Impact: the game could stay in the lobby or begin without the mandatory timer. Scope: required. Specify the atomic second-join transition.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONNECT-1.2 explicitly defines the atomic second-seat-to-playing transition, initial Red turn, turn generation, and deadline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Extend the authoritative session acceptance criteria so the second valid join starts round one as Red with a fresh turn generation and an exact five-second deadline.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with `backlog task view CONNECT-1.2 --plain`: the second valid seat atomically starts round one as Red with generation 1 and a five-second deadline.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified with `backlog task view CONNECT-1.2 --plain`: the second valid seat atomically starts round one as Red with generation 1 and a five-second deadline.
<!-- SECTION:FINAL_SUMMARY:END -->
