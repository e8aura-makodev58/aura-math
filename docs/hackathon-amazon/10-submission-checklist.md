# 10 — Submission checklist

Status is as of 2026-10-23. Items marked **blocked** need the Vega SDK or a device.

## Deliverables

| Item | Status | Notes |
|---|---|---|
| Fire TV application source (`fire-tv/`) | Done | Committed to `claude/affectionate-edison-5fduyr` (see Repository below) |
| Vega native package (`.vpkg`) | Done | Built with `npm run build:release`: aarch64, armv7 and x86_64 Release packages (see 03) |
| Run on Vega simulator or Fire TV device | **Blocked** | Virtual device did not boot here (no KVM; see 03, F-15). No device |
| Remote navigation verified on hardware | **Blocked** | Simulated key events only (see 04) |
| Installation and build instructions | Done | `fire-tv/README.md`, `docs/hackathon-amazon/03`, `04` |
| Runtime instructions | Partly done | Only the JS build and tests can be run here |
| Required configuration documentation | Done | No secrets are used; `KEPLER_SDK_PATH` documented in `03` |
| Testing instructions | Done | `04-build-and-test.md` |
| Licence | Done | MIT, `LICENSE` |
| Project description | Draft | `06-submission-description.md` (provisional) |
| Demo video, under 3 minutes, public, English | **Not done** | Storyboard only (`07`); blocked on a device or simulator |
| Product feedback | Done for tools used | `08-product-feedback.md` |
| Friction log | Done | `09-friction-log.md` (11 entries, all observed) |
| Existing-project declaration | Done | `05-existing-vs-new.md` |

## Repository

- Branch: `claude/affectionate-edison-5fduyr`, fast-forwarded to `origin/main` (`f5716e4`), then the
  Fire TV work committed on top.
- Commits from this session: listed below once pushed.
- No pull request was opened, because the user did not ask for one.

## Mini challenges

- **AWS Builder:** not entered. No AWS service is used.
- **Open Source:** the repository is MIT-licensed. The Fire TV work is new code in `fire-tv/`, but the
  project as a whole predates the hackathon window (see 05), so no new-project claim is made.

## Before the 12:00 PT deadline

1. Install the Vega SDK on a machine with access to developer.amazon.com, then follow `03`.
2. Build the Vega package and run it on a simulator or device. Record the evidence.
3. Film the demo from that run, following `07`.
4. Update `04`, `06` and `10` with what was actually run. Remove any claim that was not.
