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


## GitHub Scanner V0.4

Project Brain มี deterministic GitHub Scanner สำหรับจับการเปลี่ยนแปลงของ repo ที่ติดตาม

```text
GitHub repos
   ↓
Mechanical Scan
   ↓
Candidate = UNKNOWN
   ↓
Verify
   ↓
Accepted scanner PR
   ↓
Semantic graph update (separate verified step)
```

Scanner อ่านอัตโนมัติได้เฉพาะ:
- HEAD SHA
- commit metadata
- tracked evidence-file SHA
- exact-head GitHub Actions result

Scanner **ห้าม** สรุป capability ใหม่, compatibility, REUSE/ADAPT/BUILD หรือ capability SAT จาก commit message/CI เพียงอย่างเดียว

ดู implementation ที่ [scanner/README.md](scanner/README.md)

Scheduled scan: ทุก 6 ชั่วโมง และเปิด/อัปเดต candidate PR เมื่อ state ต่างจาก accepted baseline


## Full Repository Catalog

Project Brain ดึง mechanical repository data ครบทั้งบัญชีแล้วที่:

[Catalog](catalog/README.md) · [repositories.json](catalog/repositories.json)

Discovery snapshot ปัจจุบัน:
- 37 repositories discovered by the connected account
- 33 public repositories persisted in Project Brain
- 30 public non-empty
- 3 public empty
- 4 private repositories omitted from the public dataset
- public exact-head CI: 16 SAT / 1 VIOL / 16 UNKNOWN

ตัวเลข SAT/VIOL ด้านบนคือ **workflow evidence เท่านั้น** ไม่ใช่ capability verdict

ทุก public repo ใน Catalog เริ่มด้วย `semanticStatus = UNKNOWN` และต้องผ่าน Verifier ก่อน promote capability เข้ากราฟ

Project Brain สาธารณะไม่ persist ชื่อ, commit metadata หรือ evidence ของ private repositories; ต้องมี authenticated private layer แยกต่างหากก่อน


## Repository Capability Inventory

[Inventory](capability-inventory/README.md) · [repositories.json](capability-inventory/repositories.json)

First semantic extraction pass:
- 33 public repositories represented
- 29 repositories with documented capabilities
- 4 repositories remain UNKNOWN
- 116 documented capability candidates

กฎสำคัญ:

```text
DOCUMENTED ≠ VERIFIED
DOCUMENTED ≠ REUSE
reuseDecision = UNKNOWN
```

Capability จะเข้า canonical graph เมื่อมี goal จริงแล้วผ่าน compatibility + verification เท่านั้น


## Verifier V0.5

[Verifier](verifier/README.md)

Goal-specific verification now sits between the Capability Inventory and canonical graph:

```text
Capability Inventory (DOCUMENTED)
        ↓
Goal Contract
        ↓
Verifier
        ↓
SAT / VIOL / UNKNOWN
        ↓
REUSE / ADAPT / BUILD
        ↓
Graph Patch Candidate
        ↓
Review
        ↓
Canonical Graph
```

Current proof:

```bash
node project-brain/verifier/verifier.mjs verify \
  --contract project-brain/verifier/contracts/simclone-time-travel.json
```

Agent query:

```bash
node project-brain/query.mjs verification simclone-time-travel
```

Rules:
- UNKNOWN is never PASS
- DOCUMENTED is not VERIFIED
- exact-head CI is not semantic proof by itself
- stale evidence SHA is VIOL
- missing capability is UNKNOWN
- graph patches are never auto-applied or auto-merged


## Complete Knowledge Graph Coverage V0.5.3

Canonical Knowledge Graph is now deterministically synchronized from:

```text
Repository Catalog (33 public repos)
        +
Capability Inventory (116 DOCUMENTED candidates)
        ↓
sync-catalog-inventory.mjs
        ↓
Canonical Graph
```

Current coverage:
- 33 public PROJECT nodes from the catalog
- 116 `CAPABILITY_CANDIDATE` nodes
- 42 unique documentation evidence-file nodes
- `DOCUMENTS` edges from repository → documented capability
- `DOCUMENTED_BY` edges from capability → evidence file

Semantic boundary:

```text
CAPABILITY_CANDIDATE.status = DOCUMENTED
reuseDecision = UNKNOWN
documentation evidence verdict = UNKNOWN
```

A documented capability is not promoted to the verified `CAPABILITY` layer until a goal-specific Verifier contract resolves it.

Sync:

```bash
node project-brain/graph/sync-catalog-inventory.mjs
node project-brain/graph/sync-catalog-inventory.mjs --check
```

CI runs `--check` and fails if the canonical Graph drifts from Catalog/Inventory.
