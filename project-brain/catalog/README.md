# Project Brain Repository Catalog

Mechanical discovery catalog for repositories visible to the connected GitHub account at the 2026-09-24 capture.

## Public persistence boundary

The connected account exposed **37 repositories total** during discovery.

This public Project Brain persists details for **33 public repositories only**.

Private repository details are intentionally omitted from the public catalog:

- private repository count: **4**
- private names: not persisted here
- private commit metadata: not persisted here
- private evidence paths/content: not persisted here

An authenticated private storage/query layer is required before private repository details can become part of Project Brain.

## Public catalog snapshot

- 33 public repositories persisted
- 30 public repositories with commits
- 3 empty public repositories
- exact-head CI evidence: 16 SAT / 1 VIOL / 16 UNKNOWN

Empty public repositories:
- Monkey-king
- Empire-war
- APK-Test

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

The public scanner monitors the 33 persisted public repositories.

Private repositories are not persisted or scheduled by the public Project Brain workflow.
