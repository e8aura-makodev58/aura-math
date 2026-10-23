# 08 — Product feedback (only tools actually used)

Each entry below is based on work done in this session. Nothing is recorded for tools that were not
run. Where a section could not be filled in from experience, it says so.

## Amazon tools used

### React Native for Vega — `@amazon-devices/react-native-kepler` 4.0.1

- **Purpose:** React Native framework for Vega OS (RN 0.83 base).
- **Setup experience:** installs from npm, but the package does not resolve under a stock Metro
  configuration. The `react-native` alias plus the package's own self-referencing imports needed three
  workarounds (see 09, F-02 to F-04). After those, a bundle built.
- **What worked well:** the package ships the Vega-specific TV input API (`useTVEventHandler`,
  `TVTypes.d.ts`, with `eventType` and `eventKeyAction`) and a Hermes compiler binary for Linux.
- **What did not work well:** the package contains a nested copy of another React Native version
  (0.88) whose files use TypeScript syntax in `.js` files. Stock Metro then fails.
- **Documentation quality:** the package README is the upstream React Native README. I did not find
  Vega-specific guidance for a new project inside the package. The official docs were not reachable.
- **Development friction:** high (see F-02, F-03, F-04).
- **Missing features / gaps:** none tested beyond bundling and bytecode.
- **Would I use it again?** Undecided until a native package and a device run are possible. The
  JavaScript toolchain side is workable with the workarounds recorded.

### Kepler CLI platform — `@amazon-devices/kepler-cli-platform` 0.22.14

- **Purpose:** React Native CLI plugin for Vega: `build-vega`, `start-vega`, `build-system-bundle`.
- **Setup experience:** installed only as a registry tarball read; not run, because `build-vega`
  needs the VDK.
- **What worked well:** the tarball's README documents the system-bundle behaviour clearly, including
  how Hermes versions are chosen from the `@amazon-devices/react-native-kepler` range.
- **What did not work well:** `run-vega` is a placeholder that throws "unimplemented" and points to
  `vega run-app`. The `vega` command is looked up under `KEPLER_SDK_PATH`, which cannot be set without
  the SDK.
- **Would I use it again?** Not yet tested.

### Kepler Metro compatibility helper — `@amazon-devices/kepler-compatibility-metro-config` 0.0.7

- **Purpose:** Metro serializer hook that writes a module-manifest polyfill for system libraries.
- **What did not work well:** it runs `node_modules/.bin/kepler-module-manifest-builder` when Metro
  loads. That binary is not a dependency of this package, so the app fails to load its Metro config
  until the manifest builder is installed as a dev dependency (see F-05).

### Kepler module manifest builder — `@amazon-devices/kepler-module-manifest-builder` 0.1.16

- **Purpose:** builds manifests for Kepler apps and libraries.
- **Use here:** installed to satisfy the helper above. Its `build` command was not run on a real app
  manifest, because the app manifest format has not been checked against the official docs.

### hermesc from the Vega fork (Hermes 0.14)

- **Purpose:** compiles JavaScript bundles to Hermes bytecode.
- **What worked well:** compiled the 1.3 MB TV bundle in a single command to a valid bytecode file
  (`Hermes JavaScript bytecode, version 98`).
- **What did not work well:** the compiler prints a warning for every duplicate definition in the
  bundle (17 warnings for this app). The output is very large on a single line. The warnings were not
  investigated further.

## Amazon tools not used

- Vega SDK / VDK and the `vega` CLI, and Vega Virtual Device: not obtained (download blocked).
- Fire TV device or simulator: not available.
- AWS services (Bedrock, AgentCore, Strands, Kiro, SageMaker, others): not used; no AWS mini challenge
  is claimed.
- Alexa, Bee, Ring APIs: not used.
