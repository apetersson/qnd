---
id: CONNECT-1.2
title: Implement the authoritative game session
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
updated_date: '2026-08-26 10:46'
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
- [ ] #1 The server validates a trimmed 1-to-20-character display name; the first two distinct joiners receive cryptographically random resume tokens and Red/Yellow seats, while a third join is rejected as game full and a valid stored token restores its original seat. The second successful seat claim atomically starts round one with Red, turn generation 1, and a deadline exactly five seconds after that server transition
- [ ] #2 A drop is accepted only for the seated token, current color, current turn generation, non-full column, playing phase, and server receipt before the five-second deadline
- [ ] #3 At each deadline the server atomically increments that color’s round-local strike count, changes turn, increments turn generation, and starts a new five-second deadline without placing a piece; disconnection never pauses the clock or releases the seat
- [ ] #4 Four-in-a-row is detected horizontally, vertically, and on both diagonals; a win increments only the winner score, a draw increments no score, and the winning cells and five-second next-round deadline are broadcast
- [ ] #5 Automatic rounds clear board and strikes, preserve players and scores, alternate the starting color, and cannot be affected by stale move or timer callbacks
- [ ] #6 Presenter-token reset restarts the current round immediately with its existing starting color while preserving players and scores; clear players removes seats and scores and makes the next game start with Red. Player tokens cannot invoke either command
- [ ] #7 Focused logic checks cover the four win directions, full-column rejection, the second-seat start transition, a five-second timeout transition, stale-turn rejection, and automatic round restart; no broad test suite is introduced
<!-- AC:END -->
