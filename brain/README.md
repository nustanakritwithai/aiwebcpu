# Project Brain Web Viewer V0.2.1

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
- mobile layout

## Deliberate limits

V0.2 timeline is an event timeline. It does not yet reconstruct a historical graph because edges do not yet carry complete `valid_from` / `valid_to` temporal metadata.

Next milestone: temporal edge validity + graph replay slider.


## UX/UI V0.2.1

- mobile bottom-sheet detail inspector
- quick presets: All / Core / Reuse / Problems / Evidence
- one-hop visual Focus Mode using the existing graph dimming contract
- deep-link selected nodes with `?node=<id>`
- persisted preset/focus preferences in localStorage
- compact Brain Pulse metrics
- sticky section navigation
- larger touch targets and mobile graph viewport

The UX layer is kept in `brain/ux.js` so graph layout/rendering and interaction presentation remain separable.
