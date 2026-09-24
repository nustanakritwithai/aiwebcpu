---
type: goal
id: simclone-time-travel
status: compatibility-analyzed
target_project: Simclone
decision: ADAPT
updated: 2026-09-24
---

# Goal — Simclone ย้อนเวลาได้

## Goal

เพิ่มความสามารถย้อน state / replay history ให้ [[Projects/Simclone]] โดยไม่สร้างระบบใหม่ถ้ามีของเดิมใช้ได้

## Needed Capabilities

- [[Capabilities/Rollback]]
- [[Capabilities/Replay]]
- [[Capabilities/Verification]]

## Search Result

Provider:
- [[Projects/TestGE]]

Compatibility analysis:
- [[../Integrations/Simclone-TestGE-TimeTravel]]

Confirmed blocker:
- [[../Issues/Simclone-TestGE-State-Model-Mismatch]]

## Current Decision

# **ADAPT**

### SAT

- TestGE มี rollback/replay contract และ public history implementation
- Simclone deterministic จาก seed และมี test ว่า save/restore mid-task เดินต่อแล้วได้ state เดียวกัน
- Simclone มี serialize / restore / validate ที่ใช้เป็น adapter boundary ได้

### VIOL

- TestGE `twa-history.js` ใช้ Simclone โดยตรงไม่ได้
- TestGE history ผูกกับ TypedArray state + TWA deltaLog/commit
- Simclone มี nested state และ mutation model คนละแบบ
- Simclone events ไม่ใช่ replay log

### UNKNOWN

- TemporalHistory adapter implementation
- command journal
- full rollback/replay round-trip
- browser timeline UX
- persistent-save interaction

## Selected Architecture

```text
TestGE verified history contract
          ↓ ADAPT
Simclone serialize/restore boundary
          ↓
Bounded checkpoints
          ↓
Canonical command journal
          ↓
Rollback / Replay
          ↓
Full-state hash verification
```

ห้าม rewrite Simclone ทั้ง engine ให้เป็น TestGE เพียงเพื่อเพิ่ม time travel

## Next Implementation

1. สร้าง TemporalHistory adapter
2. bounded checkpoint ring
3. command journal: tick + sequence + command + payload
4. rollback without persistent save mutation
5. replay deterministic ticks/commands
6. round-trip full-state hash test
7. run existing regression suite
8. update Knowledge Graph with actual implementation evidence

## Success Contract

- rewind แล้ว full world ตรงกับ checkpoint
- replay round trip ได้ canonical hash เดิม
- manual CLONE/BUILD replay ตาม tick/sequence
- save schema/migration เดิมไม่พัง
- corrupt history fail closed
- existing tests ยังผ่าน
- UNKNOWN ห้ามรายงานเป็น PASS

## Verification State

reuse discovery: SAT  
architecture compatibility by adaptation: SAT  
direct module reuse: VIOL  
implementation: UNKNOWN
