# PocketMonster × Pirate Fruit — Cross-Project Deep Dive V0.6.3

Status: **CANDIDATE / exact-head gates VIOL**

This report is a source-evidence overlay. It does not declare the draft pair merged, deployed or reusable.

## Merged baseline

- PocketMonster main: `cf902e7410e8d67efa5a004d085dd7b7c858d2df` — Pages workflow SAT.
- Pirate Fruit default branch: `d20096d1720ec25a4c219fdc0e44b8373684e369` — client/server gate SAT.
- The merged baseline already carries Pirate original-world monster/PvE results through the Pocket parent shell and keeps Pirate account/save operations session-bound.

## Candidate pair

### PocketMonster PR #632
- head: `ef84398e78471cad61c597dd4211d4f8dd7d128e`
- draft: yes
- exact-head gate: **VIOL**
- blocker: the Monster controls regression still expects `world-presence-protocol.mjs?v=7` while the candidate imports v8.

### Pirate Fruit PR #168
- head: `8842f808b3ac1aadf633f0f975812c7a800b8384`
- draft: yes
- exact-head gate: **VIOL**
- blocker: TypeScript build fails on the PlayerVitalsSkillAuthority callback signature and RemoteTrade test IslandId fixtures.

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

1. Repair both exact-head CI failures without weakening existing contracts.
2. Rerun PR #632 and PR #168 on their exact heads.
3. Add a composed cross-repo test pinned to both candidate SHAs.
4. Prove server → Pocket parent → Pirate vitals and Pirate → parent → server transient input.
5. Prove trade/vitals under stale revision, duplicate idempotency, reconnect, session change and respawn retry.
6. Only then promote authority changes into the canonical graph.

UNKNOWN/VIOL is not PASS.
