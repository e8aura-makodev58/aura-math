# ADR 004: library index, schema v2 and topic capabilities

Status: accepted and corrected by Codex 2026-10-05 after independently assessing Claude’s reconstruction, implementation changes and integration checks. It follows the single Claude review R-45–R-54 and Codex's recorded dispositions in `handover.md`.

## What exists

- **Schema versions.** `parsePackage` accepts exact v1 packages unchanged and v2 packages. v2 adds a `library` object (`level` P2|P3, `skillId`, `tags`). The display `lesson.level` must equal `"<library.level> candidate"`; validation rejects a mismatch (R-51). The six original comparison and angle lessons remain v1; the 12 new lessons are v2.
- **Migration and interpretation.** Editing a v1 package creates a v2 working copy; the original payload and grouped undo history remain intact. Equal-groups interpretations use canonical `groups` units, separate display group labels and task-dependent given/derived quantity states.
- **Library index.** Topics, skills, per-lesson `sequence` and `prerequisites` live in one separate file, `content/library.json`, validated by `validateLibraryIndex`. Ordering and prerequisite changes therefore change the index digest, not lesson digests, so reordering does not void lesson approvals (R-46).
- **Release binding.** `release/manifest.json` is schema 2 with `applicationContract` 2 and `library: { path, digest }`. `scripts/build-learner.mjs` checks the library path stays inside `content/`, recomputes the digest, and prunes the index to approved entries. Runtime verification rejects unused skills as well as unapproved lessons/topics, even when the subset hash is recomputed. Entries remain empty; there are no approved lessons.
- **Topic capabilities.** `src/topics/registry.ts` and `src/topics/capability.ts` hold runtime capabilities (adapter, spec and step validators, answer derivation, renderer, label). `src/authoring/registry.ts` and `src/authoring/topic-capability.ts` hold authoring capabilities (controls, wording, templates). The learner build imports only the runtime side (R-47); `scripts/check-learner-artifact.mjs` scans for author-only strings.
- **Topics and bounds.** `place-value` (integers 0–999, target place required for digit-value tasks, prompts and hints must name it, R-50), `equal-groups` (at least 2 groups, exact division), `fractions` (rectangle partitions with exact widths; accessible description gives part widths rather than labels, R-49), `picture-graphs` (scaled tasks use keys 2 or 5; no half symbols).
- **Library behaviour.** `src/library/catalogue.ts` builds records from the supplied catalogue only. `src/ui/library-view.ts` provides search, level and topic filters, hash routes with unknown IDs handled, and text-only rendering of the search query (regression test with a hostile query).
- **Tablet inspector.** Non-modal complementary panel from 768 to 1279 px with the canvas and header offset to stay visible; modal full-width dialog only below 768 px (R-53).

## Known limits

- Taxonomy labels and topic descriptions are covered by the separate index digest. Runtime headings and diagram rendering remain application code; changes need a recorded content-impact decision.
- Accessible descriptions that give measurements are an alternative reasoning route and need human accessibility and pedagogy review.
- Literal prose and reflection remain semantically unverified, as in ADR-002.
- Screenshots and automated fit checks are recorded in `docs/screenshots/` and `docs/implementation-status.md`; they do not establish human visual, accessibility or curriculum acceptance.
