---
type: project
repo: nustanakritwithai/aiwebcpu
status: active
role: execution-runtime
source_of_truth: https://github.com/nustanakritwithai/aiwebcpu
---

# aiwebcpu

CPU-first skill runtime ที่ให้ Agent แก้ unknown problem และให้ CPU execute proven program

## Provides

- [[Capabilities/Verification]]
- Skill matching
- Deterministic execution path
- `AGENT_NEEDED` escalation
- Real CPU skill runtime direction

## Current Direction

V0.2 เน้น Real Skill First โดย `WEB_HEALTH_CHECK` เป็น skill จริงตัวแรก

## Project Brain Role

ใช้เป็น execution/verification layer หลัง Project Brain เลือก capability แล้ว

## Evidence

- README ระบุ flow parse → match → execute → verify → memory → AGENT_NEEDED
- active roadmap ระบุ Real Skill First และ structured verified result

## Confidence

status: SAT สำหรับแนวคิด/contract ที่บันทึกใน repo  
runtime production readiness: UNKNOWN จนกว่าจะตรวจ deployment ล่าสุด
