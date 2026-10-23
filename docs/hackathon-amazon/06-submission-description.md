# 06 — Submission description (draft, provisional)

> **Provisional.** This text describes what the repository contains today. It must not claim a
> device or simulator run, or a packaged Vega app, until those exist (see 04 and 10).

## Aura Math for Fire TV — learn together on the big screen

Aura Math is an interactive primary-mathematics practice app. Its web version lets a child work through
short lessons on comparison, angles, picture graphs, fractions, place value, equal groups and more. Each
answer is checked by deterministic topic logic, and each wrong answer gets a four-step hint ladder.

Television is a useful place for this. A family can sit together, a parent can read the question aloud,
and a child can answer with the remote from the sofa. The Fire TV version turns each question into a
large, readable screen with a clear focus ring, so the whole family can see the choice being made.

### How the Fire TV version works

- Home screen with Aura Math branding, a Start learning action and remote instructions.
- Choose a topic, then a lesson. Up/Down/Left/Right move the focus. OK answers or continues. BACK goes
  back a screen. MENU shows the next hint.
- Number questions use a three-digit picker, so no on-screen keyboard is needed.
- After the last question a summary shows questions completed, answers right first time, hints used,
  the topic and the completion label.

Scope today: 17 lessons across six topics, drawn from the 64 web lessons whose questions use choice or
number steps. The remaining lessons need typed or multi-select answers and are not on the TV yet.

### What was reused from the existing web app (unchanged)

- The session engine (`src/core/runtime.ts`) and its types.
- Topic adapters and mathematical checks for comparison, angles, picture graphs, fractions, place value
  and equal groups, plus adapters for other topics that are wired but have no TV lessons yet.
- The 64-lesson content, read from `content/lessons`.
- The colour palette from the web stylesheet.

### What was developed during the hackathon window

- The Fire TV application in `fire-tv/`, built on Amazon's React Native fork for Vega
  (`@amazon-devices/react-native-kepler`).
- A TV navigation layer: remote-key mapping, focus handling, a digit picker, the screen state machine,
  and a summary built from session values.
- Build tooling: a lesson snapshot generator, a bundle script and a Hermes bytecode step.
- 63 automated tests: unit, lesson-integration (all 17 TV lessons completed through the shared runtime)
  and rendering.

### Amazon tools used

- **Vega / React Native for Vega** (`@amazon-devices/react-native-kepler` 4.0.1), the app framework.
- **Kepler React Native CLI plugin** (`@amazon-devices/kepler-cli-platform` 0.22.14) and the Kepler
  Metro compatibility helper (`@amazon-devices/kepler-compatibility-metro-config` 0.0.7) with the
  manifest builder (`@amazon-devices/kepler-module-manifest-builder` 0.1.16).
- **hermesc** from the Vega fork, for bytecode compilation.
- **Not used:** the Vega SDK / VDK and Vega Virtual Device (the download was blocked from the build
  environment), AWS services, and any Alexa or other Amazon APIs.

### Status

- Built and verified on Linux: JavaScript bundle, Hermes bytecode, typecheck, lint, 63 tests.
- Not yet verified: a packaged Vega app, a run on a simulator or Fire TV device, and real remote
  navigation.

### Licence and content

The code is MIT-licensed (`LICENSE`). Lesson content is original, draft, and not reviewed by a teacher.
The app says so on its home screen.
