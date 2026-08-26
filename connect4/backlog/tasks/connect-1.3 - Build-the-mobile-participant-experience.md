---
id: CONNECT-1.3
title: Build the mobile participant experience
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
labels:
  - frontend
  - mobile
dependencies:
  - CONNECT-1.1
modified_files:
  - src/player/
parent_task_id: CONNECT-1
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the public phone-first experience against the shared socket protocol. It covers joining, seat restoration, waiting, live play, timeout feedback, results, reconnect status, and a full-lobby outcome without owning any game rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A visitor can submit a trimmed 1-to-20-character display name, receive the assigned Red or Yellow identity, and have the resume token stored locally for automatic seat restoration
- [ ] #2 The player view shows the synchronized board, both names and scores, whose turn it is, connectivity, timeout strikes, and a prominent countdown derived from the authoritative deadline
- [ ] #3 Touch, pointer, and keyboard users can select only non-full columns during their own active turn; commands include the current turn generation and input becomes inert immediately after submission until a new snapshot arrives
- [ ] #4 Waiting for opponent, game full, disconnected/reconnecting, timed out, win, loss, draw, and automatic-next-round states are concise and readable on common phone sizes
- [ ] #5 Turn and result changes are announced accessibly; drop/highlight motion honors reduced-motion settings
<!-- AC:END -->
