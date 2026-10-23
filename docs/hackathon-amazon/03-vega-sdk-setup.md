# 03 — Vega SDK setup and toolchain proof

## Environment assessment (observed 2026-10-23)

| Item | Observed |
|---|---|
| OS / kernel | Linux `6.18.44-fc-v140`, x86_64 |
| CPU | 4 vCPU; `vmx`/`svm` flags absent |
| Memory | 15 GiB |
| Disk | 252 GB device, roughly 31 GB free at check time |
| Hardware virtualisation | **Not available**: `/dev/kvm` does not exist |
| Graphics | No GPU; no display |
| Node.js / npm | v22.22.0 / 10.9.4 (Vega fork needs Node ≥ 22.14) |
| Java | Present, configured for the egress proxy trust store |
| Chromium | Preinstalled under `/opt/pw-browsers` (not needed for TV) |
| Egress | `registry.npmjs.org` and `pypi.org` reachable; `developer.amazon.com` and `developer.integ.amazon.com` return **403 (policy denial)** |

## What the Vega toolchain consists of (from the npm registry)

The Vega app runtime is Amazon's React Native fork. Packages checked on the registry:

| Package | Version used | Role | Verified how |
|---|---|---|---|
| `@amazon-devices/react-native-kepler` | 4.0.1 (`4.0.1+rn0.83.0`) | React Native framework for Vega (RN 0.83 base), peer `react ^19.2.0` | Installed; package contents read |
| `@amazon-devices/kepler-cli-platform` | 0.22.14 | React Native CLI plugin for Vega: `build-vega`, `start-vega`; `run-vega` is a placeholder | Tarball read |
| `@amazon-devices/kepler-module-manifest-builder` | 0.1.16 | Generates the module manifest used by `kepler-compatibility-metro-config` | Installed (provides the required binary) |
| `@amazon-devices/kepler-compatibility-metro-config` | 0.0.7 | Metro serializer hook that writes the manifest polyfill | Installed; source read |
| `@react-native-community/cli` | 20.2.0 | RN CLI used by `react-native bundle` | Installed |
| `@amazon-devices/eslint-plugin-kepler` | 0.1.15 | Vega best-practice lint rules | **Not installed yet** |

**Not obtained:** the Vega SDK / VDK. Its `vega` CLI is looked up as `$KEPLER_SDK_PATH/bin/vega`
(legacy name `kepler`) by `kepler-cli-platform`. It is distributed from developer.amazon.com, which
was blocked.

## Installation procedure that was run

```sh
cd fire-tv
npm install                    # installs the Vega fork, RN CLI, Metro helpers, TypeScript, Jest
```

Result: 545 packages after the first install (about 26 s), then small follow-up installs for the
manifest builder and RN CLI. Exact versions are pinned in `fire-tv/package.json` and
`fire-tv/package-lock.json`.

## Toolchain proof that was executed

1. **Minimal app compiles to a JS bundle for the `kepler` platform.**
   `npx react-native bundle --platform kepler --dev false --entry-file index.js` produced a
   1.08 MB `index.bundle` (first, minimal App).
2. **Full TV app bundles.** `npm run bundle` produced `build/index.bundle` (1.33 MB) with the
   shared engine, the topic adapters and the 64-lesson snapshot. The bundle contains no three.js code.
3. **Bytecode compiles.** `npm run hermes` ran the fork's `hermesc`
   (`sdks/hermesc/linux64-bin/hermesc`, Hermes 0.14) and wrote `build/index.hbc`
   (`Hermes JavaScript bytecode, version 98`). The compiler reported 17 warnings and 0 errors; the
   full log is `build/hermesc.log`.

## Still missing: native package

```text
Not executed: `vega build` (kepler-cli-platform: build-vega) → produces the app package (.vpkg).
Reason: KEPLER_SDK_PATH is unset because the VDK cannot be downloaded (403 from developer.amazon.com).
Also not written: manifest.toml for the app package (format to be taken from the official Vega docs).
```

## Steps to reproduce on a machine with Amazon developer access

1. Install the Vega SDK / VDK from developer.amazon.com (follow the current install guide; this doc does
   not record a command for it, since the guide was not readable here).
2. `export KEPLER_SDK_PATH=/path/to/vega-sdk` and confirm `"$KEPLER_SDK_PATH/bin/vega" -v` runs.
3. `cd fire-tv && npm ci && npm run build`.
4. Run the Vega package build through the RN CLI plugin (`npx react-native build-vega`, after confirming
   the command and options with `npx react-native build-vega --help` on the installed version).
5. Author the app manifest from the official Vega documentation and add it to the package.
6. Install and run on a Vega Virtual Device (needs KVM on an x86_64 Linux host) or a Fire TV device.

## Virtual device

Not run. There is no `/dev/kvm`, no hardware virtualisation, and no display in this container, so the
Vega Virtual Device cannot start here. Headless or software-rendered execution was not attempted
because the VDK itself is unavailable.

## Attempt log (SDK installer)

- 2026-10-23, after `developer.amazon.com` was allowed: the docs became readable (`/docs/vega/0.24/install-vega-sdk.html`).
- `https://sdk-installer.vega.labcollab.net/get_vvm.sh` then downloaded (58,010 bytes, 1,927 lines). Read before running. No login or credential prompt found. It installs to `~/vega` and edits shell profiles; it uses no sudo.
- The installer downloads its CLI and SDK metadata from `https://k-artifactory-external.labcollab.net/artifactory/api/kpm/`. This host returns **403 (policy denial)**, so the installer cannot complete. The VS Code marketplace (optional extension) also returns 403.
- Not run: the installer itself. Blocker: allow `k-artifactory-external.labcollab.net` (and the marketplace host if the VS Code extension is wanted).
