# P4 practice: session, navigation and publication contracts

**Implementation update (2026-10-06):** The user waived Claude review for this phase. Codex implemented the integrated scope; see [plan outcome](playful-p4-practice-plan.md) and ADR 008. The proposal below records the planning rationale, not an outstanding review gate.

**Status:** Proposed, documentation only, 2026-10-06. Input to the next single Claude review; Codex must assess its recommendations before implementation. This document does not approve content or claim tests were run.

## Scope and evidence

The first phase should deliver one playful P4 lesson experience plus deterministic same-skill variants in the development preview. Preserve the current palette, self-hosted fonts, existing P2/P3 material, and all publication gates. New variants must be visibly draft. The exact first supported skill and presentation are selected in the integrated plan; contracts here apply irrespective of that choice.

Inspected `src/core/{types,runtime}.ts`, `src/main.ts`, `src/learner.ts`, `src/ui/{lesson-view,library-view}.ts`, `src/author.ts`, `src/topics/{capability,registry}.ts`, `src/content/package-validation.ts`, `src/content-release.ts`, `src/released-content.ts`, `scripts/{build-learner,check-learner-artifact}.mjs`, and existing runtime/P4 UI tests. Read contributor instructions, handover/resume notes, SOW and curriculum evidence. Existing verification numbers in the handover are Claude's reported results, not checks rerun for this proposal.

Relevant existing foundations are suitable to extend:

- Topic adapters are injected into the pure runtime. Presentation and mathematical assessment remain separate.
- Session events preserve hints, reveals, guided-mode history and adult worked-solution use. Malformed/unassessable answers do not award submissions or progress.
- The shared view freezes a clone for an assessment trial. Author edits update the working revision rather than the active frozen trial.
- Mixed practice uses bound library IDs; the learner build prunes them to approved packages.
- Exact package digests and qualified independent human approvals gate release. Runtime integrity verification checks embedded packages and the pruned catalogue.

Limitations directly relevant to this work: `main.ts` records a completed result only on Exit, keyed by source lesson ID; Next lesson bypasses that recording. The view's reset/replay creates a fresh session and discards the old one. The current renderer uses a single uniform frame and generally renders diagrams from the lesson rather than action history. These are scoped integration needs, not a full independent audit of Claude's takeover.

## Attempt identity and support

Introduce an in-memory practice controller outside `Session`. Retain the existing runtime's event contract and keep concrete generators out of `src/core/`.

Each active attempt should bind a frozen package snapshot to an instance descriptor: source lesson ID/version, source payload digest, generator ID/version where applicable, seed, bounded parameters and variant fingerprint. The attempt additionally has a monotonically increasing local ID. Do not overload the source lesson ID as variant identity, and do not pass a new lesson with an old session: runtime identity must match the active snapshot.

Store a compact immutable summary at completion, or when an explicit full restart abandons an attempt: status, assessed submissions, hints/reveals, support/facilitator flags and reason for ending. Capture the summary before Next lesson, Exit, replay or successful variant replacement destroys the view. Deduplicate completion by attempt ID, because render callbacks may fire repeatedly. Keep current-attempt assessment events separate from prior-attempt summaries; never feed prior answers into an adapter's current-attempt assessment context.

Bound retained summaries (proposed latest 20 per open practice activity) and generated duplicate fingerprints. No accounts, remote analytics or durable progress are introduced. Reload starts a fresh source attempt; the page must state that this session's practice record is temporary. Normal browser entry, navigation and malformed routes must remain usable without summaries.

Completion wording remains observable: “Completed without app support,” “Completed with support,” or “Completed with facilitator.” Do not label a child as having mastered a skill or independently solved it simply because no hints were requested. A prior worked answer can still influence a repeat attempt. Record repeated-example versus new-example context separately rather than erasing that distinction.

## Action semantics

| Action                                     | Required behaviour                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revise/check after incorrect answer        | Same problem and attempt. Keep hint/support/submission history. Allow correction without forcing a restart.                                                                                    |
| Completion action “Try this example again” | Retain the completed attempt summary and start a fresh attempt on the same frozen example, recorded as repeated-example practice.                                                              |
| Restart current example                    | Explicitly end the old attempt as restarted, clear answer state and start a new attempt on the same frozen example. Retain its summary and repeat context.                                     |
| “Try another”                              | Only available for a supported completed preview lesson. Generate a different same-skill example, with identical difficulty bounds; start fresh answers and hints after successful validation. |
| Change learning mode                       | Preserve current problem, response, step, events and support. Once guided, facilitator use remains sticky for that attempt. A new attempt begins in the currently selected mode.               |
| Next mixed question                        | Continue from the source item's position in the collection, even after several same-skill variants. Variants do not add questions or advance the mixed-set cursor.                             |
| Return to Edit                             | Destroy trial state and restore the author's unchanged working revision and edit position.                                                                                                     |

Do not silently escalate difficulty or automatically remove teaching steps after one correct answer. The first phase offers the same skill and difficulty with optional learner-selected hints. Adaptive fading, diagnosis and mastery thresholds require later design and evidence.

## Atomic generation and lifecycle

Generation must build a complete candidate package: specification, original bounded wording, answers, choices, hints, fixtures and diagram data. A changed number alone is insufficient. Validate candidate structure and model consistency before starting a session. Validate template-specific pedagogical constraints separately from package validation; generic validation cannot establish prose meaning.

Compute candidate, validate it, check its fingerprint differs from the current/recent examples, create its initial session, then commit the switch. A bounded retry/exhaustion result is explicit. On any failure preserve the completed example, existing summary, route, selected mode and Next mixed question control. Show a recoverable message rather than falling back to a malformed or identical variant. Advance the generation counter only on a successful commit. Bound seeds and counters and document deterministic seed derivation in the generator proposal.

Generation can be synchronous and local in this phase. Guard double clicks while committing. If the controller later becomes asynchronous, bind requests to a lifecycle token so Exit, source changes, Return to Edit or destroy cancels stale replacement. `destroy()` must remove listeners; discarded views cannot update summaries or replace the active lesson.

Keep the source route unchanged for ephemeral variants; do not create catalogue entries or treat arbitrary variant IDs in hashes as accessible content. Refresh intentionally returns to the original source package. Store the descriptor in memory for debugging and reproduction; a seed alone is not enough without source/template versions. No route query should supply executable generator names, arbitrary parameters or package data.

## Shared presentation and author boundary

Use a presentation capability supplied by composition for the selected P4 skill, with the existing generic renderer as fallback. Keep assessment correctness in adapters, not DOM handlers. Preserve `data-region` author hooks or provide an explicit replacement mapping so contextual edit controls continue to reach story, diagram, prompt, hints and choice labels.

A playful redesign may animate a correct relationship, but must not expose later answers before the corresponding assessed step. Feedback and reduced-motion rendering must convey the same mathematical information. New manipulations that affect assessed goals require declared action types and adapter validation; avoid introducing an unvalidated drag interaction merely for appearance.

Proposed first-phase cut line: author “Try as learner” uses the redesigned presentation on its unchanged frozen draft, with same-example replay only. “Try another” is enabled in the main development preview through an injected capability; it is absent in author trials until arbitrary edited prose can be safely reconciled with templates. Author trials must not silently replace custom wording, change undo history, save a generated package, or mutate `lastValid`. Generation preview/export inside the author workflow is a later explicit feature.

## Publication and bundle boundary

An approved source package does **not** approve a generated variant. Changing values, wording, hints or specification changes its digest. Preserve manifest schema 2/application contract 3 and package v1/v2/v3 reads unless implementation evidence demonstrates an actual serialized contract change; in-memory controller fields alone do not require a package migration.

`learner.ts` can use the reviewed presentation for exact approved packages, but must not import the preview generator registry or expose a hidden generation path. Import preview generators only from preview composition. Avoid using author template modules as a convenient shared dependency: they would leak editing code and labels into the learner bundle. Extend the artifact scan with generator-specific sentinels and complement it with an import-boundary assertion, because a string scan alone is not proof of absence.

The learner catalogue remains pruned to permitted IDs. No variants are appended to `content/library.json`, no manifest entries are fabricated and no reviewer records are modified. If library placement changes in a later scope, run `bind-library.mjs` and release checks as required.

Future published generation requires a separate approval policy for a versioned generator, its exact template payload, parameter domain, teaching-property bounds and release integrity. This phase defers that policy. An alternative is pre-generating a finite bank and approving each exact package under the existing gate; neither approach is implemented here.

## Meaningful verification proposed for implementation

- Pure controller tests: distinct variant versus same-example restart; supported and guided histories remain sticky within attempts; prior events are excluded from new assessment; completion records exactly once; completed attempts are captured before every navigation path; summary eviction is bounded.
- Failure tests: invalid candidate, mismatched adapter, duplicate/exhausted space, counter limit, double click and stale/destroyed view leave active package/session/route unchanged. Use deliberately failing generator doubles instead of testing only happy paths.
- Generator tests use independent arithmetic/property oracles and fixed seeds, not the generator's own answer function as expected output. Check teaching constraints, original wording coherence, hints/diagram values, all valid forms, malformed inputs and unsupported actions.
- Browser traces: hint-assisted completion followed by a fresh independent variant; adult reveal then replacement; guided→independent switch; restart versus retry; two variants in one mixed-set slot then Next; final mixed item; route reload; back-to-library filter/tab restoration; unavailable capability; generation failure.
- Author regression: frozen trial survives working-revision updates; edit hooks remain usable; last-valid fallback, undo/redo, selection, custom text and device drafts are unchanged by playing a trial. Generic P2/P3 and other P4 lessons continue to work.
- Visual verification: capture problem, incorrect response, hint, success and completion at 390px and desktop; verify 320px overflow, keyboard focus, touch target sizes, exact-answer mobile keyboards, long text, 200% zoom and reduced motion. Record screenshots actually viewed and distinguish automated emulation from real devices/assistive technology.
- Release/security checks: unapproved variant rejection, altered-digest rejection, forged variant route fallback, pruned mixed collections, empty release, synthetic approved fixture rendering, no generator/author/model endpoint code in learner output. Keep hostile text rendering and package-size/depth rejection tests.
- Run typecheck, lint, format checks, focused tests, full unit/browser suite, content validation, both builds, release tests and artifact checks once integrated. Record actual results and environmental limits; these are proposed commands, not executed validation.

## Suggested implementation split after the single review

1. Domain agent: bounded generator/template capability, model-derived content and independent mathematical/property tests; no shared-view edits.
2. Presentation agent: selected P4 scene, same-skill feedback states, responsive/reduced-motion styling and maintained author hooks; no release/controller edits.
3. Integration agent/lead: attempt controller, preview capability injection, mixed navigation, frozen author trials, release/bundle assertions and end-to-end scenarios. Shared-file ownership and integration order recorded before edits.

Exit condition: one coherent P4 experience works in preview, its supported skill generates reproducible different examples without an LLM, attempts are recorded honestly in memory, existing exact-package learner release remains intact, and screenshots/checks support the reported outcome. More topic families, persistent progress, adaptive difficulty, author variant editing, generator-wide publication approval and the dormant annotation LLM remain outside this phase.
