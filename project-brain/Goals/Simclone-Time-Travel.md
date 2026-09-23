---
type: goal
id: simclone-time-travel
status: proposed
target_project: Simclone
decision: ADAPT
updated: 2026-09-24
---

# Goal — Simclone ย้อนเวลาได้

## Goal

เพิ่มความสามารถย้อน state / replay history ให้ [[Projects/Simclone]] โดยไม่สร้างระบบใหม่ถ้ามีของเดิมใช้ได้

## Needed Capabilities

- [[Capabilities/Rollback]]
- [[Capabilities/Replay]]
- [[Capabilities/Verification]]

## Search Result

Provider candidate:
- [[Projects/TestGE]]

## Current Decision

**ADAPT**

เหตุผล:
TestGE มี documented rollback/replay แล้ว แต่ state schema และ action contract ของ Simclone ยังต้องตรวจ compatibility

## Required Compatibility Check

1. map Simclone state → canonical snapshot
2. map Simclone actions → canonical input/event
3. check side effects that cannot rewind
4. define save/version interaction
5. deterministic replay test
6. browser acceptance test

## Success Contract

- rewind แล้ว world hash/state ตรงกับ checkpoint ที่เลือก
- replay input เดิมแล้วได้ผล deterministic ตาม contract
- save เดิมไม่ถูกทำลายโดย migration
- failure ต้องคืน UNKNOWN/VIOL ไม่ใช่ silent success

## Verification State

implementation: UNKNOWN  
compatibility: UNKNOWN  
reuse candidate found: SAT
