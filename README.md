# Aura Math

An interactive Singapore primary maths development preview. Browse 64 pre-built draft lessons across 16 topic families, including 46 P4 lessons with five additional saved examples each (230 example drafts), with one shared lesson runtime, progressive hints, and independent or facilitator-guided use.

**Content is original and unreviewed. This is an author/development preview, not a published learner product.** No curriculum approval or learning-efficacy claim is made. Progress exists only in the current page session and disappears on reload; the preview stores no learner identity or progress.

## Run locally

Requires Node.js 22.12+ and npm 10+.

```sh
npm ci
npm run dev -- --port 5178
```

Open http://localhost:5178. The illustrated home groups starters by level, strand and topic. Choose a topic for its lesson list, or use search and **All lessons**. Assets are bundled locally; lessons require no model service, credentials, or backend.

## Validate

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser checks include all 30 lessons at phone/desktop widths and long-title author reflow. They save screenshots in `docs/screenshots/` and attach desktop captures to Playwright results. The browser suite starts Vite automatically on port 5180. Set `PLAYWRIGHT_BASE_URL` to test an already running server (the suite then starts none), or `PLAYWRIGHT_REUSE_SERVER=1` to reuse one on 5180. If Chromium is installed outside Playwright's default location, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

**Environment note (2026-10-05):** Playwright's Chromium needs the system libraries `libgbm1` and `libasound2`, which are not installed on this machine and cannot be installed without root. The browser suite ran by pointing the dynamic loader at copies already extracted for another project: `LD_LIBRARY_PATH=/home/makodev58/rendertest/libs/usr/lib/x86_64-linux-gnu npm run test:e2e`. That directory is outside this repository and may move; the lasting fix is `sudo apt install libgbm1 libasound2`. Without either, browser tests fail at launch with `libgbm.so.1: cannot open shared object file`.

```sh
npm run preview -- --port 4173
```

This serves the built development preview, not approved learner content. To format changes, run `npm run format`.

## Structure

- `src/core/`: shared types and pure lesson-session transitions.
- `src/topics/`: runtime topic capabilities; mathematical checks, diagrams and descriptions.
- `src/practice/`: development-preview P4 variation and temporary attempt evidence.
- `src/library/`, `content/library.json`: topic/skill catalogue, ordering and prerequisite metadata.
- `src/content/`: versioned package validation, catalogue and bounded generators.
- `content/lessons/`, `content/generated/`: original and generated draft JSON packages.
- `release/`: publisher-controlled review register, evidence and release manifest.
- `src/ui/lesson-view.ts`: shared learner and author lesson presentation.
- `src/authoring/`: edit transactions, template wording, undo/redo and device-local draft storage.
- `src/main.ts`, `src/author.ts`, styles: development preview and contextual author interface.
- `tests/`: unit and browser interaction checks.
- `docs/`: architecture decisions and implementation status.
- `assets/`: locally bundled fonts and licence notices; art uses SVG in code.

## Author lessons and generate drafts

Open http://localhost:5178/author.html (also linked from the development preview). Browse **Starter lessons** by topic, level or search, reopen **My drafts**, or choose **New lesson** to start from one of 30 task forms. Select **Edit** beside the task wording, diagram, question, choice or hint, then use the contextual text and model controls. The canvas uses the same presentation as the learner. **Try as learner** starts a fresh attempt in place; return to **Edit** to make changes. Undo/redo restores complete edits.

Model changes update mathematical answers and fixtures. Custom wording may need checking: review the affected blocks or inspect and apply a proposed wording replacement before trying or downloading the candidate. Changing which amount is missing requires the coherent replacement. Invalid inputs remain editable while the canvas retains the last valid model. These author checks do not grant human review approval.

**Save draft** stores a device-local copy, with a maximum of ten saved drafts and explicit deletion. With Web Locks available, opening a saved draft obtains an exclusive editing lock so subsequent saves can continue it. Otherwise, or if another tab holds the lock, saving creates a new copy and tells you. Storage failure leaves the current work in memory; download a valid lesson to keep it. Browser storage clearing removes local drafts. No learner progress is stored.

Use **My drafts** in the author library to reopen saved work, or **More → Files and saved drafts** in the editor to import JSON; invalid imports preserve the active draft. **Download lesson** exports the underlying JSON and **Review report** exports changes, digests and author-only assertions. Existing authors are read-only; enter a stable contributor ID in lesson details. Replace the existing source file for same-ID exports; archive older versions outside `content/lessons/` to avoid duplicate catalogue IDs. Source packages enter the preview catalogue automatically; indexed lessons are grouped by skill. Package v3 stores level, skill and tags (v1/v2 remain readable), while `content/library.json` stores navigation order and prerequisites. Editing a v1/v2 lesson promotes the working copy directly to v3; undo preserves the original. Geometry keeps its own specification.

```sh
npm run content:validate
npm run content:generate -- --seed 1 --out content/generated
npm run content:validate -- content/generated/generated-1-1.json
```

P4 lessons have an **Example 1 of 6** picker with Previous/Next buttons. A saved
example starts a fresh attempt, retains learning mode and has separate completion
evidence. Link directly with `#lesson/<parent-id>?example=3`. **Try another** on the
starter is a temporary preview variant; saved examples live in
`content/examples/p4/` and appear as read-only links in the parent author inspector.
They do not add library tiles or mixed-set slots. Each needs its own digest review.

```sh
npm run content:examples -- --check
npm run content:examples -- --lesson p4-read-protractor
```

The builder defaults to five new examples per P4 lesson, with deterministic spread
selection and automatic library digest binding after writes. `--check` writes
nothing and fails on package/link drift. `--force` replaces only unreviewed drafts;
reviewed digests are never overwritten. Some conceptual answers repeat because
their mathematical domain is finite; numbers, figures, data and orientations still
vary. See [ADR-010](docs/ADR-010-saved-p4-examples.md) for the limits.

A seed produces six reproducible, separate unapproved drafts, one for each original comparison/angle task form. The four new topic families currently use curated starters and visual authoring rather than seeded generation. Import generated files in the author workspace; they do not automatically become learner content. Generated output may replace existing files with the same seed/IDs in the selected output folder. No AI service is called. Plain-text semantic warnings remain visible because mathematical consistency cannot certify prose or teaching suitability.

## Review and learner build

```sh
npm run content:review -- content/lessons/ribbon-collection.json
npm run content:release
npm run build:learner
npm run test:release
node scripts/release-gate.test.mjs
```

`content:review` prints the exact digest, candidate identity and unresolved warnings without granting approval.

The trusted local `release/reviewers.json` and `release/reviews.json` are initially empty. The maintainer must verify actual independent mathematical and pedagogical human review and record exact package digests and warning dispositions. Manifest entries in `release/manifest.json` identify approved package paths, IDs, versions and SHA-256 digests. Manifest schema 2 also binds `content/library.json` by its canonical SHA-256 digest and requires application contract 3. Reordering changes the index digest without invalidating package approvals; the learner bundle receives only the approved subset of topics and skills. The tools check these records; they cannot authenticate a person's identity. See [ADR 002](docs/ADR-002-content-and-release.md) for the format and trust boundary.

`build:learner` writes a separate `dist-learner/learner.html` artifact containing only release-listed lessons. With the current empty manifest it shows “Your lessons are on their way.” The default `build` still builds the development and author previews in `dist/`. `test:release` builds the learner artifact and scans it for author-code/draft leakage; the integration script uses temporary synthetic reviews and never changes the real register.

This phase advances the SOW content/runtime work; persistence, human approval, browser/device/accessibility verification and observed learner pilot remain outstanding. See [implementation status](docs/implementation-status.md). Do not copy third-party exam questions into lesson content.

## P4 revision and typography

Choose **P4 revision adventures** on the home page for twelve original draft lessons: four each in decimals, fraction calculations, and area/perimeter. Try the three-question mixed set or choose a skill. These are general revision candidates, not confirmed school assessment coverage. Further P2/P3 expansion is paused; existing lessons remain available.

Exact inputs accept equivalent decimals/fractions; malformed input does not count as an assessed attempt. **For adults: reveal worked solutions** displays authored steps and records support. Content is still awaiting independent human review. Session completion is not saved.

Outfit headings and Atkinson Hyperlegible Next body text are self-hosted, with the existing colours preserved. Font licences are linked in the app; provenance and repeatable glyph checks are in [assets/fonts/README.md](assets/fonts/README.md). Architecture: [ADR-006](docs/ADR-006-p4-exact-content.md).

## Dimension lines and the optional suggestion tool

Area and perimeter diagrams are drawn with engineering-style dimensioning: dimension lines with arrowheads, extension lines, a dashed outline for the removed corner, "?" on lengths the learner must find, and a leader line for a given measure. This is deterministic code (`src/ui/dimensions.ts`) and needs nothing to run. See [dimension lines](docs/dimension-lines.md) and [ADR 006](docs/ADR-006-dimension-lines-and-annotation-agent.md).

Authors can also ask a language model to suggest which dimensions to show and on which side. This is optional, **author-side only** and runs from the development server; the learner build contains no model call and no key. Every suggestion is checked by a deterministic validator and can never show a hidden value (the model is never told any numeric value).

To try it (a live call has not yet been made in this repository):

```sh
export ANTHROPIC_API_KEY=...   # or run `ant auth login`; never commit a key
npm run dev
```

Open `/author.html`, open a P4 measurement lesson, choose **Edit diagram**, then **Suggest a layout** in the "Dimension lines" section. Set `AURA_ANNOTATION_MODEL` to use a model other than the default `claude-opus-5-5`. The endpoint accepts only requests from this computer, because `npm run dev` listens on all network interfaces.

## P4 topics and the home page

The library has 16 topics and 57 lessons. Primary 4 covers whole numbers, decimals, fraction calculations, area and perimeter, angle measure, symmetry, line graphs, bar charts (a Primary 3 bridge), pie charts and nets of solids (all drafts for review; levels for pie charts and nets are unconfirmed). The home page shows one level at a time, groups topics by strand, and features one lesson each day ("Today's spotlight", chosen from the local date, with nothing stored).

After changing `content/library.json`, rebind its digest: `node scripts/bind-library.mjs`. To write a topic's starter lessons as data files: `node scripts/emit-starter.mjs <topic-id>` (it will not overwrite without `--force`). See [the expansion plan](docs/p4-expansion-plan.md) and [ADR 007](docs/ADR-007-p4-families-and-home.md).

## Playful P4 lessons and fresh examples

Open **Decimals → Line up decimal units** (`/#lesson/p4-decimal-add-subtract`) for the new decimal workbench: visual alignment choices, equal-place columns and an explicit regrouping demonstration when the matching hint is requested. **Fraction calculations → Combine equal fraction parts** has equal-whole strips and a common-partition workbench. Other P4 lessons receive the compact styling while keeping their topic diagrams.

After completing any of the four decimal or four fraction-calculation starters, choose **Try another · same skill** for a different example generated locally without an LLM. The operation and skill constraints stay fixed. **Try this example again** replays the same values; **Next mixed question** advances the mixed set. Hints and answers start fresh, and the selected learning mode carries forward. Small sets can exhaust; restart is explicit.

**This practice session** retains the latest 20 attempt summaries in memory, distinguishing original, generated and repeated examples and support used. Refresh clears it and returns to the original lesson. Generated completions do not overwrite the original lesson's completion record. No learner identifiers or durable storage are added.

Generation is only in the development preview for recognised canonical starters. Author trials retain frozen edited content and have no generation control. The approved learner artifact has no generator; exact-package publication checks remain unchanged. The current release still has zero approved lessons. See [implementation plan and outcome](docs/playful-p4-practice-plan.md) and [ADR 008](docs/ADR-008-playful-p4-practice.md). Browser/layout verification for this phase is blocked by sandbox EPERM; DOM checks and builds are not a visual audit.

## Hands-on P4 lessons

Nets have the existing 3D folder. Angle measure now includes **Line it up, then read** and **Build an angle, then reason**; Symmetry includes **Place the mirror** and **Shade the other half**. Authors create these through the topic forms and edit the learner-view preview; JSON remains the storage format.

See [Codex's remaining-workbench scope and review decisions](docs/codex-2d-manipulatives-plan.md). These are draft lessons. Protractor alignment and construction are practice; submitted readings/derived answers are checked. Symmetry reflection previews require a requested hint. No manipulation history is saved. New unit/DOM checks pass; Chromium browser launches were blocked by this session's sandbox, so new visual/device checks remain outstanding.
