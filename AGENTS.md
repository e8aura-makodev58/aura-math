# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `src/`: `core/` for shared contracts and session transitions, `topics/` for mathematical adapters, `content/` for versioned package validation, catalogue and generation, `annotation/` for diagram annotation plans, their validator and the author-side model proposer, and `ui/` for presentation (including the deterministic dimension-line engine). Tests live in `tests/`, architecture/status documents in `docs/`, and static assets in `assets/` (current illustrations are code-native SVG). JSON drafts live in `content/lessons/` and `content/generated/`; publisher-controlled review records live in `release/`. Separate `author.html` and `learner.html` entries support authoring and approved-content builds.

Environment-managed `.agents/`, `.aws/`, `.codex/`, and `.git/` directories must not be modified for application work. Read `handover.md`, `SOW.md`, and `curriculum-evidence.md` before changes. Ownership is coordinated in the handover.

## Build, Test, and Development Commands

Use Node.js 22.12+ and npm 10+. Exact commands are maintained in `README.md` and `package.json`: `npm ci`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e`, `npm run content:validate`, `npm run content:generate`, `npm run content:release`, `npm run build:learner`, and `npm run test:release`. Browser tests require Chromium; see README for installation and executable override.

## Coding Style & Naming Conventions

Use strict TypeScript with small pure domain modules. Prettier owns formatting and ESLint checks TypeScript source/tests. Run `npm run format` when changing code. Keep concrete topic imports out of the shared runtime; application composition registers adapters. Lesson content must be original and clearly draft until independently reviewed.

## Testing Guidelines

Use Vitest `*.test.ts` for validators and state transitions, and Playwright `browser.spec.ts` for complete interactions and responsive layout. Include malformed input, alternative selection orders, unsupported actions, hint/mode history and publication rejection. Do not describe tests as human curriculum review. Record actual execution and limitations in the handover.

## Commit & Pull Request Guidelines

Git history is unavailable in this workspace, so no existing commit convention can be verified. Use concise, imperative commit subjects, such as `Add initial project setup`. Keep changes focused.

Pull requests should explain the change, link relevant issues, and report validation performed. Include screenshots for visible interface changes. Explicitly state when tests could not be run and why.

## Security & Configuration

Keep credentials and local secrets out of committed files. Provide sanitized configuration examples when configuration is introduced. Model credentials for the optional annotation tool come only from the environment (`ANTHROPIC_API_KEY`) or an `ant auth login` profile, and model calls happen only in the development-server plugin; the learner build must contain no model code (`scripts/check-learner-artifact.mjs` enforces this).

## Library maintenance

After any change to `content/library.json`, run `node scripts/bind-library.mjs` so `release/manifest.json` carries the new digest; the release tests refuse a mismatch. Starter lessons for an author topic are written with `node scripts/emit-starter.mjs <topic-id>`. New topic families follow the pattern in `src/topics/p4-kit.ts` and need a runtime topic, an author capability, an accent colour pair in `src/p4.css`, an icon in `src/ui/visuals.ts`, independent test oracles and a browser check.

## Planning and Review Workflow

For each new planned phase, document the scope before implementation. Claude reviews once. Codex independently assesses each recommendation and records accept, modify, reject, or defer with rationale, then updates the plan and proceeds with implementation. Do not treat findings or severity labels as final decisions, and do not request a second Claude pass unless the user explicitly asks. Escalate only material unresolved decisions to the user. Human lesson-content approval remains separate from this engineering review.

`docs/visual-authoring-plan.md` and the earlier `docs/content-authoring-plan.md` are implemented; their single reviews and Codex dispositions are closed. `src/authoring/` owns edit transactions and author draft storage; `src/ui/lesson-view.ts` is the shared presentation. `handover.md` tracks ownership, validation and outstanding human/browser checks.


The library, layout and topic-expansion phase (`docs/library-and-topics-plan.md`, ADR-004) is implemented and verified as recorded in `docs/implementation-status.md`; `handover.md` has the resume notes, ownership and review findings. Browser tests need the system libraries described in `README.md`.

P4 preparation and typography are implemented under ADR-006 after single review R-64–R-74. The catalogue has 30 original drafts in 9 families; package v3 and application contract 3 coexist with unchanged v1/v2 reads. P2/P3 expansion is paused. `handover.md` records final validation and remaining human review.

P4 charts and nets (ADR-009, `docs/p4-charts-nets-*.md`) were added 2026-10-07 while Codex was unavailable: nets, pie charts and bar charts, 57 lessons in 16 topics. The dispositions were written by Claude as lead and still need Codex's independent assessment.

Remaining 2D manipulatives were implemented by Codex on 2026-10-10 after independent R-91–R-110 dispositions in `docs/codex-2d-manipulatives-plan.md`. Four protractor/symmetry drafts bring the current library to 64 lessons / 16 topics. The existing nets renderer remains three.js; 2D workbenches are lazy SVG/HTML. Saved manipulation history remains deferred. Handover records 750 unit/DOM checks and browser launch limitations; human approval remains separate. Earlier Claude-phase retrospective assessments are not silently closed.
