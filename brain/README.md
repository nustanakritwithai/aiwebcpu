# Project Brain Web Viewer V0.2

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
