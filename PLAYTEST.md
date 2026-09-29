# Live playtest — September 28, 2026

Three `gpt-6-luna` agents played separate seats in a public four-player room while a fourth seat was driven by a small client. Every seat called the same Convex `games:get` and `games:act` endpoints as the browser. Actions and sanitized state were logged after each response. We also drove an eight-player room and a separate post-fix three-player room through the public API.

## Sessions

| Room | Seats | Coverage | Result |
| --- | ---: | --- | --- |
| `DRSQQL` | 4 | Three independent agents plus one client; setup, normal turns, building, cities, bank and player trades, development cards, sevens, discard, robber, steal, and timeout pressure | Completed at turn 71; Root won with 9 points. 283 action attempts, 281 successes, 2 errors |
| `QBUGGK` | 8 | 16 opening settlement/road pairs, two clockwise rounds, 69 successful actions, discard, robber, steal | Passed; an idle turn advanced on the scheduled timeout |
| `Z8ZVCA` | 3 | Post-fix API smoke: 21 actions through setup and one round, including a seven, discard, robber, steal, and action-ID replay | Passed |

The post-fix smoke test repeated its first action ID and confirmed that the settlement was placed once. A separate stale-clock request returned `stale` without changing the game. A production browser check opened a live room and the rules guide with no page error. The four-player game reached `status=finished`; every seat saw the winning state. The winning player had hidden victory cards, so other seats saw six visible points while the game log reported nine total.

All three rooms were deleted after their results were recorded. Public queries returned `null` for each code.

## Failures found

Both server failures are recorded in [the error log](playtests/2026-09-28-errors.jsonl).

1. On turn 21, Luna 2's `end` action returned a generic server error. Convex logged an optimistic concurrency conflict between `games:act` and the scheduled timeout. The timeout moved the game to turn 22 and cleared the offer.
2. On turn 50, Luna 3's bank trade raced a separate `end` from the same test seat. Convex logged a conflict with another `games:act`. The trade did not apply; a later legal bank trade succeeded.
3. In the browser, Road Building offered only roads legal before its first free road. A connected second road could not be selected. This was found in code review during the playtest and reproduced in a rule test.

The first-settlement resource grant is an intentional quickplay rule, documented in the app. An early delay at `steal` was a test runner condition error; the server accepted the steal once the runner sent it.

## Changes made

- `games:act` accepts an action ID and expected clock sequence. Replayed IDs cannot apply twice. Changed or expired turns return explicit statuses. The browser retries a generic server failure once with the same ID and explains a stale or expired turn.
- The browser accepts only one pending action at a time from the same tab.
- Road Building previews the board after its first free road, highlights valid second roads, and clears the selection when the player changes actions or turns.
- The public game state exposes the number of development cards remaining, while their identities stay hidden. The purchase button is disabled when the deck is empty or the player cannot pay.
- `npm run test:live` is a reusable public-API smoke test. It drives 3–8 seats, writes sanitized JSONL, and checks replay protection.

## Verification and limits

`npm test` passed 15 rule tests; the randomized suite passed five additional runs. `npm run build` passed. The eight-player public-API run passed 69 actions and the post-fix three-player run passed 21.

The four-player bot match lasted 21 minutes and 18 seconds over 71 turns. That is a measured limit of the current quickplay pace even with active players.

API latency varied from under a second to roughly 20 seconds during simultaneous games. The Convex container answered a local version request in under a millisecond, while the shared hard drive reached about 94–100% utilization during a slow interval. Convex and a write-heavy ClickHouse service both store data on that drive. We did not change the other service or move Convex data from the requested hard-drive bind mount.
