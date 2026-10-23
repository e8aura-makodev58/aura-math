# Dimension lines and the annotation agent

**Status:** implemented and verified 2026-10-06 by Claude while Codex was resting. **Not independently reviewed.** Written after the code, in one session, at the user's request; see "Review status" at the end. Authority: user instruction of 2026-10-06 (decision 18 in `handover.md`).

## The request

The user noticed that geometric shapes were drawn with loose text labels and no dimension lines (the L-shape showed "outer height 8 cm" as clipped text beside the shape, and the removed corner was described in words only). They asked whether deterministic libraries already handle this, and asked for a **hybrid of deterministic and agentic logic**, with an LLM engine added for the agentic part. They supplied the drafting vocabulary: dimension line (carries the measurement), extension lines (project from the object to the dimension line), arrowheads or ticks (mark the end points), and leader line (points from a note to a feature).

## Libraries: what was decided and why

No dimensioning library was added. The figures need a handful of axis-aligned linear dimensions with arrowheads, plus one leader. That is a small piece of pure geometry (about 400 lines including layout), it must run in the learner bundle with no new dependency, and it must give identical output every time so tests can assert exact positions. I did not evaluate specific CAD or charting packages, so this is a judgement about fit and risk, not a survey. The geometry lives in `src/ui/dimensions.ts` and can be replaced behind the same functions if a library is preferred later.

## Design: who does what

| Layer | Responsibility | Where | Deterministic? |
| --- | --- | --- | --- |
| Engine | Positions extension lines, dimension lines, arrowheads or ticks, labels and leaders; stacks nested dimensions in tiers and chains adjacent ones on one line; computes a viewBox that contains every annotation; detects label collisions; escapes text | `src/ui/dimensions.ts` | Yes. Pure functions, no browser font metrics |
| Catalogue | Lists what can be dimensioned on a figure, with end points per allowed side and a **disclosure** state (given, unknown, derived), derived from the mathematical model | `src/topics/area-perimeter-figure.ts` | Yes |
| Plan and validator | A plan is only references: feature id, side, `value` or `unknown`, plus note kinds and sides. The validator rejects unknown features, disallowed sides, any value shown for an unknown or derived feature, a "?" on a given one, missing needed dimensions, extra keys, duplicates, size limits and colliding labels | `src/annotation/plan.ts` | Yes |
| Default plan | Every given length with its value, every unknown or derived edge as "?" | `defaultAnnotationPlan` | Yes |
| Proposer (agentic) | Asks a model to choose a plan, validates it, sends the checker's errors back for up to three rounds, and otherwise returns the default plan | `src/annotation/proposer.ts` | Harness is deterministic; the model is not |
| Model call | Official Anthropic SDK, structured output, no forced tool use | `src/annotation/anthropic-call.ts` | No |
| Endpoint and panel | Development-server endpoint and the author's "Dimension lines" panel | `src/annotation/handler.ts`, `scripts/annotation-dev-plugin.ts`, `src/authoring/dimension-panel.ts` | n/a |

### Safety properties (each has a test)

- **The model never sees hidden values.** The prompt contains feature names, descriptions, disclosure states and allowed sides, and no numbers from the figure, so it cannot leak an answer and is not asked to do any mathematics.
- **The model cannot supply numbers, text or coordinates.** The response schema allows only enum references, and `validatePlan` re-checks everything; a plan with an extra `label` or `x` key is rejected.
- **A rejected plan never reaches the learner.** After the repair rounds the deterministic default is returned. The panel will not offer a fallback layout as a "suggestion".
- **Author-side only.** Nothing calls a model at learner runtime. The model request is made by the development server (`vite` serve mode only). The API key stays in that server process and is never in browser code. `scripts/check-learner-artifact.mjs` now fails if the learner build contains `__annotation`, `x-aura-annotation`, `Suggest a layout` or `api.anthropic.com`.
- **The endpoint is loopback-only.** `npm run dev` listens on all interfaces, and the endpoint spends the author's API credit, so it rejects any non-loopback source address, requests without the `x-aura-annotation: 1` header, cross-origin requests, bodies over 20 KB, more than one request at a time and more than 12 per minute. Verified against the real server: a request to the LAN address returns 403.
- **A stored layout is reviewed content.** A chosen layout is saved as `specification.annotations` in the package, so it changes the canonical digest and needs review like any other lesson content. It is applied through the normal undoable author command and raises no wording checks. If a later model edit makes it invalid (for example moving the removed corner), it is dropped and the automatic layout returns.

## What the learner sees

Area-perimeter diagrams (`missing-side`, `composite-area`, `composite-perimeter`, `practice`) now show: an overall width and height; the removed corner's width and height, with the removed corner as a dashed outline; edges the learner must find as "?" (the unknown side, or in the perimeter task the two outside edges beside the removed corner); and for the missing-side task the given area or perimeter as a note joined to the interior by a leader line with a dot. Unknown values are never drawn; the dimension is shown as "?".

## Deliberate limits

- **Only area-perimeter uses it so far.** Fractions and angle diagrams were not given dimension lines on purpose: a fraction rectangle's part widths and an angle's opening are exactly what those lessons ask the learner to judge, so labelling them would give the answer. If a lesson wants a labelled whole width only, add a catalogue entry for it.
- The model's freedom is narrow: which optional features to show and which side to put each on. That is by design, since numbers and wording stay deterministic, but it means the suggestion is a layout choice and not a new kind of diagram.
- Thin shapes (for example 30 by 3 cm) are legible but crowded; very small shapes are drawn larger (scale cap 30) so labels stay in proportion. Diagrams are not guaranteed to be to scale, and the unit scale differs between lessons.
- Only straight, axis-aligned linear dimensions exist. No angle dimensions, radius or diameter, or oblique dimensions; the engine supports oblique features geometrically but nothing uses them.
- The "²" glyph in the area note relies on the shipped font; it rendered correctly in the screenshots.

## Verification (2026-10-06)

- `tests/dimensions.test.ts` (14): exact engine geometry, determinism, tier nesting and chaining, viewBox fit, escaping, degenerate input, and a sweep over every task, corner, unknown side, known measure and seven sizes (including 2 by 2 and 30 by 30): default plans validate, never collide, and never draw a hidden value. The sweep exposed a real defect (chained vertical labels collided on small shapes); the engine now spaces vertical tiers by label width.
- `tests/annotation-agent.test.ts` (19): prompt and schema contents, repair loop, fallback, malformed replies, smuggled fields, SDK request shape (structured output, `fallbacks: "default"`, none of the parameters this model rejects), refusal, truncation and empty-reply handling, and the endpoint's security checks, limits and credentials handling.
- `tests/dimension-panel.test.ts` (9, jsdom): panel states, preview and apply, fallback not offered, server errors shown as text, and the model command (stored, undoable, no wording checks, invalid plan refused, stale plan dropped, reset).
- `tests/dimension-browser.spec.ts` (8, Chromium): extension lines, dimension lines and arrowheads present and unclipped at 390 and 1280 px for three lessons, no horizontal overflow, the missing side stays "?", and the author panel's states.
- Whole suite after the change: typecheck, lint, Prettier, **364 unit/DOM tests, 40 browser tests**, both builds and the learner-artifact scan pass. Screenshots are in `docs/screenshots/dimension-*.png`.
- Endpoint run against the real dev server: status works for loopback; missing header, cross-origin and LAN-address requests return 403; a proposal without credentials returns 503 with instructions; ordinary routes are unaffected.

## Not verified

- **No live model call has been made.** There are no API credentials in this environment (`ANTHROPIC_API_KEY` is unset and `ant` is not installed). The SDK request shape follows the bundled API reference and is tested against a fake client, and the full propose-check-repair path is tested with a mock model, but the first real response, the first real structured-output schema acceptance by the API, and the `fallbacks: "default"` header behaviour are unobserved. To try it: export `ANTHROPIC_API_KEY`, restart `npm run dev`, open the author workspace, a P4 measurement lesson, **Edit diagram**, then **Suggest a layout**. Set `AURA_ANNOTATION_MODEL` to change the model (default `claude-opus-5-5`).
- Cost: each suggestion is one to three small requests at low effort. No measurement exists.
- Assistive-technology behaviour: dimension layers are `aria-hidden`; the text alternative is the existing description of the shape, which already states the dimensions.
- Human mathematical and pedagogical review of the new diagram presentation, as for all lesson content.

## Review status

Per `AGENTS.md`, new phases are documented before implementation and reviewed once by Claude with Codex dispositions. Codex was resting, the user asked Claude to take over, and this feature was designed, built and documented by Claude in one session, so there has been no independent assessment. Claude should not count as the reviewer of its own work. Codex should assess it when it returns (suggested focus: the validator rules in `src/annotation/plan.ts`, the endpoint's security checks in `src/annotation/handler.ts`, the SDK request in `src/annotation/anthropic-call.ts`, and whether extending dimension lines to other topics is wanted).
