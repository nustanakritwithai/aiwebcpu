# Project Brain GitHub Scanner V0.4

Deterministic repository-change detector for Project Brain.

## Trust boundary

Scanner may automatically collect:

- repository HEAD SHA
- commit date/message
- configured evidence-file blob SHA
- exact-head GitHub Actions result

Scanner must not automatically infer:

- a new capability
- whether a feature is complete
- compatibility with another project
- REUSE / ADAPT / BUILD
- SAT for a capability claim

All semantic candidates remain **UNKNOWN** until verified.

## Files

- `config.json` — monitored repositories and evidence paths
- `baseline.json` — last accepted scanner state
- `scanner.mjs` — collector/diff/report engine
- `latest.json` — generated current scan on automation branch
- `candidates.json` — generated UNKNOWN candidate inbox
- `REPORT.md` — generated human-readable report

## Manual run

```bash
node project-brain/scanner/scanner.mjs scan \
  --config project-brain/scanner/config.json \
  --baseline project-brain/scanner/baseline.json \
  --out project-brain/scanner/latest.json \
  --candidates project-brain/scanner/candidates.json \
  --report project-brain/scanner/REPORT.md
```

Accept a reviewed scanner state:

```bash
node project-brain/scanner/scanner.mjs promote \
  --latest project-brain/scanner/latest.json \
  --baseline project-brain/scanner/baseline.json
```

The scheduled workflow opens/updates a PR. It never auto-merges and never edits the canonical Knowledge Graph.
