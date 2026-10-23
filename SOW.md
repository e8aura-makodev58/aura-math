# Aura Math — Statement of Work

**Status:** Revised draft after two Claude review passes, 2026-10-04; technical dispositions by Codex. Pilot scope remains proposed; not an implementation approval or delivery contract.  
**Date:** 2026-10-04  
**Initial audience:** Singapore Primary 2–3 learners, with parents and teachers supporting guided learning.
**Current priority (2026-10-05):** Existing P2–P3 material remains available; further expansion is paused. The next planned module prioritises P4 assessment preparation. School-specific Term 4 coverage is unconfirmed. Typography planning preserves the accepted colours and playful layout. These changes follow the single-review workflow; detailed scope remains proposed.  
**Repository state:** Initial development preview in progress; see `docs/implementation-status.md`. User authorised development and sub-agent coordination on 2026-10-04; outstanding human review does not block preview engineering and still gates learner publication.

## 1. Purpose and Outcomes

Build an interactive tutorial web application that helps learners understand mathematical concepts and use them to solve problems through Singapore primary mathematics approaches. Learners should manipulate representations, reason about relationships, connect visuals to calculations, and explain their conclusions.

Aura Math must support the broader primary mathematics curriculum, including geometry. Bar modelling is one representation, not the foundation of every lesson. The first release will focus on a small, reviewed P2–P3 content set while establishing reusable learning infrastructure.

The intended outcomes are:

- Learners complete meaningful mathematical actions rather than only watch animations or submit final answers.
- Independent and guided modes share accurate content and mathematical checks.
- Authors can add lessons without rewriting the application shell.
- New topic families can introduce their own mathematical state, interactions, and validators.
- Mathematical correctness, interpretation quality, and teaching suitability are evaluated separately.

## 2. Agreed Principles and Proposed Decisions

### Agreed with the user

1. Support both independent learning and guided demonstration.
2. Scaffold methods and gradually reduce support.
3. Begin with basic P2–P3 content.
4. Support topics beyond word problems, including geometry.
5. Do not assume arbitrary word problems can be decomposed reliably through deterministic pattern matching.
6. A deterministic model becomes authoritative for mathematical consequences only after the problem has been accurately decomposed into basic components.

### Proposed for review

- Begin with authored, reviewed problem interpretations rather than unrestricted problem uploads.
- Prove the shared architecture with comparison and geometry lessons.
- Use deterministic topic validators and reviewed teaching sequences at runtime.
- Evaluate LLM-assisted interpretation separately before exposing it to learners.
- Start with local progress storage and no learner accounts.

These proposals should be reviewed before implementation. This document does not establish a fixed budget, schedule, hosting provider, or technology stack.

## 3. Curriculum Alignment

Maintain a curriculum map linking each lesson to its primary level, topic, objective, prerequisites, and source reference. Verify precise P2–P3 placement and terminology before accepting a lesson. Do not infer grade placement from difficulty alone.

The reference identified during brainstorming is the [MOE primary mathematics syllabus, updated October 2025](https://www.moe.gov.sg/-/media/files/primary/2021-primary-mathematics-syllabus-p1-to-p6-updated-october-2025.pdf). Its search extract was available, but direct access encountered a browser verification page. Full content-level alignment remains an outstanding review task; the pilot topics below are candidates until checked.

Use a triangulated evidence map: official documents where accessible, third-party teaching-provider mappings, and historical exam papers. The user explicitly authorised this broader approach on 2026-10-04. MOE PDF access is not a prerequisite for drafting or engineering progress. For each objective record level, source URL, source date/version when available, exact section or paper/question, evidence type, and confidence. Cross-check two independent sources where possible and record disagreements. Historical papers demonstrate assessed practice in their year, not current syllabus completeness. Provider mappings are useful evidence but are not automatically official verification.

M0 requires two independently published, inspected sources per selected objective, with at least one directly supporting its proposed level, source versions recorded, and disagreements resolved or explicitly accepted by the named human content-review owner. Syndicated copies count as one source. Historical sources may corroborate but cannot alone establish current placement. Codex prepares the map; human review-owner assignment remains outstanding. This is the minimum proposed evidence bar; learner publication still requires human mathematical and pedagogical review. Label evidence as provider-supported, historical, or official-text-verified. Initial evidence and remaining checks are in [curriculum-evidence.md](curriculum-evidence.md).

Use original lesson wording and illustrations. Record any external content licences. Distinguish official curriculum objectives from Aura Math's instructional design choices.

## 4. Pilot Scope

### 4.1 Required architecture demonstrations

**Comparison:** Three reviewed examples varying the unknown: larger quantity, smaller quantity, and difference. Each includes a visual construction task, calculation, contextual answer, and relationship check. Avoid teaching keyword-to-operation shortcuts.

**Geometry:** One lesson with at least three reviewed tasks: identify a target, classify examples, and select all examples meeting a constraint. Proposed objective: P3 recognition of right angles and comparison with a right angle, supported by the evidence map; final placement and vocabulary require M0 review. Use rotated right angles, varied arm lengths, and visibly smaller/larger angles. Do not require polygon classification or rhombus properties. Free-form and grid construction are deferred. If the objective changes at M0, replace its fixtures and acceptance criteria together rather than retaining angle-specific requirements for an unrelated topic.

Both families must work in independent and guided modes. The same lesson framework must accommodate numerical answers and non-numerical outcomes.

### 4.2 Expansion candidates after the demonstrations pass

Part–whole relationships, equal groups, sharing and grouping, and two-step problems. Later topic adapters may cover place value, fractions, measurement, time, money, and data. Full coverage of these families is not required for the initial architecture demonstration.

### 4.3 Initial exclusions

Complete P1–P6 coverage; PSLE preparation; unrestricted autonomous tutoring; arbitrary photo/OCR ingestion; classroom rostering; payments; social features; and a production content-management platform. These may become later work packages. Open-ended LLM interpretation is a research deliverable, not a required learner-facing pilot feature.

## 5. Learner Experience Requirements

### 5.1 Common lesson flow

Support exploration, explanation, guided application, independent practice, and reflection. A lesson may omit or reorder stages where pedagogically justified. Do not force every topic through a word-problem workflow.

In the pilot, explanation/reflection is a reviewed structured reason choice after the mathematical action, with fixtures for supported reasons and distractors. Guided mode also offers oral discussion prompts; the app does not assess spoken explanations. A correct reason choice is limited evidence of recognition, not proof of independent reasoning.

The learner interface must present one clear action at a time, maintain consistent meanings for colours and labels, and provide reset, replay, and recovery from mistakes. Animation must communicate a mathematical change rather than decorate the page.

### 5.2 Independent mode

- Ask learners to act before revealing the solution.
- Provide four reviewed, task-specific hint rungs: attention cue, relationship cue, partial demonstration, and worked step. In selection tasks the final rung may reveal the answer; label it before activation and record supported completion. Do not invent four different mathematical steps for a one-step task.
- Fade assistance according to explicit, testable rules using observed attempts and hint use.
- Assess intermediate work, not only final answers.
- Offer specific feedback for supported misconceptions; use neutral retry feedback for unrecognised errors.
- Preserve progress and allow a lesson to resume.
- Describe progress honestly; completion alone must not be labelled mastery.

### 5.3 Guided mode

- Give the facilitator controls to advance, reveal, replay, reset, and display discussion prompts.
- Avoid timed progression so the facilitator can pause for explanation.
- Use the same mathematical model and lesson content as independent mode.
- Keep facilitator notes distinct from learner-facing instructions.
- Preserve mathematical state when switching modes; define how hints and attempts are recorded across a switch.

### 5.4 Progress and support rules (proposed pilot baseline)

Progress belongs to this browser/device, with a visible notice that it is not a learner profile. Provide “Start fresh” and “Clear all progress”; confirm destructive clearing. No names or identifiers are required.

| Event | Recorded behaviour |
| --- | --- |
| First action | Change `not_started` to `in_progress` |
| Finish with no recorded guided mode, reveal, or hints | `completed_without_app_support`; no claim that human help was absent |
| Finish with any hint or worked step | `completed_with_support` |
| Enter guided mode during an attempt | Mark that attempt facilitator-assisted; completion is `completed_with_facilitator` even after switching back |
| Switch modes | Preserve mathematical state and append mode event; never erase assistance history |
| Retry/reset task | Start a fresh attempt; retain earlier attempt history |
| Reload same lesson version | Restore state, mode, assistance, and completed steps |
| Lesson version or approved digest changes | Explain that content changed; start a fresh attempt and exclude old results from current evidence |
| Clear all progress | Remove all stored attempts and support settings |

Show “Completed without app support” with the explanation that the app cannot observe help from another person.

Record only assessed submissions as attempts; exploration moves are not failed attempts. Record hint rung and reveal events separately. Keep past completion categories, rather than silently overwriting assisted work with a later independent result.

For pilot fading, initially show a brief general task-orientation cue that does not reveal a relationship or answer; viewing this cue is not a hint event. The four hint rungs remain available on request. After two consecutive successes without recorded app support on distinct reviewed practice variants of the same objective, omit the optional introductory cue on the next task. Any incorrect assessed response or requested hint resets that streak and restores the cue on the next task. Never hide the hint ladder or automatically reveal answers. Guided attempts do not contribute. If there are too few variants, do not fade. For the proposed pilot, do not add a large variant pool solely to demonstrate fading: verify the rule with synthetic state-transition fixtures, and keep fading inactive in learner content unless three distinct reviewed variants of the same objective are actually supplied (two qualifying tasks and one subsequent task). The three comparison unknown positions do not automatically count as variants of one objective. These thresholds are testable design defaults, not validated learning claims.

Blocked, full, or corrupt storage must leave the lesson usable in memory with a visible “Progress will not be saved” notice. Catch failures on reads and writes; do not overwrite corrupt data silently. Private browsing receives the same behaviour based on observed storage capability, with no durability promise. Use a single writer per progress record: a second tab may practise in memory, but cannot overwrite the first tab's record. Define lock expiry/recovery in the storage ADR. Test storage denial, quota exhaustion, corrupt records, and simultaneous tabs.

### 5.5 Interaction and accessibility

Design for desktop and tablet use, including touch. Drag interactions must have keyboard or tap/select alternatives. Provide visible focus, readable labels, sufficient contrast, reduced-motion behaviour, and explanations that do not rely on colour alone. Visual mathematical objects must expose useful text descriptions, derived from adapter `describe(state)` and updated after actions. Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/); conformance requires a documented audit, not just automated checks. Use at least 44 × 44 CSS-pixel interactive targets as a pilot design choice. Use English, one action per prompt, short sentences, and explain new mathematical terms. Record teacher review of vocabulary and instruction length. Built-in narration is deferred; screen-reader support and facilitator reading remain required.

## 6. Mathematical and Teaching Architecture

### 6.1 Separate responsibilities

The architecture must distinguish:

1. **Interpretation:** Determine entities, quantities, units, states, relationships, unknowns, and assumptions from a problem or task.
2. **Mathematical model:** Represent those relationships in an executable topic-specific form.
3. **Verification:** Check mathematical consequences and transformations under that model.
4. **Teaching plan:** Select suitable representations, methods, prompts, and scaffolding for the learner.
5. **Presentation:** Render state and collect learner actions without inventing mathematical rules.

Schema validity and solvable equations do not prove that the interpretation matches the story. A correct solution also does not prove that its explanation is suitable for a primary learner.

### 6.2 Interpretation approval boundary

Store interpretation status explicitly, for example `draft`, `needs_clarification`, `reviewed`, and `approved`, with version and review provenance. Approval must be deliberate and traceable; it cannot be inferred from an LLM confidence score or successful equation solving.

For authored lessons, require human content review before learner publication. Preserve links between stated relationships and source wording; label derived facts and assumptions separately. Include before/after states when quantities change.

Bind separate mathematical and pedagogical approvals to a canonical SHA-256 digest of the entire lesson payload, including task wording, interpretation, model, answers, hints, feedback, teaching steps, visual configuration, fixtures, and referenced asset bytes. Exclude only the approval envelope itself from the hashed payload to avoid self-reference. Unknown fields are rejected. Review records include digest, reviewer identity, date, status, and review notes; each human reviewer must differ from the author. One qualified independent reviewer may perform both reviews. Author provenance identifies human contributors and agent name/session identifiers; an agent session is never a qualified human reviewer. The schema ADR must pin a canonical JSON scheme and digest test vectors before M1b exits. Proposed baseline: [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) JSON canonicalisation, with rational values represented as integer numerator/denominator pairs, and a hashed asset manifest containing each unique relative path, byte length, and SHA-256 of the exact asset bytes. Hash the canonical payload including that manifest; reject missing, extra, duplicate, or mismatched assets. Do not concatenate raw assets without framing. Review envelopes are validated against a release-controlled human reviewer register; a payload-supplied name alone cannot grant reviewer status. A hash detects edits, not reviewer authenticity; publication also requires trusted review provenance in the controlled release process.

Any payload or asset edit invalidates both approvals. Approval-envelope edits require provenance validation. The build and learner loader must refuse missing, invalid, or digest-mismatched approvals. Author preview is separate, visibly unapproved, and records no learner progress. Changes to validator or renderer code trigger affected fixture checks and content-impact review before release even if content bytes did not change. The pilot must not deliver provisional generated interpretations as established teaching content.

### 6.3 Topic adapters

Use a shared lesson contract with topic-specific model and interaction adapters. Avoid making equations or bars mandatory fields for every lesson.

| Adapter | Mathematical state | Example checks |
| --- | --- | --- |
| Quantity relationships | Variables, units, equations, time states | Arithmetic, substitutions, conservation, domain constraints |
| Geometry | Shapes, vertices, edges, defined properties | Property predicates, classification, construction constraints |
| Measurement, future | Quantities, units, conversions | Unit compatibility and exact or specified-tolerance comparison |
| Data, future | Categories, counts, representations | Totals and correspondence between data and display |

Keep semantic geometry separate from screen coordinates. A scaled or rotated rendering must preserve the intended properties. Define numerical tolerances only where required and test their boundaries.

The language-neutral adapter contract is:

```text
adapter.id / adapter.version
stateSchema / actionSchema / goalSchema
initialState(taskSpec) -> State
apply(State, Action) -> {state, outcome: applied | rejected | unassessable, feedback_key?}
evaluate(State, StepGoal, AssessmentContext) -> {outcome: correct | incorrect | incomplete | unassessable,
                          matched_alternative: string | null, feedback_key: string | null}
describe(State) -> structured text description
```

Every assessed teaching step binds a `stepGoalId` to a validated adapter goal. `AssessmentContext` includes step ID, previous state, submitted action, and ordered assessed events for the current attempt; the runtime supplies this context, never a learner-controlled correctness flag. Intermediate actions such as assigning quantities or marking an angle have their own goals. Misconception detection runs within `evaluate` using the current state and this context, returning the reviewed feedback key. Detectors must define required history and bounded inputs in their fixture specification; insufficient evidence returns neutral feedback. Two traces reaching the same final state may receive different process feedback where the reviewed objective requires it. Completion still requires all mandatory step goals, including structured reflection, to pass.

Operations are deterministic and do not mutate their inputs. Unsupported actions preserve state and return `unassessable`; malformed actions are rejected before evaluation. Feedback keys refer only to reviewed package text. Correct results identify a supported solution/alternative, and unassessable results cannot award completion. Exploration need not be assessed as incorrect.

The runtime receives adapters through registration; it imports no concrete topic adapter. The application composition layer registers quantity and geometry adapters and their separate renderers. Geometry is the second executable adapter during M1b, before expansion to three comparison examples. Contract tests execute both adapters through the same runtime, and a dependency check prevents topic imports into the runtime. `describe` supplies semantic objects, selected elements, properties, and changes without depending on screen coordinates or exposing hidden answers.

### 6.4 Deterministic verification

Use exact integer or rational arithmetic where appropriate. Check units, non-negative counts, required integrality, missing constraints, contradictions, and answer uniqueness where relevant. Declare unsupported constructs explicitly.

Validate each supported learner action and solution transformation. Accept alternative valid constructions or methods through explicit rules rather than requiring one identical click sequence. For the pilot, document the supported alternatives and give informative feedback when an action cannot be assessed.

### 6.5 Teaching plans

For the pilot, represent teaching as a linear sequence with limited explicit branches for retry, supported alternatives, and hints; defer arbitrary graph authoring. Each step declares its purpose, prerequisites, permitted actions, checks, hints, and next-step conditions. Link mathematical claims in visuals and hints to the approved model.

Method choice depends on objective, prerequisites, learner support needs, and the available representations. Do not assume there is one universally correct method. Authored plans are the pilot default; generated plans require equivalent review and validation before use.

## 7. Content Contract

Each lesson package must provide:

- Stable identifier, version, title, target level, objective, prerequisites, and curriculum reference.
- Task text or exploration instructions and relevant assets.
- Reviewed interpretation and source links where applicable.
- Topic-specific deterministic model and expected outcomes.
- Supported teaching methods and visual representation configuration.
- Step graph, learner actions, validation rules, and mode-specific controls.
- Hint ladder, misconception feedback, reflection, and independent practice.
- Acceptance fixtures covering valid answers, supported alternatives, and representative mistakes.
- Review status and provenance.

Use declarative JSON validated against a versioned schema, with an author preview and validation report; no executable code inside lesson data. Codex owns schema and tooling design. A named human content-review owner, preferably with primary-maths teaching experience, is required at M0 exit; no appointment or completed review is claimed here.

Define the interpretation schema in M1a: entities, quantities and units, state/time identifiers, relationships, unknowns, source-text spans, derived facts, assumptions, ambiguity flags, and review provenance. Geometry may instead provide a task specification and goals, without story entities or equations. R1 consumes the same versioned interpretation schema.

Each claimed misconception needs a teacher-reviewed or curriculum-grounded source, a positive detector fixture, and a similar non-matching fixture to test false positives. Without that evidence, provide neutral feedback.

Validate lesson packages before loading. Produce an actionable author-facing error for malformed or unsupported content. Version stored progress against the lesson version and define behaviour when content changes.

## 8. LLM Research Work Package

Evaluate an LLM workflow for proposing structured interpretations of unfamiliar word problems. Permit bounded tool-assisted revision; do not treat multiple agreeing model outputs as proof.

Required research outputs:

- The M1a interpretation contract reused for research, with evidence links, assumptions, and ambiguity flags; schema changes require versioning and gold-fixture migration.
- A reviewed evaluation set including multi-step relationships, transfers, changing quantities, irrelevant information, inconsistent facts, and underspecified questions.
- Separate measurements for relationship fidelity, unsupported assumptions, solution correctness, and appropriate clarification or rejection.
- A fixed revision budget and explicit outcomes for unresolved cases.
- Error analysis distinguishing interpretation failures from calculation and teaching failures.
- A recommendation on whether any generated workflow is ready for supervised use.

Include semantically equivalent rewordings and altered numbers in the evaluation. Keep an evaluation subset separate from prompt development. Human approval remains required for pilot publication regardless of benchmark score. Future readiness thresholds must be agreed before evaluating a release candidate.

## 9. Technical Implementation and Data

The initial preview uses TypeScript, Vite and native DOM/SVG interactions, selected in `docs/ADR-001-stack.md`. The content-authoring phase retains that stack and now provides versioned declarative lesson data, author tooling and a controlled learner-build gate; see implementation-status for limits. No backend is required unless an accepted feature needs it; keep model-provider credentials server-side if LLM integration is introduced.

The implementation should separate application navigation, lesson runtime, topic models, validators, visual tools, content, and progress storage. Suggested directories are `src/`, `content/`, `tests/`, and `docs/`; final names depend on the chosen stack.

Store only necessary local progress in the pilot: lesson/version, completed steps, attempts, and hint use. Provide a reset control and define retention behaviour. Remote analytics and identifiable learner profiles require a separate design decision. Do not send learner identity or free-form personal information to a model provider by default.

Proposed operational baseline: browser-based English pilot for desktop and tablet; no PWA installation or guaranteed offline mode; first-party bundled fonts and assets; no third-party runtime calls, analytics, or model requests. Test Chrome, Edge, Firefox, and Safari versions current at release, including iPad Safari and one Android tablet, and record exact versions. Retain local progress until explicit clearing or browser eviction; do not promise durable backup. Hosting remains undecided until deployment planning.

Before an observed pilot, document storage keys, data fields, purpose, retention, deletion, network requests, and any hosting logs. Obtain guardian consent and appropriate school permission for participating children. A qualified owner must confirm applicable Singapore data-protection obligations and the consent/research process; this SOW makes no legal-compliance claim. Do not store participant identities in application progress or repository logs.

Document setup, build, test, and local run commands once configured. Hosting, supported browser versions, persistence limits, and operational targets must be established before deployment.

## 10. Deliverables and Milestones

| Milestone | Deliverables | Exit condition |
| --- | --- | --- |
| M0: Scope and curriculum review | Reviewed SOW, curriculum mapping, decision log | Scope baseline accepted, multi-source objective mapping reviewed, and human content-review owner assigned |
| M1a: Runtime slice | Draft lesson/interpretation schemas, runtime and quantity adapter, one comparison task in both modes, geometry contract stub | Synthetic fixtures exercise intermediate goals, hints, reflection and mode changes in author preview only; no learner publication |
| M1b: Content and publication boundary | Executable geometry adapter, canonical digest/provenance tooling, package validation report and preview, build/loader gates | Both concrete adapters pass shared contract fixtures; altered/unapproved packages cannot enter learner mode; schema/digest ADR and test vectors recorded |
| M2: Comparison lesson | Three unknown-position examples, both modes, hints and feedback | Content review and comparison acceptance scenarios pass |
| M3: Geometry lesson | Three tasks for the selected geometry objective, varied presentations, both modes | Geometry scenarios pass without equation/bar assumptions in shared runtime |
| M4: Pilot integration | Navigation, local progress, accessibility, build/run documentation | Full pilot checks pass and limitations are documented |
| R1: Interpretation research | LLM evaluation harness, reviewed dataset, failure report | Evidence supports an explicit go/no-go recommendation; independent of pilot release |

Estimate effort after M0. Do not invent delivery dates before stack, content-review ownership, and acceptance scope are agreed. Each milestone should produce reviewable artifacts before moving on.

## 11. Validation and Acceptance

### Mathematical correctness

- Every published pilot task has a reviewed interpretation or task specification, deterministic model, expected outcome, and review provenance.
- All accepted arithmetic steps satisfy the approved relationships.
- Incorrect comparison direction and incorrect responses to the selected geometry objective are rejected with appropriate feedback.
- All valid selections and selection orders are accepted when the task allows them; geometric construction is outside this pilot.
- Contradictory or malformed content cannot silently enter learner mode.

### Functional behaviour

- Comparison examples cover all three unknown positions.
- Geometry tasks include rotated instances and a non-numerical success condition.
- Both lesson families run in both modes with shared mathematical checks.
- Mode switching preserves mathematical state; reset and reload follow documented progress rules.
- Hints, retries, completion, and reflection follow the authored step plan.
- Adding a second lesson within an existing topic requires content changes rather than a new lesson-specific application screen.

### Enumerated fixtures and negative paths

- Every pilot task has at least one canonical successful trace, one distinct valid action order or representation where permitted, two representative invalid responses, and all four reviewed hint rungs. If an objective permits no distinct alternative, record the reviewer rationale rather than inventing a second method.
- Each supported alternative has a successful fixture; each misconception detector has matching and non-matching fixtures. Check feedback keys and the mathematical state resulting from each assessed action.
- For the proposed angle objective, geometry fixtures cover rotated right angles, varied arm lengths, visibly smaller/larger distractors, and every supported selection outcome. Update this list if M0 selects a different objective.
- Reject malformed packages, unknown fields, broken feedback/asset references, missing approvals, invalid provenance, and digest mismatch with actionable author errors. Mutation tests cover every payload field category and referenced assets.
- Unsupported adapter actions return `unassessable` without changing state or progress. Test all progress-table transitions, reload, mixed-mode attempts, clearing, lesson-version/digest changes, storage failures and tab conflicts. Test process-sensitive feedback with equal final states but different assessed histories, structured-reason choices, and fading with synthetic variants.
- Changing-quantity learner tasks are explicitly deferred from this pilot. State/time identifiers remain in the schema, and R1 includes changing-quantity examples. No pilot acceptance claim covers transfer reasoning.
- Content review records explicit checks of vocabulary, one-action prompts, correct diagrams, hint progression, and feedback explanations. An observed usability pilot does not establish teaching efficacy.

### Engineering and learning review

- Run focused unit tests for mathematical validators and state transitions; integration tests for content loading and persistence; and end-to-end checks for both lesson families and modes.
- Include keyboard/touch interaction, reduced-motion, and non-colour cues in manual verification.
- Complete a content review for mathematical accuracy, age-appropriate language, and clarity of scaffolding.
- Conduct a small observed pilot with consent where required, and record usability findings without claiming learning efficacy from a small sample.
- Record reproducible commands, results, unresolved defects, and supported limitations in the release handover.

## 12. Risks and Open Decisions

| Risk or decision | Required response |
| --- | --- |
| Incorrect story interpretation | Trace relationships to wording and require review before authority |
| Architecture overfits bar models | Demonstrate geometry early using the same lesson runtime |
| Correct maths but poor teaching | Review representations, vocabulary, and hint progression separately |
| Excessive scaffolding | Include independent transfer tasks and explicit support-fading rules |
| Overly broad first release | Finish two topic demonstrations before expanding content |
| LLM latency, cost, or inconsistency | Keep pilot lessons executable without a live model call |
| Curriculum access and mapping | Cross-check inspected sources and record version/placement uncertainties |
| Human reviewer availability and throughput | Assign a qualified independent owner before M0 exit; plan review batches and re-review effort |
| Authoring and fixture effort | Estimate hints, structured reasons, alternatives and review separately from runtime work |
| Storage eviction and unavailable storage | Explain local-only retention, preserve usable in-memory practice, and test failure/conflict paths |

Remaining decisions: exact evidence-backed pilot objectives; named human content-review owner; acceptance of the proposed pilot baseline; stack and hosting; visual tone; task-specific alternative methods; and research dataset size and readiness thresholds. Progress, authoring, language, browser coverage, offline scope, and read-aloud now have explicit proposed defaults above. The preview stack decision is recorded; next-phase sequencing is in `docs/content-authoring-plan.md`. Delivery estimates remain unset. Financial terms and ownership arrangements are outside this technical SOW.

## 13. Change Control and Review Status

Record scope changes, rationale, acceptance impact, and affected milestones in `handover.md`. Distinguish proposals from approved decisions. Do not silently convert future capabilities into pilot commitments.

Claude completed two review passes (R-01–R-24). Codex dispositions are recorded in `handover.md`; “addressed in draft” means a specification change, not an implemented or independently validated control. Remaining evidence and reviewer assignments stay open. Future reviews should test the revised requirements against concrete fixtures rather than repeat settled scope discussions. A review does not authorise implementation or override the user's agreed principles.

Going forward, each planned phase receives one Claude review. Codex evaluates findings and records accept/modify/reject/defer with evidence and rationale before proceeding with implementation. Recommendations and severity labels are not binding decisions. No routine second Claude review is required; only the user may request one. This engineering workflow does not substitute for human mathematical and pedagogical lesson approval.

The completed content-authoring phase is detailed in [Content-authoring plan](docs/content-authoring-plan.md), with Codex dispositions for Claude’s single R-25–R-35 review. It advances existing milestones through content contracts, author preview, bounded draft generation and review/release tooling; it does not declare full milestones complete or substitute for human approval.

The user clarified the author-interface requirement on 2026-10-05: JSON remains the raw format, while authors edit a representation of the actual learner view through simple contextual controls. [Visual authoring plan](docs/visual-authoring-plan.md) is implemented following Claude’s single review and Codex dispositions R-36–R-44: shared lesson canvas, contextual text/model controls, frozen in-place trials, undo/redo and device-local author drafts. JSON remains import/export data. Publication controls remain separate; human content approval and browser/device validation are outstanding.


On 2026-10-05 the user validated the live visual-author updates and requested better layout, easier organisation/navigation for learners and authors, and more pre-built topics. [Library, layout and topics plan](docs/library-and-topics-plan.md) proposes a shared material hierarchy, responsive library/editor refinements and four additional bounded topic families with twelve original lessons. This is documentation for the next single Claude review, not an implemented extension or completed curriculum/content approval. New topic selections, counts, schema migration and acceptance details remain proposed pending the single review and Codex assessment. Existing publication and original-content rules remain intact.


The user’s 2026-10-05 direction supersedes P2–P3 expansion as the immediate priority: prepare separate typography and P4 assessment plans, with P4 objective selection grounded in multiple sources. Historical milestone definitions remain records, not a requirement to add more P2–P3 material before P4. See `docs/font-enhancement-plan.md` and `docs/p4-assessment-plan.md` when completed.

The P4/typography phase was implemented after Claude’s single review R-64–R-74 and Codex dispositions on 2026-10-05. ADR-006 records the exact-input and compatibility decisions. Twelve P4 drafts extend the catalogue to 30; general revision scope remains distinct from unknown school assessment coverage and independent human publication approval.
