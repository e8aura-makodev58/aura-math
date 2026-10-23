# 02 — Architecture assessment and adaptation strategy

## What the existing web app is (inspected on `origin/main`, `f5716e4`)

- **Stack:** Vite 7 + TypeScript (strict), DOM-rendered lesson views, three.js for nets only, Vitest
  for unit tests and Playwright for browser tests. Entry points: `index.html` (preview),
  `learner.html`, `author.html`, `admin.html`.
- **Backend:** none for the learner. The README states that lessons need no backend, credentials or
  model service. An admin server and an annotation dev plugin exist for authoring; neither is used by
  the TV app and no production secrets are needed.
- **Engine:** pure TypeScript. `src/core/types.ts` defines `Lesson`, `Step`, `Adapter`, `Session`;
  `src/core/runtime.ts` implements session transitions (`createSession`, `submit`, `nextStep`,
  `useHint`, `switchMode`, `completionLabel`).
- **Topics:** `src/topics/*` implement mathematical checks behind `Adapter` (`apply`, `evaluate`,
  `resetStep`, `describe`). Each runtime topic also exposes `answer(lesson, step)`, which is the
  deterministic oracle.
- **Content:** 64 lesson packages in `content/lessons/*.json` (schema versions 1–3), all
  `reviewStatus: "draft"`. Release gating lives in `release/` and `src/released-content.ts`.
- **Mathematical rendering:** SVG and HTML generated in code; three.js for the nets workbench only.

## Reuse map

| Piece | Reused? | How |
|---|---|---|
| `src/core/types.ts`, `src/core/runtime.ts` | Yes, unchanged | Imported by relative path from `fire-tv/src` |
| Pure adapters: `comparison`, `angles`, `picture-graphs`, `fractions`, `place-value`, `equal-groups`, `decimals`, `whole-numbers`, `fraction-calculations`, `line-graphs`, `pie-charts`, `bar-charts` | Yes, unchanged | Imported from `src/topics/*` |
| `src/topics/registry.ts` | **No** | It pulls in three.js and workbench modules through `content/package-validation.ts` |
| `src/content/package-validation.ts` | **No** at runtime | Type-only import used; its runtime imports load the full registry |
| `content/lessons/*.json` | Yes, read-only | Snapshotted into `fire-tv/src/generated/lessons.json` by `scripts/build-lesson-index.js` |
| `src/styles.css` palette | Colours copied | `fire-tv/src/theme.ts` (`#315c46` green, `#fffdf8` paper, `#9a4c10` focus) |
| DOM views (`src/ui/*`, `src/main.ts`, workbenches) | **No** | Web-only |
| Release gating, learner build | **No** | Not needed for a draft preview; the TV labels the content as draft |

## Fire TV architecture

```
 Fire TV remote
      │  useTVEventHandler (Kepler input)
      ▼
 remote.ts  ──►  tvState.ts (pure navigation reducer)  ──►  screens/*.tsx
                     │
                     ├─ core/runtime.ts   (shared: createSession / submit / nextStep / useHint)
                     └─ engine/adapters.ts (shared topic adapters, pure subset)
                              ▲
                  generated/lessons.json  ◄── content/lessons/*.json (shared content)
```

- **Navigation is a pure reducer.** `navigate(state, key, groups)` returns the next state. This keeps
  focus, back-navigation and the summary testable without a device.
- **Focus never traps.** `moveHighlight` clamps at every edge, and BACK always leaves a screen (exits
  from home).
- **Number answers use a three-digit picker** because the remote has no keyboard. Up/Down change a
  digit, Left/Right move the cursor. `TV_MAX_DIGITS` in `catalogue.ts` bounds the answer range.
- **Hints use the core ladder.** MENU calls `useHint`; the fourth rung reveals the answer through the
  topic's `answer()` oracle, which is what the core reveal event records.
- **The summary reads only session values:** `stepsCompleted`, `firstTryCorrect` (from the first
  outcome of each step in `session.history`), `hintsUsed`, and `completionLabel(session)`.

## Decisions and why

1. **Vega React Native fork, not a DOM web shell.** The brief prefers the Vega runtime. Amazon's
   React Native fork (`@amazon-devices/react-native-kepler`, RN 0.83 base) is the only Vega UI
   framework available from npm here. The web app itself cannot run on Vega without rewriting its DOM.
2. **Shared code through `watchFolders`, not copies.** Copying would fork the mathematical logic. The
   cost is a Metro resolver workaround (see 03 and 09).
3. **Choice and number steps only.** Typed and multi-select answers have no remote-friendly input
   yet. Excluding them keeps every lesson on the TV fully operable.
4. **Pure-subset imports only.** Workbenches need DOM and three.js and would not run on the TV.
5. **`structuredClone` fallback in `index.js`.** The core runtime calls `structuredClone`. The
   fallback is defensive: whether the Vega Hermes build provides it has not been verified on a device.

## Risks

- The Vega fork's package layout did not resolve under stock Metro (see 09, entries F-02 to F-04).
- No on-device test exists, so layout sizes, font rendering, focus visuals and performance are
  unverified.
