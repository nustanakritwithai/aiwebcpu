# AI CPU Web V0.1 — Parser & Skill Matching Hardening Plan

## เป้าหมายของเวอร์ชัน

V0.1 จะยัง **ไม่เพิ่ม AI / LLM / Agent จริง** และยังไม่เพิ่ม Tool Execution จริง

เป้าหมายหลักคือทำให้แกนปัจจุบันของ AI CPU Web มีความแน่นอนและทดสอบได้ โดยล็อกวงจรนี้ให้ชัด:

```text
Thai Command
   ↓
Command Parser
   ↓
Normalized State / Goal / Observation
   ↓
Skill Matcher
   ↓
MATCH / NO_MATCH
   ↓
Workflow Simulation
   ↓
VERIFY
   ↓
DONE / FAIL / AGENT_NEEDED
   ↓
Memory / History
```

หลักคิดของ V0.1:

> ก่อนให้ AI CPU เรียก Agent หรือ Tool จริง ระบบต้องเข้าใจคำสั่งไทย จับคู่ Skill และรายงานสถานะได้อย่างแน่นอนก่อน

---

# 1. Scope ของ V0.1

V0.1 ทำเฉพาะ 7 เรื่อง:

1. ล็อก Thai Command Format
2. ทำ Parser ให้ robust ขึ้น
3. ทำ Normalized State / Goal Vocabulary
4. ทำ Skill Matching Score ให้ตรวจสอบได้
5. ทำ Runtime Status Machine
6. ทำ Memory/History record ให้เป็นมาตรฐาน
7. สร้าง Test Matrix สำหรับ Known / Unknown / Ambiguous cases

ยังไม่ทำ:

- LLM Interpreter
- Agent API
- Tool Execution จริง
- Browser Automation
- Coding Agent
- Skill Compiler อัตโนมัติ
- Vector DB / RAG
- Model Training
- Multi-Agent

---

# 2. Thai Command Format V0.1

รูปแบบคำสั่งมาตรฐานยังใช้ภาษาไทยเพื่อให้ผู้ใช้ Copy/Paste ได้ง่าย:

```text
สถานะ: <สถานะที่เกิดขึ้น>
อาการ: <สิ่งที่สังเกตได้>
เป้าหมาย: <ผลลัพธ์ที่ต้องการ>

ใช้สกิล: <ชื่อสกิล ถ้ารู้>

ทำงาน:
- <step 1>
- <step 2>
- <step 3>

ตรวจสอบ: <เงื่อนไขสำเร็จ>

ถ้าไม่สำเร็จ: <fallback>
```

## 2.1 Required Fields

ต้องมีอย่างน้อย:

- `สถานะ:`
- `เป้าหมาย:`

## 2.2 Optional Fields

- `อาการ:`
- `ใช้สกิล:`
- `ทำงาน:`
- `ตรวจสอบ:`
- `ถ้าไม่สำเร็จ:`

ถ้า optional field หาย ระบบต้องไม่ crash

## 2.3 Parser Rules

Parser ต้องรองรับ:

- เว้นวรรคก่อน/หลัง `:`
- บรรทัดว่างหลายบรรทัด
- bullet `-` หรือ `•`
- ภาษาไทยผสมอังกฤษ
- HTTP codes เช่น `401`, `503`
- uppercase/lowercase เช่น `HTTP_401`, `http_401`
- field ที่ไม่ได้เรียงตามตัวอย่าง

Parser ต้องไม่พยายามเดาความหมายเกิน vocabulary ของ V0.1

ถ้าไม่สามารถ normalize ได้ ให้ใช้:

```text
UNKNOWN_STATE
UNKNOWN_GOAL
```

แทนการสร้างค่าขึ้นเอง

---

# 3. Internal Normalized Schema

หลัง Parse แล้ว ต้องได้ object มาตรฐานเดียวกัน:

```json
{
  "state": "AUTH_ERROR",
  "stateText": "ล็อกอินผิดพลาด",
  "observation": "HTTP_401 token หมดอายุ",
  "goal": "LOGIN_OK",
  "goalText": "ล็อกอินสำเร็จ",
  "requestedSkill": "AUTH_RECOVERY",
  "requestedSteps": [],
  "verify": "HTTP_200",
  "fallback": "ESCALATE_AGENT",
  "parseStatus": "VALID"
}
```

## 3.1 Parse Status

เพิ่ม `parseStatus`:

```text
VALID
PARTIAL
INVALID
```

### VALID
มี State + Goal ที่ normalize ได้

### PARTIAL
อ่าน command ได้ แต่มี `UNKNOWN_STATE` หรือ `UNKNOWN_GOAL`

### INVALID
ไม่มี required field หรือ format เสียจน parse ไม่ได้

INVALID ต้องหยุดก่อน Skill Matcher

---

# 4. State Vocabulary V0.1

เริ่มด้วย vocabulary เล็กและควบคุมได้:

```text
AUTH_ERROR
API_ERROR
BUILD_ERROR
WEB_CHECK
FILE_ERROR
UNKNOWN_STATE
```

ตัวอย่าง mapping:

```text
ล็อกอิน / auth / token / 401
→ AUTH_ERROR

api / timeout / 503 / request
→ API_ERROR

build / dependency / compile / package
→ BUILD_ERROR

website / หน้าเว็บ / ตรวจเว็บ
→ WEB_CHECK

file / csv / encoding / utf-8 / แปลงไฟล์
→ FILE_ERROR
```

---

# 5. Goal Vocabulary V0.1

```text
LOGIN_OK
API_OK
BUILD_PASS
WEBSITE_OK
FILE_OK
UNKNOWN_GOAL
```

เป้าหมายต้องเป็น desired state ไม่ใช่คำอธิบายวิธีทำ

ตัวอย่าง:

```text
"รีเฟรช token"
```

ไม่ควรเป็น Goal

แต่:

```text
"ล็อกอินสำเร็จ"
→ LOGIN_OK
```

คือ Goal ที่ถูกต้อง

---

# 6. CPU Skill Registry V0.1

ใช้ 5 Skills เดิมเป็น baseline:

```text
AUTH_RECOVERY
API_RETRY
BUILD_REPAIR
CHECK_WEBSITE
FILE_CONVERT
```

Skill record มาตรฐาน:

```json
{
  "id": "AUTH_RECOVERY",
  "name": "กู้คืนการยืนยันตัวตน",
  "version": "0.1",
  "states": ["AUTH_ERROR"],
  "goals": ["LOGIN_OK"],
  "keywords": ["401", "token", "โทเคน", "auth", "ล็อกอิน"],
  "steps": [],
  "tools": [],
  "verify": "HTTP_200",
  "fallback": "ESCALATE_AGENT",
  "enabled": true
}
```

V0.1 ต้องแยกชัดว่า Skill ไหน `enabled / disabled`

Skill disabled ต้องไม่ถูกเลือกโดย Skill Matcher

---

# 7. Skill Matching Algorithm V0.1

V0.1 ยังใช้ deterministic scoring ไม่ใช้ AI

คะแนน baseline:

```text
Explicit requested skill exact match     +20
State exact match                        +10
Goal exact match                         +8
Observation keyword match                +1 ต่อ keyword
Command keyword match                    +1 ต่อ keyword
Skill disabled                           = ไม่พิจารณา
```

## 7.1 Match Thresholds

```text
Score >= 15  → STRONG_MATCH
Score 10-14  → WEAK_MATCH
Score < 10   → NO_MATCH
```

### STRONG_MATCH
สามารถ execute simulation ได้

### WEAK_MATCH
ไม่ควรรันอัตโนมัติ
แสดงว่า `NEEDS_CONFIRMATION` หรือ `AGENT_NEEDED`

### NO_MATCH
ส่งสถานะ `AGENT_NEEDED`

## 7.2 Explicit Skill Safety

ถ้าคำสั่งระบุ:

```text
ใช้สกิล: AUTH_RECOVERY
```

แต่ State/Goal ไม่รองรับ Skill นั้น เช่น:

```text
STATE: BUILD_ERROR
GOAL: BUILD_PASS
```

ห้ามบังคับใช้ Skill ตามชื่ออย่างเดียว

ต้องรายงาน:

```text
SKILL_CONFLICT
```

แล้วหยุด execution

---

# 8. Runtime Status Machine

V0.1 ต้องใช้สถานะชุดเดียวทั้งระบบ:

```text
IDLE
PARSING
PARSE_INVALID
MATCHING
STRONG_MATCH
WEAK_MATCH
NO_MATCH
SKILL_CONFLICT
SIMULATING
VERIFYING
DONE
FAIL
AGENT_NEEDED
```

Flow หลัก:

```text
IDLE
 ↓
PARSING
 ├─ invalid → PARSE_INVALID
 ↓
MATCHING
 ├─ no match → NO_MATCH → AGENT_NEEDED
 ├─ weak → WEAK_MATCH → AGENT_NEEDED
 ├─ conflict → SKILL_CONFLICT → AGENT_NEEDED
 ↓
STRONG_MATCH
 ↓
SIMULATING
 ↓
VERIFYING
 ├─ pass → DONE
 └─ fail → FAIL → AGENT_NEEDED
```

UI และ Memory ต้องใช้ชื่อ status เดียวกัน ห้ามสร้างคำสถานะหลายแบบในคนละส่วน

---

# 9. Work Canvas V0.1

Canvas ต้องแสดงอย่างน้อย:

```text
1. PARSED STATE
2. PARSED GOAL
3. MATCHED SKILL
4. MATCH SCORE
5. MATCH REASON
6. WORKFLOW STEPS
7. VERIFY CONDITION
8. FINAL STATUS
```

ตัวอย่าง:

```text
STATE
AUTH_ERROR

GOAL
LOGIN_OK

MATCH
AUTH_RECOVERY
Score: 30
Reason: state + goal + 401 + token

WORKFLOW
1. ตรวจโทเคน
2. รีเฟรชโทเคน
3. ลองล็อกอินใหม่

VERIFY
HTTP_200

STATUS
DONE
```

ถ้าไม่ match:

```text
MATCH
NONE

STATUS
AGENT_NEEDED
```

---

# 10. Memory / History Record V0.1

ทุก execution สร้าง Episode มาตรฐาน:

```json
{
  "episodeId": "...",
  "timestamp": "...",
  "rawCommand": "...",
  "state": "AUTH_ERROR",
  "goal": "LOGIN_OK",
  "parseStatus": "VALID",
  "skill": "AUTH_RECOVERY",
  "matchScore": 30,
  "matchStatus": "STRONG_MATCH",
  "verify": "HTTP_200",
  "finalStatus": "DONE"
}
```

Memory V0.1 มีหน้าที่ตอบคำถามว่า:

```text
State + Goal แบบนี้
→ เคยใช้ Skill อะไร
→ Match เท่าไร
→ จบด้วย DONE / FAIL / AGENT_NEEDED
```

ยังไม่ใช้ Memory เพื่อ override Skill Matcher ใน V0.1

Memory ทำหน้าที่เก็บหลักฐานก่อน

---

# 11. Test Matrix V0.1

ต้องสร้าง test cases อย่างน้อย 20 cases

## Group A — Known / Strong Match

อย่างน้อย 10 cases เช่น:

```text
AUTH_ERROR + HTTP_401 + LOGIN_OK
→ AUTH_RECOVERY

API_ERROR + HTTP_503 + API_OK
→ API_RETRY

BUILD_ERROR + dependency conflict + BUILD_PASS
→ BUILD_REPAIR
```

## Group B — Unknown

อย่างน้อย 5 cases:

```text
PAYMENT_ERROR
DATABASE_CORRUPTION
CAPTCHA_UNKNOWN
EMAIL_DELIVERY_ERROR
UNKNOWN_DEVICE_STATE
```

Expected:

```text
NO_MATCH / AGENT_NEEDED
```

## Group C — Ambiguous / Conflict

อย่างน้อย 5 cases:

- State กับ Goal คนละ domain
- explicit skill ผิด domain
- มี State แต่ไม่มี Goal
- มี Goal แต่ไม่มี State
- field ซ้ำ

ระบบต้องไม่เลือก Skill แบบสุ่ม

---

# 12. UI Changes ใน V0.1

ยังใช้ Agent Workspace layout เดิม

เพิ่มเฉพาะข้อมูลที่ช่วย debug Core:

## Chat / Command Area

แสดง badge:

```text
PARSE VALID
STRONG MATCH
NO MATCH
AGENT NEEDED
```

## Work Canvas

เพิ่ม:

- Match Score
- Match Reasons
- Parse Status
- Normalized State
- Normalized Goal

## Developer Trace

แสดงลำดับ:

```text
RAW COMMAND
→ PARSED
→ NORMALIZED
→ SCORED
→ MATCHED
→ SIMULATED
→ VERIFIED
```

---

# 13. Error Handling

ห้ามมี silent failure

ทุก error ต้องถูกแปลงเป็น status ที่รู้จัก

ตัวอย่าง:

```text
คำสั่งว่าง
→ PARSE_INVALID

ไม่มี State
→ PARSE_INVALID

State ไม่รู้จัก
→ PARTIAL
→ AGENT_NEEDED

Skill ไม่พบ
→ NO_MATCH
→ AGENT_NEEDED
```

หน้าเว็บต้องไม่ crash จาก command ที่ format ผิด

---

# 14. Implementation Order

ลำดับพัฒนา V0.1:

```text
Step 1
ล็อก Thai Command Parser

Step 2
ล็อก State / Goal Vocabulary

Step 3
ปรับ Skill Registry Schema

Step 4
เขียน Skill Match Score V0.1

Step 5
เพิ่ม Match Threshold / Conflict Detection

Step 6
เพิ่ม Runtime Status Machine

Step 7
อัปเดต Work Canvas / Trace

Step 8
อัปเดต Memory Episode Schema

Step 9
สร้าง 20+ Test Cases

Step 10
Run Acceptance Tests
```

---

# 15. Acceptance Tests

V0.1 ต้องผ่านอย่างน้อย:

### Acceptance 1 — Parser

คำสั่งไทยมาตรฐาน parse ได้ครบ State / Goal / Observation / Steps / Verify / Fallback

### Acceptance 2 — Known Skill

```text
AUTH_ERROR + LOGIN_OK
→ AUTH_RECOVERY
→ STRONG_MATCH
```

### Acceptance 3 — Unknown Skill

```text
PAYMENT_ERROR + PAYMENT_OK
→ NO_MATCH
→ AGENT_NEEDED
```

### Acceptance 4 — Skill Conflict

```text
BUILD_ERROR + BUILD_PASS
ใช้สกิล: AUTH_RECOVERY
→ SKILL_CONFLICT
→ AGENT_NEEDED
```

### Acceptance 5 — Invalid Command

ไม่มี `สถานะ` หรือ `เป้าหมาย`

```text
→ PARSE_INVALID
```

### Acceptance 6 — No Crash

20+ test cases ต้องรันโดยไม่มี JavaScript exception

### Acceptance 7 — Memory

ทุก run ต้องสร้าง Episode ที่มี final status ชัดเจน

---

# 16. Definition of Done — V0.1

V0.1 ถือว่าเสร็จเมื่อ:

1. Parser ไม่พังกับ input format ที่รองรับ
2. State/Goal ใช้ controlled vocabulary
3. Skill Matcher มีคะแนนและเหตุผลที่ตรวจสอบได้
4. Skill Match มี threshold ชัดเจน
5. explicit skill ที่ผิด domain ถูกจับเป็น conflict
6. Runtime ใช้ status vocabulary เดียวกันทั้งเว็บ
7. Known cases ได้ STRONG_MATCH ถูก Skill
8. Unknown cases ไม่ถูกเดา Skill
9. Unknown/Weak/Conflict ถูกส่ง `AGENT_NEEDED`
10. Memory เก็บ Episode มาตรฐานทุก run
11. 20+ test cases ผ่าน
12. GitHub Pages ทำงานหลัง deploy

---

# 17. สิ่งที่จะได้หลังจบ V0.1

หลัง V0.1 เราจะมี AI CPU Core ที่ตอบคำถามสำคัญได้อย่างแน่นอนว่า:

```text
คำสั่งนี้คือ State อะไร?
ต้องการ Goal อะไร?
มี CPU Skill รองรับไหม?
Skill ไหนเหมาะที่สุด?
เลือกเพราะอะไร?
ถ้าไม่รู้ ต้องส่ง Agent หรือไม่?
```

จากนั้น V0.2 จึงค่อยพัฒนา **Skill System / Skill Editor / Skill Lifecycle** ต่อโดยไม่ต้องย้อนกลับมาแก้พื้นฐาน Parser และ Matcher บ่อย ๆ

---

## Core Principle V0.1

> AI CPU ต้องรู้ก่อนว่า “รู้หรือไม่รู้” ก่อนที่จะพยายามทำงาน

และ

> Unknown state ต้องถูกส่งต่ออย่างชัดเจน ไม่ใช่เดาคำตอบหรือเดา Skill
