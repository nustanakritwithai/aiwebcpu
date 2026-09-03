# AI CPU Web V0 — Master Plan

## Product Goal

สร้างเว็บไซต์ต้นแบบ **AI CPU Web** ที่หน้าตาเหมือน Agent Workspace แต่เวอร์ชันแรก **ยังไม่ฝัง AI/LLM/Agent จริงในเว็บไซต์**

หลักการของ V0 คือ:

> ผู้ใช้วางคำสั่งภาษาไทยที่เตรียมไว้ → AI CPU แปลงคำสั่งเป็น State/Goal → จับคู่ CPU Skill → จำลอง Workflow → Verify → บันทึก Memory/History

ในช่วง V0 ChatGPT/Agent ภายนอกจะทำหน้าที่เป็น Manual Interpreter ช่วยสร้างคำสั่งภาษาไทยให้ผู้ใช้นำไปวางในเว็บไซต์

---

## Core Architecture

```text
Human / External Agent
        ↓
Thai AI CPU Command
        ↓
Command Parser
        ↓
STATE + GOAL + OBSERVATION
        ↓
Skill Matcher
        ↓
CPU Skill Registry
        ↓
Workflow Executor (Simulation V0)
        ↓
Verifier
        ↓
RESULT STATE
        ↓
Skill Memory / History
```

ถ้าไม่มี Skill ที่ตรง:

```text
NO_SKILL_MATCH
      ↓
ESCALATE
      ↓
External Agent / Human
      ↓
Create New CPU Skill
      ↓
Install into AI CPU
```

---

## V0 Scope

### 1. Agent-style Workspace UI

Layout หลัก 3 คอลัมน์:

- **Left Sidebar** — Chat, CPU Skills, Memory, History, Tools, Settings
- **Center Chat / Command Workspace** — ช่องวางคำสั่งภาษาไทย + ผลการทำงาน
- **Right Work Canvas** — แสดง State, Skill Match, Workflow, Verify และ Result

Responsive behavior:

- Desktop: 3 columns
- Tablet: Sidebar + Chat
- Mobile: Chat-first layout

### 2. Thai Command Format

V0 ใช้คำสั่งภาษาไทยที่มีโครงสร้างตายตัว:

```text
สถานะ:
อาการ:
เป้าหมาย:

ใช้สกิล:

ทำงาน:
- ...
- ...

ตรวจสอบ:

ถ้าไม่สำเร็จ:
```

ตัวอย่าง:

```text
สถานะ: ล็อกอินผิดพลาด
อาการ: HTTP_401
เป้าหมาย: ล็อกอินสำเร็จ

ใช้สกิล: กู้คืนการยืนยันตัวตน

ทำงาน:
- ตรวจโทเคน
- รีเฟรชโทเคนถ้าหมดอายุ
- ลองล็อกอินใหม่

ตรวจสอบ: HTTP_200

ถ้าไม่สำเร็จ: ส่งต่อเอเจนต์
```

### 3. Internal Normalized State

Parser แปลงภาษาไทยเป็น object ภายใน เช่น:

```json
{
  "state": "AUTH_ERROR",
  "observation": "HTTP_401",
  "goal": "LOGIN_OK",
  "skill": "AUTH_RECOVERY",
  "steps": [
    "CHECK_TOKEN",
    "REFRESH_TOKEN",
    "RETRY_LOGIN"
  ],
  "verify": "HTTP_200",
  "fallback": "ESCALATE"
}
```

### 4. CPU Skill Registry

เริ่มด้วย Skill ตัวอย่างอย่างน้อย 5 รายการ:

1. `AUTH_RECOVERY`
2. `API_RETRY`
3. `BUILD_REPAIR`
4. `CHECK_WEBSITE`
5. `FILE_CONVERT`

Skill record ต้องรองรับ:

- id / name / version
- trigger state
- supported goals
- steps
- tools
- success condition
- failure condition
- fallback
- success / failure counters

### 5. Skill Matcher

รับ `STATE + GOAL + OBSERVATION` แล้วหา Skill ที่เหมาะสมที่สุด

V0 ใช้ deterministic matching / score-based matching ด้วย JavaScript ก่อน ยังไม่ใช้ AI

### 6. Workflow Executor

V0 เป็น simulation runtime:

```text
STATE
  ↓
SKILL MATCH
  ↓
STEP 1
  ↓
STEP 2
  ↓
STEP 3
  ↓
VERIFY
  ↓
DONE / ESCALATE
```

Canvas ต้องแสดงแต่ละขั้นให้เห็นอย่างชัดเจน

### 7. Skill Memory

Memory ของ AI CPU ใน V0 เน้นจำเรื่อง Skill:

```text
STATE + GOAL
→ Skill ที่เคยใช้
→ Workflow
→ Result
→ Success / Failure
→ Usage Count
```

V0 เก็บฝั่ง browser ด้วย local persistence ก่อนเพื่อให้หน้าเว็บใช้งานได้โดยไม่มี backend

### 8. Unknown / Escalate Mode

ถ้าไม่พบ Skill ที่เหมาะสม:

```text
NO_SKILL_MATCH
→ ESCALATE_AGENT
```

ใน V0 ยังไม่เรียก Agent จริง แต่ UI ต้องแสดงสถานะว่า **ต้องส่งต่อ Agent**

---

## Initial Acceptance Tests

### Test 1 — Known Skill

Input ที่เป็น `AUTH_ERROR + HTTP_401 + LOGIN_OK`

Expected:

```text
MATCH → AUTH_RECOVERY
→ Workflow Simulation
→ VERIFY
→ DONE
```

### Test 2 — Unknown Skill

Input ที่ไม่มี Skill รองรับ

Expected:

```text
NO_SKILL_MATCH
→ ESCALATE
```

### Test 3 — Add Skill

เพิ่ม Skill ใหม่เข้า Registry แล้วรัน State เดิมอีกครั้ง

Expected:

```text
New Skill Match
→ CPU Execute
→ Agent Call Not Required
```

---

## UI Identity

หน้าเว็บต้องให้ความรู้สึกเหมือน ChatGPT / Claude / Coding Agent workspace แต่มีเอกลักษณ์ของ AI CPU:

- `⚡ CPU Skill` = งานนี้รันจาก Skill/Program ที่รู้แล้ว
- `🧠 Agent Needed` = ไม่มี Skill หรือ Skill เดิมแก้ไม่ได้
- `✓ Skill Match` = พบความสามารถที่เหมาะสม
- `✓ Verify` = ผลผ่านเงื่อนไข
- Work Canvas แสดง workflow แบบสด

---

## Version Roadmap

```text
V0
Manual Thai Command + Skill Simulation + Memory

V0.5
Real Tool Adapters / CPU Skill Execution

V1
Interpreter Agent: Human Language → State/Goal

V1.5
Agent Fallback

V2
Agent → Candidate CPU Skill

V2.5
Skill Validator / Sandbox

V3
Multi-Agent Skill Factory

V4
Small Planner trained from Experience

V5
Agent-native Signal / Policy Training
```

---

## V0 Non-Goals

ยังไม่ทำในเวอร์ชันแรก:

- ไม่มี LLM API ฝังในเว็บ
- ไม่มี Multi-Agent จริง
- ไม่มี autonomous self-modifying code
- ไม่มี model training
- ไม่มี latent communication
- ไม่มี production tool execution
- ไม่มี remote backend/database

เป้าหมายคือพิสูจน์ **AI CPU Core + Skill-oriented Memory + Agent-style UX** ให้ชัดก่อน

---

## Definition of Done — V0

V0 ถือว่าสำเร็จเมื่อ:

1. เปิดเว็บจาก GitHub Pages ได้
2. วางคำสั่งภาษาไทยได้
3. Parser แสดง State/Goal ที่แปลงแล้ว
4. Skill Matcher เลือก Skill ได้
5. Work Canvas จำลอง workflow ได้
6. Known Skill จบเป็น DONE ได้โดยไม่ต้อง Agent
7. Unknown Skill แสดง ESCALATE_AGENT
8. Registry แสดง CPU Skills ที่มีอยู่
9. Memory/History บันทึกการใช้ Skill ได้
10. UI ใช้งานได้ทั้ง desktop และมือถือ

**Core principle:**

> Agent solves unknown problems. AI CPU remembers and executes known skills.
