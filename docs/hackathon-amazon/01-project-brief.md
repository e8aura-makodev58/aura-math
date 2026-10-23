# 01 — Project brief and status (Fire TV track)

**Date of this status:** 2026-10-23. **Submission deadline:** 2026-10-23 12:00 PT.

## Mission

Adapt Aura Math's existing lesson engine into a TV-first learning screen that a family can use on a
Fire TV with the remote. The Fire TV app lives in `fire-tv/`.

## Status at a glance

| Area | Status | Evidence level |
|---|---|---|
| Existing web app preserved (typecheck, lint, 1,783 unit tests, production build) | Done | Executed on this machine, see 04 |
| Fire TV app: home, topics, lessons, question, feedback, hints, summary | Built as JavaScript | Type-checked, linted, unit/render tested, bundled, compiled to Hermes bytecode |
| Remote navigation (Up/Down/Left/Right, OK, BACK, MENU hint) | Implemented and unit tested | Simulated key events only; **not physically verified** |
| Shared engine reuse (`src/core`, pure topic adapters, lesson JSON) | Done | Integration test completes all 17 TV lessons through the shared runtime |
| Vega native package (`vega build`, `.vpkg`) | **Not done** | VDK download host blocked (403) |
| Run in Vega Virtual Device or on a Fire TV | **Not done** | No `/dev/kvm`; no device |
| Demo video | **Not done** | Requires a running device or simulator |

## What the app does

- Lets a learner pick a topic, a lesson, then answer questions one at a time using the remote.
- Uses the same deterministic checks as the web app (`src/topics/*`); no LLM is involved.
- Shows the draft label on the home screen, matching the web app's disclaimer that content is
  original and not yet teacher-reviewed.

## Scope limits

- 17 of 64 lessons run on the TV. These are the lessons whose steps are only `choice` or `number`
  and whose topic has a pure adapter. Lessons with `exact` or `multi` steps are excluded.
- Six of the twelve imported adapters have no runnable TV lessons (decimals, whole-numbers,
  fraction-calculations, line-graphs, pie-charts, bar-charts): all of their lessons use `exact`
  steps. They are wired in `fire-tv/src/engine/adapters.ts` ready for when that input exists.
- No progress is saved between launches; nothing is sent over the network.

## Open items

1. **Vega SDK access.** developer.amazon.com returns a policy 403 from this environment. The VDK
   (the `vega` CLI under `KEPLER_SDK_PATH`) is needed for `build-vega` and `vega run-app`.
2. **Device or simulator run.** Requires either a Fire TV device or a Vega Virtual Device on a host
   with KVM. Neither is available in this environment.
3. **Aura Math web source in the repository.** The repository was empty (only LICENSE) when this
   work started. The web app source arrived on `origin/main` (commit `f5716e4`) during the session
   and was merged fast-forward into the working branch.
