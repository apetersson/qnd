---
id: CONNECT-1.1.1
title: Add server-time countdown calibration contract
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
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accepted reviewer finding. Practical likelihood: Medium because phones and presenter devices have independent clocks and a five-second turn makes modest skew visible. Impact: displayed time may disagree with authoritative move acceptance. Scope: required. Add serverNow and client offset behavior to shared and UI contracts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared snapshots and both countdown UIs define server-time calibration while preserving exclusively server-side deadline enforcement
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add serverNow to snapshots, require the shared socket adapter to maintain a server-clock offset, and state that both player and presenter countdowns use the calibrated time.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with `backlog task view CONNECT-1.1 --plain`: snapshots now include serverNow and the socket adapter derives server-clock offset; both UI tasks require calibrated countdowns.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified with `backlog task view CONNECT-1.1 --plain`: snapshots now include serverNow and the socket adapter derives server-clock offset; both UI tasks require calibrated countdowns.
<!-- SECTION:FINAL_SUMMARY:END -->
