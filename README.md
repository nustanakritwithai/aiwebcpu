# AI CPU Web

AI CPU Web is a browser-based prototype of a **CPU-first skill runtime**.

The current system intentionally contains **no embedded LLM or autonomous agent in the main runtime**. A user or external agent prepares a structured Thai command, then the runtime:

1. parses State / Observation / Goal,
2. matches a CPU Skill,
3. runs only when the decision is safe enough,
4. verifies the result,
5. stores Skill-oriented Memory / History,
6. escalates unknown or uncertain states as `AGENT_NEEDED`.

## Live site

`https://nustanakritwithai.github.io/aiwebcpu/`

## Current execution direction — Real Skill First

After V0.1 Core Safety is closed, the project **does not continue with Skill Inspector / Skill Editor / Skill Composition first**.

The next milestone is:

> **V0.2 — Real CPU Skill #1: `WEB_HEALTH_CHECK`**

The goal is to prove the full real-world loop:

```text
STATE + GOAL
→ Skill Match
→ WEB_HEALTH_CHECK
→ VPS / CPU executes a real HTTP check
→ Verify real result
→ Result State
→ Memory Episode
→ Agent Calls = 0
```

See [`AI_CPU_REAL_SKILL_FIRST_PLAN.md`](./AI_CPU_REAL_SKILL_FIRST_PLAN.md) for the active roadmap.

## Plan documents

- [`AI_CPU_REAL_SKILL_FIRST_PLAN.md`](./AI_CPU_REAL_SKILL_FIRST_PLAN.md) — **active execution roadmap**
- [`AI_CPU_WEB_V0_1_PLAN.md`](./AI_CPU_WEB_V0_1_PLAN.md) — V0.1 parser / matcher / safety hardening
- [`AI_CPU_WEB_V0_PLAN.md`](./AI_CPU_WEB_V0_PLAN.md) — original V0 master plan / historical baseline

## Verified agent runtime foundation

A Pi-inspired verified control-plane foundation now lives at:

`aicpu/verified-runtime/`

It adds the runtime primitives needed to evolve AI CPU from a browser skill prototype into a verified agent system:

- parent-linked session/candidate history
- Pi session projection adapter
- lazy skill loading
- deterministic -> local -> frontier compute routing
- fail-closed policy gating
- evidence-backed SAT / VIOL / UNKNOWN verification
- VRR repair / alternate / new-approach lineage
- evidence-gated canonical memory proposals

The foundation does not grant unrestricted autonomous execution. Writes require a sandbox, unknown security classes fail closed, and canonical memory is never auto-committed.

Verify with:

```bash
node --test aicpu/verified-runtime/core.test.mjs
node aicpu/verified-runtime/demo.mjs
```

See [`aicpu/verified-runtime/README.md`](./aicpu/verified-runtime/README.md).

## Core principle

> Agent solves unknown problems. AI CPU executes proven programs.

## Run locally

Open `index.html` directly in a modern browser, or serve the folder with any static web server.
