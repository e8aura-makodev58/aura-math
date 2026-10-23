# Interactive manipulatives: evidence register

Written 2026-10-10 by a planning agent. Planning evidence only. Not a curriculum verification, not reviewed, not approved. Companion: [interactive-manipulatives-plan.md](interactive-manipulatives-plan.md).

## How "read" is used here

Every web fetch below went through a tool that returns a short summary written by a small model, not the raw page; "fetched" means I relied on that summary. Web searches returned result lists with short model-written summaries. None of this is a primary-source reading, and quotations are only short phrases the tool reported.

## 1. Fetched pages (summary relied on)

| ID | URL | What the summary said | Limits |
| --- | --- | --- | --- |
| E1 | https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html | SC 2.5.7 Dragging Movements, Level AA: all functionality that uses dragging can be done with a single pointer without dragging, unless dragging is essential or user-agent controlled; keyboard support alone does not satisfy it. | Summary only. |
| E2 | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | SC 2.5.8 Target Size (Minimum), Level AA: at least 24 by 24 CSS px, with exceptions; mentions the stricter 2.5.5 Enhanced but gave no pixel figure. | The 44 px figure in the plan is the repo's convention, not taken from this page. |
| E3 | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | SC 2.3.3, Level AAA: motion animation triggered by interaction can be disabled unless essential; `prefers-reduced-motion` techniques in CSS and JS. | Summary only. |
| E4 | https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action | `none` disables browser gestures (warns it blocks zoom); `pan-y`, `manipulation` explained; a browser-handled gesture sends `pointercancel`. | Summary only. |
| E5 | https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture | Capture routes events to the element until release; auto-released at `pointerup`; handle `lostpointercapture` and `pointercancel`. | Summary only. |
| E6 | https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style | `preserve-3d` is forced back to flat by `overflow`, `opacity` below 1, `filter`, `clip-path`, `mask-image`, `mix-blend-mode`, `isolation: isolate`, paint containment. | Summary only; drove the CSS 3D decision. |
| E7 | https://www.mathlearningcenter.org/apps | Thirteen apps: Fractions, Geoboard, Math Clock, Math Vocabulary Cards, Money Pieces, Number Chart, Number Frames, Number Line, Number Pieces, Number Rack, Partial Product Finder, Pattern Shapes, Whiteboard. Based on visual models from Bridges in Mathematics; shareable by a code or link. | No nets, protractor or symmetry app listed. Design rationale not read. |
| E8 | https://polypad.amplify.com/p (redirect from mathigon.org/polypad) | Lists "3D Solids" (Platonic Solids, Other Polyhedra) under Geometry and an "Angle" tool under Utensils. | No detail on folding, nets, protractor or controls. |
| E9 | https://mathsnoproblem.com/blog/teaching-tips/tips-teaching-angles | Teacher blog: learners confused the inside and outside protractor scales and confused reflex and obtuse angles; measuring steps stress baseline on baseline and midpoint on the vertex; concrete examples first. | One teacher's report; not research; no rates. |

## 2. Searches (result summaries only, no page opened)

| ID | Query topic | What the summary said | Limits |
| --- | --- | --- | --- |
| S1 | Math Learning Center apps | Free web apps (Geoboard, Number Line, Fractions, Number Pieces, Pattern Shapes) with virtual manipulatives; no account. | Corroborates E7. |
| S2 | Polypad nets | Polypad has 3D solids that fold and unfold; teacher accounts get lesson libraries. | Unverified; E8 could not confirm. |
| S3 | Singapore CPA and 2021 syllabus | CPA (concrete, pictorial, abstract; after Bruner) is advocated by MOE since the early 1980s and the 2021 syllabus keeps it. Hits included MOE school briefings and a NIE paper. | None opened; no geometry content detail. |
| S4 | Protractor misconceptions | Inner/outer scale confusion; read the scale that shows 0 on the baseline arm; wrong scale gives 180 minus the reading; centre/baseline misplacement. | Teacher resource pages; no studies. |
| S5 | PhET implicit scaffolding | PhET describes "implicit scaffolding" built into controls, constraints, feedback and representations to support guided inquiry; framework from about ten years of work (Chem. Educ. Res. Pract. 2013 and arXiv 1306.6544). | Papers not read (below). |

## 3. Could not read

* The official MOE 2021 primary mathematics syllabus: the MOE page I fetched contained no syllabus content. P4 placement of nets, angle measurement and symmetry therefore rests on the earlier provider evidence in `docs/p4-charts-nets-evidence.md` and `docs/p4-curriculum-evidence.md`.
* The PhET implicit-scaffolding paper: the arXiv PDF came back garbled (the fetch summary was mostly generic and is not used as evidence); the RSC publisher page returned 403.
* GeoGebra nets applet (404 at the URL I tried); no GeoGebra page was read.
* Any peer-reviewed study on virtual manipulatives or on protractor teaching; none was found or opened. The plan makes no effectiveness claim.
* How Polypad's or MLC's apps are actually operated (no hands-on use).

## 4. Own knowledge, not sources

The following are my own background knowledge and are marked so a reviewer can check them: the exact 44 px figure of WCAG 2.5.5; that an orthographic projection maps a plane to the screen by an affine map; that the existing pyramid catalogue entry (base 4, slant height 5) has apex height the square root of 21; jsdom's support for `PointerEvent`.
