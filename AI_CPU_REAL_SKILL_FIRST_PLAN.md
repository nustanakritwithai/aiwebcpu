# AI CPU Web — Real Skill First Execution Plan

## สถานะการเปลี่ยนแผน

เอกสารนี้เป็นแผนดำเนินงานหลักถัดจาก V0.1 และ **แทนที่ลำดับเดิมที่ตั้งใจจะทำ Skill Match Inspector / Skill Editor / Skill Composition ก่อน**

เป้าหมายใหม่คือพิสูจน์แกนสำคัญที่สุดของ AI CPU ให้เร็วที่สุด:

> AI CPU รับ State/Goal → เลือก CPU Skill → รันงานจริงบน CPU/VPS → Verify จากผลจริง → ส่ง Result State กลับ โดยไม่เรียก Agent

หลักใหม่: **Real Skill First**

---

# 1. สิ่งที่ต้องปิดก่อนเริ่ม Real Skill

V0.1 ยังมี safety blocker ที่ต้องปิดก่อน:

- STRONG_MATCH เท่านั้นที่ `ranCPU=true`
- WEAK_MATCH → `AGENT_NEEDED`
- SKILL_CONFLICT → `AGENT_NEEDED`
- NO_MATCH → `AGENT_NEEDED`
- PARSE_INVALID → `AGENT_NEEDED`

ต้องแก้ matcher ไม่ให้ raw keyword score เพียงอย่างเดียวสร้าง STRONG_MATCH และ explicit skill ที่ขัดกับ State/Goal ต้องเป็น hard conflict

เมื่อ Live Acceptance ทั้ง 5 กรณีผ่าน ให้ถือว่า V0.1 Core Safety ปิดแล้ว

---

# 2. Milestone ใหม่ — V0.2 Real Skill #1

## CPU Skill แรก: WEB_HEALTH_CHECK

เหตุผลที่เลือก:

- CPU ทำได้เองทั้งหมด
- ไม่ต้องใช้ LLM
- ไม่ต้องใช้ credential
- ผลตรวจสอบ deterministic
- Verify ได้จาก HTTP จริง
- เป็น primitive skill ที่นำไปประกอบ Skill อื่นในอนาคตได้

## Input

```text
STATE: WEB_CHECK
GOAL: WEBSITE_STATUS_KNOWN
URL: https://example.com
```

## Workflow

```text
VALIDATE_URL
→ DNS/CONNECTION
→ HTTP_REQUEST
→ FOLLOW_REDIRECT (bounded)
→ READ_STATUS_CODE
→ MEASURE_LATENCY
→ READ_CONTENT_TYPE
→ CLASSIFY_RESULT
→ VERIFY
```

## Result States

```text
WEB_ONLINE
WEB_REDIRECT
WEB_CLIENT_ERROR
WEB_SERVER_ERROR
WEB_TIMEOUT
WEB_DNS_ERROR
WEB_TLS_ERROR
WEB_CONNECTION_ERROR
```

## Verify

```text
HTTP 200-399 → RESPONDING
HTTP 400-499 → CLIENT_ERROR
HTTP 500-599 → SERVER_ERROR
Timeout → WEB_TIMEOUT
DNS failure → WEB_DNS_ERROR
TLS failure → WEB_TLS_ERROR
```

AI CPU ต้องคืน structured result ไม่ใช่ข้อความเดา:

```json
{
  "skill": "WEB_HEALTH_CHECK",
  "ranCPU": true,
  "url": "https://example.com",
  "httpStatus": 200,
  "latencyMs": 184,
  "contentType": "text/html",
  "resultState": "WEB_ONLINE",
  "verified": true
}
```

---

# 3. Architecture ใหม่

## Frontend

GitHub Pages คงเป็น UI หลัก:

```text
GitHub Pages
├─ Chat / Manual Command
├─ State / Goal
├─ Skill Match
├─ Work Canvas
└─ Result
```

## VPS

เริ่มสร้าง AI CPU Runtime จริงบน VPS:

```text
VPS AI CPU Runtime
├─ API Gateway
├─ Skill Registry
├─ Skill Executor
├─ WEB_HEALTH_CHECK
├─ Verifier
├─ Execution History
└─ Health Endpoint
```

Frontend ต้องเรียก Core ผ่าน interface เดียว เพื่อให้ local simulation และ VPS runtime สลับกันได้

```text
UI
↓
AI CPU Core Interface
├─ Local Mode → browser simulation
└─ Remote Mode → VPS API
```

ห้ามผูกหน้า UI กับ implementation ของ VPS โดยตรง

---

# 4. API Contract แรก

เสนอ endpoint:

```text
POST /api/v1/execute
```

Request:

```json
{
  "state": "WEB_CHECK",
  "goal": "WEBSITE_STATUS_KNOWN",
  "skill": "WEB_HEALTH_CHECK",
  "input": {
    "url": "https://example.com"
  }
}
```

Response:

```json
{
  "executionId": "...",
  "skill": "WEB_HEALTH_CHECK",
  "status": "DONE",
  "ranCPU": true,
  "resultState": "WEB_ONLINE",
  "output": {
    "httpStatus": 200,
    "latencyMs": 184,
    "contentType": "text/html"
  },
  "verified": true
}
```

Failure:

```json
{
  "status": "FAIL",
  "ranCPU": true,
  "resultState": "WEB_TIMEOUT",
  "verified": true
}
```

Unknown / unsupported:

```json
{
  "status": "AGENT_NEEDED",
  "ranCPU": false,
  "reason": "NO_SUPPORTED_SKILL"
}
```

---

# 5. Safety / Runtime Guardrails

WEB_HEALTH_CHECK V0.2 ต้องเป็น read-only network skill

ข้อกำหนด:

- รองรับเฉพาะ `http://` และ `https://`
- จำกัด timeout
- จำกัด redirect count
- จำกัด response body size หรือไม่อ่าน body เต็ม
- ห้าม execute JavaScript ของเว็บไซต์
- ห้าม login
- ห้ามส่ง credential
- ห้าม POST/PUT/PATCH/DELETE
- ห้าม arbitrary shell command
- log ทุก execution
- มี execution ID

---

# 6. Memory สำหรับ Real Skill

เริ่มเก็บ Experience จากงานจริง:

```text
STATE
GOAL
SKILL
INPUT FINGERPRINT
START TIME
END TIME
RESULT STATE
HTTP STATUS
LATENCY
VERIFIED
SUCCESS / FAIL
```

Memory รอบนี้มีหน้าที่จำว่า:

> State/Goal แบบนี้ใช้ Skill ไหน และผลจริงเป็นอย่างไร

ยังไม่ทำ RAG หรือ model training

---

# 7. UI Changes ที่จำเป็นเท่านั้น

ยังไม่ทำ Skill Inspector เต็มรูปแบบ

Canvas เพิ่มเพียงข้อมูลที่จำเป็นสำหรับ Real Skill:

```text
MODE: REMOTE CPU / LOCAL SIM
SKILL: WEB_HEALTH_CHECK
TARGET: URL
STATUS: RUNNING / DONE / FAIL
HTTP STATUS
LATENCY
RESULT STATE
VERIFIED
AGENT CALLS: 0
```

ห้าม redesign UI หลัก

---

# 8. Acceptance Tests — V0.2

## A. Known Online Website

```text
WEB_CHECK
→ WEB_HEALTH_CHECK
→ HTTP 2xx/3xx
→ DONE
→ ranCPU=true
→ Agent Calls=0
```

## B. 404

```text
→ WEB_CLIENT_ERROR
→ verified=true
```

## C. 500

```text
→ WEB_SERVER_ERROR
→ verified=true
```

## D. Timeout

```text
→ WEB_TIMEOUT
→ verified=true
```

## E. Invalid URL

```text
→ INPUT_INVALID / FAIL
→ no external request
```

## F. Unsupported Skill

```text
→ AGENT_NEEDED
→ ranCPU=false
```

---

# 9. Definition of Done

V0.2 Real Skill #1 ถือว่าสำเร็จเมื่อ:

1. V0.1 safety acceptance ผ่านครบ
2. VPS มี AI CPU API ที่ตอบ health check ได้
3. `WEB_HEALTH_CHECK` รัน HTTP request จริง
4. เว็บ GitHub Pages ส่งงานไป VPS ได้
5. Canvas แสดงผลจริงจาก VPS
6. Verify ใช้ผล HTTP จริง ไม่ใช่ simulation
7. Online / 404 / 500 / timeout / invalid URL ผ่าน acceptance
8. Execution ถูกบันทึกเป็น Episode
9. Agent Calls = 0 สำหรับ Skill ที่รองรับ
10. Unsupported task ยังจบที่ `AGENT_NEEDED`

---

# 10. Roadmap ใหม่หลัง V0.2

```text
V0.1
Core Safety / Match Gating
↓
V0.2
REAL CPU SKILL #1 — WEB_HEALTH_CHECK
↓
V0.3
VPS Skill Runtime + Persistent Memory Hardening
↓
V0.4
Real Skill #2 — HTTP/API Inspection
↓
V0.5
Real Skill #3 — File Inspection / Conversion
↓
V0.6
Agent Gateway
↓
V1
Agent Solves Unknown → Candidate CPU Skill
↓
V1.5
Skill Validator / Sandbox
↓
V2
Skill Composition / Higher-level Workflows
↓
V3
Multi-Agent Skill Factory
↓
V4
Small Planner from Experience
```

สิ่งที่เลื่อนไปภายหลัง:

- Skill Match Inspector เต็มรูปแบบ
- Skill Editor/Lifecycle ขั้นสูง
- Skill Composition
- LLM Interpreter
- Multi-Agent
- model training

---

# Core Principle

> **อย่าเพิ่งทำให้ AI CPU ดูฉลาดขึ้น — ทำให้มันทำ Skill จริงได้ก่อน**

> **Agent learns unknown work. AI CPU executes proven programs.**
