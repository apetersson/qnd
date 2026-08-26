---
id: CONNECT-1
title: Deliver presenter-hosted two-player Connect 4
status: To Do
assignee: []
created_date: '2026-08-26 10:40'
labels:
  - presentation
  - connect4
  - realtime
dependencies: []
references:
  - >-
    https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
  - 'https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/'
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a green-field, ephemeral browser game in this directory for one presenter-led session. A presenter starts the complete experience with one command, projects the canonical board and QR code, and admits the first two phone participants as Red and Yellow. The game uses a temporary TryCloudflare HTTPS URL, in-memory state, WebSockets, server-authoritative rules, and hard five-second turns where a timeout skips the turn. Exclude accounts, persistence, multiple rooms, production deployment, analytics, and speculative hardening.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One documented host command starts the built local app and temporary TryCloudflare tunnel, opens or clearly prints the protected presenter view, and shows a scannable public QR URL
- [ ] #2 Exactly two participants can claim seats, play a rules-correct Connect 4 round from phones, and see synchronized state on the projected presenter board
- [ ] #3 Every active turn has a server-authoritative five-second deadline; a missed deadline records a round-local strike and passes the turn without placing a piece
- [ ] #4 Wins score one point, draws score none, the winning line is shown, and a new round starts automatically after five seconds with the starting color alternated
- [ ] #5 The delivered scope remains one temporary in-memory match with no rooms, database, accounts, production deployment, or unrelated test infrastructure
<!-- AC:END -->
