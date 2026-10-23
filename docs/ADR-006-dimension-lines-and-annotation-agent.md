# ADR 006: deterministic dimension lines with an author-side annotation agent

Status: accepted by the user's instruction of 2026-10-06 (hybrid deterministic and agentic design, LLM engine requested); implemented by Claude. Details, limits and verification are in `docs/dimension-lines.md`.

## Decision

Draw dimension lines, extension lines, arrowheads or ticks, and leaders with a pure, dependency-free layout engine (`src/ui/dimensions.ts`). Describe what may be shown as a catalogue derived from the mathematical model, with each feature marked given, unknown or derived. Let a language model choose among catalogue options, but only as author-side tooling, and only through a plan of references that a deterministic validator accepts or rejects. The learner build contains no model call.

## Consequences

- Numbers and wording come from the model of the lesson, never from the language model. The model is not told any numeric value.
- Added the official `@anthropic-ai/sdk` 0.131.0 as an exact-pinned **dev** dependency (six transitive packages). It is loaded only by the development-server plugin and tests, never bundled; the learner-artifact scan enforces that.
- The default model is `claude-opus-5-5` with low effort, structured output and `fallbacks: "default"`; override with `AURA_ANNOTATION_MODEL`. Credentials come from the environment or an `ant auth login` profile and are never stored in the repository.
- Packages may now carry `specification.annotations` for area-perimeter lessons (a reference-only plan). It is part of the canonical digest and so of review. No schema version change: it is a validated optional specification field within the existing area-perimeter capability, and packages without it are byte-identical to before.
- The development endpoint is loopback-only, header-guarded, same-origin, size- and rate-limited (see `docs/dimension-lines.md`).
- A live model call is unobserved. Until one is made, treat the model path as tested against fakes only.

## Rejected or deferred

- Calling a model from the learner runtime: rejected. It would break the static learner build, expose credentials, and put a fallible component between the model of the lesson and what the child sees.
- Letting the model write labels, numbers or coordinates: rejected. Hidden values could leak and wording would escape review.
- Adding a CAD or charting library: not needed for this scope (not surveyed).
- Dimension lines on fraction and angle diagrams: deferred on purpose; those diagrams' measurements are what the lessons ask learners to judge.
