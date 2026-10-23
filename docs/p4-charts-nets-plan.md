# P4 bar charts, pie charts and nets: plan

**Status: written by a planning agent on 2026-10-07. Reviewed independently the same day ([review](p4-charts-nets-review.md)); the lead's decisions on every finding are in [p4-charts-nets-dispositions.md](p4-charts-nets-dispositions.md) and WIN OVER THIS PLAN where they conflict (work-package order, pie lesson count, prism and pyramid fold checks, cuboid sizes, bar bounds, text floor, contrast thresholds). Not an approved specification; no human has reviewed it.** Evidence and its limits are in [p4-charts-nets-evidence.md](p4-charts-nets-evidence.md). Per AGENTS.md this plan goes to one Claude review, then Codex records accept, modify, reject or defer for each recommendation before any implementation. Human lesson-content approval is separate.

## 0. Findings that shape the plan

1. **Level disagreement, reported not settled.** Several 2021-aligned provider pages and unopened school-document summaries put pie charts and nets at P4. An older MOE-hosted interactive labels nets Primary 6, one provider page lists "find percentage in pie charts" at P5, and the 2006-aligned IXL page lists neither at P4. Bar graphs are placed at P3 by five sources and at P4 by none that I could open. The official syllabus PDF could not be read. **Label everything "P4 candidate", pending human confirmation** (section 3.5).
2. **P4 pie charts are fraction-of-a-whole work.** No source I read puts percentages or sector angles at P4 (percentages are P5). The plan therefore teaches pie charts through equal slices and fractions, and keeps sector angles as an exact integer inside the model only for drawing and testing. Angles and percentages are not asked of the learner. This departs from the brief's suggestion of sector-angle questions and is an open question for the user.
3. **Bar charts are a P3 skill.** At P4 they are revision, a bridge to pie charts and a double-bar extension. The lessons are tagged `p3-bridge`.
4. **Nets: cube and cuboid are certain; prism and pyramid are likely; cylinder and cone are excluded** (two sources exclude them from net work, one includes cylinders).
5. **Practice generator:** `src/practice/` only recognises eight decimal and fraction profiles by canonical payload and skill signature. New lessons are unrecognised and stay **fixed starters** this phase. A pie-chart profile (enumerating whole-number tuples) is a natural later phase and is deferred.
6. **No schema or contract change is needed.** Schema 3 and application contract 3 already accept new P4 topics once the IDs are listed. One small additive change to the shared kit is needed (section 7).

## 1. Scope and lesson matrix

### 1.1 Topic structure recommendation

Create **three new topics** and leave `line-graphs` untouched:

| TopicId | Label | Strand | Why |
| --- | --- | --- | --- |
| `bar-charts` | Bar charts | Data | Own specification (categories, optional second series). |
| `pie-charts` | Pie charts | Data | Own specification (equal slices). |
| `nets` | Nets of solids | Geometry | Own grid and catalogue model. |

Reasons not to extend `line-graphs`: its specification is a closed union (`labels`, `values`, `step`, `task`, `a`, `b`, `target`) with a strict key check; pie charts and nets share none of it, and a rename of the ID would need a migration of saved packages, so only the label could change. Merging bar and pie into one `charts` topic would force a discriminated union and one oversized validator with two unrelated oracles. The cost of three topics is tile count: the Primary 4 tab goes from 7 to 10 tiles, grouped as Numbers and operations 3, Measurement 1, Geometry 3 (angle measure, nets, symmetry) and Data 3 (bar charts, line graphs, pie charts). The strand groups already keep that readable. If review prefers fewer tiles, the fallback is one combined `charts` topic labelled "Bar and pie charts"; the lesson list and models below do not change, only registration does. I recommend three.

Shared scale helpers go in a new small module `src/topics/chart-scale.ts` so bar charts do not import from `line-graphs.ts`. Do not edit `line-graphs.ts` in this phase.

### 1.2 Why 11 lessons

Eleven fits the "8 to 12" range and the pattern of earlier families (three or four per family, one practice-style member). Bar charts get 3 because the skill is already P3 and a fourth would repeat line-graph work. Pie charts get 4 because they are the clearest new P4 skill and need a stepwise path (read, count, find the whole, practise). Nets get 4 because each of the three question types (valid net, opposite faces, which solid) needs its own representation, plus one completing task. Evidence for the task types is thin for bar charts and for opposite faces, edges and vertices; those are proposals and labelled so.

### 1.3 Lesson matrix

Lesson `level` is `"P4 candidate"`, `reviewStatus` is `"draft"`, minutes 7 (practice 4). Library level `P4`. Every step has four hints (the fourth is the labelled reveal, as in existing lessons). Every lesson ends with the structured `reflection` step (choice: one reason, two plausible wrong reasons; authored meaning, reported unverified by the validator). Reflection is not counted in the "3 to 4" below.

Response kinds: E exact, C choice, M multi. All integers parse with `parseWhole` (plain digits or digits grouped by spaces or commas).

#### Bar charts (`bar-charts`)

| Lesson ID | Title | Skills and objective | Starter values (original) | Representation | Steps (goal: kind) |
| --- | --- | --- | --- | --- | --- |
| `p4-read-bar-chart` | Read the bars | Work out the scale, read a bar, add two bars. | Pets chosen by pupils. Labels Cats, Dogs, Fish, Birds, Mice. Values 20, 35, 15, 40, 25. Step 10. Asked a=1 (Dogs) and b=3 (Birds). | Vertical bar chart, gridlines every step, axis labels only at the ends so the step must be worked out | `scale`: E (10); `read`: E (35); `total`: E (75, a plus b); `reflection`: C |
| `p4-double-bar-chart` | Two bars side by side | Read the second series, find a difference, spot the biggest gap. | Classes P4A to P4D. Series Boys 20, 30, 15, 35 and Girls 25, 15, 35, 30. Step 10. a=1. Gaps 5, 15, 20, 5 so P4C is the unique biggest. | Paired bars, solid for series 1, hatched for series 2, legend inside the SVG | `read-pair`: E (series 2 at a, 15); `difference`: E (15); `gap`: C (biggest gap, meanings biggest, other-a, other-b); `reflection`: C |
| `p4-bar-chart-practice` | A fresh bar question | Add the two tallest bars. | Labels Art, Chess, Swim, Music, Drama. Values 30, 55, 40, 65, 20. Step 10. Top two 65 and 55 give 120. | Single bar chart | `top-two-total`: E (120); `reflection`: C |

Bounds: 3 to 6 categories; labels 1 to 6 characters when 6 categories, 1 to 8 otherwise, plain text, estimated width must fit its slot (section 2.2). Values whole numbers 0 to 100. Step 2, 5, 10 or 20. Readable grain: step 2 gives 1, step 5 gives 5, step 10 gives 5, step 20 gives 10 (every value is a multiple of the grain so half-step bars are readable exactly). Axis shows at least 4 and at most 10 rows. Average is deliberately excluded: sources put it at P6.

#### Pie charts (`pie-charts`)

| Lesson ID | Title | Skills and objective | Starter values (original) | Representation | Steps |
| --- | --- | --- | --- | --- | --- |
| `p4-read-pie-chart` | Slices of the whole | Count the equal slices, say a sector as a fraction, compare sectors. | 8 slices. Soccer 3, Swim 2, Chess 1, Art 2. Asked a=0, b=1. | Circle with faint spokes at every slice, bold sector borders, direct category labels | `slices`: E (8); `fraction`: C (3/8 against 5/8 and 3/5); `larger`: C (a against b); `reflection`: C |
| `p4-pie-chart-count` | How many in each slice? | Share the total among equal slices, then count a category. | 10 slices, total 60 pupils shown. Apples 4, Pears 3, Grapes 2, Plums 1. a=0, b=1, unit 6. | Same, with "Total: 60" given in the title | `one-slice`: E (6); `category`: E (24); `more`: E (6, a minus b); `reflection`: C |
| `p4-pie-chart-total` | Find the whole | From one known category, find one slice, the whole and another category. | 6 slices. Rice 3, Noodles 2, Bread 1. a=1 (Noodles, 14 pupils given), b=0, unit 7. | Same, with only the known category's count shown | `one-slice`: E (7); `total`: E (42); `other`: E (21); `reflection`: C |
| `p4-pie-chart-practice` | A fresh pie question | Count the pupils not in one category. | 12 slices, total 60. Red 5, Blue 3, Green 2, Yellow 2. a=0, unit 5. Answer 35. | Same | `rest`: E (35); `reflection`: C |

Bounds: slice count N in {4, 5, 6, 8, 10, 12} (each divides 360); 3 to 5 categories; every category has at least 1 and at most N minus 2 slices; the parts sum to N exactly. Unit (items per slice) is an integer from 2 to 20 for count, total and practice and exactly 0 for read; the whole is at most 240. For the total task the asked category has at least 2 slices and fewer than N. For the count task the parts of a and b differ and a has more. In the fraction step, the three offered fractions must be pairwise different as reduced fractions, which excludes the asked category holding exactly half the slices. Percentages and sector angles are never shown, asked or offered as choices.

#### Nets (`nets`)

| Lesson ID | Title | Skills and objective | Starter values (original) | Representation | Steps |
| --- | --- | --- | --- | --- | --- |
| `p4-cube-net-check` | Will it fold into a cube? | Know a cube net needs 6 squares, pick the one that folds, say why another does not. | Four nets, rows joined by `/`. A `#..#/####/....` , B `..#./####/#...` , C `#####/#....` , D `##../##../.##.` . Asked (why) is A. Only B folds. | Four small nets in a 2 by 2 sheet labelled A to D | `count`: E (6); `valid`: C (B); `why`: C (two squares would land on the same face, against a missing square and the turn of the squares); `reflection`: C |
| `p4-cube-opposite-faces` | Which face is opposite? | Use a folded cube's structure to name opposite and touching faces. | One labelled net `A.../BCDE/..F.`. Face asked C. Opposite pairs A with F, B with D, C with E. | One large net with letters A to F | `opposite`: C (E); `touching`: M (A, B, D, F); `opposite-pair`: C (one true pair not involving C, against two touching pairs); `reflection`: C |
| `p4-solid-from-net` | What solid does this make? | Count faces, name the solid, count edges and vertices. | Triangular prism, variant 0. Faces 5, edges 9, vertices 6. Solid distractors cuboid and square pyramid. | Catalogue net drawn from polygons | `faces`: E (5); `solid`: C (triangular prism); `edges`: E (9); `vertices`: E (6); `reflection`: C |
| `p4-complete-the-net` | Add the last square | Choose every spot where a sixth square makes a cube net. | Net string `.#.b./####c/a.d..`: five `#` squares and four candidate spots written a to d (drawn as A to D). The prototype fold check gives valid for a and d, invalid for b (two squares on the same side) and c (five in a row). Starter answer: A and D. | Five squares plus four dashed spots | `spots`: M (A, D); `reflection`: C |

Choices for `spots` are listed A to D in order (`keepOrder`) while ids stay opaque.

Nets bounds: grid at most 5 columns by 5 rows; at most 7 squares in a `check` candidate. Solids in the catalogue: cube, cuboid, triangular prism, square pyramid. Cylinder, cone and tetrahedron are excluded (the last needs non-integer coordinates).

Library order, prerequisites and blurbs (original wording) are in section 7.

## 2. Exact models

All specifications are flat JSON objects with a strict key check (`hasOnlyKeys`) like the existing families. Unused fields hold neutral values (0 or empty string or empty array), as `line-graphs` does. All answers are derived from the specification in `<topic>Answer(spec, step)`; `validate<Topic>Steps` re-derives and rejects a mismatch ("Answer contradicts model"). No floating point decides any answer. Floating point appears only in drawing coordinates (pie arcs), and the tests check the drawing with a documented rounding rule that never touches an answer.

### 2.1 Pie charts

Specification fields:

| Field | Type and bound | Meaning |
| --- | --- | --- |
| `task` | `read`, `count`, `total`, `practice` | Selects goal sequence. |
| `slices` | one of 4, 5, 6, 8, 10, 12 | N equal slices. |
| `categories` | 3 to 5 distinct plain strings, 1 to 8 characters, no `<>&"'` | Labels. |
| `parts` | integers, same length, each at least 1, sum equals `slices`, each at most `slices` minus 2 | Slices per category. |
| `unit` | integer 0, or 2 to 20 | Items one slice stands for. 0 only for `read`; whole `slices*unit` at most 240. |
| `quantity` | plain string up to 30 | What is counted, for example "pupils". |
| `a`, `b` | category indexes | Categories asked about. |

Derived values (production):

* sector size in slices `parts[i]`; fraction `parts[i]/slices`, always shown unreduced as written;
* sector angle in whole degrees `parts[i] * (360 / slices)`, exact because `slices` divides 360 (used for drawing and for tests only; never shown);
* whole `slices * unit`; category count `parts[i] * unit`.

Answer formulas by goal:

| Goal | Answer |
| --- | --- |
| `slices` | `slices` |
| `fraction` | choice whose meaning is `share` (label `parts[a]/slices`); the others are `rest` (`(slices - parts[a])/slices`) and `ratio` (`parts[a]/(slices - parts[a])`) |
| `larger` | `left` if `parts[a] > parts[b]`, `right` if less, `same` never offered as the answer (validator requires different parts) |
| `one-slice` | `unit` (in the total task this is the known count divided by `parts[a]`, equal to `unit`) |
| `category` | `parts[a] * unit` |
| `more` | `(parts[a] - parts[b]) * unit` |
| `total` | `slices * unit` |
| `other` | `parts[b] * unit` |
| `rest` | `(slices - parts[a]) * unit` |

Goal sequences: read `slices, fraction, larger, reflection`; count `one-slice, category, more, reflection`; total `one-slice, total, other, reflection`; practice `rest, reflection`. Response kinds are fixed by a `KINDS` table through `checkKinds`. Choice meanings are checked with `checkMeanings`: `fraction` needs `share, rest, ratio`; `larger` needs `left, right, same`.

What the learner sees given: read shows no number; count shows the whole in the title ("Total 60 pupils"); total shows only the known category count ("Noodles: 14"); practice shows the whole. Nothing else numeric is drawn.

**Drawing.** `viewBox="0 0 400 300"`, centre (200, 150), radius 95. Angles run clockwise from 12 o'clock. A point at angle t degrees is `(200 + 95*sin t, 150 - 95*cos t)`, written with `toFixed(2)`. Each sector is `M cx cy L x1 y1 A 95 95 0 L 1 x2 y2 Z`, where the large-arc flag L is 1 when the sector exceeds 180 degrees (that is, `parts[i]*2 > slices`) and the sweep flag is always 1. Sector fills are five colours, each at least 4.1:1 against the page surface `#fffdf8`: `#2a7a96`, `#c0561f`, `#7a5c9a`, `#4f8a3c`, `#8a6d00`. Sectors are separated by a 2 px `#fffdf8` stroke. Faint spokes at every slice boundary run to the rim so the slices can be counted. The category label sits outside the rim at the sector's mid-angle, radius 111, font 15 px bold, anchor start on the right half, end on the left half, middle within 8 px of the vertical centre line. Direct labels remove any reliance on colour.

**Collision rule (author time and test time).** A pure function `labelBoxes(spec)` returns estimated boxes (width is characters times 0.6 times font size, height is font size times 1.2). `validatePieSpec` rejects a configuration whose label boxes overlap each other or leave the viewBox. A test sweeps every valid specification.

**Independent test oracle (written differently).**

* Build an array of N owners, one per slice, by pushing each category index `parts[i]` times; count and compare by filtering and length, not by the production multiplications.
* Recover `unit` by a linear search for the smallest u in 1 to 240 with `u * ownerCountOfKnown === known`, and the whole by `u * owners.length`.
* Angles by accumulation: a loop adds `360/N` once per slice owner and records running totals; assert the total is 360 and equals the sum of the sector degrees.
* Read the arcs back out of the SVG: parse every sector `d`, take its two arc endpoints, compute each endpoint's angle with `atan2` about the centre, difference modulo 360, round to the nearest integer degree and assert it equals the model's degrees; assert the radius is 95, sweep is 1, and the large-arc flag equals (degrees greater than 180). The rounding is a drawing check only (with two-decimal coordinates the angle error is under 0.01 degrees); it does not decide any answer, and this is stated in the test.
* Property sweep over every N, every composition of N into 3 to 5 parts within the bounds, and every legal unit: validation accepts the generated specification, derived answers agree with the oracle, the fraction choices are pairwise different, and `labelBoxes` has no overlap.
* Malformed input: parts not summing to N, N not in the list, 6 categories, duplicate labels, unit with decimals, markup in a label, unknown key, `unit` 0 outside `read`, non-array fields.

### 2.2 Bar charts

Specification fields: `task` (`read`, `double`, `practice`); `labels` (3 to 6 distinct plain strings); `values` (series 1, integers 0 to 100); `values2` (series 2, same length for `double`, empty array otherwise); `series` (two plain strings of 1 to 12 characters for `double`, empty array otherwise); `step` (2, 5, 10, 20); `quantity` (plain, up to 40); `a`, `b` (indexes).

Scale rules (shared helper `chart-scale.ts`): `grain` is 1, 5, 5, 10 for steps 2, 5, 10, 20. Every value of both series is a multiple of the grain. `rows = max(4, ceil(maxValue / step))` and `rows` is at most 10; axis top is `rows * step`. Row height in pixels is `2 * floor(100 / rows)`, so it is always even and a half step is a whole number of pixels. Bar heights are therefore exact integers and the tests can read values back with no tolerance.

Validation extras: `read` needs `a` different from `b` with different values; `double` needs the second series, `a` valid, and a unique biggest gap `|values[i] - values2[i]|`, and `values2[a]` different from `values[a]`; `practice` needs the second and third largest values to differ (so the top two are unambiguous). Label width fit: estimated width is characters times 0.6 times 15, required to be at most slot width minus 4 where slot is `(400 - 60) / n`, which is why six categories allow at most 5 to 6 characters (the validator computes, not this sentence).

Answer formulas: `scale` is `step`; `read` is `values[a]`; `total` is `values[a] + values[b]`; `read-pair` is `values2[a]`; `difference` is `|values[a] - values2[a]|`; `gap` is the choice whose meaning is `biggest` (index of the maximum gap; the other two choices are the next two gaps in order); `top-two-total` is the sum of the two largest values.

Drawing: `viewBox 0 0 400 340` at most, plot left margin 46, right 14, top 44, bottom 52. Gridlines and tick labels (15 px) as in the line-graph chart; the `read` task labels only the first and last gridline so the step has to be worked out (same device as `line-graphs`). **Bar values are never printed on bars.** Series 1 fill `#2a7a96` (4.78:1 against `#fffdf8`), series 2 fill `#c0561f` (4.5:1) with a diagonal-stripe `<pattern>` overlay so the two series differ without colour. Legend inside the SVG at top: swatch plus the series name, 14 px. Bars have a 2 px `#fffdf8` gap.

Independent oracle: compute `axisMax` by loop (smallest multiple of `step` not below the largest value, at least 4 rows); read each bar's value back from the SVG `<rect>` as `(baselineY - y) / pixelsPerValue` in integer arithmetic and compare for equality; recompute gaps with a sort rather than an argmax; compute top-two with a sort and slice; the sweep covers every step, 3 to 6 categories and sampled grain-multiple values, and assert that for `double` rects of the second series stay inside their slot.

### 2.3 Nets

#### Representation of a cube net

A net is a list of rows joined by `/`, each character one cell: `.` empty, `#` an unlabelled square, `A` to `F` a labelled square (each letter used once; a net is either all `#` or all letters), `a` to `d` a candidate spot (complete task only). Cell (x, y) means column x from the left and row y from the top; the code stores cells as integer pairs with y counted from the bottom for the roll direction table below. At most 5 columns and 5 rows. The string is the stored ground truth; it is self-describing, so the data does not depend on any ordering the code computes. The author tool offers ready-made cube nets (section 4).

#### Folding algorithm (production): rolling a cube over the net

Treat the net as a trail for a cube to roll over. Give the cube faces ids 0 to 5. A state is a tuple (down, up, north, south, east, west) of face ids; the start state is (0, 1, 2, 3, 4, 5). Rolling across an edge in direction d gives:

* east: (east, west, north, south, up, down)
* west: (west, east, north, south, down, up)
* north: (north, south, up, down, east, west)
* south: (south, north, down, up, east, west)

Algorithm `foldsToCube(cells)`:

1. If the cell count is not 6 or the cells are not edge-connected, return invalid (reason `wrong-count` or `not-connected`).
2. Start at the cell with the smallest (x, y) in a fixed order. Breadth-first over the four directions in the fixed order east, west, north, south. When a neighbouring cell is first reached from cell c, its state is the roll of c's state in that direction.
3. For every pair of edge-adjacent cells in the net, including edges that were not used by the search, check that the stored state of the second cell equals the roll of the first cell's state in that direction. A mismatch means the paper would have to stretch, so return invalid (reason `overlap`). This is what rejects any net containing a 2 by 2 block, whose creases around a corner total 360 degrees instead of a cube corner's 270.
4. The cell's face is its state's `down`. If the six down ids are not all different, return invalid (reason `overlap`: two squares land on the same face and one face is left empty).
5. Otherwise return valid with the map cell to face id.

Opposite faces: face ids are opposite when they are paired 0-1, 2-3, 4-5 (down-up, north-south, east-west of the start state). Two cells are opposite iff their face ids are a pair. Touching faces are all faces other than itself and its opposite. The prototype confirmed that this method finds exactly 11 free nets (64 fixed orientations) among the 216 fixed hexominoes, and for the starter net `A.../BCDE/..F.` it gives opposite pairs A with F, B with D, C with E.

Reasons: `overlap`, `wrong-count`, `not-connected`. The `why` step offers three choices: the true reason for the asked net (always `overlap` for six-square candidates), a distractor `wrong-count` (written as "a square is missing"), and a distractor `turn` ("the squares need turning round"). The validator requires the asked net to be invalid with reason `overlap`.

Complete task: `validCompletions(piece, spots)` returns the set of spot letters whose cell, added to the five squares, passes `foldsToCube`. Validation: exactly 5 `#` cells, exactly four distinct spot letters `a` to `d`, every spot empty and edge-adjacent to a square, and between 1 and 3 valid spots (so at least one invalid).

#### Independent oracle for the cube (test file)

Two separately written methods, not the production rolling table.

1. **Enumeration oracle.** The test grows all fixed hexominoes from one square by adding an edge-neighbour five times and removing duplicates after translating to the corner. Assert 216 fixed. Reduce by the 8 symmetries (four rotations, with and without a mirror) to canonical form and assert 35 free. Run `foldsToCube` on all 216 and assert exactly **64 valid fixed, which reduce to exactly 11 free nets**. Compare that set of 11, by canonical form, to a literal list of the textbook nets typed into the test as strings and expanded by the 8 symmetries: six of the "1-4-1" type (a row of four with one square above and one below, in all six column choices up to symmetry), three "2-3-1", one "2-2-2" staircase and one "3-3". Set equality in both directions. The prototype split the 11 as 6, 3, 1, 1.
2. **Geometric oracle.** Each cell carries a 3 by 3 integer matrix whose columns are the images of the net's east, north and out-of-plane unit vectors in 3-space, starting at the identity. Crossing an edge multiplies by a quarter-turn matrix about the shared edge's axis, always in the same sense (towards the viewer). The face of a cell is the axis-aligned vector the out-of-plane column maps to. The net folds iff all six vectors are different and every adjacent pair of cells is consistent. Two cells are opposite iff their vectors are negatives. This avoids the permutation table. Test: both methods agree on validity for all 216 and on every opposite pair for all 64 valid ones.
3. **Labelled faces.** For every valid net and every assignment of letters A to F to its cells (720 per net), assert that the production opposite map equals the geometric oracle's, and that opposite is symmetric, irreflexive and a perfect matching of the letters. A sample is enough for the 720 permutations if the run is slow; the sweep over the 64 orientations is exhaustive.
4. **Distractors.** The starter data uses fixed hexomino invalid nets. The author "ready-made" menu lists all 24 invalid free hexominoes by name (35 minus 11), generated by the same enumeration and sorted by canonical key, and the test asserts the count 24 and that every one is rejected by both oracles. The `check` task needs one valid and three invalid nets with distinct canonical forms and with the valid one not among the three; the validator enforces it.
5. **Completions.** For each of the 64 valid orientations and each removable square, assert the production `validCompletions` equals a brute-force check using the geometric oracle. Record the prototype figure that every such piece had exactly 4 valid completions as a computed sanity check to re-measure, not to hard-code.

#### Catalogue solids (`p4-solid-from-net`)

Cube and cuboid nets are stored as cell strings plus (for the cuboid) per-column widths and per-row heights in whole units, and are validated by the same fold algorithm on the cells plus a dimension check: every cell's derived width and height must match its column and row sizes and shared edges must have equal length. Triangular prism and square pyramid cannot be a square grid, so they are a **fixed hand-built catalogue**: each entry is a list of face polygons with integer coordinates in whole units, a scale, and the solid it makes. Entries (original dimensions): cube with side 3 and the cross layout; cuboid 3 by 2 by 1 (column widths 3, 2, 3, 2; row heights 2, 1, 2); triangular prism with 3-4-5 right-triangle ends and a height of 4 (rectangles 3, 4 and 5 wide, triangles on the 4-wide rectangle); square pyramid with a base of 4 and four triangles of height 5 (slant edges equal). Author edits choose a catalogue entry (`solid`, `variant`); they cannot draw faces. This is an explicit limitation: the non-grid nets are checked by face-shape counts and edge matching, not by a general folding algorithm, and need human geometry review.

Derived facts: faces `F` = number of polygons; edges `E` = (sum of the number of sides of every face) / 2; vertices `V = 2 + E - F` (Euler). Solid name from the face multiset by a rule table: 6 squares is a cube; 6 rectangles, not all squares, is a cuboid; 3 rectangles and 2 triangles is a triangular prism; 1 square and 4 triangles is a square pyramid. `solid` choice distractors come from a literal table: for a triangular prism, cuboid and square pyramid; for a square pyramid, triangular prism and cuboid; for a cube, cuboid and square pyramid; for a cuboid, cube and triangular prism. Validation: the polygon-derived name equals the declared solid, and F, E, V equal the literal table below.

Independent oracle: a literal table cube 6, 12, 8; cuboid 6, 12, 8; triangular prism 5, 9, 6; square pyramid 5, 8, 5; plus a second method that counts distinct vertices and distinct edges by hard-coded 3D vertex and edge lists for each solid (typed into the test). For the cuboid and cube nets, also run the cell oracle above.

Validation of specification fields:

| Field | Type and bound |
| --- | --- |
| `task` | `check`, `opposite`, `solid`, `complete` |
| `nets` | array of net strings. `check`: exactly 4; `opposite`: 1 labelled; `complete`: 1 with spots; `solid`: empty |
| `asked` | 0 to 3, index of the net used by `why`; 0 otherwise |
| `face` | one of A to F for `opposite`, empty otherwise |
| `solid` | cube, cuboid, triangular-prism, square-pyramid, or empty |
| `variant` | 0 to 1 |

Answers by goal: `count` is 6 (a cube's face count); `valid` is the choice for the unique candidate for which `foldsToCube` is true (validator requires exactly one); `why` is the choice meaning `overlap`; `opposite` is the letter opposite `face`; `touching` is the four letters that are neither `face` nor its opposite; `opposite-pair` is the choice for a pair of letters that are opposite and do not include `face` (the two wrong pairs are touching pairs, chosen in letter order); `faces`, `edges`, `vertices` as above; `solid` is the declared solid; `spots` is `validCompletions`.

Choice and multi ids are opaque and shuffled through `choices(...)` (rotation seeded from the specification), as in `p4-kit.ts`.

#### 3D hint and fold animation

Do **not** build a fold animation or a 3D view in this batch. Reasons: a faithful animation needs 3D projection code, and under `prefers-reduced-motion` it must degrade to static frames anyway. The reasoning route is the hints: rung 2 and 3 of the opposite-faces lesson say, in words, "pretend C is the floor; B and D become two walls, A and F become the front and back" and name the answer only at rung 4. If review wants a picture, add a later work package: a static three-frame strip (flat, half-folded, closed) drawn from the same face map, shown only after hint rung 3 (otherwise the picture leaks the answer), with no motion at all so reduced-motion needs no special path.

## 3. Visual design

### 3.1 Phone sizing rules (all three topics)

Each SVG has an explicit `viewBox` no wider than 400 units and `width:100%; max-width: Wpx; height:auto`, as the existing families do. At a 360 px page width the 400-unit charts scale to about 0.9, so every text is at least 14 units to render at 12.6 px or more; the 11 px floor is met with margin. Net sheets are designed at 360 units wide so they do not shrink. No interactive element lives inside an SVG; choices and the answer input use the existing controls, which already meet the 44 px target. Nothing animates. No horizontal scroll.

### 3.2 Layouts

* **Bar chart** as section 2.2. Category labels 15 px under the axis, axis title 16 px bold in the topic ink colour at the top left, legend 14 px.
* **Pie chart** as section 2.1; labels in the margins left and right of the circle. Total or known-count callout is part of the title text, 16 px bold.
* **Net sheets.** `check`: 2 by 2 grid of nets, each cell 26 units, so a 5 by 3 net is 130 by 78 units; the sheet is 360 by 250, each net headed by a 16 px bold letter A to D. `opposite`: one net with 52 unit cells (up to 4 by 3 = 208 by 156), letters 26 px bold centred in each square. `complete`: 44 unit cells; squares filled `#2a7a96`-family, candidate spots dashed with a 22 px letter. `solid`: polygons drawn at the entry's scale (24 to 30 units per unit length), fill pale with a 2 px ink outline, no text inside the figure.

### 3.3 Colours and contrast (calculated)

Contrast is computed with the standard relative-luminance formula, `L = 0.2126 R + 0.7152 G + 0.0722 B` after linearising each channel, and ratio `(L1 + 0.05) / (L2 + 0.05)`.

| Topic | Accent text | Tile surface | L(accent) | L(surface) | Ratio |
| --- | --- | --- | --- | --- | --- |
| `bar-charts` | `#6b5a00` | `#f7efc6` | 0.1044 | 0.8558 | 5.87 : 1 |
| `pie-charts` | `#9c3030` | `#fbe6e3` | 0.0940 | 0.8265 | 6.09 : 1 |
| `nets` | `#1b6b5c` | `#ddf1ec` | 0.1152 | 0.8434 | 5.41 : 1 |

All three exceed 4.5:1. Borders (non-text): bar `#e3d38a`, pie `#e8b3ad`, nets `#a3d3c7` (to be checked for 3:1 against the surface by the contrast test; not yet calculated). Both of the existing accent systems in `src/p4.css` need the entries: `--topic-ink` and `--topic-tint` near line 59, and `--topic-accent`, `--topic-surface`, `--topic-border` near line 135. Chart fills against the page surface `#fffdf8`: `#2a7a96` 4.78, `#c0561f` 4.5, `#7a5c9a` 5.4, `#4f8a3c` 4.1, `#8a6d00` 4.84 (graphics need only 3:1). The green `nets` accent is close in hue to `decimals` and the red `pie-charts` is new to the set; tiles also differ by icon and strand heading, so colour is not the only cue. Flag hue similarity for human visual review.

### 3.4 Icons and home page placement

Three 40 by 40 `currentColor` icons added to `topicIcon` in `src/ui/visuals.ts` (the `Record<TopicId, string>` type forces them): bar chart (three unequal bars on a baseline), pie chart (circle with one wedge lifted), nets (a cross of five squares with a sixth). Home page, Primary 4 tab, strand order unchanged: Numbers and operations (3 tiles), Measurement (1), Geometry (angle measure, nets, symmetry: nets goes before symmetry to follow the school-order evidence), Data (bar charts, line graphs, pie charts). `TOPIC_ORDER` in `src/ui/library-view.ts` gets the three IDs in that order; the topic entries in `content/library.json` carry the `strand`. The tile count (10) and the group sizes stay below the thirteen-tile clutter the earlier ADR was worried about because only one level is shown at a time.

Effects:

* **Spotlight.** `src/library/spotlight.ts` walks topics alphabetically; three new topics shift which topic appears on a given date. Any test that pins a fixed date to a topic must be re-baselined; this is expected, not a regression.
* **Revision collection `p4-preparation`.** Add all 11 lessons (P4 lessons become 38; library 56 lessons across 16 topics). Update the description, which today says "seven topics" and "some P4 topics are still to come". New wording must say ten topics, say that pie charts and nets are P4 candidates awaiting confirmation, and keep the school-scope caveat.
* **Practice set.** Add `p4-pie-chart-practice` and `p4-complete-the-net` to `practiceIds`, making nine questions, still untimed with hints. Leave `p4-bar-chart-practice` out of the mixed set (bar charts are a P3 bridge) unless the user prefers ten. Recompute with `node scripts/bind-library.mjs` after any change to `content/library.json`.
* **Fresh-practice generator.** Not used. New lessons are not recognised by `src/practice/generation.ts` and fall back to the current fixed example. Deferred.

### 3.5 Level label text

On every lesson, `level` is `P4 candidate`. Tags: `P4`, the family ID, `general revision`; pie charts and nets also `level-unconfirmed`; bar charts also `p3-bridge`. `curriculum.objectiveId` follows `candidate.p4.<family>.<task>`. `curriculum.sources` are the Practicle P4 page and the Learning Lab page for pie charts and nets, Practicle P3 and P4 for bar charts (not IXL, which lists none of these); `evidenceStatus: "candidate"`.

## 4. Author tooling

Each family gets `src/authoring/<topic>.ts` exporting an `AuthorTopic` (forms, `fields`, `patch`, `derive`, `rewrite`, `template`) in the style of `src/authoring/line-graphs.ts`. `rewrite` regenerates every prompt, hint, choice and fixture from the specification; `derive` sets each assessed step's answer from the model and keeps the reflection key. Malformed text stays editable: `patch` stores unparsable text in the field and the validator reports it.

| Family | Forms (one per lesson) | Fields |
| --- | --- | --- |
| Bar charts | `p4-read-bar-chart`, `p4-double-bar-chart`, `p4-bar-chart-practice` | text: what is counted; text: labels (comma separated, 3 to 6); text: values (comma separated); text: series 2 values and series names (double only); select: gridline step (2, 5, 10, 20); selects: first and second category asked |
| Pie charts | `p4-read-pie-chart`, `p4-pie-chart-count`, `p4-pie-chart-total`, `p4-pie-chart-practice` | text: what is counted; text: categories; text: slices per category (must sum to the slice count); select: number of slices (4, 5, 6, 8, 10, 12); number: items per slice for count, total and practice; selects: category a and category b |
| Nets | `p4-cube-net-check`, `p4-cube-opposite-faces`, `p4-solid-from-net`, `p4-complete-the-net` | check: four text fields for Net A to D (`#` square, `.` empty, rows separated by `/`) plus a select "Which net does the why step ask about"; select "Load a ready-made net into Net A, B, C or D" listing the 11 valid and 24 invalid nets by name (`patch` key `load:<slot>`); opposite: one text field for the labelled net, select face asked; solid: select solid and select variant; complete: one text field with `#` and `a` to `d` |

The pie "items in the whole" input patches `unit` as total divided by slices; a total that does not divide keeps a non-integer in `unit`, so the validator names the problem. Each form's `template` returns a full `LessonPackage` built by `p4Package` (kit change below) and passes `validatePackage`. Starter JSON files are emitted with `node scripts/emit-starter.mjs <topic>`; do not hand-edit them. The learner artifact scan (`scripts/check-learner-artifact.mjs`) gets author-only sentinels for the new field labels, for example "Slices per category" and "Load a ready-made net".

## 5. Accessibility notes

Every visual is wrapped as `role="img"` with an `aria-label` from the family's `describe(spec)`, exactly as the existing families do, and the SVG itself is `aria-hidden`.

| Visual | Text alternative | Gives the answer away? |
| --- | --- | --- |
| Bar chart (read) | Title, scale shown to the ends, category names; values withheld | No for `read`, but a screen-reader user cannot read values without a data route. Mitigation: hint rung 3 states the data for the asked bar. Flag for review. |
| Bar chart (double, practice) | Same, plus series names | Same flag. |
| Pie chart | Categories in drawing order, the whole or the known count where given; slice counts withheld | A non-visual user cannot do `slices` or `fraction` from the alternative alone; hint rung 3 gives the slice counts. Flag: unavoidable if the task is to read the picture. |
| Net check, opposite, complete | Each net as rows of squares by column position, labelled faces named in place | Describes layout, not validity or opposites, so the task stays. Long but usable. Flag for readability. |
| Solid from net | A short statement that the pattern is made of joined flat shapes, without counts or shape names | Describing the shapes would give `faces` and `solid`. Non-visual route is only via hint rung 3. Flag for human review, as for line graphs. |

Line-graph precedent lists the data in the alternative (giving the readings away) and was recorded for human review; this plan chooses the stricter route and routes the data through hints instead. That is a design choice for the reviewer to confirm. Fonts: no motion; `prefers-reduced-motion` has nothing to respect in this batch. Colour is never the only cue (direct labels, stripes, letters).

## 6. Test plan

New files, in the style of `tests/p4-line-graphs.test.ts` and `tests/p4-symmetry.test.ts` (independent oracle written differently; no floating-point ground truth).

| File | Coverage |
| --- | --- |
| `tests/p4-pie-charts.test.ts` | Packages validate, all four forms play to completion in independent and guided modes with rejected fixtures; owner-array oracle; accumulation angles; arc read-back from the SVG; collision sweep; property sweep over N and compositions; malformed specs; no hidden values in on-screen text, label or SVG text (for the read task, neither the slice counts nor the whole appear; for the count task, no category count appears); author edit coherence |
| `tests/p4-bar-charts.test.ts` | Same structure; scale and rows by loop; bar read-back in integer pixels; unique biggest gap and unique top two; label fit sweep; double-series stays in slot; no values printed on bars |
| `tests/p4-nets.test.ts` | Hexomino enumeration (216, 35, 64, 11) and set equality with the textbook list; geometric oracle agreement for all 216; labelled-face sweep; 24 invalid nets rejected by both; completion oracle; catalogue F, E, V literal and vertex-list oracle; cuboid dimension consistency; malformed net strings (ragged rows, bad characters, repeated letters, 8 rows, disconnected); choice ids opaque, `answer` ids not equal to position |
| `tests/home-layout.test.ts` (edit) | Primary 4 tile list gains the three topics in the new order; Data and Geometry groups; counts |
| `tests/spotlight.test.ts` (edit) | Re-baseline fixed-date expectations |
| `tests/contrast.test.ts` (new, small) | Parse `src/p4.css`, compute luminance with an independently written function, assert at least 4.5:1 for each new accent and surface pair, at least 3:1 for borders and chart fills against `#fffdf8` |
| `tests/p4-expansion-browser.spec.ts` (edit) | Add the three families to `families`; the existing loop already plays every lesson to completion at 390 and 1280 px, takes a screenshot at 390, runs the text clipping check and checks no sideways scroll |
| browser spec additions | At 360 px width, every SVG `text` rendered font size (attribute times SVG scale) is at least 11 px; every `button`, choice label and the answer input is at least 44 px high; emulate `prefers-reduced-motion: reduce` and assert no running animation or transition on the visual; assert no horizontal scroll at 360 |

Also run the existing gates: `npm run typecheck`, `lint`, `format:check`, `npm test`, `npm run test:e2e`, `content:validate`, both builds, and `test:release`. State in the handover what was and was not run.

## 7. Implementation order and file list

### Work packages (at most three, in order)

**WP1: bar charts and pie charts** (plus all shared plumbing for these two IDs and the kit change). Deliver 7 lessons, two families, tests, home tiles, colours, icons.

**WP2: nets.** Deliver 4 lessons, the fold algorithm and both oracles, the solid catalogue, tests, tile, colours, icon.

**WP3: integration.** Collection, practice set, home order tests, spotlight re-baseline, browser additions, contrast test, learner-artifact sentinels, digest rebind, manifest content-impact decision entry, handover and implementation-status updates, screenshots.

A topic ID cannot be added to `TopicId` before its adapter and author topic exist, because `adapters` is a `Record<TopicId, Adapter>` and `topicIcon` is a `Record<TopicId, string>`; that is why `nets` waits for WP2 rather than being registered early.

### Files to create

| File | Approx. lines | Notes |
| --- | --- | --- |
| `src/topics/chart-scale.ts` | 60 | grain, rows, row pixels, axis top |
| `src/topics/bar-charts.ts` | 380 | spec, validators, answers, SVG, adapter, `RuntimeTopic` |
| `src/topics/pie-charts.ts` | 420 | spec, validators, answers, arc drawing, `labelBoxes`, adapter |
| `src/topics/nets.ts` | 650 | net parsing, `foldsToCube`, opposite map, catalogue, SVGs, adapter |
| `src/authoring/bar-charts.ts` | 400 | `AuthorTopic` and templates |
| `src/authoring/pie-charts.ts` | 430 | same |
| `src/authoring/nets.ts` | 480 | same, plus the net preset list |
| `content/lessons/*.json` (11 files, ids in section 1.3) | about 120 each | emitted, not hand-written |
| `tests/p4-bar-charts.test.ts`, `p4-pie-charts.test.ts`, `p4-nets.test.ts`, `contrast.test.ts` | 350, 400, 500, 60 | |

### Files to change

| File | Change | Risk |
| --- | --- | --- |
| `src/core/types.ts` | add `bar-charts`, `pie-charts`, `nets` to `TopicId` | Compile errors guide the rest |
| `src/content/validation.ts` (near line 77), `src/content/package-validation.ts` (near line 214), `src/library/catalogue.ts` (near line 45) | add the IDs to each topic list | Missing one makes packages fail validation |
| `src/topics/registry.ts`, `src/authoring/registry.ts` | register runtime topic, adapter and author topic | Low |
| `src/topics/p4-kit.ts` | `PackageOptions` gains optional `sources` and `extraTags`; defaults keep existing output byte-identical | Must not change existing starters; guard with a test that re-emits an existing family and compares |
| `src/ui/lesson-view.ts` (near line 255) | add the three IDs to the list that sets `inputMode` numeric for exact steps | Easy to forget; exact answers would show a text keyboard |
| `src/ui/visuals.ts` | three icons | Low |
| `src/ui/library-view.ts` | `TOPIC_ORDER` | Low |
| `src/p4.css` | both accent blocks, plus `.bar-charts-model svg, .pie-charts-model svg, .nets-model svg` width rules | Low |
| `content/library.json` | three topics with strand, 11 lessons with sequence, prerequisites, blurbs; collection and practice ids; description | Digest must be rebound |
| `release/manifest.json` | rebound digest and a content-impact decision entry | Via the script only |
| `scripts/check-learner-artifact.mjs` | new author-only sentinels | Low |
| `tests/home-layout.test.ts`, `tests/spotlight.test.ts`, `tests/p4-expansion-browser.spec.ts` | as section 6 | Fixed-date re-baseline |
| `handover.md`, `docs/implementation-status.md` | ownership row first, then results; record that no human review happened | Required by AGENTS.md |

Do not modify `.agents/`, `.aws/`, `.codex/` or `.git/`.

Library sequence and prerequisites (all IDs in section 1.3): `p4-read-bar-chart` 1; `p4-double-bar-chart` 2 requires it; `p4-bar-chart-practice` 3 requires the double chart. `p4-read-pie-chart` 1; `p4-pie-chart-count` 2; `p4-pie-chart-total` 3; `p4-pie-chart-practice` 4, each requiring the previous. `p4-cube-net-check` 1; `p4-cube-opposite-faces` 2 and `p4-solid-from-net` 3 each require the check; `p4-complete-the-net` 4 requires the opposite-faces lesson. Blurbs, original: "Work out the scale, then read and add bars." "Compare two groups side by side and find the biggest gap." "One fresh question on the tallest bars." "Count the equal slices and say each share as a fraction." "Share the total between the slices." "Start from one known slice and find the whole pie." "One fresh question on what is left over." "Which flat patterns fold into a cube, and why not the others?" "Fold in your head: which face ends up opposite?" "Count faces and edges, then name the solid." "Find where the last square can go."

### What must NOT be done

* Do not rename or change `line-graphs`, its lessons or its helpers.
* Do not bump schema 3 or contract 3; do not change the digest version.
* Do not copy or trace any paper question, diagram or answer key; all names, values and drawings are original.
* Do not show or ask percentages or sector angles in pie lessons; do not add cylinder, cone, tetrahedron, average, or a net-drawing task.
* Do not decide any answer from a floating-point calculation or a tolerance; the pie arc read-back is a rendering check only.
* Do not print bar values on bars or slice counts on pies in the reading lessons.
* Do not add a runtime dependency, a 3D library or an animation.
* Do not hand-edit emitted lesson JSON; re-emit with `--force` only after checking.
* Do not plug the new lessons into the fresh-practice generator in this phase.
* Do not describe anything as curriculum-verified, human-reviewed, or covering a school's paper. Do not label content "MOE P4 syllabus".
* Do not hard-code the prototype's "4 completions per piece" figure.
* Do not ask for a second Claude review pass unless the user does.

## 8. Open questions for the user

1. Pie charts: keep fraction-only (recommended, matches the evidence) or add percentages and sector angles anyway as an extra, later lesson set?
2. Is a P3-level bar chart topic wanted at P4 at all, or should bar charts be folded into the existing Data tile later?
3. Do you want the school's topic list before WP2, to confirm nets and the solids (cuboid, prism, pyramid)?
4. Three tiles (recommended) or one combined "Bar and pie charts" tile?
5. Is a static fold-up picture (no animation) worth a later work package?
6. Who is the human reviewer for the maths, wording and text alternatives?

## 9. Not verified

* The 2021 MOE syllabus text: never read; all level placement is provider or search-summary evidence.
* Which topics, solids and depth the learner's school uses.
* Any past-paper question style: none opened; the task lists are partly design choices (bar chart tasks, opposite faces, completing a net, faces, edges, vertices).
* That the solid catalogue's non-grid nets fold: checked only by face counts and edge lengths, to be reviewed by a human or by physical folding.
* The prototype figures (216, 35, 64, 11, the row profiles 6, 3, 1, 1, and the 4 completions) are from a scratch script; the coding agent's tests must establish them.
* Contrast values for the borders and for hue distinguishability on screen; phone rendering, 200% zoom, assistive technology, and every lesson's wording and hints have had no review.
* Nothing in this plan has been implemented, built, run in a browser or reviewed.

## 10. Why is it called a "net"? (for the user)

**For a child.** Open a cardboard box carefully along some of its edges and press it flat. The flat shape you get, with all the sides still joined together, is a net. It is like a fishing net: a flat spread-out pattern of pieces joined up, which you can gather and fold up again around something. If you fold the net back along the joins, it wraps up into the solid. A net must keep all its faces joined edge to edge, and when it folds, no two faces may land on the same spot.

**For an adult.** In geometry a net of a polyhedron is a connected arrangement of non-overlapping polygons joined edge to edge in the plane that can be folded along the shared edges to form the faces of the solid. The earliest known printed nets are in Albrecht Dürer's 1525 book on measurement, and the one general source I read says they were first called "nets" in 1543 by Augustin Hirschvogel. That source does not say why the word was chosen, and I found none that does. The usual intuition, which I offer as an explanation and not as established history, is that the flat arrangement resembles a mesh of joined pieces that can be gathered up round a shape; the German word is "Netz" (my own knowledge, not confirmed from a source I opened). A cube has exactly 11 different nets; many six-square patterns look plausible but fail, because two squares would land on the same face of the cube.

## Outcome (2026-10-07, Claude)

Implemented with the dispositions in `docs/p4-charts-nets-dispositions.md` (which win over this plan). Delivered 12 draft lessons: nets 4, pie charts 5, bar charts 3. Library: 16 topics, 57 lessons. Verification: 672 unit tests, 57 valid packages, 130 Chromium tests, builds and release checks, all run by the lead after each package; see `handover.md`. Deviations: nets grid limit 6; bar read lesson axis tops out at 40; double-bar asked class changed to avoid repeated answers. Not done: percentages and sector angles, net drawing, isometric grids. Not verified: official syllabus, human review, real devices, assistive technology.

