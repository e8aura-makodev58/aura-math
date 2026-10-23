# P4 library expansion and a calmer, more playful home

**Status:** plan written 2026-10-06 by Claude before implementation, at the user's request (LLM agent work set aside). Codex was resting, so there is no independent review of this plan; see the review note at the end. School-specific P4 coverage is still unknown and remains labelled "general revision".

## What the user asked

Add new P4 lessons. Group lessons by topic so the page is not cluttered. Consider a daily "encore" topic and/or one example per topic on the main page; the choice is mine. The page should be modern, fun and engaging.

## Content: four new P4 families, fifteen lessons

The curriculum evidence (`docs/p4-curriculum-evidence.md`) lists whole numbers and factors, angles, symmetry, and tables and line graphs as P4 areas the first batch left uncovered, supported by two providers and one school letter. They are proposed as candidates, not verified against the current syllabus.

| Family | Lessons (original wording, bounded values) | Representation | Answers |
| --- | --- | --- | --- |
| Whole numbers (`whole-numbers`) | place value to 100,000; rounding to the nearest 10, 100 or 1,000; factors; estimate by rounding (practice) | place chart; number line with the next multiples marked and a halfway notch; factor array | exact integers (spaces or commas as thousands separators accepted), choices with validated meanings |
| Line graphs (`line-graphs`) | read a line graph and its scale; changes between points; values above a target (multi-select); practice | SVG line graph with gridlines and axis ticks | exact integers, multi-select |
| Symmetry (`symmetry`) | lines of symmetry of a shape; complete a symmetric grid figure; practice | polygon with labelled candidate lines; grid with a mirror line | exact counts, multi-select; independent exact-arithmetic reflection oracle in tests |
| Angle measure (`angle-measure`) | read a protractor (choose the right scale); estimate then measure; quarter, half and three-quarter turns; practice | protractor with both scales; turn diagram | exact degrees, choices |

Rules carried over from earlier phases: exact integer arithmetic (no floating-point ground truth), model-derived answers with independent test oracles, opaque shuffled choice IDs, four hints per step with a labelled reveal, a structured reflection (unverified authored content), schema v3 packages, author controls for every family, draft status, no school-coverage or mastery claims.

Deliberate limits: no multiples or common-multiple lesson yet; no angles on a line or at a point; no compass bearings; no table-to-graph construction. For the line-graph reading tasks and the protractor, the non-visual description cannot both let a learner reason and avoid giving the answer (the same trade-off recorded for fractions); descriptions give the data table or the scale setup, and that is flagged for human accessibility review.

## Organising the page

Thirteen topic tiles in one grid is too many. Proposal:

1. **Level tabs on the home page**: "Primary 4" and "Primary 2–3". Only one set of tiles shows at a time. Primary 4 is the default when it has lessons, because it is the current priority.
2. **Tiles grouped by strand** inside a level (Numbers and operations, Measurement, Geometry, Data) with a short strand heading, so a level shows three or four small groups instead of one long grid.
3. **Today's spotlight**: one card above the tiles that changes every day. It is a deterministic function of the local date and the lessons the page is permitted to show (topic by day, lesson within the topic by a slower cycle), so it needs no storage, no tracking, and no randomness; the same day gives the same card on every device. It respects the selected level tab. I chose a spotlight over "one example per topic" because per-topic examples would repeat the topic tiles; the tiles already show each topic's first lesson.
4. The P4 revision adventure entry and its practice set are extended to the new families.

Accent colours and icons for the four new families follow the existing playful system; contrast is checked numerically.

## Verification plan

Unit and DOM tests with independent oracles for every family; exact-input grammar tests; the 15 packages validate; browser checks that every new lesson completes in both modes and fits 390 and 1280 px; library tests for tabs, strands, the spotlight (fixed dates, level tabs, empty and subset catalogues) and routes; artifact scans unchanged; screenshots reviewed. Human mathematical, pedagogical and curriculum review of the new lessons stays outstanding, and nothing is published.

## Review note

Per `AGENTS.md` a new phase is documented, reviewed once by Claude, and dispositioned by Codex. Codex is resting and the user asked Claude to proceed, so Claude is both author and the only reader of this plan. That is not an independent review. Codex should assess the phase when it returns.

## Outcome (2026-10-06, Claude)

Implemented as planned, with the deviations and limits below. Verification is in `docs/implementation-status.md` and the handover.

- **Delivered:** four families and 15 draft lessons: whole numbers (4), line graphs (4), symmetry (3), angle measure (4). The library now has 45 lessons across 13 topics (27 for Primary 4). Every family has a runtime topic, author controls, starter lessons, independent oracles and browser coverage.
- **Home page:** a Primary 4 / Primary 2–3 switch (Primary 4 by default), tiles grouped by strand, a "Today's spotlight" card, and compact tiles on phones. Counts: seven topics on Primary 4, six on Primary 2–3, so no screen lists all thirteen at once.
- **Spotlight rule as built:** `src/library/spotlight.ts`. The topic advances daily through the topics in alphabetical order and the lesson advances once per full pass, from the lessons on the level shown, using the local calendar date. No storage, no randomness, nothing about the learner.
- **Deviation from the earlier playful-home criterion:** that plan wanted the first row of topic tiles within the first screen. With the spotlight and level switch above the topics, the tiles now start about one scroll down at 1280×800 and further down on a phone. The spotlight card is within the first screen on both. This was a deliberate trade for the "fun and engaging" request, and the browser tests were changed to assert the spotlight position instead.
- **Practice set:** the P4 mixed set is now seven questions (one per family). It is untimed with hints and retries, as before.
- **Not done:** multiples and common multiples, angles on a line or at a point, compass bearings, table-to-graph work; school-specific coverage is still unknown.
- **Known weak spots:** protractor numbers are small on a phone (about 11 px rendered); the non-visual description of line graphs lists the data and so gives away the readings, and the symmetry and protractor descriptions describe the figure; all three are recorded for human accessibility review. Whole-number answers may be typed with spaces or commas as thousands separators, and angles with or without a degree sign.
- **Contract:** application contract and schema versions are unchanged (schema 3 already allowed P4 topics once the new topic IDs were listed). The manifest's content-impact decision records this phase and the library digest was rebound with `node scripts/bind-library.mjs`.

