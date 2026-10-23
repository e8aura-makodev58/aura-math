#!/usr/bin/env node
/** Local Codex quota guard. Uses the existing daemon; never starts another agent/server. */
import { createConnection as connectUnix } from "node:net";
import WebSocket from "ws";
import { open, unlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export function quota(response, limitId, threshold = 3) {
  const bucket = response.rateLimitsByLimitId
    ? response.rateLimitsByLimitId[limitId]
    : response.rateLimits?.limitId === limitId
      ? response.rateLimits
      : null;
  if (!bucket)
    throw new Error(`No quota bucket '${limitId}'; refusing to guess.`);
  const windows = [bucket.primary, bucket.secondary].filter(Boolean);
  if (
    !windows.length ||
    windows.some(
      (w) =>
        !Number.isFinite(w.usedPercent) ||
        w.usedPercent < 0 ||
        w.usedPercent > 100,
    )
  ) {
    throw new Error("Quota percentages unavailable or malformed.");
  }
  const low = windows.filter((w) => 100 - w.usedPercent < threshold);
  return {
    low: low.length > 0,
    remaining: Math.min(...windows.map((w) => 100 - w.usedPercent)),
    resetAt:
      low.length &&
      low.every((w) => Number.isFinite(w.resetsAt) && w.resetsAt > 0)
        ? Math.max(...low.map((w) => w.resetsAt))
        : null,
    allowed:
      response.ordinaryUsageAllowed !== false && !bucket.rateLimitReachedType,
  };
}

export class Guard {
  constructor(
    rpc,
    {
      threadId,
      limitId = "codex",
      threshold = 3,
      arm = false,
      resumeAfterReset = false,
      log = console.log,
    },
  ) {
    Object.assign(this, {
      rpc,
      threadId,
      limitId,
      threshold,
      arm,
      resumeAfterReset,
      log,
    });
    this.paused = null;
    this.disarmed = false;
  }
  async tick(now = Date.now() / 1000) {
    const limits = quota(
      await this.rpc("account/rateLimits/read", {}),
      this.limitId,
      this.threshold,
    );
    const { thread } = await this.rpc("thread/read", {
      threadId: this.threadId,
      includeTurns: true,
    });
    if (thread.id !== this.threadId || !Array.isArray(thread.turns))
      throw new Error("Unexpected thread response.");
    const last = thread.turns.at(-1);
    this.log(
      `Quota: ${limits.remaining}% remaining; turn: ${last?.status ?? "none"}; ${this.arm ? "armed" : "monitor only"}.`,
    );
    if (!this.arm || this.disarmed) return;
    if (this.paused) {
      const idleWait = this.paused.kind === "idle";
      const expectedStatuses = idleWait
        ? [this.paused.status]
        : ["inProgress", "interrupted"];
      if (
        !last ||
        last.id !== this.paused.turnId ||
        !expectedStatuses.includes(last.status)
      ) {
        this.disarmed = true;
        this.log("Thread changed while waiting; auto-resume disarmed.");
        return;
      }
      if (limits.low && limits.resetAt !== null)
        this.paused.resetAt = Math.max(
          this.paused.resetAt ?? 0,
          limits.resetAt,
        );
      if (
        (!idleWait && last.status !== "interrupted") ||
        this.paused.resetAt === null ||
        now < this.paused.resetAt + 5 ||
        limits.low ||
        !limits.allowed
      )
        return;
      // Consume the resume intent BEFORE the RPC: never retry an ambiguous turn/start.
      this.disarmed = true;
      await this.rpc("turn/start", {
        threadId: this.threadId,
        input: [
          {
            type: "text",
            text: `${idleWait ? "The user explicitly scheduled automatic continuation once quota became available, even though the last turn was completed." : "The quota guard interrupted the previous turn because usage was nearly exhausted."} Quota is now available and any observed depleted-window reset time has passed. Continue the previously authorised unfinished project work from the existing conversation and workspace, not merely the quota-watcher setup. Read the latest handover and reviewer findings; assess any pending review as instructed before implementation. Check interrupted tool effects before repeating them. Preserve all constraints; if all authorised work is complete or required user/reviewer input is still unavailable, report that and stop.`,
            text_elements: [],
          },
        ],
      });
      this.paused = null;
      this.disarmed = false;
      this.log(
        "Automatic continuation sent to the same thread. Quota monitoring remains active.",
      );
      return;
    }
    if (limits.low && last?.status === "inProgress") {
      // Active work is interrupted regardless of whether an idle continuation was requested.
      this.resumeAfterReset = false;
      this.paused = {
        kind: "interrupted",
        turnId: last.id,
        resetAt: limits.resetAt,
      };
      await this.rpc("turn/interrupt", {
        threadId: this.threadId,
        turnId: last.id,
      });
      this.log(
        limits.resetAt === null
          ? "Interrupted. Reset time unknown: automatic resume remains blocked."
          : `Interrupted. Earliest resume: ${new Date((limits.resetAt + 5) * 1000).toISOString()}.`,
      );
    }
    if (
      this.resumeAfterReset &&
      last &&
      ["completed", "failed", "interrupted"].includes(last.status)
    ) {
      // Explicit opt-in: queue exactly one continuation of the existing project.
      this.resumeAfterReset = false;
      this.paused = {
        kind: "idle",
        turnId: last.id,
        status: last.status,
        resetAt: limits.low ? limits.resetAt : now - 5,
      };
      this.log(
        limits.low
          ? limits.resetAt === null
            ? "Automatic continuation queued. Waiting for a reported reset time and fresh quota."
            : `Automatic continuation queued for after ${new Date((limits.resetAt + 5) * 1000).toISOString()}. No manual continue message is needed.`
          : "Quota is already available. Automatic continuation queued for the next quota check.",
      );
    }
  }
}

export function controlSocketPath(socket, codexHome = process.env.CODEX_HOME) {
  return (
    socket ??
    join(
      codexHome || join(homedir(), ".codex"),
      "app-server-control",
      "app-server-control.sock",
    )
  );
}

/** The daemon control socket speaks WebSocket, not JSONL. No server is started. */
export function connect(socket, { timeoutMs = 15000, createConnection } = {}) {
  const socketPath = controlSocketPath(socket);
  const ws = new WebSocket("ws://localhost/", {
    createConnection:
      createConnection ?? (() => connectUnix({ path: socketPath })),
    handshakeTimeout: timeoutMs,
    perMessageDeflate: false,
    maxPayload: 32 * 1024 * 1024,
  });
  const pending = new Map();
  let sequence = 0;
  let dead = false;
  let opened = false;
  let settleOpen;
  let rejectOpen;
  const ready = new Promise((resolve, reject) => {
    settleOpen = resolve;
    rejectOpen = reject;
  });
  // An asynchronous connection can fail before the first rpc call attaches.
  ready.catch(() => {});
  const fail = (error) => {
    dead = true;
    rejectOpen(error);
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };
  ws.on("open", () => {
    opened = true;
    settleOpen();
  });
  ws.on("error", (error) =>
    fail(
      new Error(
        `${opened ? "Codex control connection failed" : "Cannot open Codex WebSocket control connection"} at ${socketPath}${error.code ? ` (${error.code})` : ""}. No control action retried.`,
      ),
    ),
  );
  ws.on("close", () =>
    fail(
      new Error(
        "Codex control connection closed. No automatic reconnection or restart.",
      ),
    ),
  );
  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      fail(new Error("Invalid JSON from Codex control connection."));
      ws.terminate();
      return;
    }
    if (message.method && message.id !== undefined) {
      // This watcher never grants command/file approvals or supplies credentials.
      ws.send(
        JSON.stringify({
          id: message.id,
          error: {
            code: -32601,
            message:
              "Quota watcher cannot handle server requests; use the interactive client.",
          },
        }),
      );
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error)
      entry.reject(
        new Error(
          `Codex RPC failed (${message.error.code}); no control action retried.`,
        ),
      );
    else entry.resolve(message.result);
  });
  const rpc = async (method, params) => {
    await ready;
    if (dead) throw new Error("Codex control connection is unavailable.");
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            `Timed out: ${method} after WebSocket connected. No control action retried.`,
          ),
        );
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }), (error) => {
        if (error)
          fail(
            new Error(
              "Unable to send Codex control request. No control action retried.",
            ),
          );
      });
    });
  };
  return {
    rpc,
    notify: (method) => {
      if (dead || !opened)
        throw new Error("Codex control connection is not ready.");
      ws.send(JSON.stringify({ method, params: {} }));
    },
    close: () => {
      ws.terminate();
      fail(new Error("Quota watcher stopped; no automatic resume scheduled."));
    },
  };
}

export async function main() {
  const { values } = parseArgs({
    options: {
      thread: { type: "string" },
      socket: { type: "string" },
      "limit-id": { type: "string", default: "codex" },
      threshold: { type: "string", default: "3" },
      interval: { type: "string", default: "15" },
      arm: { type: "boolean", default: false },
      "resume-after-reset": { type: "boolean", default: false },
      once: { type: "boolean", default: false },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "node scripts/codex-quota-guard.mjs --thread UUID [--socket PATH] [--limit-id codex] [--threshold 3] [--interval 15] [--once] [--arm] [--resume-after-reset]\nDefault: monitor only. --arm interrupts below threshold and resumes after verified reset. Add --resume-after-reset to queue one continuation even from a completed turn. Keep the interactive Codex client open.",
    );
    return;
  }
  if (!values.thread || !/^[a-zA-Z0-9_-]+$/.test(values.thread))
    throw new Error("Supply an explicit --thread ID.");
  const threshold = Number(values.threshold),
    interval = Number(values.interval);
  if (
    !(threshold > 0 && threshold < 100) ||
    !Number.isFinite(interval) ||
    interval < 5 ||
    interval > 60
  )
    throw new Error(
      "Threshold must be 0–100 exclusive; interval must be 5–60 seconds.",
    );
  if (values["resume-after-reset"] && !values.arm)
    throw new Error("--resume-after-reset requires --arm.");
  if (values.arm && values.once)
    throw new Error(
      "--arm cannot be combined with --once: a one-shot guard cannot resume.",
    );
  const lockPath = join(tmpdir(), `codex-quota-guard-${values.thread}.lock`);
  const lock = await open(lockPath, "wx", 0o600).catch(() => {
    throw new Error(
      `Guard lock exists or is unavailable: ${lockPath}. Check for a running guard before removing a stale lock.`,
    );
  });
  await lock.writeFile(String(process.pid));
  await lock.close();
  const socketPath = controlSocketPath(values.socket);
  console.log(`Connecting to Codex control socket: ${socketPath}`);
  const client = connect(socketPath);
  const abort = new AbortController();
  const stop = () => {
    abort.abort();
    client.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await client.rpc("initialize", {
      clientInfo: {
        name: "quota_guard",
        title: "Local quota guard",
        version: "0.1.0",
      },
      capabilities: { experimentalApi: true },
    });
    client.notify("initialized");
    const guard = new Guard(client.rpc, {
      threadId: values.thread,
      limitId: values["limit-id"],
      threshold,
      arm: values.arm,
      resumeAfterReset: values["resume-after-reset"],
    });
    do {
      await guard.tick();
      if (values.once || guard.disarmed) break;
      await new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          abort.signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, interval * 1000);
        abort.signal.addEventListener("abort", finish, { once: true });
        if (abort.signal.aborted) finish();
      });
    } while (!abort.signal.aborted);
  } finally {
    client.close();
    await unlink(lockPath);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
