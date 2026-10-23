# Interactive manipulatives (the "workbench"): plan

**Status: written by a planning agent on 2026-10-10. Not approved; no human has reviewed it; nothing in it has been implemented, built or run in a browser.** Evidence and its limits are in [interactive-manipulatives-evidence.md](interactive-manipulatives-evidence.md). Per AGENTS.md this plan goes to one Claude review, then Codex records accept, modify, reject or defer for each recommendation before any implementation. Human lesson-content approval is separate. House style follows [p4-charts-nets-plan.md](p4-charts-nets-plan.md); where a later disposition document exists it wins over this plan.

**Request (user, paraphrased):** add interactive features where the application can demonstrate and the student can then do it themselves, in a viewport where the student can, for example, fold or unfold nets, measure angles with a protractor and shade symmetry.

**Implementation update (2026-10-10):** the renderer amendment in the dispositions governs the delivered nets workbench. Remaining 2D scope, independent review decisions and actual validation are in [Codex's follow-through](codex-2d-manipulatives-plan.md). The proposal below is retained as history; its original status, SVG rejection of WebGL, scale-assessment premise and lesson counts are superseded where specified.

## 0. Findings that shape the plan

1. **The step model can carry this without a new kind.** `Step.kind` is `choice | number | multi | exact`, and every manipulative in the first wave produces a result that already has an exact representation: a face letter (choice), a degree reading (exact), a set of cells (multi), a mirror-line position (choice over a finite list of lattice lines). The workbench is therefore an *input device and a demonstration surface* for existing steps, not a new response type. No schema or application-contract bump is needed for the first wave (section 1.4). This is the single most important decision and it is reversible: the bump triggers are listed so it is clear when the answer changes.
2. **The shared view re-renders from strings; a workbench is stateful.** `mountLessonView` rebuilds `[data-region="visual"]` with `innerHTML` whenever the visual string changes and compares a signature on every render. A drag in progress cannot survive that. The workbench needs a persistent host element with its own mount and destroy lifecycle, owned by the view but implemented by the topic (section 6.2). This is the one real change to shared UI code.
3. **No new `TopicId` is needed.** Nets, angle measure and symmetry already exist as runtime topics, author topics, tiles, icons and accents. Six new lessons use new `task` values inside them. That avoids a new tile, icon, accent colour, spotlight re-baseline and `Record<TopicId, ...>` ripples (the cost recorded for `nets` in the previous plan). The cost is that older app builds reject the new lessons for an unknown task, which is the same as every earlier content expansion.
4. **Existing evidence for the misconception that matters most (protractor scales) is third-party teacher writing, not research.** Two pages I read say learners confuse the inner and outer scale and mis-place the centre or baseline. Nothing I read gives error rates. The plan designs for the confusion but does not claim a measured effect.
5. **Level placement is unchanged and unverified.** Nets and angles are provider-placed at P4; the official syllabus could not be read (as before). Every new lesson stays "P4 candidate", draft.
6. **The Math Learning Center, Polypad and GeoGebra precedents were only partly readable** (section 5 and the evidence file). The plan uses them as prior art for *what exists*, not as evidence for *what works*.

## 1. Concept: the workbench

### 1.1 What the learner sees

A lesson step may carry a **workbench**: a bordered viewport placed in the visual panel above the question (below on a phone is wrong: the question text must stay visible, see 3.5). It has two phases per workbench step.

* **Watch.** The app demonstrates on a *worked example that is not the learner's problem*. Controls: Play/Pause, Back one move, Forward one move, Replay, and a caption line. The demonstration is a list of **keyframes** (each: a caption sentence, a target state, a duration). Play interpolates between keyframes; Back/Forward jump between them. The caption is real text in the DOM.
* **Your turn.** The same viewport shows the learner's own instance, with the manipulative live. Controls: the manipulative's own controls, Undo, Reset this step, and "Watch again". The answer is made by manipulating, and is then checked with the existing "Check my answer" button.

The learner can press "Your turn" at any time (Watch is never forced), and can return to Watch at any time. There is no timer and nothing auto-advances past a keyframe except while Play is running.

### 1.2 How it fits the existing step model

| Existing feature | Rule for a workbench step |
| --- | --- |
| Step, prompt, goal, four hints, `answer` | Unchanged. A workbench step is an ordinary step whose `goal` is registered by the topic as workbench-capable. The prompt tells the learner what to do with the manipulative. |
| Response kind | Unchanged and chosen per goal (section 2). The workbench **drives the existing answer controls** (sets the radio, checkbox group or text input). The form, `answer` action, `applyAnswer`, fixtures and the existing keyboard and screen-reader path are the same code. The radio or text control stays reachable inside a collapsed "List version of this answer" disclosure for anyone who prefers it or cannot use the workbench. |
| Check button, attempt history | Unchanged. Each check is one `submission` event and one `history` entry with the ordinary `answer` action. |
| Hint ladder (4 rungs, rung 4 a labelled "Worked step · reveal") | Unchanged in shape and counting. Hint wording for these steps may refer to the manipulative. Rung 4 additionally plays the solution **on the learner's own instance** in Watch style (it is the reveal, counted by the existing `reveal` event and "uses support" label). |
| Alignment guides, ghost previews, snapping marks | These are "mathematical overlays". Following ADR-008, they are shown only when a hint rung of at least 2 has been used, or when the step's goal is one where the overlay *is* the teaching (Watch, always). |
| Modes independent/guided | A mode switch does not remount the workbench and keeps its state. In guided mode the existing facilitator note appears; the workbench adds one authored "Talk about it" prompt per step (not assessed). Mode events are unchanged. |
| Reflection step | Unchanged: a structured choice step with no workbench. |
| Draft status | Lessons are `reviewStatus: "draft"`, level "P4 candidate", evidence `candidate`. Watch captions and the demonstration example are authored wording and need the same human review as hints. |
| Completion label | "Completed without app support" today means no hints or worked solution. Watching the demonstration is **not** support, because it uses a different example and teaches the method (as a story paragraph does); replaying it is free. Using rung 4 on the learner's own example is support, as now. Section 3.6 states how the label's note is worded so it does not over-claim. |

### 1.3 Different instances for Watch and Your turn

The spec carries two instances: `demo` (what the app demonstrates) and the learner's own. The validator requires them to differ in the property that determines the answer (different face asked, different angle, different cell set). Consequences: the Watch captions and screen-reader text may state conclusions ("D is the lid") without leaking the learner's answer; replaying Watch cannot be used to read the answer off. The learner's instance is never narrated in Your turn except at rung 4.

### 1.4 Does this need a new step or response type? Schema and contract consequences

**Recommendation: no.** Smallest honest change:

1. New `task` values in existing topics (`nets`: `fold`; `angle-measure`: `bench-read`, `bench-draw`; `symmetry`: `bench-mirror`, `bench-shade`). Existing starters stay byte-identical (guarded by the existing `tests/p4-kit-regression.test.ts` pattern, extended).
2. Additive **optional** specification keys where an instance needs them (`demoNet`, `demoDegrees`, and so on, section 2). The strict key check (`hasOnlyKeys`) lists them; absence is valid.
3. One additive optional capability on `RuntimeTopic`: `workbench?(lesson, step): WorkbenchFactory | null` (section 6.2). `Adapter`, `Session`, `Action`, the core runtime and `AssessmentEvent` are **not changed**.
4. Schema stays 3 and application contract stays 3. The previous plans' precedent is that a new task or topic needs no bump and older readers simply reject lessons they do not know; ADR-006 bumped to 3 only when a new *response representation* (exact) appeared that older validators would misread.

**Why this is honest and not a dodge:** the step really is answered by a face letter, a number or a set. The workbench cannot make the learner use it, and the plan says so (3.6, 9). What the model judges is the outcome, exactly.

**When the answer becomes yes** (any one of these):

* a step whose result has no honest `choice`, `multi` or `exact` form (for example "draw a free polygon" or "drag three labels to positions"), or one with unbounded continuous state;
* authors may store workbench *content* in the package that the runtime validates structurally (author-drawn nets, custom keyframes, free coordinates), not just the existing spec fields;
* the session must persist or replay a workbench trace in saved results.

If it happens: add `kind: "bench"` (schema 4, contract 4), taught to `validateLesson` (`oneOf` at `src/content/validation.ts`), `package-validation.ts` (the kind list, the "requires schema version" rules, fixtures), `fixturesFor`, the author model and `lesson-view`; follow the ADR-006 migration pattern (v1 to v3 stay readable and byte-identical; the first edit promotes to v4 with original provenance and one version increment; undo restores the source; no chained migration); update the release gate and the manifest envelope decision; and write an ADR. This is estimated at 2 to 3 days plus review and is **not** part of this plan.

### 1.5 Attempt history and replay

Today `Session.history` and `events` store `answer` actions. The plan keeps that: attempt history for a workbench step is the sequence of checked answers, as for every other step. Each manipulative nevertheless has a **pure, serialisable, replayable state model** (section 4): a state type and a reducer `(state, move) => state`, with a `moves` log. Replay is used in tests (random move sequences reach the same state in any legal order) and by the Watch demonstration (a keyframe is a state). Recording the move log in the session (a new `bench` event or an optional field on `Action`) is **deferred**: it is an additive core change with no consumer yet (the journal keeps 20 in-memory attempts and nothing is persisted). Open question Q4 asks whether the user wants it.

## 2. First wave: manipulatives, lessons and ordering

### 2.1 Selection and ordering (and why)

| Order | Manipulative | Why first/next | Risk |
| --- | --- | --- | --- |
| 1 | **Net folder** (cube nets) | The user's lead example; the only one that needs 3D; the riskiest unknown (rendering and pointer handling), so proven first by a spike (WP0a). Exact model already exists (`foldsToCube`, 216/35/64/11 oracles). | High |
| 2 | **Protractor** (read and draw) | Strongest documented confusion (scale, centre, baseline); 2D; drag plus rotate is the hardest *input* design after the fold. The existing angle-measure lessons only show a drawn protractor. | Medium |
| 3 | **Symmetry** (place a mirror line, shade to complete) | Cheapest (2D integer grid, existing model), and the live reflection preview is simple. Lowest risk; also the first thing to cut if time is short because the existing symmetry lessons already cover recognition. | Low |

### 2.2 Net folder (cube nets; grid nets only in wave 1)

**Representation.** The existing net string (rows joined by `/`, `#` or letters `A` to `F`). Wave 1 uses nets with **no 2 by 2 block**, so the cell-adjacency graph is a tree (5 hinges for 6 squares) and every hinge can fold independently. A 2 by 2 block is a cycle of creases that cannot all fold; the model refuses it in this task (validator) and the existing `check` lesson already covers why.

**View.** An SVG with an orthographic camera (section 2.2.1) showing the sheet flat and folding. Faces carry their letter on both sides. Colour: the side that faces the viewer when flat is the *inside* once folded; both sides use accessible tints; back faces are drawn with a pattern (diagonal hatching) so that "which side" is not conveyed by colour alone.

**Controls (all DOM buttons below the canvas, 44 px high; canvas taps are an extra, not the only route):**

* an ordered list "Creases", one toggle button per hinge, labelled by what it joins ("Crease 1: between A and B, flat or folded"), pressed state in `aria-pressed`;
* "Fold all", "Unfold all", Undo;
* "Turn the view": four arrow buttons (15 degree steps of yaw and pitch, clamped) and presets (Front, Side, Top, Corner). **No free orbit drag in wave 1** (no hidden gestures; the canvas stays scrollable).
* Tapping a hinge on the canvas toggles it as well; the hit target there is a screen-space circle of at least 44 px diameter, but because nearby hinges can overlap in folded states the DOM list is the guaranteed route.

**Lessons (2):**

| Lesson ID | Title | Skills | Steps (goal: kind) |
| --- | --- | --- | --- |
| `p4-fold-a-cube-net` | Fold it and see | Fold a cube net and say which face is the lid. | `fold-top`: choice (letter on top when the stated face is the floor); `fold-opposite`: choice (letter opposite a stated face); `reflection`: choice |
| `p4-fold-a-net-that-fails` | Folds that collide | Fold a six-square net that does not make a cube and find the pair of faces that land on the same place. | `collide`: choice (a pair of letters, three offered pairs); `missing`: choice (which face of the cube has no square: named by the face the stated floor face would be opposite to); `reflection`: choice |

The Watch example for lesson 1 is a different valid net (for example a cross); the learner's net is one of the 1-4-1 or 2-3-1 shapes. For lesson 2 the Watch example is a failing net whose collision pair the caption states ("B and D land on the same spot"), and the learner's net is a different failing net. All net strings are original selections from the 11 and 24 sets already enumerated in `tests/p4-nets.test.ts`; none is traced from a paper.

**Answers** (all from the existing exact functions): `fold-top` = the letter whose face is `oppositeFace` of the root's face (via `oppositeLetters` on the labelled net with the stated floor); `fold-opposite` = `oppositeLetters`; `collide` = the unordered letter pair with equal closed-state face id (validator requires exactly one such pair); `missing` is derived the same way. Distractors are the other touching pairs, chosen in a fixed order.

**Wave 2 (not in this plan's scope but designed for):** cuboid nets fold exactly in integers (three edge lengths, 90 degree creases, `cuboidLayout`); triangular prism and square pyramid nets do not close at 90 degrees and the pyramid apex height is the irrational square root of 21 for the existing catalogue entry (base 4, slant height 5), so their *final coordinates are not integer*. Judgement there must be combinatorial (which edges meet, using the catalogue's `glue` list) and the 3D picture is float-only. They also expose the `clip-path` flattening problem (2.2.1). Deferred and marked later.

#### 2.2.1 Rendering technology: decision and fallback

| Option | For | Against |
| --- | --- | --- |
| **SVG, orthographic projection, painter's order (recommended)** | No dependency. Each face is a `<g transform="matrix(a b c d e f)">`: for an orthographic (parallel) camera a flat face maps to the screen by an *affine* map, so its polygon, letter and hatch transform together exactly. Persistent nodes updated per frame by setting the `transform` attribute. Fully testable in jsdom (read the matrices back and compare with exact integer projection, as the repo already reads arms and arcs back out of SVGs). Matches the repo's all-SVG visuals and its contrast and clipping tests. Back-face is the sign of the matrix determinant. | No perspective. Painter's order by depth can be wrong for intersecting or interpenetrating faces during a fold; with at most six squares and convex end states it should be rare, but that is exactly what the spike must measure. No hardware 3D. |
| CSS 3D transforms (`preserve-3d`, `matrix3d`) | Browser does the depth sorting and perspective. Faces are DOM nodes. | MDN lists properties that force `transform-style` back to `flat` (`overflow`, `opacity` below 1, `filter`, `clip-path`, `mask-image`, `mix-blend-mode`): any face clipped to a polygon (prisms, pyramids) or given a translucent tint would silently flatten. Browser-dependent sort of interpenetrating planes. Cannot be asserted in jsdom (no layout), so the maths of the *picture* is untestable except in Chromium. |
| Canvas 2D / WebGL | Fast, flexible. | No DOM text or hit targets, harder accessibility, harder tests, WebGL is a heavy surface; any 3D library (three.js and similar) is far larger than the whole current learner JS (about 193 KB) and is not justified. **Rejected.** |

**Fallbacks if the spike fails** (in order): (a) split intersecting faces along the intersection line before sorting (exact for planar polygons, small code); (b) restrict intermediate views so the learner only ever sees states reachable without interpenetration (fold hinges in a legal order and disable the toggle that would pass through); (c) CSS 3D for the cube-only wave with polygon faces avoided (squares need no clip-path). Which is chosen is a spike outcome, recorded in the WP0a note.

**Spike acceptance criteria (WP0a exit gate, all required):**

1. For all 11 cube nets, all 2^5 hinge subsets and four camera presets, a **reference z-buffer rasteriser** (written in the test, per-pixel nearest plane at about 64 by 64) and the SVG painter's output agree on the nearest face id for at least 99.5 percent of covered pixels, with any disagreeing state listed.
2. The same nets' closed states read back from the SVG matrices equal the exact integer 3D positions (a separately written oracle, section 7.2) after projection and rounding to 0.01 unit.
3. Frame cost: with Chromium CPU throttling set to 4x through the DevTools protocol, a full fold animation averages at most 8 ms scripting per frame (measured with `performance.now` around the update, not by eye). This is a proxy; real phones are unverified.
4. Pointer: on the spike page, a Playwright mouse drag **and** a touch-pointer sequence (dispatched through the DevTools protocol touch events) on a 44 px handle move it, `pointercancel` reverts cleanly, and a vertical swipe that starts *outside* handles scrolls the page.
5. Learner bundle delta for the spike code at most 12 KB minified before real controls (budget in 6.5).

### 2.3 Protractor

**Representation (all integers; section 4.2 for the model).** Units are the SVG viewBox units of a 400-wide canvas. The figure: vertex `V` (integer point), first arm direction `a1`, second arm direction `a2` (degrees, anticlockwise from east, integer, multiples of 5 for tasks), and the signed turn `delta = a2 - a1` in the range 5 to 175 or -175 to -5. The protractor has a pose `(x, y, rot)`: integer centre, integer rotation in whole degrees. Its dial is the half disc of directions from `rot` to `rot + 180`. It has two scales: the **outer** scale reads `0` at direction `rot` and increases anticlockwise; the **inner** scale reads `180 - outer` at the same place.

**Why this model reproduces the real confusion without special-casing.** If the protractor sits with `rot = a1` (first arm on the 0 end of the outer scale) and the second arm is anticlockwise of the first, the outer scale reads `|delta|`. If the second arm is clockwise of the first, it lies *outside* the dial; the learner must turn the protractor by 180 degrees (`rot = a1 - 180`), which puts the 0 of the *inner* scale on the first arm. Reading the other scale gives `180 - |delta|`. The model needs no flag: the two cases arise from the geometry.

**View.** The figure and the protractor over it. The protractor has a **Move** grip (a 44 px circle at its centre point; the centre mark itself is a small cross so the exact point is visible) and a **Turn** grip (a 44 px circle at the right end of the baseline). No part of the body is a drag target, so the page still scrolls under it on a phone.

**Controls (DOM buttons and native inputs below the canvas; every pointer drag has these):**

* Move: four arrow buttons (1 unit; hold Shift or a "x5" toggle for 5), plus the focused Move grip responds to arrow keys the same way;
* Turn: "Turn left 1", "Turn right 1", "Turn 5" pairs, a "Flip 180" button, and the focused Turn grip responds to arrow keys; an `input type="range"` 0 to 359 with `aria-valuetext` ("Protractor turned 40 degrees") as a native alternative;
* "Put the centre on the corner" is **not** provided in Your turn (it would remove the skill); it appears as a hint-gated action at rung 3 only.

**Snapping.** While dragging, the centre snaps to the nearest integer unit; the turn snaps to whole degrees. A **magnet** pulls the pose onto the exact ideal when it is within 6 units of `V` and 3 degrees of an arm direction (and shows a short "clicked into place" cue as text, not sound). Section 4.2 and 7.3 define and test the tolerances; the learner is told in one sentence (3.4).

**Lessons (2):**

| Lesson ID | Title | Skills | Steps |
| --- | --- | --- | --- |
| `p4-protractor-bench-read` | Line it up, then read | Put the centre on the corner, put the baseline on a side, pick the scale that starts at 0, read the angle. | `scale`: choice (outer or inner starts at 0 on the first arm; the workbench sets the radio from the learner's pose and leaves it unselected if the pose is not lined up); `read`: exact (degrees, `parseDegrees`); `reflection`: choice |
| `p4-protractor-bench-draw` | Draw an angle | Make an angle of a given size with a protractor and a ray. | `draw`: exact (the arm's turn in degrees, set by moving the arm end; typed value mirrors it); `check-other-way`: choice (the same angle read from the other side of the ray, which scale reads it); `reflection`: choice |

Watch example for lesson 1: a different angle on the other side, narrated: "The corner goes under the centre. The first side lies along the flat edge. The scale that starts at 0 on that side is the outer scale." (original wording; needs review). Learner angles are multiples of 5 (as in the existing lessons), so every reading is unambiguous at the printed 5 degree ticks.

**The `scale` step design choice.** Selecting a radio from a pose is the app *deriving the answer from what the learner did*, which is the honest way to assess alignment in an outcome-only system: unaligned means incomplete ("Line the protractor up first"), not "wrong". It is flagged as a product question (Q3) because an alternative is to ask outright "which scale?" with no pose, which assesses recall rather than doing.

### 2.4 Symmetry

**Representation.** The grid and cell strings of `SymmetrySpec` (`"row,column"`), unchanged. A mirror line is a lattice line in doubled coordinates: `v:c` (vertical at `x = c/2` in column-centre units), `h:c`, `d1:c` (the line `x + y = c`), `d2:c` (`x - y = c`); the reflection of a cell is integer arithmetic in all four cases (section 4.3). The live preview draws the reflection of the learner's shading as a pattern-filled ghost.

**Lessons (2):**

| Lesson ID | Title | Skills | Steps |
| --- | --- | --- | --- |
| `p4-mirror-line-bench` | Place the mirror | Move a mirror line until the shape folds onto itself. | `place`: choice over every lattice line of the grid (a few dozen; the radios live inside the collapsed "List version"; ids opaque; exactly one true axis, enforced by the validator); `reflection`: choice |
| `p4-shade-to-complete-bench` | Shade the other half | Shade squares so the picture is symmetric about the given line. | `shade`: multi over every square on the far side (at most 24; ids opaque); `reflection`: choice |

**Preview rule (the leak trade-off made explicit).** In `shade`, the preview reflects *the learner's own shading back across the line* onto the given half. The learner compares ghost and original by eye. The app does **not** colour mismatches, count them, or say "match" in Your turn (that would make correctness a free oracle). The identical comparison is stated in Watch on the demo. In `place`, the ghost is the reflection of the figure in the current line; again the app does not say whether it matches. At rung 3 the hint reveals which half of the picture matches (an existing-style hint, counted), at rung 4 the answer.

### 2.5 Later candidates (not in this plan's work packages)

| Candidate | Rationale (one line each) |
| --- | --- |
| Pie sector builder | Drag a slice boundary on the existing equal-slice pie; exact because boundaries snap to slices. |
| Bar-chart builder | Drag a bar top to a gridline; exact because values are multiples of the grain. |
| Number line | MLC ships one; exact placement by snapping to ticks; also serves rounding and decimals. |
| Fraction strips | The existing decimal and fraction workbenches (ADR-008) are static overlays; strips add folding and comparing. |
| Area and perimeter geoboard | MLC Geoboard is the precedent; integer lattice, so exact. |
| Cuboid, prism, pyramid fold | Wave 2 of the net folder (section 2.2). |

## 3. Interaction design

### 3.1 Pointer events

* All drags use **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`) with `setPointerCapture` on the grip, so mouse, touch and pen share one code path. `pointercancel` and `lostpointercapture` revert to the pose at drag start (documented MDN behaviour: capture is released automatically at `pointerup`; a cancelled gesture must not commit).
* `touch-action: none` only on the grips and the arm-end handle, never on the canvas or the body of the figure. MDN warns that `none` disables pinch-zoom, which matters for low vision; the page and the rest of the workbench keep `touch-action: pan-y pinch-zoom`. Grips are at least 44 by 44 CSS px, so the exempt area is small.
* One active pointer at a time per workbench; a second simultaneous pointer is ignored (no multi-touch gestures, no pinch-to-rotate, no two-finger anything).
* Drag input is quantised in the model unit, not in pixels, and the resulting state is passed to the pure reducer as a single move (`{type:"set-pose", ...}`), so the DOM layer holds no mathematical logic.

### 3.2 Keyboard and no-drag equivalents

WCAG 2.2 SC 2.5.7 (Level AA) requires that functionality using a dragging movement is available to a single pointer **without dragging**, and the page I read says keyboard support alone does not meet it. So each drag has both: on-screen buttons that act on tap or click (nudge, turn, fold toggle, "move line left/right", "toggle square") and keyboard operation of the grip (arrow keys; Shift multiplies by 5; Enter or Space on a toggle). The shaded-square grid is a roving-tabindex grid of buttons (`aria-pressed`) so arrow keys move focus and Space toggles; it is also reachable by tapping each square, which is the primary no-drag route. **Dragging is never essential.**

### 3.3 Targets, text, contrast

* Every button, grip, toggle and grid square is at least 44 by 44 CSS px at 320 px width (the repo's convention; WCAG 2.5.8 Level AA requires 24 by 24, and the enhanced criterion is stricter; I could not read the enhanced page's pixel number, my recollection of 44 is not a source). An 8-column symmetry grid at 320 px needs 352 px of squares, which does not fit, and a grid that scrolls sideways is not acceptable (no hidden horizontal scroll). **Decision for the validator: the shade grid for the new tasks has at most 7 columns (6 or 7); the existing 8-column specs remain for the old tasks.** This is a real constraint and is called out in the risks.
* SVG text is at least 15 units in a 400-unit viewBox (16 in a 360 viewBox), the existing floor; protractor numbers are not tiny by default but the existing protractor's inner numbers are 13 units, which rendered about 11 px: in the workbench the inner scale uses 15 units and ticks are labelled every 10, not every 5.
* Text 4.5:1 and graphics 3:1 against the surface `#fffdf8`; ghosts and previews use an outline of 3:1 plus a pattern fill, so they do not rely on tint alone. Focus ring 3:1 against both the control and the surface, 3 px. The new colours (hatch, ghost outline, hinge highlight) are listed in CSS variables and checked by `tests/contrast.test.ts` with an independently written luminance function.

### 3.4 Explaining the tolerances to the learner

One line under the protractor controls, authored: "The protractor clicks into place when it is close. The app counts your work as exact once it has clicked, so you do not need a perfectly steady hand." A second line in the drawing lesson: "The arm moves in steps of 5 degrees so it is easy to place; use the arrow keys for steps of 1." A teacher note (guided mode) says that a paper protractor reads to about one degree and that the app does not model that uncertainty. No unsourced number is claimed about real-world tolerance.

### 3.5 Layout

* Phone (320 to 768): single column. Order: lesson title, **question prompt**, workbench, controls, answer area, hint. The workbench canvas is `width:100%`, `aspect-ratio` fixed per manipulative, `max-height: 56vh` on landscape phones so the question and controls are not pushed off screen. The Watch bar is one row of four 44 px buttons plus a caption line; below 360 px the caption wraps (no horizontal scroll).
* Tablet and desktop: the existing two-column workspace; the workbench fills the visual panel, controls beneath it.
* The workbench never overlays text and never auto-scrolls the page; focus moves only on explicit actions (existing `moveFocus` rule).

### 3.6 Screen readers, live regions and the leak trade-off

* The canvas is `role="img"` with an `aria-label` from a pure `describe(state)` as in all existing topics; the SVG is `aria-hidden`. Controls are real buttons with names and `aria-pressed`/`aria-valuetext`.
* One polite live region per workbench (`role="status"`), distinct from the existing feedback region. Rules: (1) announce *the learner's own action and neutral geometry* ("Crease 2 folded. 3 of 5 creases folded.", "Protractor centre moved to 120 across, 84 down", "Square row 2, column 5 shaded"); (2) **never announce derived conclusions in Your turn** (opposites, collisions, readings under an arm, whether a line matches); (3) announcements are throttled to at most one per 400 ms and drag moves announce only on release, so a drag is not read out frame by frame; (4) Watch announces each caption once when the keyframe changes, not per frame.
* This is *stricter* than the existing line-graph/chart precedent, whose text alternatives list the data and leak answers (recorded in ADR-009 for human review). It means a non-visual learner receives less to reason with in Your turn; the trade-off is stated, and a human accessibility reviewer must judge it. The draw task is the intentional exception: the arm's current angle is the *output*, so it is announced on release.
* A screen-reader user cannot do a protractor alignment as a spatial act; the workbench offers the numeric controls and the radio fallback, and the plan does **not** claim that the protractor lesson is accessible in the sense of preserving the physical skill. Flagged in section 9.

### 3.7 Reduced motion, no pressure, undo

* `prefers-reduced-motion: reduce` (read through `matchMedia` with a change listener, and mirrored in CSS) makes Watch **stepwise stills**: no interpolation, Play is replaced by a prominent "Next" button; Back/Next move one keyframe; each keyframe is a still with its caption. The learner's own toggles jump to the target state with no tween. The controller is written so the animation is a presentation of a state sequence, which is why this is a configuration and not a second implementation. A user control "Use stepwise mode" gives the same behaviour for people without the OS setting. (WCAG 2.3.3 is Level AAA and asks that interaction-triggered motion can be disabled; the plan meets it for animation it adds.)
* No timers, no scores, no speed element, no countdown. Play pauses itself on the last keyframe and never loops.
* Undo steps back one move (a stack bounded at 50). "Reset this step" returns to the step's initial state. Neither is counted as a hint or support. Undo is also available after a wrong check.

## 4. Exactness and state models

**Rule:** every judged quantity is an integer or a finite set computed in exact integer arithmetic. Floating point appears only in drawing (projection, tween, arcs). The check function never receives a pixel coordinate: pointer input is converted to model units and quantised by the DOM layer before it becomes a move.

### 4.1 Net folder

* **Net.** `cells: Pt[]` (existing), a deterministic **hinge list** `H = [(i, j)]` sorted by the pair of cell keys (so hinge numbers are stable), 5 hinges for a valid tree-shaped net.
* **State.** `{ folded: number }` a bitmask over `H` (a set; bit `k` = hinge `k` is folded 90 degrees towards the viewer). Serialisable as a decimal integer.
* **Moves.** `toggle(k)`, `foldAll`, `unfoldAll`, `setView(yaw, pitch)` (view is not part of the judged state). Illegal moves: `k` out of range, view angle outside the clamp, any unknown `type` return the same state and a rejection reason (so a malformed move cannot corrupt anything).
* **Closed state.** `folded === (1 << |H|) - 1`. Positions: each cell gets an integer 3 by 3 rotation matrix and integer translation (in half-units) obtained by composing exact quarter-turns about hinge axes from the root along the tree; the face normal is the image of the out-of-plane axis. This yields: the `lid` (cell whose normal is opposite the root's), `opposite(cell)`, and `collisions` = pairs of cells whose closed squares coincide.
* **Production code reuse.** Judging reuses `foldsToCube` / `oppositeLetters` (already independently oracled). The *workbench geometry* (the integer matrices used for drawing at the end states) is a second implementation in `src/topics/nets-bench.ts`, and the test oracle is a third, written differently (section 7.2).
* **Partial states** are not judged and have no meaning for answers. The picture at angle `t` (0 to 1) for a folded hinge is a float rotation by `t * 90` degrees; `t` is animation-only.

### 4.2 Protractor

* **Figure (spec, immutable).** `V = (vx, vy)`, `a1`, `a2` integers (degrees, mathematical orientation), `turn = a2 - a1` normalised to a signed integer in -175..-5 or 5..175.
* **Pose (state).** `{ x, y, rot }` with `x, y` integers in the viewBox, `rot` integer in 0..359. **Arm (draw task).** `{ armTurn }` integer, multiples of 5 in the draw task.
* **Moves.** `move(dx, dy)`, `moveTo(x, y)`, `turn(d)`, `turnTo(r)`, `flip`, `setArm(t)`, `reset`. Each normalises `rot` modulo 360 and clamps `x, y` to the canvas.
* **Derived (exact, pure).** `centred = (x, y) equals V`. `baselineOn = rot equals a1 or rot equals a1 + 180 (mod 360)`. `zeroEnd = "outer"` if `rot = a1`, `"inner"` if `rot = a1 + 180`, else none. `frame(d) = (d - rot) mod 360`. `reading(d)` is defined only when `centred`: `{ outer: frame(d), inner: 180 - frame(d) }` if `frame(d)` is in 0..180, else off-dial. The *expected* `read` answer is `|turn|` and is independent of the pose.
* **Assessed outcomes.** `scale`: the correct scale is the one whose 0 is on the first arm in a placement that puts the second arm on the dial; the radio is set from `zeroEnd` only when `centred && baselineOn && second arm on dial`, else cleared. `read`: the typed integer equals `|turn|`. `draw`: `armTurn` equals the target. A *specific feedback key* `answer.other-scale` is returned when the typed number equals `180 - |turn|` ("That is the reading on the other scale"); this needs a small `diagnose` hook in the adapter factory and changes no correctness.
* **Tolerance, stated once.** Position quantum 1 unit; rotation quantum 1 degree; magnet radius 6 units and 3 degrees (the model is told the snap target; snapping is a UI function `snapPose(rawPose, figure)` that is pure and unit-tested). There is **no tolerance in judging**: after snapping, equality is exact. A learner who stops 2 units from the corner has an unaligned pose and the cue says so; the reading they then take is not constrained.
* **Why 6 units / 3 degrees.** They are design numbers, not measured on any learner; they are set so a 44 px grip dragged by a thumb can reach the target. They are parameters in one constants block, covered by a boundary test, and are the first thing to retune after the first device check.

### 4.3 Symmetry

* **Spec.** The existing grid (`cols`, `rows`) and, for `bench-shade`, `cells` on the first side (`"r,c"` strings). `bench-mirror` uses `shape` (existing `SHAPES` polygons) drawn on the lattice.
* **State.** `bench-mirror`: `{ line }` (`kind` in `v | h | d1 | d2`, `c` integer). `bench-shade`: `{ shaded }`, a set of far-side cell keys (sorted array when serialised).
* **Moves.** `moveLine(dc)` (steps `c` by 1 within the valid range), `setLine(kind, c)`, `toggleCell(r, c)` (rejects a cell on the given side or off the grid), `clearAll`, undo.
* **Reflection.** `v:c: (x, y) -> (c - x, y)`; `h:c: (x, y) -> (x, c - y)`; `d1:c: (x, y) -> (c - y, c - x)`; `d2:c: (x, y) -> (y + c, x - c)`. These are exact; cells reflected off the grid are *off-grid* (not an error: the check treats them as unmatched).
* **Judged.** `place`: the chosen line is an axis iff the reflection of the figure's vertex or cell set equals the set (using the existing `symmetryAxes`, which is already brute-force oracled); the validator requires exactly one axis, so the answer is one choice id. `shade`: `shaded` equals `reflect(cells)`, a set equality, and the choices are every far-side cell so the answer is an id set.
* **Preview.** `ghost = reflect(state)` for drawing only; no correctness derived from it.

### 4.4 Keyframes (Watch)

`demoScript(spec): Keyframe[]`, pure and deterministic. A keyframe is `{ id, caption, state, ms }`. `state` is the same serialisable state the learner's reducer uses, so Watch is "the reducer played by the app". Tests: the last keyframe's state satisfies the same judgement the learner is held to; keyframe captions contain no characters outside the plain-text policy; the script is identical across runs (no clock, no randomness).

## 5. Research summary (details and limits in the evidence file)

* **Concrete, pictorial, abstract.** Search summaries describe the Singapore CPA progression as manipulatives or real objects first, then diagrams, then notation, tied to Bruner; I could not open an MOE document that states it. The workbench is the *concrete-like* stage in digital form, and each lesson ends with the existing abstract step (reflection and exact answers). It does not replace physical paper folding, and the plan says so in the evidence file and Q5.
* **Math Learning Center.** The apps page I read lists thirteen apps; geometry-related ones are Geoboard, Math Clock and Pattern Shapes. It has no nets, protractor or symmetry app that I could see. It supports the idea of free, account-less, visual-model-first apps.
* **Polypad (Mathigon/Amplify).** The page I could read lists 3D Solids (Platonic and other polyhedra) and an Angle tool, with no detail; search summaries claim fold/unfold nets. I could not verify how folding is controlled or rendered.
* **PhET.** Search summaries describe "implicit scaffolding": what the user can and cannot do and what they are shown, built through controls and feedback, to support exploration with little explicit instruction. I could not read the paper itself (the PDF was garbled; the publisher page returned 403). The plan borrows the idea of constraining controls so the productive moves are the available ones (for example hinges toggling in 90 degree steps only), without claiming its research results.
* **Protractor misconceptions.** Two teacher-written pages say learners confuse inside and outside scales, mis-place the centre, and misalign the baseline; one says "if you read the wrong scale, the true angle is 180 minus your reading", which the model above reproduces exactly.
* **Accessibility sources actually read:** WCAG 2.2 Understanding pages for 2.5.7 (dragging), 2.5.8 (target size minimum), 2.3.3 (animation from interactions); MDN for `touch-action`, `setPointerCapture`, `transform-style`.
* **Not read:** the official MOE mathematics syllabus (the MOE page I fetched had no syllabus content), GeoGebra's nets applet (404), any peer-reviewed study of virtual manipulatives. No claim of effectiveness is made.

## 6. Architecture

### 6.1 Module layout

```
src/workbench/                  shared, no concrete topic imports; DOM and pure helpers
  types.ts        Keyframe, WorkbenchFactory, WorkbenchHandle, WorkbenchIO
  controller.ts   Watch/Your-turn phase machine, keyframe player, reduced-motion switch,
                  injected clock and matchMedia so tests are deterministic
  drag.ts         pointer-event drag helper (capture, cancel, quantise callback)
  announce.ts     live-region helper (throttle, leak policy hooks)
  chrome.ts       shared Watch bar, Undo/Reset/Watch-again buttons, caption, disclosure
  project.ts      orthographic camera, affine face matrix, painter's sort (floats, drawing only)
src/topics/nets-bench.ts        pure model: hinges, closed-state geometry, demoScript, reducer
src/topics/angle-bench.ts       pure model: pose, snap, derived, demoScript, reducer
src/topics/symmetry-bench.ts    pure model: lines, reflection, shading, demoScript, reducer
src/topics/nets.ts (etc.)       register `workbench()` on the existing RuntimeTopic and add the new tasks
src/authoring/nets.ts (etc.)    new forms, fields and templates for the new tasks
```

The pure models have **no DOM import**, so Vitest runs them in Node. Topic modules call the generic `src/workbench/` helpers; the shared helpers never import a topic.

### 6.2 Registration without the shared runtime importing concrete topics

* `src/topics/capability.ts` gains `workbench?(lesson: Lesson, step: Step): WorkbenchFactory | null` (type-only import from `src/workbench/types.ts`). `WorkbenchFactory = (host: HTMLElement, io: WorkbenchIO) => WorkbenchHandle`. `io` exposes: `getHintRung()`, `setAnswer(value)` (writes the existing answer control), `announce(text)`, `onChange(cb)`, `reducedMotion`, and `lessonPhase` (`edit` or `trial`).
* `src/ui/lesson-view.ts` asks `runtimeTopics[lesson.topic]?.workbench?.(lesson, step)` (it already reaches the registry through `topicLabel`), and if non-null mounts the factory once into a persistent `<div data-region="workbench">` *outside* the `innerHTML`-replaced visual region. It destroys it on step change, restart, trial end and exit. The signature logic keeps the workbench alive across mode switches and hint changes.
* `src/core/` is untouched. The pure runtime still imports no concrete topics; application composition (`src/topics/registry.ts`) already owns the list.
* `src/ui/p4-activity.ts` (the existing decimal/fraction workbench) stays as it is; it is a presentation overlay and not part of this lifecycle. A later consolidation is possible but out of scope.

### 6.3 Edit (author) presentation

In edit presentation (no session) the workbench renders in Watch with autoplay off, and the learner instance as a static picture, so authors see both. Interaction in edit mode is disabled (it would not be recorded). Author-only: the **form fields** that choose the nets, the angle, the demo instance and the grid shading (new `AuthorTopic` forms and `fields`), with new labels added to the sentinels in `scripts/check-learner-artifact.mjs` so they cannot appear in the learner build. The workbench runtime itself is **not** author-only: learners run it, so it is in the learner bundle by design. The existing sentinels continue to guard the annotation tool and the generator.

### 6.4 Library, lessons and home page

* New lessons are **new files**, not edits to existing starters: `p4-fold-a-cube-net`, `p4-fold-a-net-that-fails`, `p4-protractor-bench-read`, `p4-protractor-bench-draw`, `p4-mirror-line-bench`, `p4-shade-to-complete-bench` (6, one to two per manipulative as asked). Existing 57 lessons, their digests and saved author drafts stay unchanged, so no regression to the 672 tests' fixed expectations. Library goes to 63 lessons across the same 16 topics.
* `content/library.json`: add the six with `sequence`, prerequisites (each requires the matching existing lesson: nets `p4-cube-opposite-faces`, angle measure `p4-read-protractor`-style first lesson by actual ID, symmetry `p4-lines-of-symmetry`-style by actual ID; the coder must look the IDs up) and the tag `workbench`. Run `node scripts/bind-library.mjs`. Add the six to the `p4-preparation` collection lessons; do **not** add them to the mixed `practiceIds` (they are 8 to 10 minute guided activities, not 4 minute practice) unless the user prefers.
* Home page: tiles, strands, icons and accents are unchanged (no new topic). The lesson list inside a topic shows a small "Hands-on" chip (text plus icon) for lessons tagged `workbench`; this is one small change in the topic view, not the home page. The spotlight is unaffected because the topic list is unchanged (a lesson-level selection inside a topic should be checked by `tests/spotlight.test.ts`).
* Content rules: original wording and original nets/figures; no paper question, diagram or answer key copied; everything `draft`; no claim of syllabus coverage; captions and hints reviewed by a human before any publication.

### 6.5 Learner build and bundle

* Learner JS today is about 193 KB (minified, one chunk) and CSS about 43 KB. **Budget:** the whole workbench (shared and three models and views) at most +30 KB minified JS and +6 KB CSS, enforced by a size ceiling added to `scripts/check-learner-artifact.mjs` (a constant derived from the measured baseline at WP0b). If a measured number exceeds the ceiling the work stops and the plan is revisited.
* No dependency is added. No model code, no network call.
* The workbench must not import `src/authoring/` or `src/annotation/`; a test greps the import graph of `src/workbench/` and `src/topics/*-bench.ts` for those paths.

## 7. Test plan

### 7.1 General

Per AGENTS.md: Vitest `*.test.ts` for validators and state transitions; Playwright `*browser.spec.ts` for complete interactions; include malformed input, alternative orders, unsupported actions, hint/mode history and publication rejection; do not describe any of it as human curriculum review. Gates: `typecheck`, `lint`, `format:check`, `npm test`, `npm run test:e2e` (with the README's library workaround), `content:validate`, both builds, `test:release`.

### 7.2 Unit tests and independent oracles (written differently from production)

| File | Coverage |
| --- | --- |
| `tests/bench-nets.test.ts` | Hinge list stable and size 5 for all valid trees; reducer: toggle is an involution, `foldAll` equals toggling every hinge in **every one of the 120 orders** (alternative selection orders), unknown move types, out-of-range hinges, view clamp, moves on a net with a 2 by 2 block rejected. **Oracle:** an exact integer 3 by 3 rotation-matrix composition (like the existing geometric oracle, but a separate file and a tree walk written independently of `nets-bench.ts`), checked on all 11 free nets in all fixed orientations (64): lid, opposite pairs and collisions. For the 24 invalid free hexominoes without a block, exactly the expected collision pairs, and agreement with `foldsToCube`. Labelled sweep: all 720 letter assignments on a sample of nets. Closed-state **SVG read-back**: the face matrices at `t=1` equal the oracle's projected integer corners to 0.01. Demo scripts: last keyframe satisfies the judgement; demo instance differs from the learner instance in the answer. |
| `tests/bench-project.test.ts` | The spike's z-buffer comparison becomes a regression test: nets x 32 subsets x 4 cameras, agreement threshold and the explicit list of known exceptions (empty if the spike chose fallback (a)). Back-face from determinant sign. |
| `tests/bench-angle.test.ts` | Reducer: move/turn/flip normalisation (modulo 360, clamp), idempotence of `reset`, unknown moves rejected. **Oracle:** a brute-force search over every pose `x, y` in a window around `V` and every `rot` in 0..359 that computes the scale reading by walking angles one degree at a time (no modular formulas) and compares with `reading()`; confirms `outer + inner = 180`; confirms the clockwise second-arm case is off-dial at `rot = a1` and on-dial at `rot = a1 + 180` with the inner scale reading `|turn|`; wrong-scale diagnosis equals `180 - |turn|`. Snap: boundary tests at exactly 6 units / 3 degrees and just outside (7 / 4), both sides of each arm and across the 0/359 wrap. Reading at every `a1, a2` multiple of 5 pair. Specification validator: malformed, non-multiples of 5, equal demo and learner instance. |
| `tests/bench-symmetry.test.ts` | Reflection for all four line kinds checked against a **coordinate-geometry oracle** (reflect the centre point of each cell with floating arithmetic and round only to compare, in the test, never in production), plus involution and fixed-point properties; every shape in `SHAPES` and every lattice line: the set of axes found equals the existing brute-force oracle's; exactly one axis for the `place` shapes; shade: all `2^n` subsets for a small grid are judged by set equality against an independently built reflected set; toggle order independence over random permutations; cells on the wrong side or off grid rejected; ghost never changes the judgement (property). |
| `tests/bench-controller.test.ts` | Phase machine: Watch/Your turn transitions, replay, Back/Next, Play to the last keyframe and stop, no loop; **fake clock and fake `matchMedia`**: with reduced motion the player never schedules a frame and Next works; changing the preference live switches modes without losing the keyframe index. |
| `tests/bench-announce.test.ts` | Throttle, drag-end-only announcements, and a **leak scan**: for every manipulative and every Your-turn move sequence, no announcement contains the answer text for the learner's step (letters of the lid, the reading, the collision pair, the axis position). |
| `tests/bench-leak-and-build.test.ts` | Import-graph rule (6.5), and that no `src/workbench` or `*-bench` file contains author-only labels. |
| existing | `tests/p4-kit-regression.test.ts` extended: existing starters unchanged; `tests/home-layout.test.ts` and `tests/spotlight.test.ts` still pass unchanged; lesson-view step cap (8) respected. |

DOM tests (Vitest + jsdom 30.1.1, which in the versions I know has `PointerEvent`; the coder confirms and otherwise dispatches `MouseEvent` with a `pointerId` shim): mount the factory in a lesson view; Check with no manipulation is `incomplete`; manipulating sets the same answer the form would submit; Undo and Reset; mode switch preserves state; rung 4 plays on the learner instance and records `reveal`; destroy removes listeners (no leak across steps).

### 7.3 Browser tests (Playwright, Chromium emulation only)

* **Pointer and keyboard parity.** For each manipulative, solve the same step three ways and assert identical `answer` actions and identical feedback: (1) mouse drag, (2) touch (CDP touch events) tap and drag, (3) keyboard only (Tab, arrows, Space, Enter), plus (4) buttons only with no drag at all (WCAG 2.5.7).
* **Viewports:** 390 by 844, 360 by 740, 320 by 640 and 1280 by 800; no horizontal scroll; every interactive control at least 44 by 44; question prompt visible without scrolling at 390 and 360; every SVG `text` rendered size at least 11 px (and the 15 unit rule at the source).
* **`pointercancel`** mid-drag reverts; releasing outside the canvas commits only the last in-range quantised pose; a vertical swipe starting on the canvas background scrolls the page (touch-action rule); a second pointer is ignored.
* **Reduced motion** (`page.emulateMedia({ reducedMotion: "reduce" })`): no running `Animation`s on the workbench (`document.getAnimations()` empty), no rAF-driven change after a keyframe jump, Next advances by stills, captions update.
* **Screen-reader surface:** the accessibility tree (`page.accessibility`/aria snapshot) contains the live region, names for every control and no answer text before the check; fallback "List version" is reachable.
* **Visual:** screenshots of Watch and Your turn for every lesson at 390 and 1280 into `docs/screenshots/` (a screenshot is evidence of rendering only; clipping is asserted by code, not by eye); a pixel-level check that folded and flat states differ (guards against an animation that never renders).
* **Hint/mode/history:** hint rungs 1 to 4 on a workbench step produce the expected events; guided/independent switch mid-step preserves state; a wrong check followed by Undo and a right check yields two submissions with the right outcomes; completion label rules (3.6, 1.2).
* **Whole-lesson play-through at 390 and 1280:** extend the existing expansion spec's `families` loop with the six lessons using the workbench route.
* **No-leak scan:** a built learner artifact scan for authoring labels (sentinels) and the size ceiling.
* **Contrast:** extend `tests/contrast.test.ts` for the new workbench colours and the focus ring.

## 8. Work packages

Order puts the riskiest unknown first. Each package has an entry and an exit gate. "Lead" is the integrating agent; per the repo, handover ownership rows are claimed before work and results logged after.

**WP0a: fold-rendering and pointer spike (throwaway code, 2 to 3 days).**
Entry: this plan reviewed once and dispositions recorded. Scope: a standalone dev-only page (not an app entry; not imported by `main.ts`, `author.ts` or `learner.ts`) with the cube-net folder SVG, the z-buffer comparison, a 44 px hinge button list, one pointer grip with `setPointerCapture` and `touch-action` rules, and the CPU-throttled frame measurement. Exit: the five spike criteria in 2.2.1 are met or the written decision picks fallback (a), (b) or (c) with its numbers; the spike page is deleted; the module `src/workbench/project.ts` is carried forward. If criterion 1 fails and no fallback fixes it, **stop and ask the user** (CSS 3D or a still-frame strip, previous plan Q5).

**WP0b: foundation (2 to 3 days).** Entry: WP0a exit. Scope: `src/workbench/*`, `RuntimeTopic.workbench` and the lesson-view mount lifecycle, shared Watch/Your-turn chrome, announce helper, `p4.css` workbench block, bundle ceiling, the `diagnose` hook in the adapter factory, kit regression extension, controller and announce tests. Exit: typecheck/lint/format/tests green; a trivial stub workbench (a toggle that sets a radio) passes pointer, touch, keyboard, reduced-motion and `pointercancel` browser tests at the four widths; bundle delta recorded; no change to `src/core/`.

**WP1: net folder (3 to 4 days).** Entry: WP0b exit. Scope: `nets-bench.ts`, the view, two lessons, author form(s), library entries, oracles in 7.2. Exit: `bench-nets` and `bench-project` tests pass; both lessons play to completion by mouse, touch and keyboard at 390, 360, 1280; screenshots viewed by the lead; sentinels added; digest rebound; handover entry.

**WP2: protractor (3 to 4 days).** Entry: WP1 exit (so the controller has been proven twice only after WP1, but the protractor can start in parallel after WP0b if staffed). Scope: `angle-bench.ts`, view, two lessons, author forms, tolerance constants and tests. Exit as WP1 plus the boundary tests and the explained-tolerance copy present.

**WP3: symmetry (2 to 3 days).** Entry: WP0b exit. Scope: `symmetry-bench.ts`, view, two lessons, author forms, 7-column grid rule. Exit as WP1 plus the exhaustive subset judgement test.

**WP4: integration and documentation (1 to 2 days, lead).** Scope: library order and collection, "Hands-on" chip, practice-set decision (default: not added), the combined browser loop, contrast test update, `docs/ADR-010-workbench.md`, `docs/implementation-status.md`, `handover.md` (ownership, validation actually run, outstanding human and device checks), screenshots. Exit: every gate in 7.1 run and recorded as run or not run with the reason.

**Cut order if time is short** (cut first to last; each cut leaves a coherent product): (C1) the mirror-line placement lesson; (C2) the protractor *draw* lesson; (C3) the fold-collision lesson; (C4) the shade-to-complete lesson (the whole of WP3); (C5) "Turn the view" presets beyond Front and Corner. **Never cut:** WP0a, WP0b, `p4-fold-a-cube-net`, `p4-protractor-bench-read`, the keyboard/no-drag equivalents, the reduced-motion path, the exact oracles.

## 9. Risks, open questions, not verified

### 9.1 Risks

| Risk | Mitigation |
| --- | --- |
| Painter's order wrong for some partial folds | WP0a z-buffer comparison; fallbacks (a) to (c); ask the user if all fail. |
| Pointer handling on real touch devices differs from Chromium emulation (scroll trapping, pen, iOS Safari) | Grips-only `touch-action: none`; DOM button parity; explicit "not verified on devices" statement; first real-device check before any claim. |
| 44 px targets do not fit an 8 column symmetry grid at 320 px | Shade lessons use at most 7 columns; validator enforces it. |
| Outcome-only assessment cannot prove the learner used the manipulative | Stated plainly; Watch/Your-turn is teaching design, not proctoring; reflect in labels (no claim of "measured with a protractor"). |
| Magnet snap hides a poor alignment (learner gets credit for a sloppy drag) | Snap radius is small and disclosed; judging is exact equality after snap; the cue states "clicked into place"; tuning is a documented first-device task. |
| Live regions leak or flood | Throttle, drag-end only, no derived conclusions, leak-scan test; a human screen-reader review is still required. |
| Bundle growth | 30 KB ceiling enforced in the artifact check. |
| Scope creep into wave 2 solids | Cuboid/prism/pyramid explicitly deferred with reasons (irrational pyramid height; `clip-path` flattening). |
| A stateful host plus string-rendered visual causes stale or duplicated UI | Host outside the `innerHTML` region; destroy on every step/trial boundary; DOM test for listener leaks. |
| Hand-authored demo captions teach something wrong | Draft status; same human review as hints; captions generated from small templates reduce free text. |
| Colour of back-face hatch or ghost fails contrast | Added to `contrast.test.ts` with an independent luminance function before use. |

### 9.2 Open product questions for the user

1. **Scope of the first wave.** Are net folding, protractor and symmetry the right three and in this order, or does the user want a different manipulative earlier (for example a number line or fraction strips)?
2. **Cuboid, prism and pyramid folding.** Wanted soon (adds a second rendering mode and combinatorial judging) or acceptable to leave until the cube folder has been used?
3. **Protractor alignment as an assessed outcome.** Should lining the protractor up be *derived into* the scale answer (recommended here), or should the lesson just ask "which scale?" and treat the manipulative as optional practice?
4. **Recording what the learner did.** Is a saved move log (needs an additive core change, later a persistence design) wanted, or are checked answers enough?
5. **Relationship to physical manipulatives.** Should the app suggest a printed net or a real protractor as an offline step (CPA's concrete stage), or stay screen-only?
6. **Who reviews** the new captions, the stricter screen-reader text, and the placement, and is a real phone or tablet available to test on?

### 9.3 Not verified / limits

* Nothing here has been implemented, built, run or reviewed. All design numbers (snap radii, budgets, frame times, 99.5 percent agreement, 30 KB ceiling, 44 px fit at 320 px) are proposals to be measured.
* The MOE syllabus and school documents were never read; P4 placement of nets, protractor use and symmetry is provider-sourced (previous evidence file) and unconfirmed.
* No evidence was found that virtual manipulatives improve learning outcomes; the plan makes no such claim.
* Polypad's, GeoGebra's and PhET's behaviour was not inspected hands-on; only listings and search summaries.
* jsdom 30's `PointerEvent` support, Chromium's behaviour for `setPointerCapture` plus `touch-action` under CDP touch emulation, and `getAnimations()` coverage are assumed from general knowledge and must be confirmed in WP0a.
* Real touch hardware, iOS Safari, pen, 200 percent zoom, high-contrast modes and assistive technology are unverified; the leak-versus-usability trade-off in announcements needs a human accessibility reviewer.
* Whether a six-letter or six-square net suits the learner's age, the wording of every caption and hint, and the sequencing against the school's teaching order have had no human review.
* The Playwright browser suite needs the system-library workaround recorded in README on this machine.

## 10. What must NOT be done

* Do not add a new step kind, bump schema 3 or contract 3, or touch `src/core/` unless the user agrees to the 1.4 bump triggers.
* Do not add a runtime dependency, a 3D library, WebGL, or a canvas for judged content.
* Do not judge any answer from a pixel, an angle read from the screen, or a tolerance; judge integers and sets after quantisation.
* Do not make dragging the only way to do anything; do not add free-orbit, pinch, rotate-by-two-fingers or hover-only controls.
* Do not auto-play on load with sound or loop motion; do not add timers or scores.
* Do not announce derived conclusions in Your turn; do not colour mismatches in the symmetry preview.
* Do not edit existing starter lessons, `line-graphs`, the dimension-line engine or the annotation tool; do not hand-edit emitted JSON.
* Do not describe anything as curriculum-verified, human-reviewed or covering a school's paper; do not copy any paper's diagram or wording.
* Do not request a second Claude review pass unless the user does.

## Appendix: workbench lifecycle table (R-95, written by the WP0b coding agent, 2026-10-10)

The host is `[data-region="workbench"]` in `src/ui/lesson-view.ts`, outside the innerHTML-replaced visual region. Mount key: `trial counter : presentation : lesson id : step index : step id : choice ids` (plus the specification JSON in edit presentation). Creator and destroyer: `syncWorkbench` inside `render`; `destroy()` of the view also destroys it. The same table is a comment at the top of `lesson-view.ts`.

| Event (call site) | Key changes? | Effect on the workbench |
| --- | --- | --- |
| first render, `startTrial` (start, replay, Restart lesson, Try another, restart set) | yes (trial counter + 1) | old one destroyed, a new one created with fresh state |
| `nextStep` | yes (step) | destroyed; created again if the new step has one (reflection steps have none) |
| completion screen | cleared | destroyed |
| `useHint` | no | `hint(rung)` once per change; rung 4 folds the learner's own net (counted as support by the runtime as before) |
| edit "Inspect hint" select | no | `hint(rung)` (preview) |
| `switchMode` | no | nothing; state kept |
| check | no | `lock(true)` after a correct answer; a wrong answer leaves it live and Undo can clear the choice (the next check is a new submission; history is not trimmed) |
| learner changes the list-version controls | no | `answerChanged(ids)` |
| edit `update` (typing) | only when specification, step or choice ids change | wording edits do not rebuild |
| `showEdit` / trial to edit | yes | destroyed and created in edit presentation (answer buttons disabled, folding allowed as a preview) |
| view `destroy()` | n/a | destroyed: timers, rAF, `matchMedia` and canvas pointer listeners removed, three.js geometries, materials, textures and renderer disposed |

`io.setAnswer` looks the answer controls up by choice id at call time and refuses when they are disabled or read-only. The answer controls of a workbench step are moved into a collapsed `<details class="bench-list">` ("List version of this answer") and moved back for every other step.
