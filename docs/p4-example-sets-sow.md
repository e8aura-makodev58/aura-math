# SOW: at least five new saved examples for every Primary 4 lesson

**Status: scope of work written 2026-10-11 by Claude at the user's request, for Codex to implement.** It is a specification, not an approval of any content. Per `AGENTS.md`, Codex should assess it independently first and record accept, modify, reject or defer for anything it disagrees with (in a short dispositions section at the end of this file or in `handover.md`), then implement. No lesson content produced under this SOW is approved; all of it stays draft until independent human review.

## 1. The request

> "Add at least 5 new examples per lesson for Primary 4." (user, 2026-10-11)

**Interpretation used here.** An _example_ is a complete, saved instance of a lesson: the same steps and skill as the lesson, with different numbers, shapes, data or story. Every one of the **46 P4 lessons** in `content/library.json` gets **at least five** saved examples in addition to its current starter, so a learner has at least six fixed instances per lesson.

Saved examples differ from today's "Try another" variants in three ways:

|                          | "Try another" variants (today)                       | Saved examples (this SOW)                   |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------- |
| Where they live          | Built at runtime by `src/practice/generation.ts`     | JSON packages in the repo                   |
| Who can see them         | Development preview only; never in the learner build | Any build, once approved                    |
| Can a human review them? | No (different each run)                              | Yes: fixed text and digest, like any lesson |

The variants stay as they are. Saved examples are the reviewable, publishable route to "more examples".

## 2. Baseline (measured 2026-10-11)

46 P4 lessons. "Domain" is the number of valid variant specifications the deterministic generator already enumerates for that lesson (`variantCandidates`), excluding the starter.

| Family                               | Lesson: domain size                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decimals                             | places 6560, add-subtract 8504, multiply-divide 49, practice 224                                                                                                                         |
| Fraction calculations                | mixed-and-improper **9**, add-subtract **4**, of-quantity 95, practice **6**                                                                                                             |
| Area and perimeter                   | rectangle-missing-side 531, composite-area 3955, composite-perimeter 3955, measurement-practice 7911                                                                                     |
| Whole numbers                        | place-value-100k 2597, rounding 2602, factors 18, estimate-by-rounding 5570                                                                                                              |
| Line graphs                          | read 799, change 799, target 227, practice 39                                                                                                                                            |
| Bar charts                           | read 1599, double 127, practice 59                                                                                                                                                       |
| Pie charts                           | read 575, sectors 155, count 1583, total 455, practice 911                                                                                                                               |
| Nets                                 | cube-net-check 528, opposite-faces 395, solid-from-net **3**, complete-the-net 191                                                                                                       |
| Symmetry                             | lines-of-symmetry **5**, symmetric-figure 224, practice **8**                                                                                                                            |
| Angle measure                        | read-protractor 61, estimate-then-measure 57, turns 23, angle-practice 61                                                                                                                |
| **Workbench lessons (no generator)** | fold-a-cube-net **0**, fold-a-net-that-fails **0**, fold-a-solid **0**, protractor-bench-read **0**, protractor-bench-draw **0**, mirror-line-bench **0**, shade-to-complete-bench **0** |

**Gaps:** 7 workbench lessons have no generator. `p4-fraction-add-subtract` (4) and `p4-solid-from-net` (3) are below five. `p4-lines-of-symmetry` is exactly five because the square was excluded (its picture shows 2 of 4 axes). Two more are thin enough that five _distinct-looking_ examples need care: `p4-fraction-practice` (6) and `p4-symmetry-practice` (8). 37 lessons already have enough valid specifications and need only selection and saving.

## 3. Deliverables

1. **≥5 saved examples for each of the 46 P4 lessons** (≥230 new draft packages), each a full schema-3 lesson package that passes `npm run content:validate`.
2. **Generator coverage for the gaps:** domains for the 7 workbench lessons and widened domains for `p4-fraction-add-subtract`, `p4-solid-from-net` and `p4-lines-of-symmetry` (see §5), so each has at least five honest specifications.
3. **A deterministic example builder script** (`npm run content:examples`) that selects, builds and writes the examples, reproducibly, and refuses to overwrite a reviewed file.
4. **Linking examples to their lesson** in the library index without adding them as home-page tiles (§6).
5. **A learner-facing example picker** on the lesson page ("Example 2 of 6", Previous, Next) (§7).
6. **Tests** (§9), **docs and handover** (§11).

## 4. What every example must satisfy

- **Same lesson, different instance.** Same topic, same task, same step kinds and step count as its parent lesson; only the specification and the wording derived from it differ.
- **Built, not written.** The package is produced by the family's existing author `rewrite`/builder from a validated specification, so prompts, choices, hints, worked steps and reflection come from the same code as the starter. No hand-written or LLM-written mathematical content. Story frames from `src/content/story-frames.ts` may vary the context where that family already uses them.
- **Valid.** `validateSpec` and the topic step validators pass; `content:validate` reports 0 invalid.
- **Answers from the model.** Each choice/exact/multi answer is computed by the topic model, and an **independent oracle** in tests (written differently from production code; reuse the Phase A oracles in `tests/p4-family-variants.test.ts` where they exist) agrees for every saved example.
- **Distinct.** No two examples of a lesson (or an example and the starter) share the same answer set, and none repeats the starter's specification. Across a lesson's six instances, the correct answer of each choice step must not sit in the same position every time, and no step's answer may be identical in all six.
- **Choice balance holds.** `tests/choice-balance.test.ts` must still pass with the new packages included (unique-longest and unique-shortest within chance ± 8 points; each position within chance ± 10). Add the new packages to its sample.
- **Readable at phone width.** Charts, nets and figures must render without overlap at 360 px (the existing per-family label and size rules apply; nets still use the 15/16-unit SVG text floor).
- **Draft.** `reviewStatus: "draft"`, provenance `{kind: "generated", generatorVersion: "p4-examples-v1", seed}` (uint32), authors `["Codex"]`, original wording, same curriculum block and tags as the parent plus a tag `example`.

## 5. Generator work for the gaps

Add bounded domains in `src/practice/family-domains.ts` (or a sibling module) following the Phase A pattern: explicit enumeration, every element passes `validateSpec`, answers from the model, independent oracle, deterministic order.

| Lesson                       | What to add                                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p4-fold-a-cube-net`         | Specs over the 11 free cube nets × orientations × floor face, with a Watch net that differs (existing `demoFace`/demo rules)                                           | Reuse `CUBE_NETS`/`orientations` from `family-domains.ts` and the rolling-cube model in `src/topics/nets-bench.ts`. Exclude specs whose top-face answer equals the starter's.                                                                                                                                                      |
| `p4-fold-a-net-that-fails`   | Specs from the 14-net collision pool (non-cube hexominoes with no 2×2 block and exactly one coincident pair; see dispositions R-92)                                    | The `missing` step must stay well defined (single letter).                                                                                                                                                                                                                                                                         |
| `p4-fold-a-solid`            | The catalogue solids (cube, cuboid, triangular prism, square pyramid) as learner solid, each with a different Watch solid                                              | Only four solids exist, so ≥5 examples need variation in face lettering or cuboid edge lengths (a, b, c); if that cannot give five honest instances, add **one** more catalogue solid (e.g. a triangular-based pyramid) with exact integer vertices and the existing edge-gluing test, or record the shortfall for the user (§12). |
| `p4-protractor-bench-read`   | Angle sizes (multiples of 5, 10–170) × arm orientation × which arm lies on the baseline × inner/outer scale                                                            | Respect the R-94 rule (either arm may be aligned); the wrong-scale distractor is 180 − answer.                                                                                                                                                                                                                                     |
| `p4-protractor-bench-draw`   | Target angles × start orientation, with the derived follow-up question (R-93: never answerable from the prompt number)                                                 |                                                                                                                                                                                                                                                                                                                                    |
| `p4-mirror-line-bench`       | Figures × mirror line from the bounded list (vertical, horizontal, two diagonals) on the existing grid sizes                                                           | Grid stays at the measured column count.                                                                                                                                                                                                                                                                                           |
| `p4-shade-to-complete-bench` | Half-figures × mirror line; the transfer step varies its options (no fixed "Square A")                                                                                 |                                                                                                                                                                                                                                                                                                                                    |
| `p4-fraction-add-subtract`   | Widen denominators and operand ranges within P4 bounds (related denominators only, e.g. halves/quarters/eighths, thirds/sixths/twelfths, fifths/tenths)                | Keep sums ≤ 1 or as the existing builder allows; independent fraction oracle.                                                                                                                                                                                                                                                      |
| `p4-solid-from-net`          | Vary net orientation/lettering and which faces are asked, across the catalogue solids                                                                                  |                                                                                                                                                                                                                                                                                                                                    |
| `p4-lines-of-symmetry`       | Fix the square picture (draw all four axes as candidates) so the square can be included, or add other P4 shapes (rectangle, isosceles triangle, kite, regular hexagon) | Steps 2 and 4 must agree.                                                                                                                                                                                                                                                                                                          |

If widening an existing profile changes "Try another" output for a seed, bump `P4_GENERATOR_VERSION` (currently `p4-bounded-v3`) and add the new value to the sentinels in `scripts/check-learner-artifact.mjs`. Workbench domains may live only in the example builder if wiring them into "Try another" is risky; say which.

## 6. Storage and linking

**Recommended design** (Codex may modify with rationale):

- **Files:** `content/examples/p4/<parent-id>-ex<N>.json`, N = 1…k. Lesson id `<parent-id>-ex<N>` (fits `^[a-z][a-z0-9-]{1,63}$`; check the longest parent id).
- **Loading:** extend the package glob in `src/content/lessons.ts` (and the content scripts and validators that read `content/lessons/`) to include `content/examples/**`. Duplicate-identity checks must cover both folders.
- **Library index:** add an optional `examples: string[]` to each lesson entry in `content/library.json`, listing its example ids in order. Example packages are **not** separate library lesson entries, so the home page, topic tiles, spotlight, search counts and the P4 revision collection are unchanged. This is a change to the library index format: update `validateLibraryIndex` (strict fields) and its tests, keep old indexes readable, and decide whether this needs the library `schemaVersion` raised; record the decision. Run `node scripts/bind-library.mjs` after editing the index.
- **Release:** no change to the release mechanism. Each example is its own package with its own digest, reviewed and approved like any lesson (`release/manifest.json` entries). A lesson may be approved without its examples; the picker shows only approved instances in the learner build.
- **Manifest decision text:** hand-edit `contentImpactDecision` to record this phase (examples added as draft generated packages; library index gains `examples`; no approved entries).

**Alternative to consider and reject or accept explicitly:** storing only specifications and building at runtime. Rejected by default because the learner build contains no author/builder code, and runtime building cannot be reviewed by digest.

## 7. Learner experience

- On a lesson with saved examples, show "Example 1 of 6" (the starter is Example 1) with **Previous** and **Next example** buttons, next to the existing lesson controls. 44 px targets, keyboard operable, visible focus, works at 320–768 px with no sideways scroll.
- Choosing an example opens it as a fresh attempt (same rules as "Try another": hints, mode carried as today, support tracking per instance). Completion of any instance does not mark the others complete.
- Deep link: `#lesson/<parent-id>?example=<N>`; an unknown N falls back to Example 1.
- In the learner build only approved instances are listed; if only the starter is approved, the picker is hidden.
- "Try another" stays as it is in the development preview. Label both clearly so an adult can tell a saved example ("Example 3 of 6") from a fresh preview variant.
- The author workspace lists examples under their parent lesson (read-only is enough for this phase; editing an example is out of scope).

## 8. Example selection (the builder script)

`npm run content:examples [-- --lesson <id>] [--count 5] [--check]`:

1. For each P4 lesson, take the full deterministic domain (from `variantCandidates` or the new workbench domains).
2. Remove the starter's specification and any specification whose answer set equals the starter's.
3. Pick _k_ (default 5) by a **deterministic spread rule**, not the first _k_: sort by a stable key, then greedily choose the candidate that maximises its minimum distance from those already chosen, using a per-family feature vector (for example: answer value or bucket, operation, number of digits or decimal places, chart category count and scale step, net shape id and floor face, angle size band and scale, mirror-line orientation). Tie-break by the seeded order. Document the feature vector per family in code comments.
4. Build each package with the family builder, apply story frames where the family uses them, set provenance (`p4-examples-v1`, seed = hash of parent id and N), validate, and write.
5. **Never overwrite** an existing example file whose digest differs from a fresh build unless `--force` is given; `--check` exits non-zero if any file would change (use it in CI-style checks so reviewed examples cannot silently drift).
6. Print a per-lesson summary: domain size, chosen features, file names.

## 9. Tests (minimum)

- **Per lesson:** at least 5 example packages exist and are linked in the library index; each validates; same step kinds/count as the parent; no duplicate answer sets within the parent group; starter not repeated.
- **Independent oracles** agree with every saved example's answers (all 230+, not a sample).
- **Builder determinism:** two runs produce byte-identical files; `--check` passes on a clean tree; a manual edit to an example file makes `--check` fail.
- **New domains** (§5): size, validity of every element, oracle agreement, and the workbench-specific rules (R-92 collision pool, R-93 derived draw question, R-94 either-arm alignment, transfer-step order varies).
- **Choice balance** includes the new packages and still passes two-sided.
- **Library index:** old index without `examples` still validates; unknown example id, an example linked to two parents, or an example id that collides with a lesson id are rejected; home-page counts and spotlight unchanged (`tests/home-layout.test.ts`, `tests/spotlight.test.ts`).
- **Learner build:** `npm run build:learner` / `test:release` still pass; with a synthetic approval of one example (test-only fixture, as the existing release-gate tests do), the picker shows exactly the approved instances; artifact scan still finds no author or generator code.
- **Browser (Playwright):** at 390 and 360 px, open a lesson, step through Examples 1→6 with Next and back with Previous, complete one example by buttons and one by keyboard, check no sideways scroll and that the deep link opens the right example. Include one workbench lesson (3D fold) and one 2D bench lesson. Screenshots of one example per family into `docs/screenshots/p4-examples/`.
- **Regression:** the full existing suite stays green (baseline on 2026-10-11: 827 unit tests in 42 files, 64 valid packages, Playwright 185 passed, 3 skipped by environment).

## 10. Work packages and gates

| WP  | Content                                                                                                                          | Exit gate                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| E0  | Assess this SOW; record dispositions; claim ownership in `handover.md`                                                           | Dispositions written                                    |
| E1  | Library index `examples` field, loader glob, identity checks, validator and tests; no content yet                                | All existing gates green                                |
| E2  | Builder script with spread selection, provenance, `--check`; examples for the **37 lessons that already have ≥5 specifications** | Per-lesson and oracle tests pass; choice balance passes |
| E3  | Gap domains (§5) and examples for the remaining 9 lessons                                                                        | Same, plus workbench rule tests                         |
| E4  | Learner picker, deep link, author listing, learner-build filtering                                                               | Browser tests at 390/360 px; screenshots viewed         |
| E5  | Docs (ADR, README, implementation status, manifest decision text), handover                                                      | Full gate run recorded                                  |

Full gate run after each WP: `npm run format`, `typecheck`, `lint`, `format:check`, `npm test`, `content:validate`, `build`, `build:learner`, `test:release`, `node scripts/release-gate.test.mjs`, full Playwright (README describes the Chromium library workaround). Run `node scripts/bind-library.mjs` after any `content/library.json` change.

**Cut order if time is short:** author listing (E4 part), then the picker's Previous button (keep Next), then `p4-fold-a-solid` beyond four examples (record the shortfall). Never cut: ≥5 examples for the other 45 lessons, oracle agreement on every example, `--check`, choice balance, draft status.

## 11. Documentation and handover

- New ADR (next free number) for saved example sets: storage, linking, selection rule, review implications.
- `README.md`: library counts (lessons vs examples), the new script.
- `docs/implementation-status.md`: outcome with exact counts.
- `release/manifest.json`: hand-edited `contentImpactDecision`; digest rebound by script only.
- `handover.md`: ownership row, decision entry for this request, work-log entry with validation and limits, resume notes.

## 12. Risks and open points

- **Human review load.** 230+ new packages each need two qualified human approvals of their exact digest before publication (ADR-002). That is a large review task. Suggest to the user a batch review checklist per family (review the builder output pattern once, then spot-check), but do not weaken the per-digest rule without the user's decision.
- **Thin domains.** `p4-fold-a-solid` may not reach five honest examples without a new solid; `p4-fraction-practice` and `p4-symmetry-practice` have small domains, so their five examples may look alike. Report the actual spread.
- **Dependency on work in progress.** A Claude coding agent is building LLM story generation (Phase B2+B3), which touches `src/practice/generation.ts`, `src/practice/controller.ts`, `src/content/story-frames.ts`, `src/admin-server/*` and `src/admin.ts`. Check `handover.md` ownership before editing those files; saved examples must not depend on LLM stories (use built-in frames only, so examples are reproducible).
- **Repository size.** Roughly 230 more JSON files; check the content validation and Vite glob time stay reasonable.
- **Not verified by this SOW:** curriculum placement of the lessons (still "P4 candidate"), child suitability of wording, real-device behaviour.

## 13. Acceptance criteria

1. Every one of the 46 P4 lessons has ≥5 saved examples, linked in the library index, all valid draft packages, none duplicating its parent or each other.
2. Every saved example's answers agree with an independent oracle.
3. `npm run content:examples -- --check` passes on the final tree.
4. Choice balance, learner-artifact separation and every existing gate pass.
5. The learner picker works by touch and keyboard at 360 px, shows only approved instances in the learner build, and does not change home-page counts.
6. Shortfalls, if any, are listed per lesson with the reason.

## 14. Codex independent assessment (2026-10-11; before implementation)

- **Accept:** fixed complete draft packages, five additional instances per P4 parent, deterministic spread selection, separate provenance/digests, hidden home-page examples, learner picker and approval filtering. Saved specifications alone are rejected: the learner must not import author builders.
- **Modify distinctness:** require distinct specifications and task instances, prefer distinct mathematical answer sets where available. Do not require every answer to change: cube face counts, conceptual rules and reflection answers are invariant. Four catalogue solids cannot yield six different solid-name answers. Vary solid net orientation with an optional, validated quarter-turn field for static and folding lessons; preserve integer geometry and exact edge gluing. Report this finite-domain limitation rather than inventing new curricular solids or changing the objective.
- **Modify gap domains:** implement them in an example-only module, including broader related-denominator subtraction and solid orientations. Leave Claude's in-progress practice generation/controller/story modules untouched for new domains; saved examples have their own `p4-examples-v1` version. The square-axis correction nevertheless admits a sixth existing runtime symmetry candidate, so a `p4-bounded-v4` version stamp must be coordinated with Claude before touching its owned generator file. Use supported vertical/horizontal grid mirrors and existing shape candidates; diagonal grid mirrors and arbitrary protractor orientations are unsupported by today's contracts and outside this phase.
- **Modify square candidates:** draw all four true square axes, rather than silently omitting two. Existing square packages are absent from the starter catalogue; preserve saved parent payloads and update derived square tests as needed.
- **Modify selection:** score mixed numeric/categorical specification features with normalized numeric distance and categorical mismatch; use answer diversity as the primary preference until that domain is exhausted. Fixed bounded specifications remain distinct even where answers repeat.
- **Accept additive index extension:** keep schema version 1 and add optional `examples`; old indexes remain valid. Strictly reject duplicate, self-linked and cross-parent identities; check available example topic/level/skill consistency. Prune unapproved links in release builds and require an approved parent for approved examples.
- **Modify overwrite rule:** `--force` may replace only drafts without review records for the existing digest. A reviewed digest is never overwritten. `--check` checks packages and links without writing.
- **Modify validation cadence:** run focused checks after each package; run the full relevant gates on the integrated tree. Do not repeatedly rebuild or launch blocked browsers after unchanged intermediate steps. Browser failures are reported honestly, not replaced by claims of manual verification.
- **Accept:** content remains draft; no agent test substitutes for qualified human mathematical/pedagogical approvals. No LLM calls or user credentials are needed to build these examples.

This assessment responds to Claude's authored SOW; it is not a second Claude review or a human content approval.
