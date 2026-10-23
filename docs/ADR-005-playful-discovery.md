# ADR 005: illustrated topic discovery

Status: accepted 2026-10-05 after Codex assessed Claude’s single review R-55–R-63.

The learner and development entries share one library presentation. Home shows a compact illustrated welcome and topic tiles; selecting a tile opens a dedicated topic view with focused heading. Search, level filters and All lessons give exhaustive access. Author surface keeps a complete catalogue and author controls. Hash navigation applies the requested state after destroying the previous library view; separate home and lesson scroll positions preserve return context.

All tiles, counts, starting actions and descriptions derive from the entry’s permitted `LibraryRecord[]`. Decorative SVGs contain fixed shapes and no lesson data. Empty approved content shows no topic tiles or starter action. Author code and packages remain excluded from the learner artifact. Static design studies stay under `docs/design/`, outside build inputs.

The index accepts an optional bounded plain-text lesson `blurb`, so earlier synthetic/index fixtures remain readable. The six topic descriptions and 18 new blurbs are learner-facing copy covered by the index digest; changed copy requires human review before publication. Package digests are unchanged.

Visual impact: six decorative topic icons replace the generic fallback, and page-level `data-topic` accents plus CSS refine the lesson stage. Mathematical diagrams, prompts, answers, hint sequences and lesson region contracts are unchanged. The existing 39 shared lesson-view checks and six original/twelve expanded lesson fixtures pass without snapshot regeneration. These checks establish compatibility, not pedagogical approval.

Measured accent-on-surface contrast ratios: comparison 4.95, angles 5.59, place value 5.19, equal groups 4.81, fractions 5.41 and picture graphs 5.42. Body, secondary text and focus token pairs measure 11.23, 6.05 and 6.05 respectively. Keyboard focus, 44px core navigation targets, reduced-motion navigation and responsive fit are checked in Chromium. Native browser zoom, full contrast/target auditing, assistive technology and real devices remain separate verification.

The user authorised implementation after the single review. A static mock and captured real views provide reviewable visual evidence; a second permission gate or Claude round was not added. User feedback determines whether the page recaptures the intended playful character.

Token pairs used for the measurements: comparison `#95523b / #f8e8dd`, angles `#2b6669 / #e2f0ee`, place value `#855c16 / #fbefd0`, groups `#9c4e42 / #fae4de`, fractions `#725287 / #f1e9f5`, graphs `#216a65 / #e0f1eb`; body `#253f34`, secondary `#53665a` and focus `#9a4c10` against `#fffdf8`. Codex independently recalculated these sRGB relative-luminance ratios after integration.
