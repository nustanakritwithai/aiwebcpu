---
type: project
repo: nustanakritwithai/TestGE
status: v1
role: authoritative-world-runtime
source_of_truth: https://github.com/nustanakritwithai/TestGE
---

# TestGE

Transactional World Architecture (TWA): deterministic, transactional, verifiable authoritative world runtime

## Provides

- World state / canonical snapshot
- [[Capabilities/Rollback]]
- [[Capabilities/Replay]]
- Atomic commit
- Unified delta log
- Time-travel audit
- Delta replication
- Client prediction / reconciliation

## Architecture

```text
Input
→ Canonical Snapshot
→ Compute
→ Proposal / WriteSet
→ Deterministic Conflict Resolution
→ Verification
→ Atomic Commit
→ Delta Log
```

## Project Brain Role

Provider หลักสำหรับ world truth, transaction, rollback/replay และ replication

## Evidence

README ระบุ TWA V1 feature set และ Browser Regression Suite

## Reuse Policy

ควรค้น TestGE ก่อนสร้าง world transaction / rollback / replay ใหม่

## Confidence

documented capability: SAT  
compatibility กับ consumer repo: UNKNOWN จนกว่าจะทำ adapter test
