# ADR-009: Bar charts, pie charts and nets

Status: implemented 2026-10-07 by Claude as lead (Codex unavailable). Not independently assessed; see `handover.md`.

## Decision

Add three topic families to the P4 library on the existing kit (`src/topics/p4-kit.ts`), with application contract 3 and schema 3 unchanged:

- **nets**: cube-net validity by a rolling-cube fold (also rejecting nets with a 2x2 block), opposite faces, solid from net (cuboid, triangular prism, square pyramid, cube), complete the net. Prism and pyramid nets are a hand-built catalogue with exact integer vertices and an edge-gluing and vertex-angle test. Cuboid nets store only (a, b, c); sizes are derived from the fold.
- **pie charts**: fractions of a whole only (4, 5, 6, 8, 10 or 12 slices); no percentages or angles as answers. Five lessons, one with no spokes.
- **bar charts**: scale steps 2, 5, 10, 20; at most 10 rows; maximum value derived as rows x step; no zero bars; double bars use a pattern overlay and legend, not colour alone. Tagged `p3-bridge`.

Answers are exact integers from the model. Test oracles are written differently from production code (including reading arcs and rects back out of the rendered SVG). Floats are used only for drawing coordinates. SVG text floor is 15 units in a 400-wide viewBox (16 in 360).

## Consequences

- Placement (P4 candidate; bar charts a P3 bridge) rests on provider pages; the official MOE syllabus was unreadable.
- Text alternatives list the chart data (line-graph precedent), which leaks answers to screen-reader users; recorded for human accessibility review.
- Percentages and sector angles are deferred pending the school's topic list.
- Reasoning and dispositions: `docs/p4-charts-nets-{evidence,plan,review,dispositions}.md`.
