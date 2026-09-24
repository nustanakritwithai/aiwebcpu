---
type: integration
id: simclone-testge-time-travel
status: planned
decision: ADAPT
source_project: TestGE
target_project: Simclone
updated: 2026-09-24
---

# Integration — Simclone × TestGE Time Travel

## Executive Result

**Decision: ADAPT**

- Direct reuse ของ `TestGE/src/twa-history.js` ใน Simclone: **VIOL**
- Reuse แนวคิด/contract ของ TestGE rollback + replay: **SAT**
- Simclone มี deterministic save/restore continuation ที่เป็นฐานของ adapter: **SAT**
- Implementation ของ time-travel adapter: **UNKNOWN**

## Why direct reuse fails

TestGE history ทำงานกับ world model เฉพาะของ TWA:

- TypedArray fields: `id generation version type active team x y vx vy radius mass hp`
- delta records ถูกสร้างผ่าน Proposal → Verify → Commit
- rollback/replay ใช้ `ARRAY_FIELDS` และ `deltaLog`
- mutable field verifier รองรับชุด field ของ TWA เท่านั้น

Simclone ใช้ authoritative state แบบ nested object และ `step()` เปลี่ยน state โดยตรง:

- agents: needs, task, trace, skill, provenance, lifecycle, death, memory, appearance
- stock / buildings / resource nodes / archive / events / counters
- save schema + migration rules
- player commands `CLONE` / `BUILD`

ดังนั้น map เฉพาะ x/y/hp เข้า TestGE จะ **ไม่ใช่ whole-world rollback** และทำให้ state ส่วนอื่นไม่ย้อนตาม

ดูปัญหา: [[../Issues/Simclone-TestGE-State-Model-Mismatch]]

## What can be reused

จาก TestGE:

1. checkpoint contract
2. bounded history
3. rollback → redo stack
4. round-trip verification
5. state hash before/after
6. canonical command/event idea
7. explicit audit trail

จาก Simclone:

1. `serialize(world)`
2. `restore(text)`
3. deterministic `step(world, count)`
4. strict `validate(world)`
5. save migration rules
6. existing determinism test

## Recommended V0 adapter

ไม่ rewrite Simclone engine เป็น TWA ตอนนี้

ใช้ **Serialized Snapshot Adapter**:

```text
Simclone World
   ↓ serialize
Checkpoint
   ↓
Bounded Snapshot History
   ↓
restore(checkpoint)
   ↓
Replay canonical commands + deterministic ticks
   ↓
serialize/hash comparison
   ↓
SAT / VIOL / UNKNOWN
```

### Required additions

- `TemporalHistory` wrapper ที่ไม่แก้ game rules
- bounded checkpoint ring
- canonical command journal สำหรับ Influence actions เช่น CLONE / BUILD
- deterministic world hash จาก serialized canonical state
- explicit preview/commit policy: time travel ห้ามเขียนทับ browser save อัตโนมัติ
- version pin: engine/save schema ต่อ checkpoint

## Important discovery

Simclone `events` **ไม่ใช่ replay log** ตาม AGENTS.md

ดังนั้นถ้าต้องการ replay ที่รวม player actions ต้องเพิ่ม command journal แยกจาก event feed

Autonomous ticks สามารถ replay จาก checkpoint ได้เพราะ engine มี deterministic continuation test แต่ manual commands ต้องมี canonical input history

## Compatibility Matrix

| Concern | TestGE | Simclone | Result |
|---|---|---|---|
| deterministic execution | yes | yes | SAT |
| checkpoint concept | native | serialize/restore candidate | ADAPT |
| rollback storage | per-field delta | no replay history | ADAPT |
| replay inputs | canonical input log | no canonical command journal | GAP |
| state model | TypedArray fixed fields | nested domain state | VIOL direct reuse |
| mutation model | proposal/commit | direct authoritative mutation | VIOL direct reuse |
| state validation | verifier | validate() | reusable pattern |
| persistence/versioning | engine checkpoint | strict save schema/migrations | ADAPT |
| whole-world rewind | native for TWA fields | not implemented | UNKNOWN |

## Implementation Plan

### P0 — Contract
Define `TemporalHistoryAdapter` around Simclone's existing serialize/restore/validate.

### P1 — Checkpoint + rollback
Create bounded checkpoints and restore an earlier world without persistent-save side effects.

### P2 — Canonical command journal
Record player influence commands with tick + payload + sequence.

### P3 — Replay
Restore checkpoint then replay ticks + commands in deterministic order.

### P4 — Verify
Compare canonical serialized hash before rollback and after replay round-trip.

### P5 — UI
Add read-only timeline preview first. Explicit confirmation is required before replacing the active world.

## Success Contract

- rollback restores the full Simclone world, not only position/HP
- replay round-trip produces identical canonical hash
- player commands replay at exact ticks and order
- current save schema remains valid
- corrupt/unsupported snapshots fail closed
- browser persistent save is not overwritten during preview
- history is bounded
- all existing Simclone tests remain green

## Evidence inspected

TestGE main:
- `src/twa-engine.js` blob `26aaa90b71633c61c8c01ccde34772963e21c890`
- `src/twa-core.js` blob `dae27c1fc62b6b70335534b478b9030b2fb9f57a`
- `src/twa-history.js` blob `bed50c45a65cd4ec51d5dac0bc970cafcb6baead`

Simclone main:
- `src/engine.mjs` blob `dc0d6d59c1acb388faf6a6d691dcee1a716de73c`
- `tests/engine.test.mjs` blob `c59bc5c2b144967d149f6fc63366d4f0e22e5a37`
- current main includes V0.4.0 skill provenance commit `6db08b9f5fbaa01e96018667f351924770247b3b`

## Project Brain verdict

**Do not BUILD rollback from zero.**  
**Do not directly import TWA history as-is.**  
**ADAPT the verified TestGE history contract to Simclone's deterministic serialized world.**
