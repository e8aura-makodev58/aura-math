# PROPOSAL ONLY: two-agent quota switchboard (Codex and Claude)

> ## What this document is, and is not
>
> - **It is a proposal written for the user to read and decide on.** It is not a task, a work order, a specification or an approved plan.
> - **Nothing in it is authorised for implementation.** The user has not approved the scope, the design, the permissions it would need, or any phase. Do not write code, scripts, services, hooks, settings or configuration from it.
> - **Codex and any other agent: do not act on this file.** Do not treat it as a continuation instruction, do not add it to a resume prompt, do not claim it as ownership in `handover.md`, and do not start a "plan review" of it. It is deliberately not linked from `handover.md`, `AGENTS.md` or any other file. If the user wants it pursued, they will say so in their own words; until then, ignore it.
> - **It records an assessment, not a decision.** It was written by Claude on 2026-10-06 at the user's request after a read-only look at the existing quota guard. No file other than this one was created or changed for it, and the running watcher was not touched.
> - It has had **no independent review**. The repo's usual rule (document, one Claude review, Codex dispositions) has not been applied and would apply before any implementation.

## 1. Goal the user described

Extend the existing quota watcher so that it also understands Claude, and so that work can **switch automatically between the two coding agents**: stop an agent when its usage limit is nearly reached, hand the work to the other agent while it has quota, and resume the first agent after its limit resets.

## 2. What exists today (verified 2026-10-06)

- `scripts/codex-quota-guard.mjs` (410 lines), `scripts/codex-quota-guard.test.mjs` (16 tests, all pass when run directly), `docs/quota-guard.md`.
- It is **not a cron job.** It is a foreground Node process in a terminal (PID 820066 at the time, started with `--thread <id> --arm --resume-after-reset`). The only crontab entries on the machine belong to another project.
- Behaviour: polls the local Codex app-server (Unix WebSocket) every 15 s for `account/rateLimits/read` and `thread/read`; interrupts an active turn when a window has under 3% left; resumes with `turn/start` after the reported reset time plus 5 s and a fresh quota read. It never accepts approvals, never guesses an unknown quota bucket or reset time, clears its resume intent before sending (so no double resume), and stands down if the thread changes.
- Gaps found:
  1. Fragile as a supervisor: dies with its terminal, keeps no state across restarts, any single RPC error ends the loop, stale lock files need manual removal.
  2. One agent, one thread, one quota bucket; sub-agent threads and the other vendor are invisible.
  3. The resume prompt is hard-coded to this project.
  4. Interrupts abruptly with no handoff note and no tree health check; the repo has no git, so a half-edited tree can be left behind.
  5. If the weekly window is the low one it waits for days with no fallback.
  6. Its tests are not part of `npm test`; a live interruption has never been exercised; `docs/quota-guard.md` still says "not armed".

## 3. What Claude Code exposes (from the official docs, read 2026-10-06)

Sources: `code.claude.com/docs/en/statusline`, `/hooks`, `/headless`. Claude Code 2.1.291 is installed here. No status line or hooks are configured.

| Need | What exists | Limit |
| --- | --- | --- |
| Read usage | The status-line command receives JSON on stdin with `rate_limits.five_hour` and `rate_limits.seven_day`, each `used_percentage` (0–100) and `resets_at` (Unix seconds) | claude.ai Pro and Max subscribers only (or a Claude apps gateway with a spend limit); appears only after a session's first API response; each window may be absent; a window is dropped once its `resets_at` passes; it is pushed per running session, so it goes stale when no Claude session is running |
| Know a limit was hit | `StopFailure` hook with a `rate_limit` matcher, input includes `session_id`, `error_type`, `error_message` | observation only, cannot block; async |
| Run work unattended | `claude -p`, `--resume <session-id>`, `--permission-mode`, `--allowedTools`, `--permission-prompts none`, `--output-format json` or `stream-json` (includes `system/api_retry` events with `error: rate_limit`), `--bare` | `--bare` ignores subscription login and needs an API key; SIGINT ends a turn cleanly, SIGTERM leaves it unfinished (`CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` continues it on resume) |
| Control a live chat from outside | nothing | **An interactive Claude session cannot be paused or fed a prompt by another process.** Codex's control socket has no Claude equivalent |

Not verified: whether the Agent SDK emits a dedicated rate-limit event; whether this account is a Pro or Max subscription (credentials were not opened); how a headless run reports a hard limit hit mid-turn; the vendors' terms for unattended automated use of a subscription.

## 4. Proposed design (for discussion)

**One supervisor** running as a service, with the agents behind two small interfaces: *usage* (how much is left and when it resets) and *control* (stop, start, is it running).

- **Process model.** A long-running Node process under a user systemd unit or tmux. Cron, if used at all, is only a watchdog that restarts it (the `ai-quiz` project already uses that pattern).
- **Codex side.** Reuse the existing app-server calls, refactored behind the interface, with reconnect and backoff.
- **Claude side.**
  - *Usage:* a tiny status-line script writes the latest `rate_limits` to a file the supervisor reads; a `StopFailure` hook records limit events. When no session is running the data is stale, so the supervisor infers availability from `resets_at` having passed and then confirms with one very small probe request.
  - *Control:* the supervisor starts and stops **headless** Claude runs itself (Agent SDK or `claude -p --resume`). It cannot drive the user's interactive Claude chat.
- **One lease.** A lease file names the single agent allowed to edit. Only the holder works; the other waits. Switching has hysteresis (a margin and a cooldown) so it does not flip-flop. If both agents are low, sleep until the earliest reset.
- **Handoff steps** (in this order): stop the active agent at a safe point; snapshot the working tree; run the project health checks (`typecheck`, tests) in a neutral process; write a machine-generated handoff note; start the other agent with a prompt built from the repo's own rules (`AGENTS.md`, `handover.md`) rather than hard-coded text.
- **Persistence.** Pending intents and the lease are written to disk, so a restart does not lose or repeat them. Stale locks are detected by checking whether the owning process is alive.
- **Safety defaults.** Dry-run mode first (decides and logs, never acts). A kill-switch file. No auto-approval of anything. Unattended Claude runs use an explicit allow-list (no deploys, no deletions outside the project, no network beyond the project). A cap on turns or spend per run. Role rules from `AGENTS.md` (an agent never counts as the independent reviewer of its own work; Claude reviews once per phase and Codex dispositions) are carried in every handoff prompt.

## 5. Possible phases (each would need the user's approval first)

| Phase | Deliverable | Gate |
| --- | --- | --- |
| P0 | The user answers the questions in section 7; scope and permissions agreed; independent review of the plan | Written approval; no code before it |
| P1 | Refactor the Codex guard into a library with the usage/control interface, persistence, retry and reconnect; put its tests into the normal test run | Behaviour identical in dry-run; existing 16 tests still pass |
| P2 | Claude usage sink: status-line script and `StopFailure` hook in a monitor-only mode, no control | A recorded real reading; staleness and absent-window cases tested |
| P3 | Claude headless controller with the restricted permission policy | Fake `claude` binary tests; one supervised live drill |
| P4 | Arbiter, lease, handoff protocol and health-check snapshot | Scenario tests: both free, one low, both low, flapping, crash and restart, stale data, unknown reset |
| P5 | Service wrapper, watchdog, notifications, kill switch, documentation | A full dry-run over a real reset, then a supervised live switch |

## 6. Risks

- Unattended agents editing a repository that has no git; a half-finished edit can break the tree. Snapshots and health checks reduce, but do not remove, this.
- Switching mid-phase can skip the review protocol in `AGENTS.md`; the handoff prompt has to carry it and the supervisor must never let an agent mark its own work as reviewed.
- Usage numbers lag and polling overshoots; a limit can be hit between checks, and an interrupted tool call may leave effects half done.
- Claude's usage data exists only while a Claude session runs and only for Pro and Max, so the switch decision for Claude is partly inferred.
- Experimental interfaces: the Codex app-server API is experimental and Claude Code's status-line and hook fields can change between versions.
- Unattended use of a subscription may be limited by the vendors' terms; this needs checking before anything runs without a person present.

## 7. Questions the user would need to answer

1. Is the Claude account a Pro or Max subscription (needed for the usage data), or API-key billing?
2. Which agent is the default when both have quota?
3. Should the supervisor only run headless sessions it starts itself, or must it also control your live Codex chat as the current guard does (Claude's live chat cannot be controlled)?
4. What may an unattended agent do? Suggested starting point: edit and test inside this project only.
5. Where should notifications go, and should a switch be announced before it happens?
6. May the supervisor take a snapshot copy of the working tree before each handoff, given there is no git?
7. Are there quiet hours or a spending ceiling?

## 8. Out of scope for any first version

Controlling interactive chats other than Codex's; switching between more than two agents; automatic purchase of credits or plan changes; using more than one account per vendor; unattended deploys; anything that changes lesson content or review status.
