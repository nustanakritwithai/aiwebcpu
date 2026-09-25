# AGENTS.md — Project Brain Agent Entry

This repository contains **Project Brain**, the shared machine-readable context used by humans and external agents.

## Start here

Before changing code:

1. Read `project-brain/README.md`.
2. Run:
   ```bash
   node project-brain/query.mjs work
   ```
3. Take the first work item whose status is `READY`.
4. Read its source profile/runbook and inspect the named repositories/configuration.
5. Define the acceptance evidence before editing.
6. Execute the smallest safe change.
7. Verify with deterministic evidence.
8. Report the result as exactly one of:
   - `SAT`
   - `VIOL`
   - `UNKNOWN`
9. `UNKNOWN` is never a pass.
10. Update Project Brain only with evidence that can be reproduced or inspected.

## Agent work commands

```bash
node project-brain/query.mjs work
node project-brain/query.mjs work P0
node project-brain/query.mjs integration "PocketMonster VPS"
node project-brain/query.mjs checkpoints
```

The machine-readable queue is `project-brain/agent-work.json`.

## Safety / privacy boundary

Project Brain is public. Never persist private VPS repository names, credentials, tokens, machine paths, secret configuration, or user data here.

For private VPS work, use authenticated private access during execution, then write only redacted evidence and public-safe conclusions back to Project Brain.

## Completion rule

An agent saying "done" is not evidence. A phase becomes complete only when its acceptance conditions have deterministic evidence and the queue/graph is updated accordingly.
