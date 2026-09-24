---
type: project-brain-home
version: 0.3
status: active
updated: 2026-09-24
interface: web-only
---

# Project Brain

> โปรเจกต์ใหม่ไม่เริ่มจากศูนย์ แต่ต่อยอดจาก capability และ evidence ที่มีอยู่แล้ว

## Projects

- [aiwebcpu](Projects/aiwebcpu.md)
- [TestGE](Projects/TestGE.md)
- [AstraLife](Projects/AstraLife.md)
- [Simclone](Projects/Simclone.md)

## Core Capabilities

- [Verification](Capabilities/Verification.md)
- [Rollback](Capabilities/Rollback.md)
- [Replay](Capabilities/Replay.md)
- [Agent Learning](Capabilities/Agent-Learning.md)

## Active Goal

- [Simclone Time Travel](Goals/Simclone-Time-Travel.md)

## Temporal Graph

- [Temporal Knowledge Graph](Temporal-Graph.md)
- [Web-only Interface Decision](Web-Only.md)

Project Brain V0.3 สามารถย้อนดู knowledge state ตาม checkpoint ผ่าน Web Viewer ได้

## First Cross-Repo Analysis

- [Simclone × TestGE Time Travel](Integrations/Simclone-TestGE-TimeTravel.md)
- [State Model Mismatch](Issues/Simclone-TestGE-State-Model-Mismatch.md)

```text
Need: Simclone time travel
↓
Found: TestGE rollback / replay
↓
Direct reuse: VIOL
Architecture reuse: SAT
↓
Decision: ADAPT
↓
TemporalHistory adapter
```

## Decision Rule

```text
Goal
↓
Need Capability
↓
Search Graph
↓
REUSE / ADAPT / BUILD
↓
Compatibility Check
↓
Verify
↓
Update Brain
```

## Verification Language

- **SAT** — มีหลักฐานเพียงพอว่า contract ผ่าน
- **VIOL** — พบหลักฐานว่าขัด contract
- **UNKNOWN** — หลักฐานยังไม่พอ ห้ามนับว่า PASS

## Canonical Graph

`graph/project-brain.json`

Node:
Project • Capability • Evidence • Goal • Issue • Integration • Version

Relation:
PROVIDES • NEEDS • VERIFIED_BY • USED_IN • DEPENDS_ON • BLOCKED_BY • ADAPTED_FROM • SUPERSEDES
