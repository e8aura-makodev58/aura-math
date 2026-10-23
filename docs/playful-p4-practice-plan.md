# Playful P4 lessons and fresh practice

Status: implemented with verification limits, 2026-10-06, Codex. The user explicitly waived Claude's review for this phase and instructed implementation; the general single-review workflow remains for future phases. Human lesson-content approval and learner publication remain separate. Ignore parallel supervisor-service planning documents for this task.

## User direction and boundaries

The user wants fresh examples with different variables to reinforce and check learning, and a lesson experience that carries the playful character of the main page. The user explicitly requested agent delegation after discussion. Existing agreed workflow remains: document first, Claude reviews once, Codex assesses each recommendation before implementation.

Preserve the approved palette, locally hosted fonts, original JSON packages, author-facing visual editing, guided mode, mathematical checks and publication boundary. Prioritise P4; P2/P3 expansion remains paused. School-specific assessment coverage remains unknown. No learner LLM calls, accounts, timers, new analytics or durable learner storage are proposed in this phase. Completion is evidence of a completed task, not mastery.

## Baseline independently inspected

`src/ui/lesson-view.ts` already presents one active assessed step, but surrounds it with a long title/objective, complete step rail, generic visual and question panels. `lessonVisual(lesson)` uses static topic renderers without session presentation state. The phone experience can put the active prompt below substantial introductory content. The required change is to prioritise the mathematical activity and reduce surrounding chrome, rather than add more cards or claim step-by-step assessment is new.

The completion screen currently replays the same frozen lesson. It cannot generate a new variant. `src/content/generation.ts` supports the original comparison/angle offline batch; author P4 modules contain reusable model-derived teaching builders but must not be imported wholesale into learner-facing code. The current runtime resets a session when replaying; preview results in `src/main.ts` are source-ID keyed and captured on exit only. New attempts need explicit isolation and honest records.

Claude's latest P4 families/home and dimension work were read as existing foundations, not independently certified. The relevant interfaces will be assessed during implementation; unrelated annotation endpoint work and a complete retrospective audit are outside this plan.

## Proposed delivery order

1. Build a concrete lesson mock under `docs/design/`, with desktop/phone representations of the problem, active step, wrong answer, hint, correct answer and completion. Independently inspect it before wiring; no additional routine user approval gate is added.
2. Deliver one complete decimal subtraction-with-regrouping experience, including deterministic fresh variables and coherent hints. Use the existing lesson's skill and assessments. A decimal alignment interaction should replace generic choices only when its mathematical meaning and accessible alternative remain equivalent.
3. Extend generation to the four existing decimal forms, then four fraction-calculation forms, after each predicate and complete teaching builder passes its tests. Keep same skill and difficulty. Do not expand the topic catalogue.
4. Apply the compact shared lesson shell across existing topics, retaining topic-specific renderers. Fractions receive their own equal-unit treatment; other new manipulations, such as constructing graphs or free-form shapes, are deferred. Preserve shared author canvas and old topic interactions.

Each stage must leave a usable preview. The first acceptance point is the decimal slice, not completion of every family.

## Lesson experience

Make the problem and representation the centre of the screen. Keep a compact task summary visible with a small progress indicator, then the active prompt and its answer control. Desktop may use a workbench beside the active action; phones place the task, prompt and useful representation before secondary details. Avoid sticky controls that cover the mobile keyboard.

Feedback explains a mathematical relationship using existing reviewed/draft-authored wording. A visual transition may illustrate a justified state change after a correct action or an explicit hint; it must not expose a later answer before the learner requests support. Motion is short, optional and disabled for reduced motion. Focus, textual feedback and non-colour cues remain sufficient without animation. No automatic advancement.

Hints stay available, with the fourth rung clearly labelled as a reveal. Adult worked solutions remain explicit support. Guided-mode actions preserve assistance history. Author edit navigation remains unassessed; trials use frozen copies and cannot silently modify the source draft.

Completion offers a primary **Try another** action for supported preview forms, secondary **Try this example again** for a fresh attempt on the same example, and distinct **Next lesson / Next mixed question** navigation. Correcting an incorrect submission stays in the current attempt with its history intact. An unsupported form retains existing actions without a misleading disabled generation control. Fresh examples change variables while preserving the declared skill, operation and pedagogical constraints.

## Generation and attempts

Use a versioned deterministic sampler and pure teaching builder. Generate a complete valid candidate before replacing the current attempt. Build question, prompts, hints, answers, choices, diagrams, interpretation and fixtures together from the same model; never blindly replace number strings in custom prose. Only explicitly registered canonical starter forms are eligible initially. Author-custom drafts need opt-in template recognition or remain ineligible.

Preserve exact decimal/rational arithmetic. Enforce pedagogical predicates separately from ordinary schema validity: required regrouping, exact decimal division, related denominators, positive meaningful quantities, consistent whole sizes and valid units. Use a stable enumerated domain capped at 10,000 valid tuples per profile, with a versioned seeded permutation, normalized base exclusion and separate choice randomness. Visit each tuple once per practice run; mathematical parameters, not shuffled choice IDs, define uniqueness. Exhaustion offers an explicit restart of the set or return, without silently changing difficulty or repeating. Invalid candidates fail visibly while retaining the completed attempt. This finite-domain approach replaces rejection sampling for the initial profiles.

Proposed initial profiles are deliberately narrower than topic validators:

| Source form              | Property preserved                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Decimal add/subtract     | Subtraction, one whole-to-tenths exchange, no hundredths borrow; one-digit whole parts             |
| Decimal multiply/divide  | Division by 2–9; non-whole dividend above one and exact one-decimal quotient below one             |
| Decimal places           | Thousandths value with internal zero and unequal written lengths; comparison decided at hundredths |
| Decimal practice         | Four equal cord lengths, exact whole metres used, positive non-whole remainder                     |
| Mixed/improper fractions | Two wholes, coprime proper fraction, denominator 3–6; conversion direction unchanged               |
| Fraction add/subtract    | Proper fractions in simplest form, denominator ratio two, positive reducible subtraction result    |
| Fraction of quantity     | Three quarters of a set, integer partition, totals 16–40                                           |
| Fraction practice        | Three quarters used, one quarter remaining, integer partition, totals 16–40                        |

These restrictions retain the actual existing starter's challenge, even when its form name covers broader operations. Addition, multiplication, other borrowing patterns and other fraction profiles are deferred. Small domains, including the quantity profiles, can exhaust after a few examples; communicate this honestly. Exact source IDs, bounds and arithmetic examples are in the generation proposal.

Record seed, generator/template version, source identity and bounded in-memory attempt summaries for replay/debugging. Retain at most 20 summaries per open practice activity, recording each ended attempt once, including before Next lesson or Exit. A fresh session clears answers, hint rung, feedback, worked-solution visibility and assessment state while preserving the selected mode; guided mode immediately marks facilitator support. Earlier support records remain associated with earlier attempts. Results must not overwrite source-lesson completion with a generated variant's result. The route stays bound to the source lesson; refresh returns to its original example and clears temporary attempt records. Variants do not advance the mixed-set position; Next mixed question uses the source item's position. No durable progress claim.

No adaptive difficulty or automatic hint fading in the first implementation. Repeated success may be displayed factually, but the app cannot observe help from another person.

## Publication and compatibility

New variants run in the visibly draft development preview only. Exact-payload approval of a saved lesson does not approve generated payloads. Keep `src/learner.ts`, existing manifest/digest checks and approved-subset routes fail-closed; omit new generator controls and code from the approved learner build initially. Shared visual polish can apply to approved lessons without admitting unapproved generated content, subject to content-impact checks.

Extract runtime-safe pure builders from author modules rather than importing author storage/controllers or model-provider code. Author trials get the redesigned presentation and same-example replay, but no generation control in this phase: custom prose must not be silently overwritten. Do not bump schema/application contract merely to add preview-only attempt metadata. If implementation needs serialized package changes, document a concrete compatibility reason before making them. Future reviewed-generator publication policy is a separate proposed phase.

## Verification required before delivery

- Independent arithmetic oracles and bounded sweeps for each generation profile; semantic predicates, deterministic replay, numeric uniqueness, coherent prose/units/choices and invalid/exhausted cases.
- Session tests for support history, malformed inputs, wrong-answer retry, same-example replay, fresh-example replacement, guided-mode carryover and generation failure without state loss.
- DOM/browser checks for one active action, keyboard/tap equivalence, focus, hint disclosure, exact inputs, author frozen trials, mixed-sequence return and source-result isolation.
- Inspect real desktop/phone captures of initial, wrong, hinted, correct and completed states; verify at 320/390/768/1280 widths, text enlargement and reduced motion. Report emulation and native-device limits accurately.
- Run appropriate typecheck, lint, formatting, unit/DOM suite, content validation, both builds, browser suite, release gate and artifact scan after implementation. No tests are claimed in this documentation turn.

## Delegated proposals and review brief

Supporting proposals:

- [Lesson design](playful-p4-ux-proposal.md): concrete desktop/phone workbench, alignment choices, complete feedback/hint/success states and topic presentation boundary.
- [Generation](p4-variation-proposal.md): supported source forms, deterministic sampling, exact arithmetic and pedagogical properties, uniqueness and failure bounds.
- [Integration contracts](p4-practice-contracts-proposal.md): isolated attempts, temporary records, source routes, mixed-set navigation, frozen author trials and release/bundle checks.

Codex assessment: adopt the single decimal slice, selectable alignment diagrams mapped to existing assessed choice meanings, and a capability supplied by topic composition with a generic fallback. Direct drag placement, adaptive difficulty/fading and author variant saving are deferred. This keeps the redesign mathematical and interactive without adding an unvalidated action contract. Generation remains preview-only; shared presentation can extend across the catalogue, with richer decimal/fraction interactions limited to individually supported profiles. The integration proposal's 20-summary cap, source-route reload semantics and exclusion of author generation are incorporated above. Adopt the generation proposal's finite-domain permutation and precise skill signatures rather than generic numeric sampling. All wording builders remain drafts pending human review; sharing pure code does not confer publication approval. This records the preimplementation assessment; the user then waived Claude review. Actual delivery and the bounded UI-composition tradeoff are recorded in the outcome below.

The earlier Claude review brief is superseded for this phase by the user's explicit waiver. Codex proceeds with independent integration assessment and implementation checks. No review findings are invented to imply a Claude pass occurred. Human mathematical and pedagogical approval remains separate.

## Implementation outcome — 2026-10-06

Delivered compact P4 presentation and two rich workbenches: decimal add/subtract with visual alignment choices and explicit regrouping hints, and fraction add/subtract with equal-whole strips/common partitions. Four decimal and four fraction-calculation starters have deterministic same-skill generation. Other P4 lessons retain their topic diagrams with compact styling; P2/P3 presentations/content are preserved. Rich manipulation across every family is deferred.

Pure teaching builders are shared with author rewrites; generator recognition checks full canonical saved payload plus skill signatures. Generated packages have fresh instance IDs, coherent model-derived teaching content/fixtures and rebuilt interpretations. Finite permutation, base exclusion, explicit exhaustion and restart are implemented. Runtime core and serialized package/schema contracts remain unchanged. A small UI helper directly composed by the shared view replaces the proposed new registration contract for this bounded slice; see ADR 008.

The temporary journal retains at most 20 attempt summaries, upserts late support disclosure, captures navigation/replay/restart and separates source results from generated examples. Mode carries forward while answer/hint/assessment state resets. Source routes and mixed-set positions stay stable. Author trials remain frozen edited lessons without generation. Approved learner builds exclude generator/author dependencies and retain exact-payload approval gates. All 45 saved packages, library index and real manifest were checked byte-identical.

Validation: full suite 515/515 in 29 files; subsequent preview integration 6/6 includes an additional real exhaustion/restart trace. Typecheck via both final builds, ESLint, formatting, 45-package validation, empty approved build/artifact separation and synthetic release gates pass. Tests include complete finite-domain sweeps with independent math/property oracles and a regression preventing premature simplest-form disclosure.

Browser execution and mock captures failed before scenarios started due sandbox EPERM (localhost/server and Chromium restrictions), including a final attempt of the six new practice scenarios. No fresh screenshots were captured/inspected; phone initial-prompt position, native zoom, actual devices and assistive technology remain unverified. The static mock was inspected in source only. Human content approval and production publication remain outstanding. No supervisor-service documents were used or changed.
