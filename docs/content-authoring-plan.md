# Next phase: content authoring and controlled lesson generation

**Status:** Implemented within the scoped decisions from the completed single Claude review; verified results in handover.  
**Prepared:** 2026-10-04 by Codex.  
**Current request:** C1–C4 complete for draft tooling; real publication awaits qualified human review.  
**Decision owner:** Codex leads technical assessment and implementation; the user retains product/scope authority.

## 1. Review process and authority

The user has set this process going forward:

1. Codex prepares a concrete plan against the actual code.
2. Claude reviews that plan **once** and records evidence-backed findings. Claude does not implement changes or rewrite the plan during the review.
3. Codex evaluates every finding for correctness, impact, proportionality, and consistency with user decisions. Findings are recommendations, not final decisions.
4. Codex records **accept**, **modify**, **reject**, or **defer**, with rationale, evidence, and any change to acceptance criteria. A severity label alone does not create a blocker. A credible unresolved correctness defect does require resolution or an explicit scope exclusion.
5. Codex revises the plan and proceeds with the resulting implementation scope. Ask the user only for a genuinely material unresolved product decision, external commitment, or conflict with their instructions. Do not require another routine permission round or send the revised plan back for a second Claude review unless the user explicitly requests one.

The single Claude review is an engineering/design review. It neither grants nor replaces the separate human mathematical and pedagogical approval needed to publish lessons. Tests and normal engineering checks continue during implementation; they are not additional Claude review rounds.

Original review instruction (fulfilled): Claude was to append findings from **R-25** onward in `handover.md`, after checking the next unused ID. Each finding should cite a section or source file, a concrete failure/example, its consequence, and the smallest useful remedy. Record alternatives and uncertainty. Separate genuine defects from optional design preferences. Codex fills the disposition column after the review; an empty column never means acceptance.

## 2. Baseline at planning and problem

The user confirms the page works. It is a functional development preview, with six original authored fixtures in `src/content/lessons.ts`, two mathematical adapters, and a shared runtime. No AI content generation occurs. `src/content/validation.ts` validates a narrow draft format and rejects every learner-mode load. Lessons are created by TypeScript functions; adding content still involves source editing.

`src/core/types.ts` couples a teaching step to an authored answer, and the adapters use fixed step IDs for some checks. `src/core/runtime.ts` records submissions, but does not yet supply the complete assessment context or mode/hint event history described in the SOW. The preview stores no durable learner progress.

Previous validation: 25 unit/DOM tests passed; build, lint, typecheck and formatting passed. Eight browser tests exist but execution was blocked by environment permissions. The user's successful page check is useful usability evidence, not a substitute for those automated browser checks.

**Next outcome:** an author can add a lesson or generate a bounded batch of variants as data, inspect each draft in the existing app, correct it using precise validation errors, and prepare an exact version for human review. Publication must accept only versions whose content and review evidence match.

## 3. Scope and sequence

Keep the existing TypeScript/Vite stack and both existing topics. Build the content path before expanding the curriculum or adding live AI.

| Work package | Deliverable | Acceptance gate |
| --- | --- | --- |
| C1: Versioned content and assessment contracts | JSON schema, topic registry, migrated six lessons, source/interpretation fields, explicit step-goal bindings | All six lessons run through the data loader; geometry has no mandatory story/equation fields; unsupported packages produce field-level errors |
| C2: Local author workflow | Validate command, draft catalogue, local JSON import/export, author preview, review report | A new lesson in each existing topic works without application-code edits; invalid imports do not replace the active draft |
| C3: Bounded generation | Seeded comparison and angle generators, original text templates, batch report | Reproducible validated variants with coherent prompts/hints; every generated package starts as a separate unapproved draft |
| C4: Review and release boundary | Canonical digest, review records, controlled release manifest, learner loader and build checks | Exact reviewed packages load; missing/mismatched/forged approval claims fail; preview-only content is excluded from learner artifacts |

C1 → C2 → C3 → C4 is the integration order. C1/C2 deliver immediate authoring value; C3 does not wait for a named reviewer to produce drafts. C4 tooling can be implemented and tested with synthetic records, but real learner publication remains closed until actual qualified human reviews exist.

These are work packages within the existing SOW, not claims that M0–M4 are complete. C1 advances M1a; C2 and C4 advance M1b; C3 supplies draft content for M2/M3. Persistence, observed pilot and complete accessibility/device verification remain M4 work.

## 4. Proposed content contract

Place source packages in `content/lessons/`, bounded template definitions in `content/templates/`, and schema definitions in `src/content/schema/`. The existing `src/content/lessons.ts` becomes a catalogue/loader rather than a factory. Generated drafts are explicit files; do not generate changing exercises silently at learner runtime.

A package separates:

| Part | Required information |
| --- | --- |
| Identity | `schemaVersion`, stable lesson ID, content version, locale, topic/adapter contract version |
| Curriculum | Objective ID, candidate level, prerequisites, source references and evidence status; provider and historical references remain supported |
| Authorship | Human or agent/session provenance; creation source; template version, seed and parameters when generated |
| Task | Plain text/exploration instructions, bounded asset references, topic task specification |
| Interpretation | For word problems: entities, quantities/units, relationships, source-text spans, unknowns, assumptions and ambiguities; geometry uses a task specification instead |
| Teaching | Stable step IDs, goal references, interactions, four task-specific hints, reflection, reviewed feedback keys and permitted branches |
| Evidence | Expected outcomes, positive/negative fixtures, supported alternatives and sourced misconception detectors when present |
| Review envelope | Separate mathematical/pedagogical records bound to the payload digest; excluded from that digest and validated separately |

Reject unknown schema versions, duplicate IDs/keys, unsupported action types, unknown fields, unresolved references and non-finite/unsafe numbers. Define explicit input size/count/depth limits in C1 so JSON import cannot exhaust the page. Reject executable content, remote asset URLs and arbitrary HTML. Render text as text; no `eval` or lesson-supplied scripts.

Use model-derived goal results for numerical and geometric facts. A structured reason choice still needs authored, human-reviewed meaning; an answer key cannot prove that explanation true. Source-text links should resolve to exact wording and be invalidated when wording changes.

Migrate all six fixtures with unchanged intended answers and support behaviour. Preserve lesson IDs; document the migration even though there is no durable progress to migrate. Do not add a permanent fallback that quietly bypasses the new validator.

## 5. Assessment and topic boundaries

The composition layer registers each topic's schema, validator, adapter and renderer. The common runtime does not import concrete topics or delete adapter-specific fields such as `state.answer` itself.

Bind every assessed step to a goal. Supply `AssessmentContext` containing the current step, previous state, submitted action, and ordered relevant events. Record hint rung, reveal, assessed submission and mode-change events separately. Define an adapter transition/reset hook for moving between steps without leaking stale answers.

Evaluation returns outcome, matched supported alternative (or null), and a feedback key. Unsupported actions preserve state and cannot advance completion. A detector requiring history must return neutral feedback when that history is missing. Continue using neutral errors unless a misconception claim has evidence and detector fixtures.

Acceptance includes two traces reaching the same final state but requiring different process feedback, valid multi-selection in different orders, an unsupported action with no state/progress change, and mode switches that preserve state and assistance history. The new contract should improve authoring without adding arbitrary branching or new interactive construction in this phase.

## 6. Author workflow

Implemented commands: `npm run content:validate`, `npm run content:generate -- ...`, and `npm run content:release -- ...`. Reports identify lesson, JSON path, severity, and repair guidance; validation failure exits non-zero.

The author workspace is a development-only route/build, separate from learner navigation:

1. Open a source draft or import a local JSON file. Validate before replacing the active draft.
2. Inspect interpretation/task specification, teaching steps, visual output, source evidence and validation results together.
3. Run either lesson mode and reset without recording learner progress. Display draft status prominently.
4. Export the exact edited JSON and review report. File import/export is explicit; no hidden writes, account system, or backend required.
5. Prepare a versioned review candidate after errors are resolved. Warnings remain visible and require recorded disposition before release.

Start with a JSON editor/import interface and read-only structured panels. A rich visual lesson builder is deferred. Never expose an “approve” button that lets an author impersonate a qualified reviewer. The preview may display real review records but cannot invent them.

## 7. How bounded generation works

### Comparison

Begin with the three existing unknown positions. Use one original text template per position, a small curated vocabulary set, integer smaller quantity and positive difference, and derive the larger quantity. Proposed pilot domain: quantities from 1 to 100, larger strictly greater than smaller; no zero difference, negative counts, transfers, or unit conversions. Parameters outside that domain are rejected, not silently clamped.

Generate task wording, model values, source spans, calculation prompts, hint substitutions, and explanation choices from the same typed parameters. Avoid free-form story paraphrasing in this generator. Unknown quantity must remain hidden in visual labels and accessible text before the relevant reveal.

### Angles

Generate the existing identify/classify/select task forms. Right-angle targets are exactly 90 degrees. Use a small authored distractor set (for example 45, 60, 120, 135 degrees), bounded rotations, and arm lengths that fit the renderer. Keep degree labels out of learner-facing tasks. Reject zero/straight angles and ambiguous selection sets for the chosen task. Geometry goals remain exact; screen-coordinate rounding is presentation only.

### Batch rules

A seed, generator version, template version and parameters reproduce an identical payload; keep wall-clock provenance outside the deterministic payload or supply it explicitly as an input. Compare digest equality in tests. Deduplicate payloads and give every materialised variant a stable ID and version. Proposed initial demonstration: one variant per comparison unknown position and one per angle task form, six drafts total. This is a validation batch, not an automatic promise of 18 published lessons.

Test boundaries and invariants across the finite parameter domains, not just those 18 examples. Each variant includes its own test fixtures and generation provenance. A passed mathematical validator establishes consistency with its model, not semantic fidelity or teaching suitability.

**Approval never propagates automatically from a template to all variants.** A human can review a batch, but the approval record must enumerate exact variant digests. New values, wording, hints or visuals outside that batch require new approval. Automatic family-wide approval is deferred.

## 8. Human review and controlled release

Use canonical JSON to compute a version-1 payload digest. Current packages support no external asset references; introducing assets later requires an asset-bound schema and digest contract. Freeze the algorithm/version and cross-runtime test vectors before implementing release checks. Include task content, model, goals, hints, feedback, visual specification, fixtures and authoring provenance. No external assets are accepted in version 1. Exclude only the review envelope; hash equality is not evidence of reviewer authenticity.

Mathematical and pedagogical reviews are separate. Either can request changes. Both must approve the same digest, and each reviewer must be a qualified human distinct from the recorded authors. An agent never acquires human reviewer status.

For the local-first release workflow, keep the authorised human reviewer register and release decisions outside imported lesson JSON. The release maintainer verifies actual review evidence and creates a manifest of allowed ID/version/digest tuples. Changing a reviewer name or status inside a draft is insufficient. Schema and automated tests validate records; the maintainer remains accountable for confirming their real origin. This is not a cryptographic identity service.

Build learner artifacts only from manifest-listed packages. The loader recomputes/checks payload and asset digests and rejects versions absent from the manifest. Preview catalogue/import tooling and draft assets must not ship in that learner build. A person replacing both app code and the release manifest controls the distribution; browser checks are not protection against a compromised publisher. Signing infrastructure is deferred unless deployment needs it.

Editing payload/asset content invalidates approval; modifying the envelope requires provenance revalidation. Renderer/validator changes require compatibility fixtures and a recorded content-impact decision because package hashes alone do not cover application behaviour. Version the manifest and keep the previous verified artifact for rollback. No deployment is part of this phase.

## 9. AI-assisted authoring: subsequent research, not this implementation

Once the common format and author workflow exist, evaluate an optional author-side LLM proposer. Its output enters the same draft validator and preview. It cannot write approval records or publish. Test semantic fidelity, unsupported assumptions, ambiguous questions, and mathematical correctness separately on held-out cases.

No provider, credentials, paid API calls, or automatic problem-upload feature is selected by this plan. Keep secrets outside browser bundles and keep learner information out of author prompts. Provider choice, evaluation thresholds and cost limits belong to the existing R1 research work package. A new topic may still require a new mathematical adapter/renderer even if AI can write plausible lesson text.

## 10. Verification and delivery boundaries

| Area | Required evidence |
| --- | --- |
| Migration | Six existing lessons still complete in both modes; expected outcomes and support labels preserved |
| Authoring | Add one new comparison and one angle lesson through data only; malformed import leaves current work intact; export/reimport retains content |
| Contract | Model-derived goals, history-sensitive feedback, alternative selection orders, no topic imports in runtime |
| Generation | Same inputs reproduce digest; invalid bounds rejected; valid instances satisfy invariants; labels/hints match parameters; six sample drafts validated |
| Review | Edited hints, task text, fixtures and visual configuration invalidate approvals; external asset references are rejected; fake envelope identity and unlisted versions cannot load |
| Build separation | Learner artifact contains no draft catalogue/author route; empty release manifest yields an explicit no-approved-content result, never preview fallback |
| Interface | Keyboard import/preview flow, understandable validation errors, reduced motion and responsive geometry checked in a real browser when environment permits |

Run existing tests plus focused new checks, typecheck, lint, formatting and build. Add browser coverage for author import/export and release separation. Keep browser testing marked unverified until it actually runs; DOM tests cannot certify layout. Human review and browser limitations do not prevent building draft tooling, but cannot be counted as satisfied release criteria.

No persistence, accounts, CMS backend, new maths topics, full bar construction, live learner AI, automated mastery claims, or learner deployment is included. Keep current preview usable through incremental integration.

## 11. Proposed execution ownership

After the one Claude review and Codex dispositions, use bounded parallel assignments if useful:

- Content/schema agent: package format, migration, topic validation and generators.
- Runtime agent: goal/context contract and assessment event transitions.
- Author-interface agent: import/export, report panels and preview navigation after the schema is stable.
- Codex lead: release boundary, integration, tests, documentation and assessment of Claude's findings.

Respect the four-agent concurrency limit including the lead, assign exclusive file ownership before edits, and agree on the contract first. This is an implementation assignment proposal, not a request to launch agents or conduct additional reviews now.

## 12. Completed Claude one-pass review brief

Read this plan, `docs/implementation-status.md`, the SOW's relevant sections, and actual content/runtime/types before commenting. Prioritise semantic-vs-mathematical correctness, geometry generality, reproducible variants, review provenance, draft/learner build separation, migration risk, and scope size. Check whether C1–C4 are small enough to integrate without a backend or premature CMS.

Return one consolidated set of findings in `handover.md`, with concrete counterexamples where possible. Do not silently accept this plan, amend user decisions, implement fixes, or schedule another review. Next owner is Codex, who will assess findings, record decisions, revise once as needed and proceed to implementation.

## 13. Decisions after the single review

See handover R-25–R-35 for individual decisions. Use typed hand-written multi-issue validators (no generated executable validators). Literal prose is marked semantically unverified; bounded generators regenerate text from parameters. Reflection requires human review; reasoning options use opaque IDs and seeded ordering. Imported and generated comparison values share the 1–100 positive-difference domain; rotations are bounded to -180..180 and arm lengths remain renderer constants. The current pilot sequences stay linear. History-sensitive assessment is exercised only by a synthetic test adapter.

C1+C2 form the first integration checkpoint. C3 delivers six demonstration drafts with independent mathematical checks rather than eighteen repetitive variants. C4 includes a local trusted reviewer register and build-time manifest gate; it remains closed with no real human approvals. Provenance is intentionally digest-bound, so changing it requires renewed review. Browser/device/accessibility checks are separate unverified evidence until executed. Author error panels use textContent; untrusted size/depth/prototype-key checks precede cloning.

## 14. Delivery record

C1–C4 are implemented: six source JSON packages, six generated examples, author.html workspace, bounded package/fixture checks, assessment events/context/reset hooks, content CLI/candidate digest reports and exact-review manifest-only learner builds. Default release records are empty. See README for executable commands and implementation-status for exclusions. 56 unit/DOM tests plus typecheck/lint/format/both builds and Node release checks pass. Ten browser checks are discovered; browser execution, device accessibility and actual human content approval remain unverified.
