---
id: CONNECT-1.2
title: Implement the authoritative game session
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
labels:
  - server
  - realtime
dependencies:
  - CONNECT-1.1
modified_files:
  - server/game/
  - server/websocket/
  - test/game-session.test.ts
parent_task_id: CONNECT-1
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the in-memory rules engine and WebSocket command handling behind the shared server boundary. The server is the sole authority for seats, tokens, turns, deadlines, moves, timeout transitions, wins, draws, scoring, reconnects, and round resets. Keep transport integration independent from HTTP/tunnel startup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The first two distinct joiners receive cryptographically random resume tokens and Red/Yellow seats; a third join is rejected as game full, while a valid stored token restores its original seat
- [ ] #2 A drop is accepted only for the seated token, current color, current turn generation, non-full column, playing phase, and server receipt before the five-second deadline
- [ ] #3 At each deadline the server atomically increments that color’s round-local strike count, changes turn, increments turn generation, and starts a new five-second deadline without placing a piece; disconnection never pauses the clock or releases the seat
- [ ] #4 Four-in-a-row is detected horizontally, vertically, and on both diagonals; a win increments only the winner score, a draw increments no score, and the winning cells and five-second next-round deadline are broadcast
- [ ] #5 Automatic rounds clear board and strikes, preserve players and scores, alternate the starting color, and cannot be affected by stale move or timer callbacks
- [ ] #6 Presenter-token commands can reset the current round while preserving scores or clear players and all match state; player tokens cannot invoke them
- [ ] #7 Focused logic checks cover the four win directions, full-column rejection, a five-second timeout transition, stale-turn rejection, and automatic round restart; no broad test suite is introduced
<!-- AC:END -->
