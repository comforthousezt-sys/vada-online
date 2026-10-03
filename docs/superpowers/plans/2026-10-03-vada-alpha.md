# VADA Online Alpha Implementation Plan

Goal: ship a complete testable VADA match and HOSTiQ client with an independently deployable Render room server.

Architecture: one shared TypeScript rules engine, React HTML controls and Babylon.js scene. Render owns authoritative WebSocket commands; a private Postgres schema stores room snapshots and accepted operation IDs. HOSTiQ serves prebuilt static files.

Spec: approved VADA_Online_Masterplan_UA_2026-10-03.docx, with HOSTiQ replacing Vercel as explicitly requested. Native execution in this session; test domain invariants before implementation.

Global constraints: five archetypes, 12 assets, 20 route tiles, 10 shared turns/day, six sessions, strict majority of all members, voting only at parliament, 400 starting coins, two influence, four cards and two secret objectives. No payments or cloud writes during packaging.

Review focus: secret projection leakage; duplicate/stale commands; restart persistence; missed votes and turn order; financial trades with changed resources.

## Task 1: rules and content
Files: shared/types.ts, content.ts, engine.ts, bot.ts, tests/engine.test.ts.
Interfaces: createGame(players, seed, now, timers), applyCommand(state, playerId, command, now), tick(state, now), viewFor(state, playerId), chooseBotCommand(view).
- [x] Write and run failing domain tests for 10 turns, parliament attendance, goals, counteractions, trades and final score.
- [x] Implement deterministic serializable rules with versioned content.
- [x] Run all domain tests; simulate completed 3-, 4- and 5-player matches.

## Task 2: room server
Files: server/rooms.ts, store.ts, index.ts, tests/server.test.ts.
Interfaces: room manager accepts authenticated commands, expected versions and operation IDs; stores before acknowledgment; serializes work per room.
- [x] Test personalized views, replayed operations, stale writes, rejected origins and restart resume.
- [x] Implement hashed resume credentials, CORS/WS origin validation, bounded messages, timeouts, bot actions and durable snapshots.
- [x] Verify multi-client flow and restart using local storage; verify Postgres if a test instance is available.

## Task 3: browser client
Files: web/src, tokens.css, styles.css.
- [x] Build menus, creature choice, local continuation, private lobby, map, cards, parliament, chat, trade and match report.
- [x] Build procedural tabletop and five original NUMBRA; provide HTML fallback.
- [x] Verify desktop/phone, keyboard, reduced motion, offline and error states.

## Task 4: delivery
Files: render.yaml, RULES_UA.md, INSTALL_UA.md and release packages.
- [x] Build production assets with relative paths, separate HOSTiQ zip from source.
- [x] Produce Ukrainian instructions including client config, Render environment and Supabase connection.
- [x] Run clean install, tests, build and archive integrity checks; preserve exact results and feature status.

Ruling: the user has approved the masterplan and explicitly requested implementation. Proceed with reversible local work without another approval gate. Paid cloud provisioning remains outside this packaging task.

Verification note: all local tasks completed. 17 tests, 36 full bot matches, production browser flows, accessibility scans, official Blueprint JSON Schema validation and compiled server startup passed. No live PostgreSQL/Supabase/Render/HOSTiQ instance was provisioned or exercised; these remain explicit installation checks.
