# P4 deterministic variation proposal

Status: supporting generation specification, 2026-10-06. The user waived Claude's review for this phase and authorised implementation; the lead coordinates integration. The generator implementation notes below distinguish delivered domain work from pending UI and publication. No human content approval is implied.

## Observed baseline

Source inspection found 27 P4 JSON packages among 45 lessons. `src/content/generation.ts` implements `bounded-v1`, a seeded uint32 generator for the six original comparison/angle packages, not P4 runtime variation. `src/authoring/decimals.ts` and `src/authoring/fraction-calculations.ts` already build wording, steps and answers from mathematical specifications. Their private rewrite/template functions are author capabilities, not a learner generation API. Importing those modules into the learner is explicitly excluded.

`src/topics/decimals.ts`, `src/topics/fraction-calculations.ts` and `src/topics/exact.ts` implement bounded specifications, exact arithmetic, model-derived answers, displays and interpretation for contextual practice. `src/content/package-validation.ts` validates supported step sequences, model answers, fixtures and canonical interpretation equality. Its own comment correctly says that structural/model consistency does not prove prose meaning. Current generated provenance supports only generator version and uint32 seed; template approval and variant identity are separate contract work, not fields that can silently be added to existing packages.

## Proposed delivery sequence and per-lesson coverage

No P4 lesson currently provides runtime Try another. “First slice” below means proposed delivery, not an existing capability. Decimal calculation is the first complete UX/generation vertical slice; the other decimal forms follow using the same validated infrastructure. Bounded fractions are the next increment within the plan. No simultaneous expansion of P2/P3 or the other P4 families.

| Existing P4 lesson ID        | Proposed variation coverage  | Skill retained / reason for deferral                                                                 |
| ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `p4-decimal-add-subtract`    | First decimal vertical slice | Subtraction; whole-to-tenths regrouping, no hundredths borrowing                                     |
| `p4-decimal-multiply-divide` | Decimal follow-on            | Exact division by a one-digit whole number; inverse check                                            |
| `p4-decimal-places`          | Decimal follow-on            | Thousandths digit value, internal zero, comparison decided at hundredths                             |
| `p4-decimal-practice`        | Decimal follow-on            | Equal pieces: multiplication then subtraction; positive length remaining                             |
| `p4-mixed-and-improper`      | Bounded fraction increment   | Mixed-to-improper conversion; same whole-count/partition difficulty                                  |
| `p4-fraction-add-subtract`   | Bounded fraction increment   | Subtraction with related unequal denominators and a reducible result                                 |
| `p4-fraction-of-quantity`    | Bounded fraction increment   | Exact integer partition, then named fraction of a set                                                |
| `p4-fraction-practice`       | Bounded fraction increment   | Exact fraction used, then whole-set remainder                                                        |
| `p4-composite-area`          | Deferred                     | Shape constraints, hidden dimensions, annotations and method coverage need separate generator review |
| `p4-composite-perimeter`     | Deferred                     | Boundary reasoning and shortcut alternatives need separate generator review                          |
| `p4-measurement-practice`    | Deferred                     | Missing-side-to-perimeter dependency and disclosure need separate generator review                   |
| `p4-rectangle-missing-side`  | Deferred                     | Exact inverse geometry, units and dimension disclosure need separate generator review                |
| `p4-place-value-100k`        | Deferred                     | New whole-number signature/builder scope beyond this arithmetic slice                                |
| `p4-rounding`                | Deferred                     | Tie thresholds and rounding-place difficulty require a distinct profile                              |
| `p4-factors`                 | Deferred                     | Factor-set size and multi-selection difficulty require a distinct profile                            |
| `p4-estimate-by-rounding`    | Deferred                     | Estimation is a separate objective, not decimal exact calculation                                    |
| `p4-read-line-graph`         | Deferred                     | Axis-scale/read-off/text-alternative disclosure require separate design                              |
| `p4-line-graph-change`       | Deferred                     | Data direction, sign and change interpretation require separate design                               |
| `p4-line-graph-target`       | Deferred                     | Threshold membership/selection difficulty require separate design                                    |
| `p4-line-graph-practice`     | Deferred                     | Coherent data/story/axis generation requires separate design                                         |
| `p4-lines-of-symmetry`       | Deferred                     | Structural geometry rather than number substitution                                                  |
| `p4-symmetric-figure`        | Deferred                     | Reflection topology and selection alternatives need separate design                                  |
| `p4-symmetry-practice`       | Deferred                     | Shape invariants and completion/classification need separate design                                  |
| `p4-read-protractor`         | Deferred                     | Readability and dual-scale distractor generation need separate design                                |
| `p4-estimate-then-measure`   | Deferred                     | Estimation bands and rendered geometry need separate design                                          |
| `p4-turns`                   | Deferred                     | Direction/orientation/state transitions need separate design                                         |
| `p4-angle-practice`          | Deferred                     | Angle reading plus turn reasoning need separate design                                               |

The generator must never advertise unsupported lessons as varied. No operation changes, difficulty increases or automatic hint fading in this first slice. Those are explicit future features, not implied by another independently correct example. Correct structured reflection remains evidence of recognition, not proof of reasoning or mastery.

## Skill profiles and precise mathematical bounds

All following bounds are proposed narrower instructional subsets of the existing validators. Preserve objective, operation, response kinds and goal sequence. Only explicitly registered canonical starter packages are eligible; author-custom drafts are ineligible initially. Do not infer a skill profile from a title or accept an edited package solely because its ID matches a supported ID: supported profiles must be explicitly registered and the base digest/specification checked.

### Decimal subtraction: first slice

Represent operands as integer hundredths `A` and `B`; `a=A/100`, `b=B/100`. Choose A's whole digit in2–9, B's whole digit in1..min(3,A's whole digit−1), A's tenths digit in0–8, B's tenths digit strictly above A's in1–9, A's hundredths digit in1–9 and B's hundredths zero. This finite domain has8,505 tuples before excluding the base. Whole parts stay one digit; both operands are non-whole. This preserves the current 7.25 − 2.60 pattern: no hundredths borrowing, one whole exchanged for ten tenths. A's represented scale is 2; B's scale is 1. The result is positive by construction.

For the general profile detector, define `hundredthsBorrow = A%10 < B%10`. Define `tenthsBorrow = floor(A/10)%10 - Number(hundredthsBorrow) < floor(B/10)%10`. Borrowing through zero occurs when hundredthsBorrow is true and A's tenths digit is zero. Integer-part borrowing chains are out of scope. Never mix those signatures under a same-difficulty button.

Independently checked example: 8.14 − 3.70 = 4.44, because 814 − 370 = 444 hundredths. The tenths column requires exchanging one whole; hundredths 4 − 0 needs no exchange. This is a different numeric example of the base skill. Addition, no-regrouping subtraction, hundredths-only and through-zero subtraction remain deferred profiles even though the adapter accepts them.

### Other decimal forms

- **Exact division:** divisor `k` in 2–9, quotient `Q` in 1–9 tenths, dividend coefficient in tenths `C=k*Q`; require `C >= 10` and `C % 10 != 0`, as the base has a non-whole dividend greater than one. Store `a={coefficient:C,scale:1}`. This constructs exactness rather than hoping a randomly sampled dividend divides: the hundredths coefficient `10*C` is divisible by k. Example 3.6 ÷ 4 = 0.9; inverse 0.9 × 4 = 3.6. Divisor 1, repeating results and answers requiring more than one decimal place are excluded. Multiplication is deferred as a separate profile.
- **Decimal places:** keep target thousandths. Choose common whole digit W in 1–9 and common tenths digit T in 1–9. Let A's hundredths digit be zero and thousandths digit Z in 1–9; choose B's hundredths H in 1–9 and no written thousandths. Store A at scale3 and B at scale2. Example 6.208 versus 6.24: digit value 0.008, B greater, with comparison decided at hundredths. This keeps the current internal-zero and unequal-written-length challenge. Varying which value is greater, ties or target place is a separate profile.
- **Contextual decimal practice:** keep cord/metres and four pieces; choose piece hundredths coefficient B in {25,75,125,175,225}. Thus used amount U=4B is an exact positive whole number of metres. Choose available amount A at scale1, from 1.1–9.9 m, excluding whole values, strictly above U/100. This preserves the current two-operation pattern without introducing subtraction regrouping: used fractional digits are zero. Example available 8.7 m, four pieces of 1.75 m: used 7 m, remaining 1.7 m. Base 9.5 − 4×1.25 = 4.5 is checked independently. Keep the unit/context fixed; arbitrary unit or story switching is excluded.

Existing broad decimal validation permits places values up to 999.999, arithmetic operands up to 999.99, factors1–9 and nonnegative exact results up to9999.99. Those are safety limits, not the proposed same-difficulty distribution.

### Bounded fractions, subsequent increment

- **Mixed/improper:** whole count fixed at2 initially; denominator in3–6, proper numerator1..d−1, coprime numerator/denominator. Keep other irrelevant specification fields fixed and valid. Example 2 4/5 =14/5; full strips contribute10 fifths. Larger strip counts, reverse conversion and reducible given fractions are separate profiles.
- **Add/subtract:** subtract only, larger first denominator D in{4,6,8,10,12}; second denominator D/2. Proper numerators N and M; require R=N−2M strictly between0 and D and `gcd(R,D)>1` so simplify is a real task. Both input fractions must be in simplest form. Example 7/10 −1/5 =5/10 =1/2. Equal denominators, unrelated denominators, zero/negative results, addition and sums above a whole are excluded here. This retains the current 5/6 −1/3 =3/6 =1/2 signature.
- **Of quantity:** keep fraction3/4 initially and choose quantity `4q`, q in4–10, giving totals16–40. Example 3/4 of36 counters: one part9, named fraction27. Keep the unit counters; numerator/denominator variation would change cognitive load and follows only as reviewed profiles.
- **Fraction practice:** keep fraction3/4 and stickers; total `4q`, q in4–10. Example 3/4 of28 used is21, leaving7. The unknown remains remaining, not taken.

Existing validator permits denominator2–12, proper numerators, whole part0–9 (mixed needs >=1), totals1–120 exactly divisible by denominator, and equal or divisibility-related denominators. Narrow profiles are deliberate. Every fraction quantity is integral by construction, not rounded; every story still refers to one equal-sized whole/set.

## Proposed generator and coherent content boundary

1. Select a registered skill profile for the validated base. Version the profile, bounds and wording together.
2. Select a parameter tuple using a fixed seeded algorithm; no LLM, date dependence, arbitrary uploads or blind textual substitution.
3. Build the complete question/steps/hints/choices from template-specific deterministic wording builders and the model; those builders remain draft teaching content pending human review. Extract reusable pure builders into a content module, then have author rewrite and main development-preview generation share them. Do not import `src/authoring/`, storage, author registries or the existing catalogue-wide generator into the approved learner runtime. Author frozen trials offer no generation control in this first phase.
4. Derive answers, worked steps and model-specific text descriptions/diagrams from the same parameters. Contextual packages rebuild interpretation quantities, operation chain and exact source spans from the new story; they never retain stale spans from the base. Preserve four hint rungs and explicit reveal/support semantics.
5. Deterministically permute opaque choice IDs/order with an independently derived choice seed; remap answers and choice-referencing hints/fixtures atomically. Numeric ordering, where pedagogically meaningful, takes precedence over shuffling. Do not confuse new option IDs with a new mathematical variant.
6. Build accepted fixtures, including applicable equivalent answers, and rejected parseable values guaranteed distinct from the answer. Do not copy fixed `9999` distractors without checking collisions. For simplest-form steps include an equivalent unreduced incorrect response. Generated fixtures are consistency checks, not independent oracles or human review.
7. Validate the entire generated package and profile invariants before mounting it. Treat validation failure as unavailable generation, never partial success. Keep the authored base immutable.

No generated variant inherits an `approved` status simply by cloning a package. Variants remain drafts and generation is available only in the main development preview, not author frozen trials. For this phase, generation and its controls are excluded from the approved learner artifact altogether, as specified in the lead plan. Reusable pure model/teaching builders may be learner-safe, but the preview generation entry point and domain registry must not be pulled into that build. Future learner availability needs separate release/approval design; existing exact-payload release approval cannot silently authorise runtime-modified content.

## Reproducibility, deduplication and failure behaviour

Proposed replay envelope outside current package fields: base package digest, skill-profile ID/version, builder/generator version, root uint32 seed, variant ordinal and canonical parameter tuple. These are mathematical/session identifiers, not learner identity. Same envelope must reproduce wording, choices, hints, fixtures and parameters. Changing code/bounds requires a new generator/profile version; a seed alone is insufficient. Manual seed input is not a learner requirement.

The proposed profiles have small finite domains. Enumerate allowed tuples in a documented stable order, exclude the base's normalized mathematical tuple, then use a seeded permutation to visit each tuple once per practice run. Domain enumeration must use integer arithmetic. A capped domain limit of10,000 tuples per profile is proposed; reject an overlarge or empty registered domain instead of running an unbounded sampler. Permutation uses a fixed PRNG and documented shuffle; choice randomness is a separate stream so presentation changes cannot change numeric sequence.

Fingerprint the normalized task/profile and meaningful operands, excluding choice IDs, unused fields and textual trailing zeros. Therefore 2.60 and2.6 are the same example. Keep used fingerprints for the current in-memory run. No promise of cross-device or post-reload deduplication until persistence is separately implemented. Exhaustion returns a typed `exhausted` result and shows that all examples in this set were tried; allow explicit restart of the set or return to the library. Never silently repeat or silently loosen difficulty. Restart does not erase prior recorded attempt summaries while the run remains alive.

If a domain tuple fails full validation, return a typed `invalid` result with an author diagnostic and a short learner recovery message. Retry budget is explicitly zero resampling attempts: each click builds at most one tuple after domain enumeration, so a defect fails visibly instead of searching for a passing tuple. The user can retry a transient presentation failure, but a deterministic invalid tuple must remain invalid. Unknown profile/base mismatch returns `unsupported`; invalid seed/ordinal returns `invalid-request`. Generator failures do not count as learner incorrect responses. The existing lesson and its completion remain intact until a complete successor is ready.

## Input and attempt isolation

Retrying a wrong answer retains the current variant and current attempt/support history. Completion's Try this example again starts a fresh attempt on the same variant. Try another creates a new variant instance/attempt with empty input, untouched topic state, first mandatory step active and no carried-over hint or reveal activation. Preserve previous attempts/support summaries; never relabel supported work independent. Do not reuse the base lesson ID as the only attempt key: identity must include base version/digest and variant instance. Retain current guided/independent mode and mark a new guided attempt as facilitator-supported immediately.

Only a completed lesson initially offers Try another. Construct/validate before destroying the current session; commit exactly once. Disable/debounce activation during that commit, invalidate old-session callbacks, scope input and choice IDs to the new instance, and make back navigation/return safe. An old answer or late event must never assess the new specification. Reload replay/persistence behaviour is the contracts proposal's responsibility; do not imply saved progress exists today.

## Verification to perform after review and implementation

No application tests were run for this documentation-only task. Proposed verification:

- Exhaustively inspect each bounded domain with independent integer/rational oracles, comparing subtraction borrow signature, division exactness, fraction partitions and simplified results. Golden examples above are arithmetic cross-checks done during planning, not executed tests.
- Fixed replay vectors for multiple seeds/ordinals; equivalent decimal tuple deduplication; base exclusion; every tuple visited once; deterministic exhaustion; zero/empty/over-limit domains; invalid envelope; invalid generated wording/interpretation; unsupported edited base.
- Cross-check every generated display, prompt, hint rung4, answer, accepted/rejected fixture and source span against model parameters. Include text-free model assertions and independently authored golden wording assertions so builder/validator agreement cannot hide a shared mistake.
- Verify decimal equivalent syntax, malformed inputs, fraction equivalents and unreduced simplest-form rejection; both choice orders and every meaning remain assessable.
- Browser sequence: complete base with hints, Try another, verify empty answer/new numbers/no completion or hint carry-over, complete without support, check distinct summaries; repeated fast activation; late old-session submission; mode switches; keyboard focus; narrow phone display; return/library and exhausted-set recovery.
- Run typecheck, lint, formatting, unit/domain tests, scoped browser flows, package validation and release/artifact gates. Ensure learner artifact excludes author/model SDK modules and unpublished variants. Preserve all original package bytes and release manifest unless deliberately changed under the reviewed contracts work.

Open curriculum limitation: sources already recorded in `curriculum-evidence.md` and `docs/p4-curriculum-evidence.md` support general revision planning, not school-specific Term4 coverage or human approval. No external source was fetched for this code-grounded generation proposal.

## Generator implementation handoff

Implemented `src/practice/generation.ts` and extracted pure decimal/fraction teaching builders into `src/content/p4-decimal-builder.ts` and `src/content/p4-fraction-builder.ts`; the author capabilities reuse them. Saved JSON files were not changed. The generator recognises exact canonical payload equality against the saved catalogue and additionally checks each source's explicit skill signature. This recognition establishes engineering eligibility only, never approval. Repository changes to a starter cannot silently switch subtraction to addition, change the intended fraction, or broaden difficulty under the same ID.

The subtraction domain deliberately caps B's whole digit at 3, as specified above, giving 8,505 valid tuples before base exclusion. Other domains also stay below 10,000. `next()` validates a complete package before returning it and does not advance after invalid construction; `restart()` replays the same sequence with a fresh instance nonce. Generation has no author import, LLM call, persistence, or learner-entry integration.

Descriptors currently contain source ID/version, profile/generator version, seed, ordinal, mathematical fingerprint and instance ID. No source SHA digest was added to the synchronous API: exact canonical matching is against the current build's saved source. Replaying a historical teaching payload across changed builds requires retaining its original canonical source and builder version, not merely the descriptor. Numeric tuples and choice order reproduce across runs; instance IDs intentionally differ to isolate session state. This is temporary preview replay, not an archival reproducibility or durable progress feature.

The generator tests sweep every tuple using independent integer/rational predicates, test base exclusion, replay and exhaustion, custom-source rejection, a future catalogue change with unchanged IDs, defensive copying, and invalid-candidate non-advancement. The lead records final aggregate validation and UI integration in the handover; the earlier documentation-only verification paragraph describes the planning session, not a claim that tests remain unrun after implementation.
