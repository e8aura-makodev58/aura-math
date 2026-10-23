# Implementation status

## 2026-10-11: saved P4 examples (Codex)

Implemented Claude's user-requested example-set SOW after independent dispositions
in §14: **230 new saved drafts**, five for every one of the 46 P4 parents; **294
packages total**, with unchanged **64 parent tiles / 16 topics**. Includes
deterministic spread generation, read-only drift checks and reviewed-digest overwrite
protection, example linking, fresh-attempt picker/deep links, author read-only links,
and approval/pruning gates. See [ADR-010](ADR-010-saved-p4-examples.md).

Final checks: **1,778 unit/DOM tests in 48 files** (`npm test -- --maxWorkers=2`),
typecheck, lint, formatting, all 294 package validation, 230-example reproducibility,
development build, learner build/artifact checks and synthetic release checks pass.
The learner artifact has 0 approved lessons, main JS 204,986 bytes, CSS 47,201 bytes
and 13,106 bytes of lazy 2D workbenches. The eager draft-preview content chunk is
1.72 MB (207 KB gzip); no claim of low-end device load-time verification.

Seventeen focused Playwright scenarios are discovered, including phone navigation,
keyboard completion and captures for ten P4 families, but none executed successfully:
Chromium fails at launch in this session, including with README's library override.
No new screenshots, real-device, zoom or assistive-technology results are claimed.
Local origin 5178 was not reachable from this session's final check; no service
restart was performed while Claude's work remained active.

**Remaining coordinated change:** square diagrams now show all four true axes,
which grows the existing runtime symmetry candidate pool from five to six. Bump
`P4_GENERATOR_VERSION` from `p4-bounded-v3` to `p4-bounded-v4` once Claude hands off
`src/practice/generation.ts`; the v4 artifact sentinel is already present. The user
was asked for that ownership status asynchronously; no reply was received yet.
Claude's practice/story/admin implementation was not edited. Each new content
digest still needs qualified human mathematical and pedagogical approval.

Content-authoring phase implemented 2026-10-04 after Codex assessed Claude's single plan review R-25–R-35. Visual authoring implemented 2026-10-05 after its single review and Codex dispositions R-36–R-44. The user authorised development and delegation. No real human content approval or learner publication exists.

## Implemented

- Six original JSON lesson packages migrated with original IDs, answers and both support modes. Dropping valid data in `content/lessons/` adds existing-topic preview content without code changes.
- Version-1 typed validators, field-level multi-issue reports, byte/depth/count limits, duplicate/prototype-key rejection, explicit goals, candidate source evidence, model-linked comparison interpretation and exact source spans; geometry requires no word-problem interpretation.
- Shared learner-view author canvas with contextual text/model controls, stable typing/IME, last-valid previews, free Edit navigation and frozen in-place learner trials. JSON remains import/export data; no raw editor or preview handoff.
- Grouped undo/redo, derived model answers/fixtures, coherent wording proposals, author-only dependency checks, read-only existing authors, stable contributors, version/provenance tracking and digest/change reports.
- Device-local draft save/load/delete with a ten-record cap, exclusive Web Lock continuation or visible copy fallback, corruption/storage failure handling and unsaved-change prompts.
- Seeded bounded generation with coherent text/hints, opaque shuffled reasoning choices, fixtures/provenance, six demonstration drafts in `content/generated/`; no live AI calls or hidden generation.
- Assessment context, ordered mode/hint/reveal/submission events, feedback keys, supported-alternative results and adapter-owned step resets. History-sensitive feedback is tested with a synthetic adapter; no real pilot exercise claims a process detector.
- Canonical SHA-256 package digests, trusted local human reviewer records, warning dispositions and exact-ID/version/digest manifest checks. Separate learner build generates only approved data, with an explicit empty-content state; its runtime loader rechecks package identity, structure and digest. Author code and draft catalogue are absent from that artifact.

## Limits

Literal prose and reflection remain semantically unverified, including prose after model edits. Model checks and exact text spans cannot establish meaning or teaching quality. Generated drafts require their own exact-digest review; no template-wide approval propagates.

All real content remains draft. Trusted reviewer/review files and the release manifest are empty. Local maintainer evidence verification is required; there is no cryptographic identity service, signed distribution or deployment. External assets are unsupported in this version, so an asset-manifest contract is deferred until assets exist. Renderer/validator edits need compatibility tests and a recorded content-impact decision. Automatic rollback archive storage is not implemented.

The pilot keeps linear task sequences rather than arbitrary graphs, full construction or misconception detectors. No durable learner storage, accounts, fading, LLM interpretation, timed tasks, read-aloud service or analytics. Author drafts use local storage; learner identity/progress are never stored. Comparison diagrams are schematic. Structured reasons test recognition, not independent explanation.

M0–M4 are not declared complete. Human maths/pedagogy review, remaining curriculum cross-checks, learner persistence/version migration, assistive technology and tablet checks, consent and observed pilot remain outstanding. Provider and historical-paper evidence remains supported, alongside official material when available.

## Validation

The current verification results are recorded in `handover.md`: unit/DOM tests, typecheck, ESLint, formatting, both builds, content commands, synthetic release-gate checks and learner artifact scans. Domain checks include all 4,950 positive comparison pairs with sum at most 100 and generated batches across 100 seeds. Synthetic records are tests only.

Browser checks cover learner interactions, the library, visual authoring and responsive fit at 390/768/1024/1280 px. Current phase results are recorded below; Chromium uses the system-library workaround in README. DOM tests do not certify responsive layout or accessibility; a Playwright pass is not a WCAG or device audit.

Vite preview uses port 5178 because 5173 belongs to another app. Dependencies remain pinned in package-lock; a fresh online npm ci was not exercised here.

## Earlier visual author-interface delivery

The delivered canvas and contextual inspector satisfy the requested editing workflow within the original six pilot forms. See docs/visual-authoring-plan.md for the completed phase and docs/ADR-003-visual-authoring.md for renderer impact. At that phase’s completion, ninety unit/DOM tests passed. The local server could not be verified from this restricted environment: port 5178 was reported occupied, but localhost connections were unavailable. No new server or production deployment is claimed.


## Library, layout and topic expansion (implemented; resumed and verified 2026-10-05)

Delivered after the single Claude review R-45–R-54 and Codex dispositions (see `handover.md`): a shared topic/skill library with search, level and topic filters and hash routes; a separate author library (Starter lessons / My drafts / New lesson chooser) and focused editor; four new topic families (place value, equal groups, fractions, picture graphs) with three original draft lessons each, giving 18 curated draft lessons across six families; package schema v2 with `library` metadata (v1 still readable); a separately digest-bound library index (`content/library.json`) referenced by `release/manifest.json` (manifest schema 2, application contract 2); and separate runtime and authoring topic registries.

Verified on 2026-10-05 (Claude, after Codex paused): 234 unit/DOM tests in 12 files; typecheck, ESLint, Prettier, both builds, `content:validate` (18 packages, 0 invalid), `test:release` (learner artifact separation, empty-release state), synthetic release gate; **18 Playwright checks executed in real Chromium and passed** (first real browser execution in this project; see the README note on the missing system libraries). Screenshots at 1280, 768 and 390 px were viewed by Claude and are stored in `docs/screenshots/`; no horizontal overflow was measured at those widths for the library, author library, author editor with inspector open, and four sampled lessons.

Fixed during verification: equal-groups lesson JSON quantity units contradicted the validator (all three lessons failed to load); the empty-release scan expected a superseded message; picture-graph visuals had no styling (symbols stacked one per line); the inspector context text ran words and numbers together; at tablet width the open inspector covered the author toolbar; three stale/incorrect browser-test lines.

Still unverified: 200% zoom, contrast and touch-target measurement, assistive-technology and real tablet/device checks, keyboard-only walkthrough beyond the Playwright scenarios, screenshots of every lesson and of long titles/full inspector, and all human mathematical, pedagogical and curriculum review. The 12 new lessons are unreviewed drafts; the reviewer register, reviews and release entries remain empty. Claude's resume work is not an independent review of this implementation.


### Codex final assessment, 2026-10-05

Codex independently assessed Claude’s fixes and confirmed ADR-004 with corrections. Seven additional integration checks expose and prevent incorrect equal-groups given/derived states and unused skills in released libraries; they also cover all starter templates, v1 migration/undo, atomic model repair and index contracts. Final results: **241 unit/DOM tests in 13 files**, typecheck, lint, formatting, both builds, all 18 package validations, learner-artifact separation and strengthened synthetic release gates passed. **21 Chromium browser tests passed**, including all 18 lessons at 390/1280 px with guided hints and a long author title/trial at 640 CSS pixels.

Phone screenshots for all 18 lessons are in `docs/screenshots/topics/`; the 640px author trial is in `docs/screenshots/author-long-title-trial-640.png`. Codex inspected representative diagrams/hints and the tablet inspector. The 640px check represents reflow space at 200% of a 1280px window; native browser zoom remains unverified. Full human visual acceptance, contrast/touch-target measurement, assistive technology, real devices and all human content reviews remain outstanding. The earlier “still unverified” list records Claude’s limits at the time; the new all-lesson captures, long-title and Try/hint checks supersede those specific gaps. No approved learner publication or production deployment was performed.


## Playful discovery redesign (2026-10-05)

Delivered after the single Claude review R-55–R-63 and Codex dispositions. The shared learner/development home now has a compact illustrated welcome, six distinct mathematical topic icons and coloured topic tiles. Tile selection opens a dedicated, focused topic view; search, level filters and All lessons provide direct catalogue access. Authors keep a compact complete catalogue with matching topic accents and clearer tabs. Six topic descriptions and 18 original lesson blurbs replace repetitive catalogue copy; they are bound by the updated index digest and still require human review before publication.

Codex integrated the delegated work and fixed same-page hash navigation, starter focus restoration, separate topic/home scroll restoration and shared author focus tokens. Existing lesson package data and mathematical/hint interactions are preserved. ADR-005 records the visual/content impact. Screenshots of the real home, focused topic and author library are under `docs/screenshots/playful-*`; the static study and home/topic/empty captures are under `docs/design/`.

Verification: **245 unit/DOM tests across 13 files**, **25 Chromium browser checks**, typecheck, ESLint, formatting, development and empty-approved learner builds, artifact separation and synthetic release gates pass. Browser coverage includes 390/768/1024/1280 widths, all 18 lesson/hint states at phone/desktop widths, keyboard topic and starter return, safe search, and 640px author reflow. The agent measured all six accent-on-surface pairs at 4.81:1 or higher; body/quiet/focus token pairs are recorded in ADR-005. This is not a complete accessibility audit. Human taste/usability feedback, native zoom, assistive technology, actual devices and all human content approvals remain separate.


## P4 preparation and typography (2026-10-05)

Implemented after the single Claude review R-64–R-74 and Codex dispositions. There are now **30 original draft lessons across nine families**, including twelve P4 lessons across decimals, fraction calculations, and area/perimeter. Further P2/P3 expansion is paused. The home preparation entry offers a bounded three-question mixed sequence, with honest general-revision and draft labels.

P4 uses exact decimal/rational checks, original worked hints, semantic geometry and ordinary author controls. Malformed exact input preserves text without an assessed attempt; adult worked solutions record support. Alternate valid area/perimeter method fixtures survive author rewrites. Package schema 3 and application contract 3 preserve original v1/v2 reads and direct undoable migration; the separately hashed optional preparation collection is pruned to approved members. See ADR-006.

Outfit headings and Atkinson Hyperlegible Next body text are bundled locally (66,288 font bytes). Notices, source-package integrity and binary hashes are recorded in assets/fonts/README.md and linked from both artifacts. Glyph audits include final P4 squared-unit characters and document symbol fallbacks. Palette preserved; small labels increased and phone header spacing corrected. Decimal charts scroll locally with keyboard focus instead of breaking long place names.

Final verification: **322 unit/DOM checks in 16 files and 32 real Chromium browser checks passed**, including all P4 completions, mixed navigation, exact syntax/support and three P4 author edit/trial flows. Both builds, typecheck, lint, formatting, 30-package validation, font cmap checks and synthetic release/artifact gates pass. Sampled desktop/phone captures were visually inspected; native zoom, assistive technology and real-device acceptance remain open. No real reviews/approvals, production deployment, durable learner progress, exam prediction or complete P4 coverage are claimed. School-specific topic/date information remains unknown.


## Dimension lines and annotation agent (2026-10-06)

Added by Claude at the user's request while Codex rested; full detail in `docs/dimension-lines.md` and ADR 006. A deterministic engine (`src/ui/dimensions.ts`) now draws dimension lines, extension lines, arrowheads or ticks and leader lines on the area-perimeter diagrams, replacing loose text labels (one of which was clipped). Unknown lengths show "?". A reference-only annotation plan, validated by `src/annotation/plan.ts` (no hidden values, no invented numbers or text, needed dimensions present, no label collisions), selects which dimensions appear. An optional author-side proposer asks a language model for a plan through the official Anthropic SDK (dev dependency, dev-server only), validates it, repairs it for up to three rounds and otherwise falls back to the deterministic default. The learner build contains none of it, and the artifact scan enforces that.

Verified: 364 unit/DOM tests (19 files), 40 Chromium tests, typecheck, lint, Prettier, both builds, the learner-artifact scan, and endpoint checks against the real dev server. **No live model call has been made** (no credentials here), so the model path is tested against fakes only. The feature has had no independent review. Fractions and angle diagrams intentionally have no dimension lines because labelling them would give the answers.


## P4 expansion and the two-level home page (2026-10-06)

Added by Claude at the user's request while Codex rested; details in `docs/p4-expansion-plan.md` and ADR 007. Four new P4 families (whole numbers, line graphs, symmetry, angle measure) bring 15 draft lessons, so the library holds **45 lessons across 13 topics** (27 for Primary 4). The home page shows one level at a time (Primary 4 by default), groups topics under strands, and adds a deterministic "Today's spotlight". The LLM annotation tool is set aside, unchanged.

Verified 2026-10-06: typecheck, ESLint, Prettier; **481 unit/DOM tests in 25 files**; `content:validate` (45 packages, 0 invalid); both builds; the learner-artifact scan (with new author-only sentinels); the synthetic release gate; **73 Chromium tests**, including every new lesson played through at 390 and 1280 px with a text-clipping check, the keyboard level tabs, the spotlight changing with a fixed clock, and a malformed answer that is not counted. Screenshots: `docs/screenshots/home-*.png` and `docs/screenshots/p4-expansion/`. Colour contrast of the new accents was calculated (at least 5.3:1), not eyeballed.

Defects found and fixed during verification: circled line labels on the symmetry figure were outside the picture's viewBox (viewBox now fitted to everything drawn); several SVGs were designed too wide and rendered text at 8–9 px on a phone (resized); P4 tiles had no accent colours and fell back to plain green; multi-select options for ordered items were being rotated.

Not verified: 200% zoom for the new lessons; real tablets or phones; assistive technology; whether the topic wording, hints and reflection choices are right for P4 (all 15 lessons are unreviewed drafts). The first tile row is below the first screen on the new home (a deliberate trade, see the plan). Protractor numbers are small on a phone. Human mathematical, pedagogical and curriculum review is outstanding, and nothing is published.

### Mobile pass (2026-10-06, Claude)

Measured with Chromium in touch and mobile emulation at 320, 360, 390, 412 and 768 px over the home page (both levels), a topic page and five lessons. No page scrolls sideways at any of these widths. The pass found controls rendered at 9 to 11 px on phones (for example "Check my answer →" at 11 px, the mode switch and step labels at 9 px, "← All lessons" at 10 px) and several touch targets below 40 px. A readable-size block at the end of `src/p4.css` now sets a 12 px minimum for text outside SVG, 14 to 16 px for buttons, and 44 px minimum height for the main controls and links. After it, a scan finds no text under 12 px outside SVG diagrams, and the only element under 40 px is a plain text label above an input. The ordered multi-select options for the line-graph and symmetry lessons now keep their natural order (an earlier fix had not taken effect for line graphs). This is emulation, not a real phone: real devices, landscape, 200% zoom and assistive technology are still unchecked.



## Playful P4 lessons and deterministic fresh practice (2026-10-06, Codex)

Implemented at the user's instruction, with Claude's review explicitly waived for this phase. See `docs/playful-p4-practice-plan.md` and ADR 008. P4 lessons have compact styling; decimal add/subtract and fraction add/subtract have model-driven workbenches, visual alignment/equal-part treatments, contextual disclosure and completion continuation. All four decimal and four fraction-calculation starter forms support locally generated different variables with the same skill/difficulty, without an LLM. Small domains exhaust explicitly and can restart.

The latest 20 attempt summaries are temporary in-memory evidence, including original/generated/repeated context and app support. Fresh attempts reset inputs/hints/worked views while carrying mode; source results remain isolated and mixed-set navigation stays on the source slot. Refresh restores the original source and clears the journal. Author frozen trials retain custom content without generation. Pure teaching builders are shared with author rewrites; approved learner builds exclude the generator. All 45 package files, index and manifest remain byte-identical; no schema bump, publication approval or deployment.

Verification: full515/515 unit/DOM checks across29 files; subsequent6/6 preview integration checks include the added complete small-set exhaustion/restart case. Final development and empty-approved learner builds (typecheck), lint, formatting, 45-package validation and release/artifact gates pass. Full generated domains satisfy independent mathematical predicates; malformed input, support isolation, replay/reload, frozen author hooks and fractional answer disclosure are covered.

Browser startup failed with sandbox EPERM before execution, including final scoped practice run; no fresh browser/screenshot/layout result is claimed. Mock inspection was source-only. Existing previous browser counts are historical results, not verification of this new UI. Human visual/device/zoom/accessibility checks and content review remain outstanding. The supervisor-service planning work is unrelated and untouched.

## P4 charts and nets (2026-10-07, Claude)

Details in `docs/p4-charts-nets-plan.md` (outcome section) and ADR-009. Three families added: nets (4 lessons), pie charts (5), bar charts (3, Primary 3 bridge). Library now 16 topics and 57 lessons. Lead-run verification: typecheck, lint and format clean; 34 files and 672 unit tests; 57 packages valid; development and learner builds; release tests; 130 Chromium tests. Limits: plan and review by agents, dispositions by the same lead (not independent); official syllabus unreadable; no human content, accessibility, device or zoom review. Nothing is published.


## Remaining 2D workbenches — 2026-10-10, Codex

Implemented under `docs/codex-2d-manipulatives-plan.md` after Codex independently dispositioned Claude's single R-91–R-110 review for the remaining scope. Two protractor and two symmetry drafts extend the catalogue to 64 lessons / 16 topics. Existing 60 saved lessons are byte-identical. The lazy 2D workbenches reuse the shared host and existing assessed response kinds; no core/schema bump or saved manipulation log. Ghosts require hint support; follow-up questions have no movable preview. Alignment/construction are practice, with submitted readings and derived outcomes assessed.

Final validation: 750 unit/DOM checks (38 files), typecheck via both builds, lint, formatting, 64-package validation and release/synthetic publication gates pass. Main learner JS 202,100 bytes; CSS 46,677 bytes; 2D lazy chunks 13,083 bytes. Browser checks attempted, but Chromium launch failed with sandbox EPERM before any interaction. Dedicated 19-scenario browser coverage is authored, not run. Narrow-screen measurements, fresh screenshots, devices, zoom and accessibility remain unverified. Human approval still gates publication (0 approved lessons); no 5178 deployment claim.
