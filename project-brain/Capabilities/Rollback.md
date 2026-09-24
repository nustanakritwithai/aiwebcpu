---
type: capability
id: rollback
status: documented-verified
provider: TestGE
reuse_policy: prefer-reuse
---

# Rollback

ย้อน canonical world ไปยัง state ก่อนหน้าโดยอาศัย transaction/delta history

## Provider

[[Projects/TestGE]]

## Related

- [[Capabilities/Replay]]
- Canonical Snapshot
- Unified Delta Log
- Atomic Commit

## Candidate Consumer

[[Projects/Simclone]]

## Evidence

TestGE README ระบุ checkpoint, multi-step rollback, replay และ time-travel audit ใน TWA V1

## Reuse Decision

สำหรับ goal ที่ต้อง rollback world state:
**SEARCH TestGE FIRST**

## Compatibility

Direct reuse: UNKNOWN  
Adapter reuse: candidate
