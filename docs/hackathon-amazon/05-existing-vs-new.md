# 05 — Existing Aura Math versus new Fire TV work

## Existing (not written during the hackathon window)

| Item | Where | Origin |
|---|---|---|
| Web app (Vite, DOM views, workbenches, authoring tools, admin server) | `src/`, `index.html`, `author.html`, `admin.html`, `scripts/` | Commits `017752c` ("Import aura-math project") and `f5716e4` ("Merge remote main into local project import") on `origin/main`. Existing project work, not authored in this session. |
| Pure engine `src/core/*` | `src/core/types.ts`, `src/core/runtime.ts` | Existing; reused unchanged |
| Pure topic adapters and mathematical checks | `src/topics/*` (subset used) | Existing; reused unchanged |
| Lesson content, 64 drafts | `content/lessons/*.json` | Existing; read-only use |
| Colour palette | `src/styles.css` | Existing; values copied into `fire-tv/src/theme.ts` |
| Repository licence | `LICENSE` (MIT, 2026) | Existing |

## New (Fire TV work in this session)

| Item | Path | Notes |
|---|---|---|
| Fire TV application | `fire-tv/` | New Vega React Native app |
| TV engine: catalogue, remote mapping, digit picker, navigation, summary | `fire-tv/src/engine/*` | New code calling existing runtime |
| TV topic adapter map | `fire-tv/src/engine/adapters.ts` | New; uses existing adapters |
| TV screens and focus components | `fire-tv/src/App.tsx`, `fire-tv/src/screens/*`, `fire-tv/src/components/*`, `fire-tv/src/theme.ts` | New |
| Lesson snapshot generator and generated file | `fire-tv/scripts/build-lesson-index.js`, `fire-tv/src/generated/lessons.json` | New tooling; the JSON is generated from existing content |
| Build scripts | `fire-tv/scripts/build-bundle.js`, `fire-tv/scripts/compile-hermes.js` | New |
| Metro, Babel, TypeScript, ESLint, Jest configuration | `fire-tv/metro.config.js`, `babel.config.js`, `tsconfig.json`, `eslint.config.mjs`, `package.json` | New |
| Tests | `fire-tv/__tests__/**` | New: 63 tests |
| Documentation | `fire-tv/README.md`, `docs/hackathon-amazon/*` | New |

## Git history for the hackathon work

The commit list is recorded in `10-submission-checklist.md`, under "Repository", once the commits are
pushed. Commits from before the hackathon window are the three listed above, plus the initial
licence commit `2f8177e`.
