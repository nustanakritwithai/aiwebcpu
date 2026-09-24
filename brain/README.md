# Project Brain Web Viewer V0.4

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
