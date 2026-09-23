---
type: capability
id: verification
status: active
---

# Verification

การพิสูจน์ผลลัพธ์ด้วย deterministic evidence ก่อนเชื่อคำตอบของ Agent

## Providers

- [[Projects/aiwebcpu]]
- [[Projects/TestGE]]

## Result Vocabulary

- SAT
- VIOL
- UNKNOWN

## Contract

Agent saying “done” is not evidence.

Evidence ที่ยอมรับได้ตามงาน:
- test result
- CI result
- state transition
- file/hash comparison
- runtime output
- browser/acceptance result

## Rule

UNKNOWN ห้ามถูกยกระดับเป็น SAT โดยไม่มีหลักฐานใหม่
