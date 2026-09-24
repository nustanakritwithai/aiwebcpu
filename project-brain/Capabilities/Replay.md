---
type: capability
id: replay
status: documented-verified
provider: TestGE
reuse_policy: prefer-reuse
---

# Replay

สร้าง state progression ซ้ำจาก deterministic history / canonical input-event log

## Provider

[[Projects/TestGE]]

## Related

- [[Capabilities/Rollback]]
- Canonical Input / Event Log
- Unified Delta Log

## Candidate Consumer

[[Projects/Simclone]]

## Evidence

TestGE README ระบุ rollback/replay และ canonical input/event log ใน TWA V1

## Compatibility

Semantic compatibility กับ Simclone: UNKNOWN จนกว่าจะ map state/action contract
