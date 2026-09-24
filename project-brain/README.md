# Project Brain

Project Brain คือ shared knowledge system สำหรับคนและ AI โดยมี **Web Viewer เป็น Human Interface หลักเพียงตัวเดียว**

## Architecture

```text
GitHub repos
    ↓
project-brain/graph/project-brain.json
    ├─→ Project Brain Web Viewer
    └─→ query.mjs → AI / Agent
```

- GitHub repositories = source of truth ของ code และ evidence
- `project-brain/graph/project-brain.json` = canonical machine-readable Knowledge Graph
- `/brain/` = human-readable Web Viewer
- `project-brain/query.mjs` = query layer สำหรับ AI / Agent / automation
- Markdown ใน `project-brain/` = architecture notes และ evidence context บน GitHub

Project Brain **ไม่ใช้ Obsidian, local Vault หรือ mobile sync เป็นส่วนของระบบแล้ว**

## Decision Rule

```text
NEED
  ↓
SEARCH EXISTING CAPABILITY
  ↓
REUSE → ADAPT → BUILD
  ↓
VERIFY
  ↓
SAT / VIOL / UNKNOWN
  ↓
UPDATE PROJECT BRAIN
```

UNKNOWN ไม่ใช่ PASS และ Agent บอกว่าเสร็จไม่ถือเป็นหลักฐาน

## Current Scope

Projects:
- [aiwebcpu](Projects/aiwebcpu.md)
- [TestGE](Projects/TestGE.md)
- [AstraLife](Projects/AstraLife.md)
- [Simclone](Projects/Simclone.md)

First cross-repo proof:
- [Simclone Time Travel](Goals/Simclone-Time-Travel.md)
- [Simclone × TestGE Time Travel](Integrations/Simclone-TestGE-TimeTravel.md)

## Web Viewer

Live path:

```text
/brain/
```

Viewer อ่าน canonical graph เดียวโดยตรง ไม่มีฐานความจริงซ้ำ

ฟีเจอร์ปัจจุบัน:
- typed Knowledge Graph
- relation labels
- search / presets / focus mode
- evidence inspection
- Temporal Graph slider
- historical deep links ด้วย `?at=<checkpoint-id>`
- node deep links ด้วย `?node=<node-id>`

## Query Layer

```bash
node project-brain/query.mjs providers rollback
node project-brain/query.mjs capability replay
node project-brain/query.mjs goal "Simclone ย้อนเวลาได้"
node project-brain/query.mjs integration "Simclone TestGE"
node project-brain/query.mjs node AstraLife
node project-brain/query.mjs checkpoints
node project-brain/query.mjs snapshot pb-2026-09-24-compat
```

ผลลัพธ์เป็น JSON เพื่อให้ Agent ใช้งานต่อได้โดยไม่ต้อง scrape หน้าเว็บ

## Temporal Graph V0.3

อ่านรายละเอียดที่ [Temporal-Graph.md](Temporal-Graph.md)

`activeFrom` / `activeUntil` บอกช่วงที่ความรู้นั้นมีผลใน Project Brain ไม่ได้อ้างว่าเป็นวันที่ capability ถูกสร้างจริง

## Interface Policy

ดู [Web-Only.md](Web-Only.md)

Project Brain ใช้ **Web-only human interface** เพื่อให้มี UI เดียว, source เดียว และลดภาระ sync ระหว่างเครื่อง
