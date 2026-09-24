# Project Brain — Obsidian Vault V0.1

โฟลเดอร์นี้คือ Human Interface ของ Project Brain สำหรับอ่านร่วมกันระหว่างคนและ AI

## หลักการ

GitHub = source of truth ของ code  
Obsidian = human-readable knowledge map  
project-brain/graph/project-brain.json = machine-readable graph seed  
AI/Agent = อ่าน ค้นหา วางแผน และอัปเดตความรู้หลัง Verify

กฎก่อนสร้างของใหม่:

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

## เปิดใน Obsidian

Clone repo นี้ แล้วเลือกโฟลเดอร์ `project-brain` เป็น Vault ได้ทันที ไม่ต้องใช้ community plugin สำหรับ V0.1

เริ่มที่ [[00-Home]]

## V0.1 Scope

เริ่มจาก 4 โปรเจกต์:
- [[Projects/aiwebcpu]]
- [[Projects/TestGE]]
- [[Projects/AstraLife]]
- [[Projects/Simclone]]

Proof แรก:
- [[Goals/Simclone-Time-Travel]]

หมายเหตุ: ข้อมูล capability เป็น registry สำหรับการค้นหาและวางแผน ไม่ได้หมายความว่า module จากแต่ละ repo เชื่อมกันได้โดยตรงจนกว่าจะผ่าน compatibility check และ verification


## Query Layer

Project Brain V0.1 มี CLI แบบ dependency-free สำหรับ Agent/automation:

```bash
node project-brain/query.mjs providers rollback
node project-brain/query.mjs capability replay
node project-brain/query.mjs goal "Simclone ย้อนเวลาได้"
node project-brain/query.mjs integration "Simclone TestGE"
node project-brain/query.mjs node AstraLife
```

ผลลัพธ์เป็น JSON เพื่อให้ Agent ใช้ต่อได้โดยไม่ต้อง scrape Obsidian Markdown

หลักสำคัญ: Query layer อ่าน `graph/project-brain.json` ซึ่งเป็น machine view เดียวกับ Knowledge Graph ไม่สร้างฐานความจริงอีกชุด
