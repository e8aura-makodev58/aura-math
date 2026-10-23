# P4 assessment preparation — proposed first module

Prepared 2026-10-05 by Codex’s P4 planning agent. **Status: implemented following the user’s continuation request and single-review dispositions R-64–R-74; verification is recorded in handover.** The user has paused further P2–P3 material expansion and prioritised preparation for a P4 Term 4 assessment. Preserve the existing 18 lessons and playful library; this work changes the next content priority, not those completed deliveries.

School-specific topics, textbook edition and assessment format are not yet supplied. This proposal therefore uses **general P4 revision assumptions**, supported by the inspected sources and limitations in [P4 curriculum evidence](p4-curriculum-evidence.md). It does not promise full P4 coverage, identify the learner’s school, or assert that all schools assess the same topics in Term 4. When a topic list arrives, Codex updates the proposed selection before implementation; unrelated engineering planning can continue.

## 1. Useful first outcome and explicit limits

Propose **12 original P4 lesson packages**, covering three priority families: decimals, fractions, and area/perimeter. Each family has three teaching lessons and one short independent-practice lesson with a new original example. The existing P2/P3 lessons remain available as clearly labelled prerequisites, not relabelled P4 content. Whole-number algorithms/factors, angle measurement, symmetry, tables/line graphs, time, nets and pie charts remain visible planning gaps.

The pilot offers a self-paced path: choose a skill → see its model → answer intermediate questions → check a fresh practice question → revisit an explanation if needed. A separate **three-question mixed-practice taster** links the three practice packages. It is a short practice sequence, not an assessment replica, diagnostic, prediction, comprehensive revision paper or mastery test. Existing retries and hint availability remain; no countdown, exam marks, grade estimate, adaptive ability model, new account system or broad assessment engine is added in this phase.

A child or supporting adult should be able to find the P4 preparation path immediately, choose a topic, understand what the first batch covers, and finish a small useful activity without navigating all P2/P3 cards. The font work is independently planned; P4 content must not depend on a chosen font or trigger another home redesign.

## 2. Proposed lesson matrix

All IDs, examples, quantities, bounds and teaching sequences below are **Aura Math design proposals**, not copied exam questions. Every teaching package has 3–4 purposeful assessed goals plus structured reflection where appropriate; do not pad a one-question practice package to four goals. The practice packages have one mathematical question plus a short reason choice; reflections are not counted as extra practice questions.

| Package ID / skill | Distinct task and original example | Representation and assessed path |
| --- | --- | --- |
| `p4-decimal-places` | Read tenths/hundredths/thousandths and compare values, including zero places; e.g. 3.407 versus 3.47 | Decimal place chart and bounded number line; name a target place, find its digit value, choose the larger value, explain. |
| `p4-decimal-add-subtract` | Align place values in addition/subtraction with up to two decimal places; e.g. 7.25 − 2.6 | Reusable place chart and one clearly shown regrouping; identify equal units, calculate, check the size of the result. |
| `p4-decimal-multiply-divide` | Multiply/divide a two-place decimal by a one-digit whole number; e.g. 2.4 ÷ 3 | Equal-unit strip/counts, not thousands of dots; choose the equal grouping, derive the result, check by reversing the operation. Exact terminating quotients only in this batch. |
| `p4-decimal-practice` | One fresh two-step decimal context combining one-digit multiplication and subtraction | Short task wording, diagram on request, exact final response and authored reason; interpretation stores both operations and their quantities/units. |
| `p4-mixed-and-improper` | Connect a mixed number with an improper fraction; e.g. 2 3/5 | Several equal-sized fraction strips; count whole units and remaining parts, identify equivalent forms, explain why the quantity is unchanged. |
| `p4-fraction-add-subtract` | Add/subtract like or related proper fractions; e.g. 5/6 − 1/3 | Equal-whole strips with a common partition; choose matching equal units, calculate, simplify. Related denominators mean one divides the other in this pilot. |
| `p4-fraction-of-quantity` | Find a proper fraction of an integer quantity; e.g. 3/4 of 28 | Grouped set and unitary bar; find one equal part then the required number of parts. Exact integer results only. |
| `p4-fraction-practice` | One fresh question using a fraction of a quantity and the remaining quantity | Source-linked interpretation; split into equal parts, derive the target, final answer and authored reason. |
| `p4-rectangle-missing-side` | Find a missing dimension from area or perimeter and another dimension; e.g. area 84 cm² and width 7 cm | Rectangle with explicit known/missing labels; distinguish square units from length units, select the relationship, derive the missing length, check. |
| `p4-composite-area` | Find the area of a rectangle with a rectangular corner removed; e.g. 12×8 with a 4×3 corner missing | One bounded orthogonal L-shape; choose split/add or outer-minus-cutout, calculate the component area, derive the whole area. Both supported methods accepted. |
| `p4-composite-perimeter` | Find the outside boundary of that shape, deriving missing edge lengths | L-shape boundary highlighting with keyboard/tap edge alternatives; derive a missing segment, add only outside lengths, explain why an internal split edge is excluded. |
| `p4-measurement-practice` | One fresh labelled L-shape asking for either its area or perimeter | Identify the requested measure, final integer response in the displayed unit, authored reason. No task requires estimating dimensions from pixel size. |

Teaching and practice examples must differ in payload, not simply switch the same question’s label. The first matrix selects assessable methods within clear bounds. It does not claim to cover every item in historical papers. If the supplied school list prioritises other families, reorder or replace explicitly before coding; do not silently grow this into an unlimited syllabus project.

## 3. Contracts needed before authoring

### 3.1 Level and package compatibility

Use a shared machine level type `P2 | P3 | P4` and explicit parsing/validation. Current code accepts only P2/P3, and unknown non-P3 legacy display levels default to P2. Audit all of these before adding content:

| Boundary inspected | Necessary change and regression guard |
| --- | --- |
| `src/content/package-validation.ts`: library level union and validator | Accept explicit P4 in the new contract; preserve exact v1/v2 reads. Match candidate display to authoritative machine level. Reject unrecognised levels. |
| `src/library/catalogue.ts`: index/record unions, validation, fallback and `intrinsicLibrary` | Add P4 without classifying a P4 source as P2. Known existing IDs retain their original mapping; unsupported legacy level is actionable, not guessed. |
| `src/ui/library-view.ts`: route parser and level options | P4 filter/hash route survives refresh and return; unknown routes safely recover. Support an explicit preparation collection rather than assuming all P4 material belongs to the first batch. |
| `src/authoring/model.ts` and author details controls | Level editing, new templates and origin reports preserve P4; v1 migration remains deliberate and undoable. |
| `src/core/types.ts`, runtime and authoring registries, renderer/title/icon composition | Add supported topic/answer contracts explicitly; remove no existing capability. Core runtime still receives an adapter and imports no concrete maths. |
| Release scripts/loader, fixture validator, artifact scans | Reject new unsupported contract versions; preserve synthetic approved-subset and empty-release checks; no P4 drafts/templates enter approved learner artifacts. |

Propose **package schema v3** and **application contract 3**, because P4 exact free-text responses and new specifications are substantive contract changes. Keep canonical digest version unchanged. Continue accepting byte-identical v1/v2 packages and local drafts; existing P4 schema-v3 packages do not exist. Do not auto-convert old packages/storage on read. Editing an older source can deliberately promote to v3 once, keeping exact origin and revision/undo semantics. Pin migrations and examples in an ADR after review, before implementation. Schema and application-contract increments must be updated together with build/loader fixtures; real approval entries stay empty until human evidence exists.

The separately bound library index must carry the preparation collection and its ordered package IDs. Any index envelope/version change is explicit in its validator and release fixture. Suggested collection contract: stable ID, short label, coverage note, level P4, ordered unique lesson IDs, and three practice IDs that are a subset of those members. Prune membership to the permitted package set; omit empty collections and absent links. Draft or local starter collections must never be imported by the approved learner entry. A school topic list can affect selection without editing unrelated neighbour lesson digests.

### 3.2 Mathematical representations and answers

Retain topic-specific separation; widening existing P2 bounds alone is insufficient. Propose three new runtime/author capabilities, with shared pure helpers where safe:

| Capability | Bounded specification and invariants | Reuse boundary |
| --- | --- | --- |
| `decimals` | Store values as integer coefficient plus scale 0–3, never binary floating-point ground truth. Representation/compare permits three places; arithmetic operands up to two places and magnitude ≤999.99. Multiply/divide uses divisor/multiplier1–9, never zero. Exact result magnitude ≤9999.99, at most two decimal places. Reject non-terminating or over-precision quotients for this batch; rounding is deferred. | Reuse place-chart/SVG conventions and answer application, not integer-only place-value spec or `assess` numeric parser. |
| `fraction-calculations` | Integers for numerator/denominator; denominators2–12, conversion/arithmetic quantities bounded to ≤10 wholes. Conversion distinguishes whole/remaining units; addition/subtraction uses equal or divisibility-related denominators, nonnegative bounded result, reduced canonical rational. Fraction of a quantity uses proper fraction and quantity1–120 divisible by denominator. | Reuse equal-area visual primitives and fraction-choice conventions; keep P2 `fractions` bounds and models unchanged. No arbitrary decimal approximation of rationals. |
| `area-perimeter` | Integer centimetre dimensions1–30. Shapes are rectangle/square or one outer rectangle with a strictly smaller corner rectangle removed. A declared corner/orientation rotates geometry consistently. Validate no zero/negative lengths, interior overlap, disconnected shape or contradictory dimensions. Area uses square-centimetre units; perimeter uses length units. Derive boundary and any missing length from semantic dimensions. | Reuse shared SVG mounting/accessibility; existing angle adapter supplies no area/perimeter logic. Arbitrary polygons, holes, slanted sides, drawing and triangle area are deferred. |

For the L-shape, the model must explicitly support two verified area decompositions (subtract the cutout, or add two non-overlapping rectangles) and a boundary-length path. Do not teach that every composite’s perimeter equals its outer rectangle: that equality applies only to this corner-cutout family. Labels identify the outside boundary; internal teaching splits never become perimeter edges. Accessible text gives the same dimensions, missing markers and shape structure as the diagram without naming the hidden answer.

Add an `exact` response kind with an ordinary labelled text input and topic-specific parser. `Step.answer` can remain a string for canonical exact decimal/rational answers; correctness is determined by parsed quantity under the declared goal, not lexical equality or a learner-supplied flag. No units in the input when the prompt already specifies them. Decimal grammar accepts plain nonnegative decimals (up to three places) and equivalent trailing zeros, rejects exponents, expressions, Infinity and commas. Fraction grammar accepts nonnegative integer, `n/d` and `w n/d` forms with bounded integer parts and denominator>0; equivalent unsimplified forms are accepted unless a step explicitly assesses simplest form. A simplest-form goal must check the representation as well as value and explain that distinction. Syntax errors preserve typed text with helpful feedback; no `eval`, floating tolerance or global change to P2 numeric grading.

A task’s supported goals derive exact answers from the validated spec. Formula selection and intermediate unit choices use opaque choice meanings checked against the model. Reflection is an authored reason key with human-review warnings. For practice word problems, record given/derived quantities, units, finite operation relationships, unknown and exact story spans. Use authored templates for the specific two-step families; do not infer arbitrary word problems or treat source linkage as proof of semantic accuracy.

### 3.3 Author workflow

Authors choose P4 → family → supported task, see the actual learner canvas, and edit ordinary controls. Expose decimal values/operation/target place, fraction quantities/related denominator/operation, or shape dimensions/cutout corner/requested measure. Computed values and units are shown read-only where derived. Do not expose redundant answer fields for mathematical goals or unrestricted polygon/operation-graph editing.

Partial entries stay in the working draft; invalid values leave the last valid canvas available and block Try/export/save-candidate. Changes regenerate answers/fixtures but mark dependent prose and visuals for checking. A coherent wording proposal includes story, prompts, hint reveals, quantity labels, units and interpretations. Apply it atomically after validating the model, then validate the proposed entire package; stale dependent-choice errors must not prevent repair. Undo restores payload, metadata, pending checks and last-valid view. Task/unknown changes require coherent wording before trial. Try creates a frozen fresh attempt. Origin digests, contributor identity and existing lock/copy/storage protections continue; author assertions are not human approval.

## 4. Preparation and practice experience

Add a small P4 preparation entry on the existing discovery page, labelled **general revision — school coverage not confirmed** until a supplied list is mapped. Selecting it shows the three topic groups, covered skills, and a concise uncovered-topics note. Offer “Learn a skill”, “Try a fresh question” and “Try three mixed questions”; retain ordinary level/topic search and the author’s separate starter/draft libraries.

The three-question sequence opens one practice package per family in a declared order. Each has one mathematical question and its reason step. Existing correct-answer gating/retries remain and are clearly described; this is not a skip-and-submit paper simulation. Record assistance and attempts using existing session events; display completion with the honest support label. A session summary may show which question needed another try or a hint, but must not report marks, predicted readiness, or mastery. No durable cross-session progress is promised: current completion is session-only. The first batch does not add persistent learner history or a second assessment state machine.

All links, recommendations, counts and next targets operate on the supplied permitted catalogue. Approved subsets may yield one or two available practice questions; show the actual count and omit missing lessons rather than promising three. Empty release still shows no approved lessons. Returning to P4 preserves collection/filter state and keyboard focus. Touch, keyboard and screen-reader paths remain usable at 390/768/1280px, 200% zoom and reduced motion. Visual checks must inspect decimal input, long fraction notation and dimensional labels, not just the home page.

## 5. Implementation stages after the single review

| Stage | Finite deliverable | Required gate |
| --- | --- | --- |
| P4-0 | Codex assesses each Claude finding; update scope if school topic list arrives; claim ownership | Approved planning scope and recorded dispositions before code. No routine second Claude pass. |
| P4-1 | P4 level/collection/schema/exact-answer contracts and one vertical decimal example through author→trial→export→release fixture | Existing 18 packages untouched; migration/input/unsupported-contract tests pass before authoring the rest. |
| P4-2 | Three decimal teaching packages plus one practice package | Independent fixed-point oracle, operation precision/domain rejection, both learning modes and wording repair. |
| P4-3 | Three fraction teaching packages plus one practice package | Independent integer/rational oracles, equivalent responses, simplest-form rule where used, equal-whole geometry and author round-trip. |
| P4-4 | Three area/perimeter teaching packages plus one practice package | Independent cell-area and edge-boundary oracles, both decompositions, missing dimension/unit rejection, accessible diagrams. |
| P4-5 | P4 discovery, permitted three-question sequence, docs and review candidates | Full engineering regression/build/release/artifact/browser checks; human publication still separate. |

Parallel delegation may separate topic capabilities after P4-1 pins the interfaces. Root owns integration, migrations/library/release and final checks. These are checkpoints within one proposed phase, not six additional review or permission rounds. No delivery date or claim that a preparation deadline is achievable has been made. If school coverage differs, change the documented batch; explicitly state which objectives remain unserved.

## 6. Verification and publication

For all 12 packages, independently specified expected results, two representative wrong responses per assessed goal, complete guided/independent traces, four useful hints, and an authored reflection fixture. Both supported area decompositions receive traces. Exact parser fixtures accept equivalent decimal/rational values and reject malformed/oversized text; simplest-form fixtures separate quantity from representation. Use independent arithmetic expressions/cell-edge enumeration, not the production answer helper as oracle.

Boundary tests include decimal0/zero places/unequal scales/carry/borrow/0.1+0.2/zero divisor/nonterminating quotient; fraction zero or negative denominator/improper and mixed equivalence/unrelated denominators/subtraction below zero/nonintegral set partition; shape missing/contradictory dimensions/rotations/zero cutout/overlap and perimeter shared edges. Reset, hints, mode history and unsupported actions must not award correctness or lose state. Unknown topic/schema/level errors stay actionable.

Integration tests cover legacy reads and explicit migrations, P4 routes and origin reports, edited package/index digest rejection, denial/corruption/cap-full storage, stale wording repair, approved subsets and empty collections. Run existing unit/DOM/browser suites, typecheck/lint/format, content validation, both builds, synthetic release gates and draft/author/template artifact scans. Capture responsive before/after P4 library, all three model families and author editor; inspect, record actual browser versions and limitations. Passing software checks are not a curriculum/content review.

Every original package and learner-facing preparation/index text needs independent mathematical and pedagogical human review. Records bind to exact hashes and the controlled reviewer register. Renderer/parser/model changes require a content-impact decision and affected fixtures even when old package bytes are unchanged. Development preview stays visibly draft; reviewed engineering work cannot publish unapproved content.

## 7. Deliberately deferred priorities

After the first batch and the school list, prioritise whole-number algorithms/rounding/factors, decimal rounding and general quotient rounding, broader fraction problems, angle naming/measurement, symmetry, tables/line graphs, and other school-listed areas. Nets/pie charts/current placement need the version disagreement resolved. Free construction, arbitrary polygon geometry, OCR/paper import, automatic school mapping, unrestricted two/three-step interpretation, exam-paper timing/weighted marking, durable progress and performance-based adaptation are separate phases.

## 8. Claude review brief

Review once alongside [curriculum evidence](p4-curriculum-evidence.md), the [combined review brief](font-and-p4-review-brief.md), handover and the affected contracts. Assess whether 12 packages are feasible/useful, exact input/schema migration is safely bounded, the related-fraction and L-shape restrictions are mathematically sound, author wording repair covers all dependencies, and preparation copy avoids school/coverage/mastery claims. Suggest concrete minimal remedies and affected acceptance tests. Append consolidated findings at the next unused ID recorded in handover (currently R-64 before this review). Do not implement or silently approve content. Codex assesses each recommendation, records its disposition and proceeds under the user-agreed planning/review workflow. No additional routine approval round is introduced by this plan.

## Codex dispositions after the single review

R-64–R-74 are dispositioned in handover. Implement a decimal vertical slice first, then each complete family. Retain schema v3 for explicit rejection by older readers of exact-response and structured-interpretation payloads; promote v1/v2 directly in one undoable edit, preserving origin. Add an adult worked-solution view with support tracking. Syntax failures are unassessable and keep input. Decimal input uses decimal keyboard, fractions text keyboard and accepts repeated spaces. Corner-cutout perimeter equivalence is explicitly taught as a valid method; notch shapes are deferred. Use concise draft and coverage notices, with detailed model bounds in author/adult material.
