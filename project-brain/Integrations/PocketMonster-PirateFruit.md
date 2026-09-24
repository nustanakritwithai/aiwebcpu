# PocketMonster × Pirate Fruit — Cross-Project Deep Dive V0.6.3

Status: **CANDIDATE / individual exact-head gates SAT / paired gate PENDING**

This report is a source-evidence overlay. It does not declare the draft pair merged, deployed or reusable.

## Merged baseline

- PocketMonster main: `cf902e7410e8d67efa5a004d085dd7b7c858d2df` — Pages workflow SAT.
- Pirate Fruit default branch: `d20096d1720ec25a4c219fdc0e44b8373684e369` — client/server gate SAT.
- The merged baseline already carries Pirate original-world monster/PvE results through the Pocket parent shell and keeps Pirate account/save operations session-bound.

## Candidate pair

### PocketMonster PR #632
- head: `ba1347d8537519543669273c7964d8c6079c57b2`
- draft: yes
- exact-head gate: **SAT**
- verification: Monster controls, world continuity, Studio integration and real-browser acceptance are SAT on the exact head.

### Pirate Fruit PR #168
- head: `f08ed860162fb27d33332c8d31d1c1f3d4cbb32d`
- draft: yes
- exact-head gate: **SAT**
- verification: build, server smoke, unit tests, extended economy test, browser smoke, renderer and audio gates are SAT on the exact head.

## Authority flow

```text
Pirate native scene
  ├─ transient block / mounted / sprinting intent
  ├─ bounded state / trade operations
  ▼
Pocket parent shell
  ├─ owns launch-session binding and iframe isolation
  ├─ validates envelopes
  └─ DOES NOT own Pirate gameplay truth
  ▼
Pirate central server
  ├─ shared monster world
  ├─ player hit CAS preview/ack
  ├─ canonical player vitals (candidate)
  ├─ central market quote/execute (candidate)
  └─ persistence / revision / idempotency
  ▼
Pocket parent validates/relays server result
  ▼
Pirate scene presents authoritative result
```

## Single-writer boundaries

- Monster species/progression/collection: **Pocket Monster**.
- Human/Pirate progression/inventory/boats/quests: **Pirate Fruit**.
- Shared monster world execution: **Pirate central server worker**.
- Pirate HP/guard/energy/MP: **Pirate server candidate**; Pocket only transports the snapshot.
- Cross-world session/iframe transport: **Pocket parent shell**.
- Living economy market mutation: **Pirate central market candidate**.

## Candidate vitals contract

`pirate-vitals/1` carries revisioned HP, max HP, guard, energy, MP, death and optional respawn state. The Pirate receiver is fail-closed: once server authority is claimed, malformed or stale packets do not restore local vitals authority.

## Candidate market contract

Pocket sanitizes `tradeQuote` / `trade` operations. Pirate loads the bundled EconomyEngine from the canonical market document, calculates the trusted server quote, applies the player/market projection with idempotency receipts, and returns `nextMarket` for the outer transaction.

## Promotion gates

1. Individual exact-head gates are SAT for Pocket #632 and Pirate #168.
2. Run the composed cross-repo gate pinned to Pocket `ba1347d8…` + Pirate `f08ed860…`.
3. Prove server → Pocket parent → Pirate vitals and Pirate → parent → server transient input at the pinned pair boundary.
4. Keep stale revision, duplicate idempotency, reconnect, session change and respawn retry fail-closed.
5. Only after paired SAT and integration review may the candidate authority changes be promoted into the canonical graph.

Individual SAT is not paired SAT. UNKNOWN/VIOL is not PASS.
