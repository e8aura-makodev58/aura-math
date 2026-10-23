# Codex quota guard

Local utility requested by the user, separate from Aura Math's content-authoring plan. Requires Node.js 22+, installed repository dependencies (`npm ci`), and the Unix WebSocket control socket of the existing Codex daemon (inspected CLI version: 0.160.0). The `ws` development dependency implements the WebSocket transport.

**Status: transport corrected and tested; not armed for the current session.** The original script incorrectly sent JSONL through a raw socket proxy and timed out during initialization. It now performs a WebSocket HTTP Upgrade directly on the control socket. A read-only workspace probe now reports `EPERM` at socket connection; The user subsequently verified host-terminal access: quota 0%, latest turn completed. Live automatic continuation has not yet been verified.

## Connect and run

Use a terminal outside the coding sandbox on the host running the **same Codex app-server that owns this thread**. Keep the interactive client open to handle approvals. A different CLI daemon or a newly started app-server may not own this conversation; this utility does not migrate or duplicate it.

From the repository root, test read-only access first:

```sh
node scripts/codex-quota-guard.mjs --thread 01a1069f-4161-7be3-8d5c-cdc7884e5e96 --once
```

If quota and thread status are returned, run the watcher in that terminal:

```sh
node scripts/codex-quota-guard.mjs --thread 01a1069f-4161-7be3-8d5c-cdc7884e5e96 --arm --resume-after-reset
```

With `--arm --resume-after-reset`, a completed/idle turn queues one automatic continuation when quota becomes available. No manual “continue” message is needed. It prints the earliest resume time, then checks fresh quota before starting. If quota already reset before launch, it queues the continuation for the next check. After sending it, the script keeps monitoring active work. Stop any older watcher with Ctrl+C in its own pane before starting this version.

Without `--arm`, the script monitors only. Plain `--arm` still only resumes turns the watcher itself interrupted. `--socket /absolute/control.sock` selects an existing daemon socket. Otherwise the path is `$CODEX_HOME/app-server-control/app-server-control.sock`, or `~/.codex/app-server-control/app-server-control.sock` if CODEX_HOME is unset; it does not create one. `--limit-id codex` selects the quota bucket; select a different ID only when its relationship to the session is known. Unknown buckets produce an error rather than falling back silently. Never use `--last` for automatic continuation.

## Behaviour

- Poll every 15 seconds by default (`--interval 5` through `60` supported).
- Interrupt an active target turn when either primary or secondary window has **less than 3% remaining** (`usedPercent > 97`). Exactly 3% does not trigger. `--threshold` is configurable.
- Wait for confirmed interrupted status, the latest depleted window's reported reset time plus five seconds, and a fresh quota read showing adequate headroom and no reported usage denial.
- Start one continuation turn on the same thread with instructions to resume only previously authorised unfinished work and check interrupted tool effects. Do not override model, sandbox or approval settings.
- If the thread changes, disarm automatic resume. Start an idle/completed thread only with the explicit `--resume-after-reset` option, and only once for that queued request. Never retry an ambiguous `turn/start` failure.
- No forced process kill, earned-reset consumption, paid credits, credentials, remote messages or approval auto-acceptance. Missing quota/errors stop the watcher; unknown reset time prevents automatic continuation.

This is a best-effort quota guard, not a hard token reservation: polling and usage-reporting delays can overshoot the threshold. Interrupting a turn may leave tool effects in progress; it is not a transaction rollback or guaranteed checkpoint. Other sessions and independently running sub-agents are **not** controlled. Keep those stopped separately if they share the quota.

Closing the terminal/stopping the watcher cancels its future actions; it does not resume a paused turn. Sleep/suspension pauses monitoring. The watcher does not install a service, survive process restart with a pending resume intent, or reconnect automatically. A per-thread temporary lock prevents duplicate local watchers. After a crash, check that the old process is gone before deleting its stale `codex-quota-guard-THREAD.lock` in the OS temporary directory.

If this UI does not expose its app-server control socket, the script cannot control this session from a separate terminal. It must be integrated with the session's owning client; starting a new daemon is not a workaround.

## Verification and references

```sh
node --check scripts/codex-quota-guard.mjs
node scripts/codex-quota-guard.test.mjs
```

Sixteen tests passed, including four cases for explicitly scheduled idle continuation (single resume, user intervention, multiple windows/unknown reset, already-restored quota), including a real WebSocket HTTP Upgrade and framed RPC exchange over in-memory sockets, an initialization response timeout, custom socket resolution, plus nine policy tests: exact threshold, multiple quota windows, malformed/missing quota, monitor-only and idle behaviour, interruption/reset confirmation, unknown reset, user intervention, account denial, and ambiguous resume failure. The scheduled idle continuation subsequently reached this same thread and resumed authorised project implementation on 2026-10-04. Live interruption of an active turn has not been exercised.

Protocol references: [official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server). Field shapes were also checked against schemas generated locally by the installed `codex app-server generate-json-schema`. The app-server interfaces are experimental and can change; failed RPCs stop control actions rather than inventing alternative endpoints.
