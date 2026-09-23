---
type: project-brain-home
version: 0.1
status: bootstrap
updated: 2026-09-24
---

# Project Brain

> โปรเจกต์ใหม่ไม่เริ่มจากศูนย์ แต่ต่อยอดจากของที่มีอยู่แล้ว

## Projects

- [[Projects/aiwebcpu]]
- [[Projects/TestGE]]
- [[Projects/AstraLife]]
- [[Projects/Simclone]]

## Core Capabilities

- [[Capabilities/Verification]]
- [[Capabilities/Rollback]]
- [[Capabilities/Replay]]
- [[Capabilities/Agent-Learning]]

## Active Goal

- [[Goals/Simclone-Time-Travel]]

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
Verify
↓
Update Brain
```

## Verification Language

- **SAT** — มีหลักฐานเพียงพอว่า contract ผ่าน
- **VIOL** — พบหลักฐานว่าขัด contract
- **UNKNOWN** — หลักฐานยังไม่พอ ห้ามนับว่า PASS

## Knowledge Graph

Machine seed: `graph/project-brain.json`

Node หลัก:
Project • Capability • Evidence • Goal • Issue • Integration • Version

Relation หลัก:
PROVIDES • NEEDS • VERIFIED_BY • USED_IN • DEPENDS_ON • BLOCKED_BY • ADAPTED_FROM • SUPERSEDES
