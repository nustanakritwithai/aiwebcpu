---
type: project-brain-architecture
status: active
updated: 2026-09-24
decision: WEB_ONLY
---

# Web-only Human Interface

Project Brain ใช้ **Web Viewer เป็น Human Interface เพียงตัวเดียว**

## Why

การมีทั้ง Web Viewer และ local note vault ทำให้เกิดสอง presentation surfaces ที่ต้อง sync และตรวจความสดของข้อมูลแยกกัน

Project Brain จึงลด architecture เป็น:

```text
GitHub repos / evidence
          ↓
 canonical project-brain.json
       ┌──┴────────────┐
       ↓               ↓
   Web Viewer       query.mjs
       ↓               ↓
     Human          AI / Agent
```

## Removed from product architecture

- local note vault
- device-specific sync
- `pb-sync`
- shared-storage copy
- local UI settings as a required Project Brain component

Markdown filesใน `project-brain/` ยังอยู่ เพราะเป็น architecture/evidence documents ใน GitHub ไม่ใช่ local UI database

## Web contract

- canonical data: `project-brain/graph/project-brain.json`
- human UI: `/brain/`
- agent query: `project-brain/query.mjs`
- source of truth: GitHub repos + verified evidence
- no second human-facing data store

## Mobile

มือถือยังใช้งาน Project Brain ได้ผ่าน browser ที่หน้า Web Viewer แต่ไม่มี mobile-specific knowledge store หรือ sync workflow
