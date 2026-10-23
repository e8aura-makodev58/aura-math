# ADR 007: P4 expansion families and the two-level home page

Status: accepted by the user's instruction of 2026-10-06 (expand the P4 library, group lessons into topics, add a daily feature, make the page modern and fun); implemented by Claude. Details: `docs/p4-expansion-plan.md`.

## Decisions

- **Four new families** share one kit (`src/topics/p4-kit.ts`): step builders, opaque rotated choice ids (rotation can be switched off for ordered options such as days or line letters), exact whole-number parsing, an adapter factory, fixtures and the package builder. Each family keeps its own runtime topic (`src/topics/<family>.ts`) and author capability (`src/authoring/<family>.ts`), and the learner build imports only the runtime side.
- **Answers come from models and exact arithmetic.** Symmetry uses an integer reflection test with no tolerance, checked in tests against a brute-force enumeration of lattice lines. The protractor and compass drawings are checked in tests by reading the drawn arms and arcs back from the SVG. Line-graph and whole-number answers are checked against separately written oracles over many generated inputs.
- **No schema or contract bump.** New topics only needed listing in the schema 3 topic list.
- **Home page:** a level switch (Primary 4 default), strand groups in teaching order, a deterministic daily spotlight, compact phone tiles. The spotlight is a pure function of the local date and the lessons on show, with no storage. Route state gains an optional `tab` parameter (`p4` or `p23`, anything else ignored).
- **Tooling:** `scripts/emit-starter.mjs <topic>` writes a topic's starter lessons as JSON data files (it refuses to overwrite without `--force` and refuses invalid packages). `scripts/bind-library.mjs` recomputes the library index digest into `release/manifest.json`; run it after any change to `content/library.json`.

## Consequences and limits

- Starter lessons are data files generated from templates; hand edits to a JSON file are overwritten if the starter is re-emitted with `--force`.
- Accessible descriptions: line graphs list their data (the readings), which a sighted learner does not see; symmetry and protractor descriptions describe positions without saying which lines are symmetric or what the reading is. This is an alternative reasoning route and needs human accessibility review.
- Colour accents for all thirteen topics were checked numerically: accent text on its tile surface is at least 5.3:1.
- The dormant LLM annotation tool from 2026-10-06 is unaffected and set aside at the user's request.
