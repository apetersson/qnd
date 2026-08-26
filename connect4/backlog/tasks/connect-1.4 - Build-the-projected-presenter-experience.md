---
id: CONNECT-1.4
title: Build the projected presenter experience
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
updated_date: '2026-08-26 10:46'
labels:
  - frontend
  - presenter
dependencies:
  - CONNECT-1.1
modified_files:
  - src/presenter/
parent_task_id: CONNECT-1
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the localhost presenter route against the shared socket protocol. It is the canonical projected view and remains useful from empty lobby through repeated rounds. Presenter-only actions authenticate with the startup token carried in the local URL fragment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The lobby emphasizes a large scannable QR code and readable public HTTPS URL, with Red/Yellow seat names and connectivity as players arrive
- [ ] #2 During play the route shows a projection-scale 7-by-6 board, player names, scores, turn color, server-time-calibrated five-second countdown, timeout strikes, winning cells, and calibrated next-round countdown while retaining a smaller QR code
- [ ] #3 The presenter token is read from the URL fragment, removed from visible browser chrome after capture, and sent only through the typed presenter-auth command
- [ ] #4 Reset round and clear players controls require a confirmation appropriate to their impact, remain unavailable until presenter authentication succeeds, and display structured server rejection feedback
- [ ] #5 The layout remains legible at standard 16:9 presentation sizes and uses no generated imagery or external asset requests
<!-- AC:END -->
