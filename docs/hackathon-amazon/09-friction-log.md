# 09 — Friction log

Every entry was observed in this session. Commands and outputs are summarised; the raw outputs are in
the session transcript.

| ID | Field | Entry |
|---|---|---|
| F-01 | Task | Obtain the Vega SDK (VDK) and read its install guide. |
| | Steps | Probed `https://developer.amazon.com/docs/vega/`, `https://developer.amazon.com/en-US/docs/vega/` and `https://developer.integ.amazon.com/docs/vega-api/latest/vega-carousel.html` with `curl`. |
| | Expected | Pages load, or the install step is reachable from the build environment. |
| | Actual | HTTP 403 "CONNECT tunnel failed" from the egress policy proxy, for each host. The proxy log records `connect_rejected`. |
| | Severity | **High**: blocks the native build, the simulator and the official docs. |
| | Workaround | Used npm packages from the registry, which are reachable. Documented the gap; did not route around the policy. |
| | Suggestion | Allow `developer.amazon.com` (and the SDK download hosts) for hackathon build environments, or publish the VDK on npm or a reachable CDN. |
| F-02 | Task | Bundle the Fire TV app with Metro, importing the fork as `react-native`. |
| | Steps | `package.json`: `"react-native": "npm:@amazon-devices/react-native-kepler@4.0.1"`; `npx react-native bundle --platform kepler ...`. |
| | Expected | Metro resolves `react-native` to the fork. |
| | Actual | "Unable to resolve module react-native ... could not be found within the project". A minimal `resolver` with `extraNodeModules` did not fix it. |
| | Severity | High (blocks bundling). |
| | Workaround | `metro.config.js` maps `react-native` and `react-native/*` to `node_modules/@amazon-devices/react-native-kepler` via `resolver.resolveRequest`; install the fork under its real name only (no alias). |
| | Suggestion | Document the supported dependency form in the Vega guide, and make Metro resolve npm aliases to packages that use `exports`. |
| F-03 | Task | Same bundle, after F-02. |
| | Steps | Bundled with the mapping above. |
| | Actual | Syntax error in `.../node_modules/react-native/Libraries/NativeComponent/ViewConfigIgnore.js` ("`':' or '?' expected`" on a TypeScript generic). The fork ships its own nested `node_modules/react-native` at 0.88.0, which it imports for its internals. |
| | Severity | High. |
| | Workaround | Map every `react-native/*` subpath to the fork's root, so the nested 0.88 copy is never loaded. |
| | Suggestion | Remove the nested copy from the published package, or ship `.js` files that contain no TypeScript syntax. |
| F-04 | Task | Run `react-native bundle` in the Vega project. |
| | Actual | "react-native depends on @react-native-community/cli for cli commands" then "Unable to find React Native files looking up from ...". |
| | Severity | Medium. |
| | Workaround | Add `@react-native-community/cli` (20.2.0) as a dev dependency and `react-native.config.js` with `reactNativePath` pointing at the fork. |
| | Suggestion | Put these three dev dependencies and the config into the Vega template. |
| F-05 | Task | Load `metro.config.js` with `@amazon-devices/kepler-compatibility-metro-config`. |
| | Actual | `Unable to generate a manifest ... node_modules/.bin/kepler-module-manifest-builder: not found`. The helper does not declare the builder as a dependency. |
| | Severity | Medium. |
| | Workaround | Add `@amazon-devices/kepler-module-manifest-builder@0.1.16` as a dev dependency. |
| | Suggestion | Declare the builder as a dependency of the helper, or document it. |
| F-06 | Task | Read the `run-vega` command. |
| | Actual | `run-vega` throws "This command is unimplemented. Please use `vega run-app`". The placeholder's description says "currently unimplemented". |
| | Severity | Low. |
| | Workaround | None needed yet (not run). |
| | Suggestion | Remove the placeholder command or document `vega run-app` as the replacement. |
| F-07 | Task | Compile the bundle to Hermes bytecode with the fork's `hermesc`. |
| | Actual | Exit 0 and a valid `.hbc`, but 17 "warning" lines about duplicate definitions, each echoing a long line of the bundle. |
| | Severity | Low. |
| | Workaround | The helper script writes the output to `build/hermesc.log` and prints only the counts. |
| | Suggestion | Deduplicate the bundle's module definitions, and print a short summary. |
| F-08 | Task | Typecheck the TV app against the shared engine. |
| | Actual | `src/content/package-validation.ts` imports the whole topic registry at runtime, so a type-only import of its `LessonPackage` type pulls in three.js and DOM workbenches. Typecheck then needs `three` types and DOM iterables. |
| | Severity | Medium (blocks clean reuse of pure modules). |
| | Workaround | Imported only pure adapter modules; mapped `three` types in `tsconfig.json`; added `DOM.Iterable`. |
| | Suggestion | Split the `LessonPackage` type into its own module, so it does not load the registry. |
| F-09 | Task | Run the shared core runtime in Hermes. |
| | Actual | `src/core/runtime.ts` calls `structuredClone`. The TypeScript DOM lib provides it, but Hermes support in the Vega build was not verified on a device. |
| | Severity | Medium (unknown on device). |
| | Workaround | `index.js` installs a JSON-based fallback when `structuredClone` is missing. |
| | Suggestion | Confirm `structuredClone` on the Vega runtime and document it. |
| F-10 | Task | Begin the project from the repository. |
| | Actual | The repository contained only `LICENSE` when the session started. The web app source appeared on `origin/main` during the session. |
| | Severity | High at the start (could not inspect the existing app). |
| | Workaround | Fetched `origin/main` and fast-forwarded the working branch. |
| | Suggestion | Keep hackathon work on a branch that already contains the starting code, and confirm the starting commit before work begins. |
| F-11 | Task | Fetch the live web app for comparison. |
| | Actual | `https://aura-math.makodev58.com` returns 403 from the egress proxy. |
| | Severity | Low. |
| | Workaround | Used the repository source instead. |
