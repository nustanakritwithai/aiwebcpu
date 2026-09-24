---
type: project-brain-architecture
version: 0.3
status: verified
updated: 2026-09-24
---

# Temporal Knowledge Graph

Project Brain V0.3 เพิ่มมิติ **เวลา** ให้ Knowledge Graph

## ความหมายของเวลา

`activeFrom` / `activeUntil` หมายถึง:

> ช่วงที่ข้อเท็จจริงหรือความสัมพันธ์นั้นปรากฏอยู่ใน **knowledge state ของ Project Brain**

ไม่ใช่การอ้างว่า underlying software/capability ถูกสร้างจริงในวันนั้น

เหตุผลคือ Project Brain ต้องแยก:

- เวลาที่ระบบจริงเกิดขึ้น
- เวลาที่เราพบหลักฐาน
- เวลาที่ Project Brain รับความรู้นั้นเข้ากราฟ

V0.3 บันทึกอย่างหลังเพื่อไม่สร้างประวัติเท็จ

## Checkpoints

แต่ละ checkpoint มี:

- id
- date
- label
- description
- source

Node และ Edge ใช้:

```text
activeFrom
activeUntil (optional, exclusive)
```

Node สามารถเปลี่ยน property ตามเวลาได้ด้วย `temporalStates`

ตัวอย่าง Goal:

```text
Project Brain V0.1
Simclone Time Travel
decision = UNKNOWN
        ↓ compatibility analysis
decision = ADAPT
```

## Viewer

Web Viewer ใช้ slider เพื่อ materialize graph ณ checkpoint:

```text
Checkpoint
  ↓
Active Nodes
  ↓
Active Edges
  ↓
Temporal Property State
  ↓
Rendered Graph
```

URL รองรับ `?at=<checkpoint-id>` เพื่อ share historical view ได้

## Query

```bash
node project-brain/query.mjs checkpoints
node project-brain/query.mjs snapshot pb-2026-09-24-bootstrap
node project-brain/query.mjs snapshot pb-2026-09-24-compat
```

## Verification

- UNKNOWN ไม่ใช่ PASS
- interval ต้องอ้าง checkpoint ที่มีจริง
- `activeUntil` เป็น exclusive และต้องอยู่หลัง `activeFrom`
- temporal property ranges ห้าม overlap


## Verified release

- Merge commit: `d4e41bbf071a86f0f34d9e4e3675ade9e2526fd1`
- Project Brain CI: SAT
- Temporal schema/query/viewer contract: SAT
- Current checkpoint: `pb-2026-09-24-temporal-v03`
