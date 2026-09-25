# Agent Work Layer

Project Brain now exposes an explicit work queue for external agents.

## Purpose

The canonical graph answers **what is known**. The agent work layer answers **what should be worked next**.

```text
Knowledge Graph + Deep Profile
            ↓
      agent-work.json
            ↓
 query.mjs work
            ↓
   READY work item
            ↓
 Inspect → Change → Verify
            ↓
 SAT / VIOL / UNKNOWN
            ↓
 Project Brain update
```

## Rules

- Only a `READY` item is actionable by default.
- Dependencies must be SAT before the next phase is promoted to READY.
- UNKNOWN never unlocks a dependent phase.
- Work items describe acceptance evidence, not just implementation tasks.
- Public Project Brain must not contain private VPS secrets/metadata.

## Current active sequence

`P0 → P1 → P2 → P3 → P4 → P5`

The current READY item is **P0 — Freeze one ingress**.

## CLI

```bash
node project-brain/query.mjs work
node project-brain/query.mjs work P0
```

The first command returns the active goal, READY item(s), and the full dependency-aware queue. The second returns a single work item.
