# Repository Capability Inventory

Semantic extraction layer between the mechanical Repository Catalog and the canonical Project Brain graph.

## Meaning

`DOCUMENTED` means a repository README/architecture document or inspected source file explicitly supports the capability statement.

It does **not** mean:
- compatible with another project
- safe to reuse directly
- production-ready
- capability SAT for a new goal

Every extracted capability keeps `reuseDecision = UNKNOWN` until a concrete compatibility + verification pass is run.

## Current pass

- 33 public repositories represented
- 29 repositories with documented semantic extraction
- 4 repositories still UNKNOWN
- 115 documented capability candidates

Empty repositories remain UNKNOWN.

## Flow

```text
Repository Catalog
      ↓
README / AGENTS / architecture / source inspection
      ↓
DOCUMENTED capability inventory
      ↓
Goal-specific compatibility check
      ↓
REUSE / ADAPT / BUILD
      ↓
Verify
      ↓
Canonical Knowledge Graph
```
