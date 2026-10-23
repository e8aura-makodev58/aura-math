# Interactive manipulatives (workbench): dispositions of the review (binding on the coding agents)

**Status: written 2026-10-10 by Claude as lead, because Codex is unavailable.** This is the lead's assessment of the independent review in [interactive-manipulatives-review.md](interactive-manipulatives-review.md) (R-91 to R-110) of the plan in [interactive-manipulatives-plan.md](interactive-manipulatives-plan.md). It is **not** an independent assessment (the lead commissioned the plan), so Codex should re-check it when it returns. It approves no lesson content or curriculum placement. Nothing is published.

**Precedence for the coding agents:** this document wins over the plan; where the review and this document differ, this document wins; everything else in the plan stands.

**Codex follow-through:** independent dispositions for R-91–R-110 and the implemented remaining 2D scope are recorded in [codex-2d-manipulatives-plan.md](codex-2d-manipulatives-plan.md). This does not retroactively certify all earlier nets engineering or human content review.

## User answers (2026-10-10) and how they are applied

The user said "yes and asap for all" to the plan's open questions and asked what question 5 meant; after the explanation they said they want it on a 2D/3D viewport.

1. Order net folder, protractor, symmetry: **yes**.
2. Cuboid, prism and pyramid folding: **in the first wave**, not later. Cube first (it proves the renderer); the other solids follow in the same package group (WP1b).
3. Protractor alignment is **assessed** (the plan's choice), subject to R-93 and R-94 below.
4. Saved record of what the learner did: first read as yes, then the user said (2026-10-10) it **can come later and to push it back**. It is **deferred and not scheduled**: no work package, no core change, no contract bump in this phase. It needs an additive core change and probably a version bump with a migration, so it will get its own plan, review and ADR when the user asks. The workbench must not depend on it.
5. Offline suggestions (paper net, real protractor): **dropped**. Everything is on screen.
6. Caption reviewer and a real phone: **unanswered**. Human caption review stays an outstanding gate; testing is emulation only.

## Dispositions

| ID | Sev | Disposition | Decision |
| --- | --- | --- | --- |
| R-91 | High | **Accept** | The spike's first criterion is extended to per-hinge tween frames (t in steps of 1/8, other hinges at 0 or 1) and every view the controls can reach, not four presets. Default design: **show only 0 and 90 degrees and snap between them** (a short non-geometric cue or none), because painter's order is sound for end states; use a mid-fold tween only if the spike shows it passes with a per-face nearest-point depth sort or face splitting. The measured disagreement number is recorded in the handover. |
| R-92 | High | **Accept** | Counts corrected: 11 cube nets, 8 non-cube hexominoes with a 2x2 block, **16** without; of those, **14** have exactly one coincident face pair and are the `collide` pool (two nets with two pairs are not used). The spike includes coincident frames and renders coincident faces distinguishably (offset, outline and both letters). The `missing` step is rewritten as a plain question: "which face of the cube is not covered by any square?", derived in the model and tested where one pair collides. |
| R-93 | High | **Accept** | The `draw` step may not be answered by the number in its own prompt. Replace it with a derived question after the learner builds the angle (for example: what size is the angle on the other scale, or is it acute or obtuse and what is its supplement). If no honest derived form exists, **cut `draw` first** (it moves to the front of the cut order). The lesson note states plainly that drawing is practice and what is assessed is the derived answer. |
| R-94 | High | **Accept** | `zeroEnd` is defined for **either arm** lying on the baseline. The correct scale is a property of that arm and the side of the other arm. The mapping from the spec's `flip` to the sign of `turn` is written in the plan appendix before coding. The brute-force oracle covers both-arm cases. A correct alignment on the second arm must never be rejected. |
| R-95 | High | **Accept** | The coding agent adds a lifecycle table (events, mount key, creator, destroyer) before editing `lesson-view.ts`. Mount key includes a trial counter. Add hint-rung and trial-start notifications, edit-mode rebuild only when relevant spec fields change, `setAnswer` that finds controls by choice id after rebuilds, a `<details>` wrapper for workbench steps only, and `destroy()` that cancels rAF, `matchMedia` and window listeners. WP0b's exit test covers replay, Try another, hints 1 to 4, mode switch, wrong check then Undo, edit-mode typing and a listener-leak check. `src/core/` stays untouched. |
| R-96 | Med | **Accept** | Measure the real content width at 320 and 360 px in WP0b. The shade grid is 6 columns (even, as the validator requires) and must fit; if 44px squares do not fit at 320, use the smallest square that fits, state the measured exception honestly, and keep the keyboard and button route. Seven columns are not used. |
| R-97 | Med | **Accept** | Snap radius is set in screen pixels, not viewBox units. Decision: the **snap cue is allowed only as neutral position feedback** ("lined up with the line"), with no live-region claim that the answer is right; alignment is assessed by the derived answer, not by the cue. Grips are offset handles, not on the vertex. |
| R-98 | Med | **Accept** | Each step states its selection gesture (DOM face buttons with the face letter in the accessible name for folding). The list version is documented as a parity route that does not make independent mode harder to guess. `place` offers a bounded, grouped list (lines through the grid middle and diagonals only). |
| R-99 | Med | **Accept** | For two-valued steps (such as `scale`) the Watch example has the **same answer on a different surface** (angle, side, net), or Watch is method-only wording. "Different instance" is not read as "uninformative". |
| R-100 | Med | **Accept with a choice** | The symmetry ghost is **gated behind hint rung 2** (consistent with ADR-008) and each symmetry lesson ends with a transfer step with the preview off. The completion note does not claim independence beyond that. Undo and magnet snap are recorded as scaffolds in the note. |
| R-101 | Med | **Accept** | The new nets oracle uses a different method (axis-angle float rotation with face coincidence by tolerance, in the test only) plus the rolling-cube result. A test requires the **picture, the judged answer and the oracle to agree** on all 11 cube nets and the 14 collision nets, in all orientations. |
| R-102 | Med | **Accept** | Grips are absolutely positioned HTML buttons over the SVG (44 CSS px, real focus ring, real `touch-action: none`). The spike checks touch emulation (noting emulation is not a device). |
| R-103 | Med | **Accept** | The `workbench` tag is set in the package via `p4Package` extraTags, not in `content/library.json`. The generic all-lessons Playwright loop gets bench helpers; collapsed `<details>` radios must not break existing specs. The loop's timeout is raised if needed. |
| R-104 | Med | **Accept** | Each lesson states what a non-visual learner can and cannot do; no parity is claimed. Human accessibility review remains a gate. |
| R-105 | Low | **Accept** | Keep the +30 KB JS / +6 KB CSS ceiling, measured before and after each package; the handover says the code ships dormant until content is approved. |
| R-106 | Low | Accept | WP2 can start only after WP0b is accepted; the plan's day estimates are guesses and are not commitments. |
| R-107 | Low | Accept | Reduced-motion is tested with a fake clock in unit tests and a transform sample in the browser, not with `document.getAnimations()`. |
| R-108 | Low | Accept | Undo then Check is a new submission and history is not trimmed. Pointer and `matchMedia` listener leak test in WP0b. iOS and low-end phone behaviour are recorded as limits. |
| R-109 | Low | Accept | Q3 is resolved above; Q1, Q2, Q4 and Q5 were answered by the user; Q6 is a process gate. |
| R-110 | Low | Accept | The CSS 3D rejection is reworded: a nested hinge tree makes every face a `preserve-3d` parent, which is the real problem, not leaf tints. The conclusion (SVG with an orthographic camera) stands. |

## Work package order (binding; replaces the plan's where different)

WP0a spike (SVG fold renderer proof, with the R-91, R-92 and R-102 criteria) then WP0b foundation (lifecycle, host, bench kit, lifecycle test), WP1 net folder for cube nets then WP1b cuboid, prism and pyramid, WP2 protractor, WP3 symmetry, WP4 lead integration and documentation. The saved learner record is deferred by the user and is not a package in this phase. **If the spike fails its criteria, work stops and the user is asked.** Cut order if time is short: `draw` lesson, mirror-line lesson, fold-collision lesson, shade lesson. Never cut the foundation, the cube folding lesson, the protractor read lesson, the keyboard and reduced-motion paths.

## Not verified, so do not claim it

iOS Safari and any real device; `touch-action` on SVG children (avoided by HTML grips); jsdom `PointerEvent` support; grid width at 320 px until measured; screen-reader behaviour; frame cost on low-end phones; the MOE placement of these topics; all web evidence is summaries. No human has reviewed any caption, hint or geometry.

## Gates between work packages

After each package the lead (not the coding agent) runs: typecheck, lint, format, the full unit suite, content validation, both builds, the artifact scan and the full browser suite (library workaround in README), measures the learner bundle, and views screenshots. A package is not accepted on the coding agent's own report.

## Amendment (2026-10-10): renderer switched to three.js (user direction)

The user pointed to the three.js viewport in their own project (`/home/makodev58/loci/loci-app/src/viewport/components/ViewportPanel.tsx`, three 0.162, `WebGLRenderer`, `OrbitControls`) and asked to stop the spike, which had run long. The WP0a spike was stopped before writing its report; its partial results in `spikes/fold/results/` (throwaway, not part of the app) showed:

- SVG painter's order: 0 mismatches for cube and collision nets at end states, but **large failures for the cuboid and triangular prism** (worst case fully wrong) at both end states and tween frames. SVG cannot meet the user's first-wave request for cuboid, prism and pyramid folding.
- three.js in headless Chromium rendered folded and mid-fold frames with legible letters (`docs/screenshots/manipulatives/gl-*.png`); scene-graph corner positions matched the exact model to about 1e-15; picture vs judged answer agreed on 384 of 384 checks; the collision pool is confirmed as 14 nets (2 with two pairs, 8 with a 2x2 block, 11 cube nets).

**Decision (supersedes the plan's SVG choice and the parts of R-91, R-102 and R-110 about painter's order):** the 3D net viewport uses **three.js (WebGL)** with a depth buffer. Mid-fold tweens are allowed. The exact integer fold state stays the source of truth and the judged answer never depends on rendering. Constraints: the viewport is **lazy-loaded with `import()`** so only workbench lessons pay; render on demand (not a continuous loop); controls and hinge actions are HTML buttons (R-98, R-102 stand); reduced motion shows stepwise stills; WebGL unavailable or context lost falls back to a still image plus the button route; dispose geometries, materials, renderer and listeners on destroy. The +30 KB budget (R-105) applies to the **main** learner bundle; the lazy 3D chunk gets its own measured budget, recorded in the handover. Protractor and symmetry stay 2D SVG. No further exhaustive sweeps: tests use the pure model, scene-graph matrix read-back against an independent float oracle, and a few browser screenshots.
