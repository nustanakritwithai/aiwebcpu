# Project Brain Verifier V0.5

Contract-driven verification layer for documented repository capabilities.

## Why contract-driven

The verifier must not infer compatibility from a capability name, commit message, README keyword or successful CI run.

A verification contract explicitly states:

- goal
- candidate capability
- exact compatibility checks
- whether exact-head CI is required
- adaptation requirements
- desired decision if all required checks pass

## Verdict

Required checks aggregate as:

```text
any VIOL    -> VIOL
else UNKNOWN -> UNKNOWN
else          SAT
```

UNKNOWN is never PASS.

## Decision

A candidate decision becomes REUSE / ADAPT / BUILD only when the candidate verdict is SAT.

REUSE with declared adaptations is rejected to UNKNOWN.

## Evidence freshness

Every inventory evidence path/sha must still match the accepted Repository Catalog. Stale evidence is VIOL for the verification contract until re-extracted.

## CI boundary

Exact-head CI can be:
- `ignore`
- `prefer`
- `required`

Even SAT CI is repository-health evidence, not semantic capability proof.

## Graph boundary

Verifier creates a **graph patch candidate** only when:
- overall verdict = SAT
- recommendation is resolved

The patch is never auto-applied and never auto-merged.

## CLI

```bash
node project-brain/verifier/verifier.mjs verify \
  --contract project-brain/verifier/contracts/simclone-time-travel.json \
  --out project-brain/verifier/reports/simclone-time-travel.json \
  --patch project-brain/verifier/patches/simclone-time-travel.json \
  --report project-brain/verifier/reports/simclone-time-travel.md
```
