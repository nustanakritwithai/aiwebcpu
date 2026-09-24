# Project Brain V0.6.8 — Pocket × Pirate release closure

## Completed scope

The current vitals/economy integration pair is merged, the reviewed native dependency is bundled, and the existing Pages/Firebase deployment gates passed. This does not declare the entire game roadmap complete or activate unrelated production write flags.

| Layer | Exact evidence | Result |
|---|---|---|
| Pirate PR #168 | reviewed `c8c725e8a12e6723a8015e74566965ae18218ff2`; merged `eeec6e626e7b542d2229ffd909ffb5c015c2f111` | Merged; client/server, renderer and audio CI SAT |
| Pocket PR #632 | reviewed `94ab7ba4cdae44da5cd23ad38369eb6a045fa53e`; merged `f7f243d21906d9fa26127529313b441b4b938ce0` | Merged; all four selected PR gates SAT |
| Cross-repo behavior and artifact | [run 36072889289](https://github.com/nustanakritwithai/aiwebcpu/actions/runs/36072889289) | SAT; eight real-module groups plus native hash and release regressions |
| Pocket Pages + Firebase launcher | [run 36073170000](https://github.com/nustanakritwithai/PocketMonster/actions/runs/36073170000) | Both deploy jobs and post-deploy checks SAT |
| Pirate post-merge client/server | [run 36071876211](https://github.com/nustanakritwithai/Pirate-fruit-/actions/runs/36071876211) | SAT |
| Project Brain evidence materialization | [run 36073667450](https://github.com/nustanakritwithai/aiwebcpu/actions/runs/36073667450) | Actual API data captured; 136/136 tests SAT |
| Authenticated production gameplay | No live-account transaction test was performed | UNKNOWN |

## Runtime repairs

The MP quickslot path previously bypassed server vitals authority and consumed an item locally. Both HP and MP now use the authoritative operation path: accepted, rejected, missing and failed ACKs do not create a second local inventory or vitals writer. Public hotkey-path tests cover pending-request deduplication and preserve offline behavior.

Pocket's parent ingress rejects contradictory death/HP values, zero max HP, malformed respawn values and empty respawn identities before relaying to the native receiver.

The new native build changed minified identifiers. The presence test fixture now locates the exact island table/coordinate projection semantics without hardcoding one minifier's variable names. Release source and artifact hash pins remain exact; no verifier was disabled.

## Actual shipped native dependency

- Source: `c8c725e8a12e6723a8015e74566965ae18218ff2`.
- Entry: `pirate-fruit-offline/assets/index-D3UrpAn_.js`.
- SHA-256: `1e79f3e0dae4c2b8865aae6393e30f43517ffe5982dd125d77beb4f2a9703f4e`.
- Existing save sandbox, input, presentation and fullscreen hooks are preserved.

## Project Brain map

Open the canonical node `integration:pocketmonster-pirate-fruit`, or either project node. The Release Evidence panel shows merged code, current-head CI, real-module pair verification, native artifact, backend preflight, Pages/Firebase deployment and the separate UNKNOWN live-gameplay scope.

The nine field/message groups describe request direction, writer, validator/relay, commit owner and boundary:

1. `pirate-vitals/1`
2. `respawn`
3. `vitalsInput`
4. Potion / skill / buff operations
5. `pirate-original-state/1`
6. `tradeQuote`
7. `trade`
8. Monster intent / original-world results
9. Private player-hit preview / ACK

The timeline now includes the V0.6.8 knowledge checkpoint. The old structural pair remains archived with its original source pins; it is not relabeled as proof for the new release. `reuseDecision` remains UNKNOWN.

## Limits and operations

The behavioral gate executes actual producer/domain/relay/receiver modules but injects the HTTP/CAS host. Backend health/version and successful static deployment do not prove live authenticated gameplay transactions or an external host's new worker activation.

No server credentials, database settings or production feature flags were changed. Only the current PR pair was merged; unrelated historical PRs remain untouched. One-time branch/source materialization workflows were removed after their bounded jobs completed. Read-only verification workflows and reproducible generation scripts remain available.

A dedicated browser regression checks the Project Brain map against repository assets at desktop/mobile viewport sizes. Its result is separate from physical Android or live-site browser testing.
