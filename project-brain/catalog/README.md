# Project Brain Repository Catalog

Mechanical discovery catalog for every repository owned by `nustanakritwithai` visible to the connected GitHub account at the 2026-09-24 capture.

## Scope

- Total repositories: **37**
- Non-empty: **34**
- Empty: **3**
- Public: **33**
- Private: **4**

Empty repositories:
- Monkey-king
- Empire-war
- APK-Test

Private repositories:
- MulitAgentWork
- Ai-game
- MonsterLifeServer
- A2A-blackboard

## Trust boundary

Catalog data is discovery evidence, not a capability verdict.

```text
Repository metadata / HEAD / file SHA
        ↓
DISCOVERED
        ↓
semantic status = UNKNOWN
        ↓
Verifier
        ↓
Capability / relation promotion
```

A filename, commit message, package manifest, or successful CI result does not by itself prove a reusable capability.

## Scheduled scanning

Public repositories can be monitored by the aiwebcpu GitHub Actions scanner.

Private repositories are cataloged but marked `MANUAL_PRIVATE` until a cross-repository credential is explicitly configured for the scanner workflow.
