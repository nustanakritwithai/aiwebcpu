---
type: issue
id: simclone-testge-state-model-mismatch
status: confirmed
severity: integration-blocker
verdict: VIOL
updated: 2026-09-24
---

# Issue — Simclone/TestGE State Model Mismatch

## Claim

`TestGE/src/twa-history.js` ไม่สามารถใช้เป็น whole-world rollback ของ Simclone แบบ direct reuse ได้

## Evidence

### TestGE

TWA state history ผูกกับ `ARRAY_FIELDS`:

```text
id generation version type active team
x y vx vy radius mass hp
```

History applies forward/backward deltas to fields เหล่านี้ และ delta records เกิดจาก TWA commit pipeline

### Simclone

authoritative world มี state เพิ่มอีกจำนวนมาก:

```text
rng
agents[]
  satiety energy
  task trace
  skills skillProvenance
  bornTick life death
  memory appearance
stock
nodes
buildings
archive
events
stats
nextAgent / nextEvent / nextBuilding
```

และ `step()` เปลี่ยนค่าเหล่านี้โดยตรง ไม่ได้สร้าง TWA WriteSet

## Verdict

**VIOL — direct module compatibility**

ถ้าใช้ TWA history โดย map เฉพาะ fields ที่ตรงกัน ผลลัพธ์จะไม่ใช่ Simclone world rollback ที่ถูกต้อง

## Resolution

ใช้ [[../Integrations/Simclone-TestGE-TimeTravel]]:

- reuse contract
- adapt storage to serialized Simclone snapshots
- add canonical command journal
- verify full-state round trip

## Close Condition

Issue นี้ปิดได้เมื่อ generic history contract รองรับ arbitrary canonical state หรือ Simclone adapter ผ่าน full-state rollback/replay tests โดยไม่ rewrite core game rules
