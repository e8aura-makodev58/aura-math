# P4 bar charts, pie charts and nets: dispositions of the review (binding on the coding agents)

**Status: written 2026-10-07 by Claude as lead, because Codex is unavailable for several days.** This is the lead's assessment of the independent review in [p4-charts-nets-review.md](p4-charts-nets-review.md) of the plan in [p4-charts-nets-plan.md](p4-charts-nets-plan.md). It is **not** an independent assessment of the review (the lead also commissioned the plan), so Codex should re-check it when it returns. It approves no lesson content and no curriculum placement; nothing is published.

**Precedence for the coding agents:** where this document conflicts with the plan, this document wins. Where the review and this document differ, this document wins. Everything else in the plan stands.

## Dispositions

| ID | Sev | Disposition | Decision |
| --- | --- | --- | --- |
| R-75 | High | **Accept** | Each catalogue net (triangular prism, square pyramid, and any other non-grid net) is stored as exact **integer vertex lists** per face with a fixed orientation. A test glues edges: every non-shared edge must pair with exactly one other edge of equal **squared** integer length, each net edge is glued exactly once, and the face angles meeting at every vertex of the folded solid total under 360 degrees (an angle test in exact integer arithmetic, no floats). A mirrored face must fail a test written for that purpose. Drop the `variant` field: exactly one catalogue entry per solid in this phase. Compare slant edges as squared integers (the pyramid slant is the square root of 29). |
| R-76 | Med | **Accept** | Cuboid nets store only the three edge lengths (a, b, c). Cell sizes are **derived from the fold** (assign a, b, c to the three opposite-face pairs from the fold map, then compute each cell's width and height); a test asserts any stored size equals the derived one. Cuboid nets whose faces do not align to a hexomino grid are **out of scope** and must be stated in the lesson wording limits. |
| R-77 | Med | **Accept** | SVG text floor: **15 units** in a 400-wide viewBox, **16** in a 360-wide net sheet (the phone scale is about 0.75, not 0.9). A browser check measures each text element's rendered height at a 360 px viewport and **fails** below 11 px. |
| R-78 | Med | **Accept** | Bar-chart bounds are derived, not stated twice: maximum value = `rows * step` with `rows <= 10` (so step 2 caps at 20, step 5 at 50, step 10 at 100, step 20 at 200). Category label length limits are written per category count and checked by the validator with a conservative width estimate. **Zero-value bars are not allowed** in this phase (invisible bars add confusion). The lesson-matrix text must not contradict the validator. |
| R-79 | Med | **Accept** | Thresholds: text 4.5:1, graphical marks 3:1. Use a darker orange than `#c0561f` (which is 4.498:1) wherever it is text. Decorative borders are exempt and the planned border 3:1 test is **removed**. State plainly that pie segments are told apart by direct labels and a white stroke, not by contrast alone. |
| R-80 | Med | **Accept** | Keep the pure collision function, test it with a hand-built overlapping case, and add a **browser check** that measures every pie label's `getBBox` against the viewBox and against its neighbours. Use a conservative width estimate (0.65 em for bold capitals). |
| R-81 | Med | **Accept with modification** | Add a **fifth pie lesson**, `p4-read-pie-sectors`: no spokes, sectors that are one half, one quarter and eighths, which the learner must recognise as fractions of the whole, plus a choice "is a slice an amount or a share of the whole?". The pie family becomes five lessons (twelve lessons in the batch). Sector angles and percentages stay **out** as learner answers (the evidence puts percentages at P5); revisit only with the school's topic list. |
| R-82 | Med | **Accept with a default; open decision recorded** | Default: **follow the existing line-graph precedent**: the text alternative lists the data, and the resulting answer leak for screen-reader users is recorded for human accessibility review. Reason: withholding the data would make independent mode unreachable for a screen-reader learner, which is worse than the leak. This is a product decision for the user and a human accessibility reviewer; it is listed under open questions and can be reversed with a one-line change per family. |
| R-83 | Med | **Accept with modification** | Update `tests/home-layout.test.ts` (tile list, "7 topics seen", "7 mixed questions"). Make those expectations **derive from `content/library.json`** instead of hard-coded numbers so future families do not break them. `spotlight.test.ts` needs no change. |
| R-84 | Med | **Accept** | New order: **WP0** kit change plus a regression test that re-emits one existing family byte-identically; **WP1 nets**; **WP2 pie charts**; **WP3 bar charts**; **WP4 integration and documentation**. If time is short cut `p4-bar-chart-practice` first, then `p4-complete-the-net`. |
| R-85 | Low | Accept | The manifest `contentImpactDecision` text is hand-edited; only the digest is scripted. |
| R-86 | Low | Accept | Give the new bar and pie icons distinct features (bar: axis with ticks and a legend swatch; pie: spokes) and look at screenshots. |
| R-87 | Low | Accept | Change one starter value in each lesson that repeats an answer across steps (pie-count, double-bar). |
| R-88 | Low | Accept | Net strings are normalised on parse (trim blank rows and columns); templates must already be normalised. Offer the corner-reason choice as well as the overlap reason where a 2 by 2 block is the fault. |
| R-89 | Low | Accept | Add a note to the evidence file that net drawing and isometric-grid tasks may be syllabus items and are out of scope. |
| R-90 | Low | Accept | State "no interpretation" explicitly for the bar, pie and net practice lessons. |

## Open questions for the user (none blocks starting)

1. **Pie chart scope.** The batch teaches pie charts as fractions of a whole, with no percentage or sector-angle answers. Do you want a later optional lesson on sector angles or percentages, or wait for your school's topic list?
2. **Screen-reader text.** Default recorded above: the text alternative lists the data. Do you want that, or do you prefer the stricter version that withholds values?
3. **Level labels.** Pie charts and nets are tagged "P4 candidate, level unconfirmed"; bar charts are tagged as a P3 bridge. Is that the right framing for your child's assessment?

## Not verified, so do not claim it

The official MOE syllabus and every school-hosted PDF were unreadable (404 or 403), so placement rests on provider pages. Real rendering widths, the container width at 360 px, icon similarity and whether the prism and pyramid drawings fold are unverified until built and viewed. No human has reviewed any wording, hints or geometry.

## Gates between work packages

After each package the lead (not the coding agent) runs: typecheck, lint, format, the full unit suite, content validation, both builds, the artifact scan and the full browser suite, and views screenshots. A package is not accepted on the coding agent's own report. The next package starts only when the previous one is accepted.
