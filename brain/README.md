# Project Brain Web Viewer V0.5.3

Interactive read-only Knowledge Graph viewer for Project Brain.

## Live path

`/brain/`

The viewer fetches the canonical machine graph from:

`../project-brain/graph/project-brain.json`

It does not maintain a second graph dataset.

## V0.2

- node colors by type
- relation colors and arrow labels
- node search
- type filters
- pan / zoom / fit
- detail panel with incoming/outgoing relations
- timeline event cards
- responsive web layout

## Deliberate limits

V0.2 timeline is an event timeline. It does not yet reconstruct a historical graph because edges do not yet carry complete `valid_from` / `valid_to` temporal metadata.

Next milestone: temporal edge validity + graph replay slider.


## UX/UI V0.2.1

- responsive bottom-sheet detail inspector
- quick presets: All / Core / Reuse / Problems / Evidence
- one-hop visual Focus Mode using the existing graph dimming contract
- deep-link selected nodes with `?node=<id>`
- persisted preset/focus preferences in localStorage
- compact Brain Pulse metrics
- sticky section navigation
- larger touch targets and responsive graph viewport

The UX layer is kept in `brain/ux.js` so graph layout/rendering and interaction presentation remain separable.


## Temporal Graph V0.3

- checkpoint slider
- play / pause history
- jump to current knowledge state
- share historical view with `?at=<checkpoint-id>`
- node/edge visibility from `activeFrom` / `activeUntil`
- temporal node property materialization
- Brain Pulse metrics recalculate for the selected checkpoint

Time semantics are knowledge-state history, not inferred software creation dates.


## Interface Policy

The Web Viewer is the only human interface for Project Brain.

Desktop and mobile browsers use the same responsive application. There is no separate local-vault or device-sync interface.


## GitHub Scanner V0.4

The Web Viewer includes a Repository Change Inbox.

- accepted baseline for monitored repositories
- tracked evidence-file count
- exact-head CI evidence status
- pending scanner PR discovery
- pending candidates loaded from the scanner PR head
- API failure is displayed as UNKNOWN, never as “no change”

The scanner never writes semantic capability claims directly into the canonical graph.


## Repository Catalog

The web-only interface exposes the full GitHub repository catalog.

Current discovery boundary:
- 37 repositories discovered by the connected account
- 33 public repositories persisted and rendered
- 30 public repositories with commits
- 3 public empty repositories
- 4 private repositories omitted from the public dataset
- public exact-head CI: 16 SAT / 1 VIOL / 16 UNKNOWN

The catalog UI reads `project-brain/catalog/repositories.json` directly. It does not maintain a second repository dataset.

Every persisted public repository remains `semanticStatus = UNKNOWN` until capability verification.

Private repository names, commits and evidence are intentionally not published by the public Web Viewer.


## Capability Inventory

The Web Viewer reads `project-brain/capability-inventory/repositories.json` directly.

Current first semantic pass:
- 33 public repositories represented
- 29 repositories with DOCUMENTED extraction
- 4 repositories remain UNKNOWN
- 116 documented capability candidates

`DOCUMENTED` means the repository documentation or inspected source explicitly supports the statement. It is not a reuse verdict. REUSE / ADAPT / BUILD remains UNKNOWN until goal-specific compatibility verification.


## Verifier V0.5

The Web Viewer exposes checked-in goal-specific verification reports.

Verifier flow:

```text
DOCUMENTED capability
  ↓
explicit Goal Contract
  ↓
evidence freshness + explicit compatibility checks
  ↓
SAT / VIOL / UNKNOWN
  ↓
REUSE / ADAPT / BUILD
  ↓
review-only graph patch candidate
```

The browser does not reimplement verification logic. It renders reports produced/proven by `project-brain/verifier/verifier.mjs` and CI.

Current proof contract:
- `simclone-time-travel` → SAT / ADAPT

Auto graph write and auto merge remain disabled.


## Command Center UX V0.5.1

The Web Viewer now uses a reusable workspace shell instead of stacking every subsystem in one long page.

Views:
- Overview
- Knowledge Graph
- Repositories
- Capabilities
- Verifier
- Scanner
- History

UX rules:
- one primary view visible at a time
- deep links with `?view=<view>`
- global search across canonical Graph, Catalog, Capability Inventory and Verifier registry
- Overview metrics are loaded from canonical datasets
- desktop uses a persistent rail
- narrow layouts use a drawer + horizontal view navigation
- prefers-reduced-motion is respected

The shell lives in `brain/shell.js` and does not duplicate domain data.


## Decision Workspace V0.5.2

Adds a goal-centered read-only workspace:

```text
Goal
 ↓
Canonical NEEDS
 ↓
Verifier/canonical candidates
 ↓
Documented evidence
 ↓
SAT / VIOL / UNKNOWN
 ↓
REUSE / ADAPT / BUILD
```

Rules:
- Goal list comes from the canonical graph
- verifier is matched by explicit `goalId`
- candidate rows come from a verifier report or canonical NEEDS/PROVIDES relations
- no keyword/fuzzy recommendation is performed in the browser
- a Goal without an explicit verifier contract remains UNKNOWN
- the workspace never writes contracts, reports, patches or graph state
- deep links preserve `?view=decision&goal=<goal-id>`


## Complete Graph Coverage V0.5.3

The Knowledge Graph now includes the complete public semantic inventory:

- 33 public repository PROJECT nodes
- 116 DOCUMENTED capability-candidate nodes
- 42 documentation evidence-file nodes
- DOCUMENTS and DOCUMENTED_BY relations

Graph UI distinguishes:
- Verified Capability
- Documented Capability

The Documented preset isolates repository → candidate → documentation evidence paths.

Large graph layout uses bounded iterations for browser performance.

CI verifies that Graph coverage remains synchronized with the Repository Catalog and Capability Inventory.
