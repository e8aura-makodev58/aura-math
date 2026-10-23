# Library, layout and pre-built topics

**Prepared:** 2026-10-05 by Codex. **Status:** Implemented in the tree and verified 2026-10-05 (see `docs/implementation-status.md` and the handover resume notes). Proposals below were the plan; where the code differs, the code and ADR-004 are authoritative. Visual acceptance beyond the recorded screenshots, and all human content review, remain outstanding.

The user validated the updated live page: editing is better, but the layout still needs improvement. They request a more usable interface, more time spent on pre-built topics, easier navigation for learners and authors, and detailed planning before implementation. These directions are agreed; the design, topic selection and quantities below are proposals for review.

## 1. Outcome and scope

Make it easy to find a suitable lesson, work through it, and adapt it without understanding file formats. Deliver four genuinely new topic families with three original pre-built lessons each. Retain the six existing comparison/angle lessons: proposed total **18 curated lessons across six families**. The existing six seeded demonstrations remain separate author imports, not six additional curated lessons.

Prioritise content and its mathematical/teaching checks over cosmetic expansion. Proposed effort allocation: roughly 55% new topic/content work, 30% navigation/layout, 15% integration/regression. This is a prioritisation guide, not a delivery estimate. No accounts, backend CMS, live AI, arbitrary construction, new learner persistence, mastery claims or hosting migration in this phase.

“Pre-built” means a complete packaged lesson with a visual representation, teaching sequence, four hint rungs per step, supported answers, reflection, provenance and fixtures. A topic card, renamed comparison exercise or random parameter variant does not count. New packages stay draft until independent human approval. The user's live-page validation is usability feedback, not publication or curriculum approval.

## 2. Inspected baseline and problems

Read the repository guidelines, handover, SOW, curriculum evidence, current learner/development/author entries, shared view, CSS, topic registry, package contracts and release tooling.

| Current implementation | Consequence | Proposed remedy |
| --- | --- | --- |
| `src/main.ts` hardcodes two topic panels and lists every lesson in the sidebar; a large decorative hero precedes materials | Larger catalogues make browsing long and repetitive | Compact library header; topic/skill navigation and useful filters; keep the lesson list in the library |
| `src/learner.ts` has a plain list home, despite sharing the rich lesson view | Preview and release have different discovery experiences | Shared library presentation receiving an explicitly permitted catalogue |
| `src/author.ts` mixes source/new selectors, open/edit/try/undo/save/download/report actions in one toolbar | Authors must scan unrelated controls on every edit | Author library for finding/creating; focused editor with clear action hierarchy |
| Canvas forces a single column and inspector moves below it at 1050px | Long scrolling separates selection from its editing controls | Responsive canvas/inspector allocation and a tablet edit panel |
| Repeated Edit buttons, lesson heading/step selectors and teaching panels compete for space | Mathematical task loses prominence | Selected-region outline and contextual editing affordances; one step navigation control |
| `TopicId`, validator, answer dispatch, visuals, author controls and wording assume comparison/angles | New content cannot be added by JSON alone | Explicit registered topic capabilities with complete integration checks |
| Catalogue import and CLI scan flat `content/lessons/*.json` | Rearranging directories would break discovery | Keep flat source files this phase; organise by validated metadata and indexes |

These are code-based observations plus the user's feedback. No new visual/browser inspection or accessibility audit is claimed.

## 3. Material organisation and navigation

### 3.1 Shared hierarchy

Use **level → strand → topic → skill → lesson** for browsing, with direct search across lessons. The topic label serves people; the adapter ID identifies a mathematical model. Multiple skills can share an adapter. Proposed strands: Numbers and operations, Geometry, Data. Add Measurement only when it has content; do not show empty topic tiles as delivered materials.

Existing topics: Comparing quantities (P2, Numbers and operations), Right angles (P3, Geometry). New topics: Place value, Equal groups, Fractions, Picture graphs (candidate P2 placement). Each lesson belongs to one primary topic/skill and level; optional controlled tags support cross-topic discovery without duplicating the lesson. Do not infer official level from file names or model difficulty.

Proposed library record fields: level `P2|P3`, strand ID, topic ID, skill ID, sequence integer, prerequisite skill IDs, controlled tags. Topic/skill definitions have stable IDs, short labels, descriptions and a declared order. Durations continue to use package minutes. Avoid difficulty ratings until criteria exist; use skill labels rather than generic “easy/hard”. All IDs/references and topic/adapter compatibility are validated.

### 3.2 Learner library

- Header: Aura Math, “Explore lessons”, P2/P3/All selector. A short introduction rather than a tall hero.
- Topic cards show name, one-sentence purpose, applicable level and available lesson count. Opening one shows its skill groups and ordered lesson cards.
- Search matches title, objective, topic and skill labels; whitespace/case normalised, literal text only. Topic and level filters combine. Result count, Clear filters and a useful empty state are visible.
- Cards show title, skill, level, estimated minutes and one Start action. Draft labels remain visible in the development preview. Published library contains approved entries only.
- Suggested first lesson uses declared sequence within the selected topic; prerequisite links are suggestions, not progress locks. Link only to prerequisites present in the allowed catalogue; otherwise show plain prerequisite text.
- Return from a lesson preserves filters, topic and scroll; restore focus to the originating card. Completion offers Replay, Back to topic and next available lesson within that topic. Do not label session completion as mastery or imply durable progress.
- Hash routes encode known topic/lesson IDs and query/filter state. Invalid/stale IDs show a recoverable library state. Refreshing a lesson starts a fresh attempt under the current memory-only progress policy. Never encode answers, personal data or draft content in URLs.

### 3.3 Author library

Separate **Starter lessons** and **My drafts** as tabs. Starter lessons are the curated packaged sources, grouped by the same topic/skill hierarchy. My drafts lists validated local records with title, topic, saved time and version; no raw paths or JSON as primary content.

Search and topic filters use the same library helpers. Starter cards offer Open and Create a copy; My drafts offer Continue, Save as copy through the editor, and explicit Delete. Opening a packaged source preserves the existing same-ID revision workflow; creating a copy gets a new lesson ID/version 1 and source provenance. “My drafts” refers to this device, not an account. A full ten-slot library shows its limit and explicit deletion/export options without eviction.

**New lesson** opens a short topic → supported task form chooser with an actual preview and description. Every new topic ships starter templates and ordinary author controls. Unsupported forms cannot appear as selectable. File import/export lives under a labelled More menu. Review reports remain author reports, not approval actions. Do not combine draft status with trusted human approval status or create a “Publish” button.

## 4. Proposed layout and interaction design

### 4.1 Reviewable wireframes

Desktop library:

```text
[Aura Math]  Explore lessons                         [Author workspace]*
[All levels / P2 / P3]   [Search lessons____________] [Clear filters]
[Topics: All | Place value | Equal groups | Fractions | ...]
[Topic title / purpose]                                      [N lessons]
[Skill heading]
[Lesson title + short objective] [level / minutes]            [Start]
```

`*` Development entry only; approved learner artifact has no author route.

Desktop author editor:

```text
[← Library]  Lesson title · Draft · Unsaved          [Try] [Save draft] [More]
[Undo] [Redo]   [Edit / Try]                         [Step 2 of 4 ▾]
[              Actual learner canvas             ] [Edit: question         ]
[ task + model | active question + answer area    ] [ordinary field controls]
[ selected region outlined; contextual Edit       ] [field error near input ]
[ hints in learner position                       ] [Checks (N) / Details   ]
```

The diagrams specify hierarchy, not pixel-final appearance. Retain the warm colour palette, improve contrast/readability, and reduce decorative text. Icons always have text labels or accessible names. Build code-native icons/SVG; no generated bitmap assets needed.

### 4.2 Concrete responsive behaviour

- At 1280px and above, editor canvas uses remaining width and a 320–360px inspector. Canvas chooses its internal one/two-column layout based on **canvas width**, not outer viewport. Only use two columns when both task and answer panels retain roughly 280px usable width.
- At 768–1279px, library is two columns where cards fit. Author canvas occupies the page; selected Edit opens a labelled side panel with a backdrop, close control and focus management, while showing the selected task region. Opening the panel scrolls the selected region into view. Apply changes live; closing does not silently discard edits.
- Below 768px, library is one column. Inspector becomes a full-width dialog with contextual excerpt, live changes, Done and cancel-free close semantics; undo is explicit. Preview is behind the panel, never squeezed to an unreadable width. Returning restores selected-region focus and scroll.
- Test portrait/landscape 768×1024 and 1024×768, desktop 1280×800, phone 390×844 and 200% browser zoom. No horizontal page overflow, clipped controls, nested tiny scroll areas or overlays hiding active fields. Sticky toolbar must not obscure anchor targets/focus; reduce stickiness on short viewports.

Use native dialog semantics or equivalent tested focus trapping for modal panels. Escape closes an inspector, not a lesson or unsaved draft; focus returns to its opener. Do not put edit buttons inside answer labels (which could accidentally select answers). In Edit, one visible focusable Edit affordance per region plus a selected outline; affordances work with keyboard/touch, not hover alone. Try removes editor overlays, uses the shared learner presentation and starts a new frozen attempt. Keep inputs, caret and IME stable during updates; source/lesson switches use existing unsaved guards.

### 4.3 Action and message hierarchy

In the editor Save draft is the primary persistence action, Try is the main secondary action, Undo/Redo sit beside editing state. Download, report, import and source details move to More or named panels. Save status says Unsaved / Saved on this device / Save failed; avoid presenting content-validator warnings as save failure.

Validation errors stay beside their fields plus an accessible summary. Pending wording checks have count, affected block links and current/proposed text. Never conceal blocking checks solely in a collapsed menu. Global semantic/human-review warning is concise and persistent; detailed explanation is expandable. Keep mathematical controls and text controls adjacent to what they affect.

## 5. New pre-built topics and lesson inventory

Propose four new adapter families in this order, with three authored lessons each. These are narrow objectives, not full syllabus coverage. Provider evidence supports candidates; precise placement/terminology and teaching quality still require human review.

| Family / candidate level | Pre-built lesson IDs and intended tasks | Representation and bounds |
| --- | --- | --- |
| Place value / P2 | `hundreds-tens-ones`: read a base-ten model (e.g. 243); `zero-in-a-place`: explain zero tens/ones (e.g. 305/470); `digit-value`: distinguish a digit from its value (e.g. 6 in 462) | Hundreds/tens/ones chart and grouped base-ten SVG; integers 0–999, including zero places. Clearly mark lessons as a subset of the provider’s up-to-1000 range. No renaming/regrouping algorithm here. |
| Equal groups / P2 | `equal-groups-total`: 4 groups of 3 → total; `sharing-equally`: 12 objects among 3 groups → each; `how-many-groups`: 15 objects in groups of 5 → groups | Distinct grouped counters; multiplication/sharing/grouping models with labels. Group size 2,3,4,5,10; group count 1–10; total ≤50; exact division only. Never use “groups” and “in each group” interchangeably. |
| Fractions / P2 | `equal-parts`: recognise equal halves/quarters, reject unequal-part example; `name-the-fraction`: identify shaded parts of a rectangle; `compare-same-whole`: compare unit or like fractions of equal-sized wholes | Exact equal-area rectangle partitions. Denominators 2,3,4; numerator 1..d−1. Include visibly unequal partition distractors with explicit geometry. No decimal arithmetic, unlike non-unit fraction comparison, or fraction operations. |
| Picture graphs / P2 | `read-the-key`: read a row using its key; `compare-categories`: compare two categories using scale; `graph-total`: find total across categories | Horizontal pictographs, key 1,2 or5; 2–4 categories, integer full-symbol counts 0–6 each. Include zero category and ties; largest-category questions require a unique maximum unless multi-select is explicit. No half-symbols, bar graphs or real learner survey data. |

Each lesson has 3–4 purposeful steps: attend to representation, make an intermediate mathematical choice, find/compare the target, explain with a reviewed structured choice. Do not enforce four steps if it produces repetition. Four hint rungs progress from attention to relationship to partial demonstration to labelled reveal, for every step. Both independent and guided modes work. Reflection is semantically unverified authored content; opaque stable choice IDs and varied correct positions avoid positional cues.

The first iteration reuses choice/number/multi answer kinds. Learners make mathematical selections and calculations tied to visual models. Do not promise free-form dragging, live object construction or drawing through these existing action kinds. Place-value and fraction visual-choice steps need topic-owned structured option specifications rendered safely; these are generated from validated geometry/model data, not HTML strings in packages.

Topic controls for authors: place digits/value/target position; group count/size/task type; fraction partition/shading/comparison and curated distractor type; graph category labels/full-symbol counts/key/question. Derived answers/fixtures/reveals update atomically. Task-type, divisor, fraction-whole or graph-key changes flag all dependent prose; structural changes requiring a different interpretation use a coherent model+wording transaction before Try/export. Unsupported parameters stay editable but cannot replace the last-valid canvas. No arbitrary new cards/categories outside validated bounds.

### 5.1 Evidence inspected for this plan

On 2026-10-05 inspected [Practicle P2](https://practicle.sg/primary-2-math/) and [IXL P2](https://sg.ixl.com/standards/maths/primary-2). Practicle lists place value, multiplication, equal sharing/grouping, fractions and scaled picture graphs. IXL sections P2.NA.1.1, P2.NA.1.3, P2.NA.2.1 and P2.S.1 corroborate these candidates. Practicle advertises 2026 alignment; that is its claim. IXL says alignment is pending and offers historical/current-labelled mappings, so neither replaces human verification. Original wordings, bounded domains and lesson counts above are our design choices. Existing historical-paper evidence remains in curriculum-evidence; no new paper questions or diagram inspection are claimed.

### 5.2 Proposed model and assessment contracts

| Adapter ID | Core specification and derived facts | Mathematical goals / safeguards |
| --- | --- | --- |
| `place-value` | Integer value; task enum read-model/zero-place/digit-value; target place enum hundreds/tens/ones when needed. Digits are derived from the value, not independently editable redundant fields. | Identify a place/model choice; read the value; identify digit value. Validate target presence, explicitly allow a zero-valued target, derive answers arithmetically. Render up to nine hundreds blocks/ten-rods/unit counters per column, never 999 individual dots. |
| `equal-groups` | Positive groupCount and perGroup; task enum total/each/groups. Total is derived product, with unknown role declared. Story interpretation records the same relationship and names/units/spans. | Identify grouping/sharing relationship; select matching model; calculate the unknown. Reject non-integral division, inconsistent redundant totals, unequal groups or label/role swaps. Do not require one multiplication operand order when equivalent and unambiguous; sharing/grouping role questions remain distinct. |
| `fractions` | Task enum equal-parts/name/compare; rectangle partition definitions and shaded-part indices; comparison operands with equal whole dimensions. Curated option specs bind stable choice IDs to partition data. | Recognise equal area; identify numerator/denominator representation; compare fractions by exact cross-products. Only curated unequal-part distractors may have unequal geometry, and are explicitly marked as candidate examples, never the accepted equal-part model. Validate partition coverage, no overlaps, unique shaded indices, and same whole for comparison. |
| `picture-graphs` | Key integer 1/2/5; categories with stable IDs, labels and full-icon count; task enum read/compare/total and target category IDs. Quantities are count×key. | Read key; calculate a row or whole-graph total; compare named categories. Reject duplicate category IDs, out-of-range counts, missing targets and ambiguous single-correct maxima. Graph legend and row semantics derive from the same model. |

Every mathematical step names a supported goal, not just a free-text title. Choice goals map opaque IDs to validated model relations/visual options; number goals derive integers. Reflection remains an authored key with a semantic-review warning. Reset transitions clear topic-specific selections/input, unsupported actions are unassessable without mutation, and no capability exposes a learner-controlled correctness flag. This matrix bounds the implementation; detailed TypeScript discriminants and independent test oracles are defined during L2/L3 against these invariants.

## 6. Contracts, taxonomy and compatibility

### 6.1 Versioned content changes

Introduce **package schema v2** for library metadata and new topic specifications; retain strict read support for exact v1 packages. Do not silently add accepted keys to v1. New authored packages use v2. Existing v1 packages remain byte-identical and acquire derived browse metadata through a small explicit legacy-ID map. Unknown valid legacy IDs get a topic/level-based fallback and “General practice” skill rather than disappearing or causing a guessed approved mapping.

For v2, add a validated `library` object with the hierarchy fields from §3.1, and topic-specific discriminated specifications and visual-option data. Keep existing plain-text, byte/depth/count, duplicate/prototype-key checks and no external assets/scripts. Template choice IDs and mathematical answer keys remain opaque and model-bound. Suggested prerequisite relations must be acyclic; do not use them as access locks.

Distinguish package schema version, adapter version, lesson revision, canonical digest version and application contract. Keep canonical SHA-256 rules unchanged; include every v2 field in the digest. Editing a legacy package promotes it explicitly to v2, increments its lesson revision once and clears any inherited approval expectations. Origin report retains the unaltered v1 object and its canonical digest. Existing imported/local saved v1 records remain readable; never auto-rewrite local storage on read. A failed migration keeps the draft and offers export; it does not delete, replace or evict it.

Maintain manifest schema unless its envelope truly changes. Increment application contract for new schema/renderers and record content-impact decision; do not modify a manifest contract without replacing/verifying the corresponding build/loader fixtures. Real approvals/entries remain empty until evidence exists. Every payload edit, metadata included, changes digest and needs exact-package review.

### 6.2 Topic capability composition

Add a typed topic definition at the composition layer: adapter, specification validation, answer derivation, visual renderer, author model controls, wording dependencies/proposals, template factory, library label/icon and fixture suite. Core runtime continues to receive an adapter without importing concrete topics. Author editor delegates model panels and transactions through capabilities; eliminate generic “not comparison means angles” branches.

Audit explicitly: `TopicId`, `src/topics/registry.ts`, `src/content/validation.ts`, package validation, `src/ui/visuals.ts`, `src/ui/lesson-view.ts` headings, `src/authoring/model.ts`, wording, template chooser, `src/author.ts`, generation and release loader/build. Unsupported topic/schema errors are actionable and cannot fall through to another renderer. Existing seeded generation remains comparison/angles and reproducible; generating variants of new topics is deferred until those templates and checks exist.

Word-problem interpretation stays topic-specific. Equal-group stories need a v2 relationship recording group count, per-group quantity, total, unknown role, unit and source spans. Place-value/fraction/graph exploration uses its task specification without forced story equations. Arbitrary input interpretation is still excluded. Numeric answers use exact integers; fraction comparisons use cross-products, not floating-point rounding. Do not define reflection correctness by the model or claim text lint proves meaning.

### 6.3 Index and release boundary

Build library records from the supplied catalogue, not a separate untrusted list of lesson files. A shared library module receives allowed records; it does not import the draft catalogue. Development entry supplies curated drafts; author entry combines its explicit starter/local sources; approved entry supplies only runtime-verified manifest packages. Filter counts, search, recommendations, prerequisite links and next-lesson targets operate on that same permitted set. No draft title/objective/search index leaks into the learner artifact.

Taxonomy labels are application-owned; learner build prunes unused topic/skill definitions. Author storage and templates stay out of learner modules. Keep flat content paths to avoid discovery/CLI migration this phase. Adding a v2 lesson within an implemented family requires a package, not a new sidebar/home screen. Duplicate IDs still fail validation; same-ID exports replace the source file, with archives outside the catalogue.

## 7. Implementation sequence after the one review

| Stage | Work and checkpoint | Verification before moving on |
| --- | --- | --- |
| L0: assess review | Codex dispositions each finding; revise this plan and ownership; capture current entry fixtures | No coding before review assessment; preserve user scope and original packages |
| L1: library and layout foundation | Shared filtered library; author library/editor separation; responsive hierarchy using six existing lessons; v1/v2 metadata reader | Find/open/return/filter/route flows; focus/IME/undo/unsaved/save regressions; actual screenshots when available |
| L2: place value and equal groups | Complete two adapters, visuals, author forms, coherent wording and six original lessons | Independent mathematical fixtures, both modes, editor round-trip, validator/import/report/release checks |
| L3: fractions and picture graphs | Complete remaining two adapters and six original lessons; integrate topic/skill grouping | Exact partition/scale semantics, misleading distractors rejected, corresponding editor and runtime checks |
| L4: quality and handover | All 18 lessons, navigation/refinement, browser scenarios, docs and release separation | Both builds, tests/lint/typecheck; all-topic traces; declared limits and content-impact decision |

These are checkpoints within this planned phase, not requests for four more Claude reviews. Do not spend L2/L3 time endlessly re-theming L1. After assessment, lead may delegate separate topic pairs and library/layout modules within available concurrency, claim ownership first and agree capability APIs. Lead owns schema/migration/release integration. No agents are assigned implementation during this documentation-only session.

## 8. Acceptance, tests and review material

### 8.1 Concrete workflows

1. Learner chooses P2 → Fractions → Name the fraction, starts within three navigation actions, returns to the same filtered list, then opens the next available lesson. Search “graph” from All returns picture-graph lessons with correct counts.
2. Author finds a starter by topic, creates a copy, selects diagram/question, changes a bounded parameter, checks proposed dependent text, tries a fresh lesson and saves. Reopening preserves payload, origin, ID/version and lock/copy semantics.
3. Author opens an existing v1 source and v1 saved draft; inspecting alone changes nothing. Editing promotes deliberately with preserved origin, undo restores the complete state, exported v2 imports and yields identical working digest. Cap-full, corrupt or denied storage preserves work and existing records.
4. An approved synthetic subset of two topics shows only its own cards/counts/search results/next links; a real empty manifest still yields the explicit no-approved-lessons state. Draft-only strings, templates and storage remain absent from learner artifacts.
5. Tablet author selects a region, edits without losing caret/IME, closes the panel, and returns to that region. Keyboard users can open/close every menu/panel without trapping focus or accidentally selecting an answer. Pending blocking checks are reachable.

### 8.2 Mathematical and content coverage

For each of 12 new packages: independent expected answers for every mathematical step, at least two representative invalid responses, one successful complete trace in each mode, all four hints per step and reflection fixture. Where action order is irrelevant, include alternative selection order; do not invent unsupported solution methods. Tests of model-derived answers use a separately expressed oracle, not the same production function. Human review remains required for words, hints, visual suitability and reflection.

Boundary checks: place-value0/9/10/99/100/305/999 and invalid1000; group multiplication/division boundaries plus zero, negative, remainder and swapped-role mistakes; fraction numerator/denominator bounds, equal-area geometry and exact comparisons; graph zero/tie/max/key boundaries and confusing icon count with quantity. Visible and nonvisual representations must expose the same task information without naming a hidden correct option; describe graph keys/counts and fraction geometry rather than an answer key. Visual-choice accessible descriptions must permit reasoning, not disclose correctness flags.

Capture original six lessons in both modes before shared-renderer changes. Run the existing 90-test baseline plus meaningful new checks, both builds, content validation, synthetic release-gate checks and artifact scans. Add navigation/search/empty/route tests, mixed-schema/migration/digest rejection tests and editor capabilities for every topic. Do not treat screenshots or passing tests as independent mathematical/pedagogical approval.

### 8.3 Visual validation requirement

Collect before/after screenshots for library, active lesson and author editor at desktop and tablet dimensions, with long titles and a full inspector. Check 390px and 200% zoom for overflow/focus visibility; contrast, touch targets ≥44px and reduced-motion behaviour. Reviewer can judge planned hierarchy now; actual visual quality requires browser inspection after implementation. If the environment still prevents browser execution, report that limitation and provide commands/scenarios; do not call layout accepted from DOM tests. User’s previous live validation does not substitute for screenshots of future changes.

## 9. Risks and scope controls

Four adapters touch more than runtime registration. The capability audit and two topic batches prevent partial topics with missing author or release support. v2 risks digest/storage migration mistakes; keep v1 immutable, migrate only on explicit edit and test mixed imports. More navigation can obscure tasks; avoid permanent all-lesson sidebars or complex nested accordions. A modal inspector can disrupt context; selected-region excerpt, focus return and tablet testing are required. Content count can encourage weak near-duplicates; judge completeness by distinct objectives and fixtures.

Money, time, measurement, shape patterns/solids and multi-step problems remain candidates for a later phase. This plan does not promise complete P2/P3 coverage, human-review throughput, durable backups or deployment dates. The reviewer appointment and remaining curriculum checks continue independently; source-access failure is not an MOE-only implementation gate.

## 10. Instructions for Claude’s single review

Read this plan, handover, SOW/curriculum evidence and the affected source contracts before findings. Review the proposed scope and architecture, not an implementation that does not yet exist. Focus on:

- Whether the layout hierarchy genuinely reduces cognitive/scroll burden for learners and authors, especially tablet editing.
- Whether four new topic families and 12 lessons are bounded and educationally distinct, with actionable specifications and fixtures.
- Whether taxonomy, search/route state and next/prerequisite links respect the permitted catalogue.
- Whether v2/legacy editing/local storage/origin/undo and digest/application contracts preserve data and approval boundaries.
- Missing topic-specific wording, renderer, validation, answer derivation or author capabilities; unsupported action/parameter paths.
- Where acceptance is under-specified or proposed scope should be narrowed without dropping the user’s request for richer content.

Append one consolidated findings set to handover starting at **R-45** (check next unused ID first). Name affected sections, concrete failure examples and minimal proposed remedies. Do not implement or rewrite the plan. Codex then records accept/modify/reject/defer with rationale, updates the plan and proceeds with the reviewed phase after that assessment. No routine second Claude review; engineering review never counts as qualified human content approval.


## 11. Codex review dispositions and implementation amendments

See handover R-45–R-54 for individual rationale. Split runtime from author-only topic composition. Keep intrinsic level/skill/tags inside v2; move sequence/prerequisites and taxonomy to a separately digest-bound library index so routine reordering does not change neighbour lesson digests. Preserve strict v1 reads and explicit edit promotion. v2 level is authoritative with matching display text.

Tablet inspection is non-modal and complementary; phones use modal focus management. Search/route text is bounded and rendered as text. Require explicit target place for digit-value tasks even with repeated digits. Equal groups start at two groups, graph scale tasks use keys2/5, and fraction descriptions expose measurements as an alternative reasoning route without marking correctness. Fractions are taught through equal-sized whole pictures, not cross-products.

Add configurable external/reused browser URLs and a screenshot/acceptance command. Actual layout acceptance requires browser or recorded user evidence; if restricted here it remains unverified while topic engineering proceeds. Retain all12 new lessons, with the two topic batches and integration gates, rather than introduce another permission loop or stop at six new lessons. No human review or layout pass is inferred from code/DOM tests.
