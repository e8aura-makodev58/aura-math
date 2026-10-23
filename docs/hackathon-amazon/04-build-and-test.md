# 04 — Build and test record

All commands were run from the repository, on the date noted. Output was summarised; nothing here is
inferred from a previous run.

## Existing web app (`/home/user/aura-math`, branch `claude/affectionate-edison-5fduyr`)

| Command | Result |
|---|---|
| `npm ci` (with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | 49 files, **1,783 tests passed** |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (Vite warns about chunk size; pre-existing) |

Browser tests (`npm run test:e2e`) were **not run** in this session. The README records that Chromium
needs system libraries that were missing on the earlier development machine.

## Fire TV app (`/home/user/aura-math/fire-tv`)

| Command | Result |
|---|---|
| `npm install` | 545 packages (first install); exit 0 |
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npm run lint` (ESLint 9, typescript-eslint) | exit 0 |
| `npm test` (Jest, 5 suites) | **63 tests passed** (see breakdown) |
| `npm run bundle` | exit 0 → `build/index.bundle` (1,326,809 bytes) |
| `npm run hermes` | exit 0 → `build/index.hbc` (Hermes bytecode v98); 17 warnings, 0 errors |
| `npm run check` (typecheck + lint + test) | exit 0 |

Test breakdown:

| Suite | Tests | What it proves |
|---|---|---|
| `__tests__/remote.test.ts` | 11 | Key-down mapping; key-up ignored; unknown keys ignored |
| `__tests__/digits.test.ts` | 4 | Digit wrap-around; cursor clamping; leading zeros |
| `__tests__/navigation.test.ts` | 12 | Edge clamping; grid moves; screen flow; choice answers; wrong answer keeps the step open; Back |
| `__tests__/lessons.test.ts` | 34 | For each of the 17 TV lessons: all steps completed through the shared core runtime using each topic's own answer oracle, and a wrong first answer is rejected |
| `__tests__/render/App.render.test.tsx` | 2 | The real `App` renders branding and the draft notice; select-key presses move from home to a question with feedback |

The render test uses the Vega fork's Jest preset, with its native mocks and the TV input hook replaced.

## What this evidence does and does not show

| Level | Status |
|---|---|
| Static analysis (typecheck, lint) | **Passed** |
| Unit tests | **Passed** (63) |
| Application compiled to JS bundle | **Passed** (`index.bundle`) |
| Bytecode compiled | **Passed** (`index.hbc`, Hermes v98) |
| Vega native package built (`vega build`) | **Not done** — VDK unavailable |
| Installed on Vega simulator | **Not done** — no VDK, no KVM |
| Application actually executed on a Vega device or simulator | **Not done** |
| Remote navigation physically verified | **Not done** |

Rendering tests run in Jest with native mocks. They prove the React tree and the key handling, not
pixel layout on a 1920×1080 TV.

## Reproduce

```sh
cd fire-tv
npm ci
npm run check
npm run build
```
