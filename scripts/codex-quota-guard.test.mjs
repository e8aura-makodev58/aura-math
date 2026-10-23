import { test } from "node:test";
import assert from "node:assert/strict";
import { Guard, quota } from "./codex-quota-guard.mjs";
const snapshot = (used = 98, secondary = null) => ({
  rateLimits: {
    limitId: "codex",
    primary: { usedPercent: used, resetsAt: 100 },
    secondary,
  },
});
function harness(arm = true, resumeAfterReset = false) {
  const calls = [];
  const data = {
    limits: snapshot(),
    turn: { id: "turn1", status: "inProgress" },
  };
  const guard = new Guard(
    async (method, params) => {
      calls.push({ method, params });
      if (method === "account/rateLimits/read") return data.limits;
      if (method === "thread/read")
        return { thread: { id: "thread1", turns: [data.turn] } };
      return {};
    },
    { threadId: "thread1", arm, resumeAfterReset, log: () => {} },
  );
  return {
    data,
    calls,
    guard,
    mutations: () =>
      calls.filter((c) => ["turn/start", "turn/interrupt"].includes(c.method)),
  };
}
test("strictly less than 3% triggers; exactly 3% does not", () => {
  assert.equal(quota(snapshot(97), "codex").low, false);
  assert.equal(quota(snapshot(97.1), "codex").low, true);
});
test("waits for latest depleted window, does not ignore weekly quota", () => {
  const result = quota(
    snapshot(99, { usedPercent: 99, resetsAt: 300 }),
    "codex",
  );
  assert.equal(result.resetAt, 300);
});
test("unknown bucket and invalid usage fail without inference", () => {
  assert.throws(() => quota(snapshot(), "other"));
  assert.throws(() => quota(snapshot(NaN), "codex"));
  assert.throws(() =>
    quota({ rateLimitsByLimitId: {}, ...snapshot() }, "codex"),
  );
});
test("monitor-only and idle threads never mutate", async () => {
  const h = harness(false);
  await h.guard.tick();
  assert.equal(h.mutations().length, 0);
  const idle = harness();
  idle.data.turn.status = "completed";
  await idle.guard.tick();
  assert.equal(idle.mutations().length, 0);
});
test("interrupt once then require confirmed interruption, reset time and fresh quota", async () => {
  const h = harness();
  await h.guard.tick(50);
  await h.guard.tick(60);
  assert.equal(h.mutations().length, 1);
  h.data.limits = snapshot(10);
  await h.guard.tick(110); // not yet interrupted
  assert.equal(h.mutations().length, 1);
  h.data.turn.status = "interrupted";
  await h.guard.tick(99);
  assert.equal(h.mutations().length, 1);
  h.data.limits = snapshot(98);
  await h.guard.tick(110); // reset clock alone insufficient
  assert.equal(h.mutations().length, 1);
  h.data.limits = snapshot(10);
  await h.guard.tick(110);
  assert.equal(h.mutations().at(-1).method, "turn/start");
  assert.equal(h.mutations().at(-1).params.threadId, "thread1");
  await h.guard.tick(120);
  assert.equal(h.mutations().length, 2);
});
test("unavailable reset time never schedules guessed resume", async () => {
  const h = harness();
  h.data.limits.rateLimits.primary.resetsAt = null;
  await h.guard.tick(50);
  h.data.turn.status = "interrupted";
  h.data.limits = snapshot(0);
  await h.guard.tick(500);
  assert.equal(h.mutations().length, 1);
});
test("new turn or natural completion disarms pending resume", async () => {
  for (const turn of [
    { id: "new", status: "completed" },
    { id: "turn1", status: "completed" },
  ]) {
    const h = harness();
    await h.guard.tick(50);
    h.data.turn = turn;
    h.data.limits = snapshot(0);
    await h.guard.tick(500);
    assert.equal(h.guard.disarmed, true);
    assert.equal(h.mutations().length, 1);
  }
});
test("account denial blocks restart despite quota availability", async () => {
  const h = harness();
  await h.guard.tick(50);
  h.data.turn.status = "interrupted";
  h.data.limits = { ...snapshot(0), ordinaryUsageAllowed: false };
  await h.guard.tick(500);
  assert.equal(h.mutations().length, 1);
});
test("uncertain turn/start is never retried", async () => {
  const h = harness();
  await h.guard.tick(50);
  h.data.turn.status = "interrupted";
  h.data.limits = snapshot(0);
  const original = h.guard.rpc;
  h.guard.rpc = async (...args) => {
    if (args[0] === "turn/start") throw new Error("timeout");
    return original(...args);
  };
  await assert.rejects(h.guard.tick(500), /timeout/);
  assert.equal(h.guard.disarmed, true);
});

// Exercise a real WebSocket HTTP Upgrade and framed RPC over an in-memory socket.
// This needs no listening socket and works in the restricted coding sandbox.
import { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { connect, controlSocketPath } from "./codex-quota-guard.mjs";

function memorySocketPair() {
  let left, right;
  const make = (peer) => {
    const stream = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        peer().push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        peer().push(null);
        callback();
      },
    });
    stream.setTimeout = () => stream;
    stream.setNoDelay = () => stream;
    stream.setKeepAlive = () => stream;
    return stream;
  };
  left = make(() => right);
  right = make(() => left);
  return [left, right];
}
function fakeDaemon(onMessage) {
  const [clientSocket, serverSocket] = memorySocketPair();
  const server = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });
  let request = Buffer.alloc(0);
  let sawUpgrade = false;
  const readRequest = (chunk) => {
    request = Buffer.concat([request, chunk]);
    const end = request.indexOf("\r\n\r\n");
    if (end < 0) return;
    serverSocket.removeListener("data", readRequest);
    const lines = request.subarray(0, end).toString().split("\r\n");
    assert.match(lines[0], /^GET \/ HTTP\/1.1$/);
    const headers = Object.fromEntries(
      lines.slice(1).map((line) => {
        const colon = line.indexOf(":");
        return [
          line.slice(0, colon).toLowerCase(),
          line.slice(colon + 1).trim(),
        ];
      }),
    );
    assert.equal(headers.upgrade.toLowerCase(), "websocket");
    sawUpgrade = true;
    server.handleUpgrade(
      { method: "GET", headers, url: "/", socket: serverSocket },
      serverSocket,
      request.subarray(end + 4),
      (socket) => {
        socket.on("message", (raw) =>
          onMessage(socket, JSON.parse(raw.toString())),
        );
      },
    );
  };
  serverSocket.on("data", readRequest);
  return {
    createConnection: () => clientSocket,
    upgraded: () => sawUpgrade,
    close: () => {
      for (const client of server.clients) client.terminate();
      clientSocket.destroy();
      serverSocket.destroy();
      server.close();
    },
  };
}

test("control connection upgrades to WebSocket before initialize and correlates RPC responses", async () => {
  const methods = [];
  const daemon = fakeDaemon((socket, message) => {
    methods.push(message.method);
    if (message.id !== undefined)
      socket.send(
        JSON.stringify({ id: message.id, result: { ok: message.method } }),
      );
  });
  const client = connect("/unused/test.sock", {
    createConnection: daemon.createConnection,
    timeoutMs: 1000,
  });
  try {
    assert.deepEqual(
      await client.rpc("initialize", {
        clientInfo: { name: "test", version: "1" },
      }),
      { ok: "initialize" },
    );
    client.notify("initialized");
    assert.deepEqual(await client.rpc("account/rateLimits/read", {}), {
      ok: "account/rateLimits/read",
    });
    assert.equal(daemon.upgraded(), true);
    assert.deepEqual(methods, [
      "initialize",
      "initialized",
      "account/rateLimits/read",
    ]);
  } finally {
    client.close();
    daemon.close();
  }
});

test("connected daemon that does not answer initialize produces an RPC timeout", async () => {
  const daemon = fakeDaemon(() => {});
  const client = connect("/unused/test.sock", {
    createConnection: daemon.createConnection,
    timeoutMs: 100,
  });
  try {
    await assert.rejects(
      client.rpc("initialize", {}),
      /Timed out: initialize after WebSocket connected/,
    );
  } finally {
    client.close();
    daemon.close();
  }
});

test("custom socket and CODEX_HOME selection do not change process environment", () => {
  assert.equal(
    controlSocketPath("/custom/socket", "/home/test"),
    "/custom/socket",
  );
  assert.equal(
    controlSocketPath(undefined, "/tmp/test-codex"),
    "/tmp/test-codex/app-server-control/app-server-control.sock",
  );
});

test("explicit reset continuation starts from a completed turn exactly once", async () => {
  const h = harness(true, true);
  h.data.turn.status = "completed";
  h.data.limits = snapshot(100);
  await h.guard.tick(50);
  assert.equal(h.mutations().length, 0);
  assert.equal(h.guard.paused.kind, "idle");
  await h.guard.tick(110); // elapsed time alone is insufficient
  assert.equal(h.mutations().length, 0);
  h.data.limits = snapshot(0);
  await h.guard.tick(110);
  assert.equal(h.mutations().length, 1);
  assert.equal(h.mutations()[0].method, "turn/start");
  assert.match(
    h.mutations()[0].params.input[0].text,
    /unfinished project work/,
  );
  await h.guard.tick(120);
  assert.equal(h.mutations().length, 1);
});

test("scheduled idle continuation cancels if user starts another turn", async () => {
  const h = harness(true, true);
  h.data.turn.status = "completed";
  await h.guard.tick(50);
  h.data.turn = { id: "user-turn", status: "inProgress" };
  h.data.limits = snapshot(0);
  await h.guard.tick(200);
  assert.equal(h.guard.disarmed, true);
  assert.equal(h.mutations().length, 0);
});

test("idle continuation waits for both quota windows and stays blocked on unknown reset", async () => {
  const h = harness(true, true);
  h.data.turn.status = "completed";
  h.data.limits = snapshot(100, { usedPercent: 99, resetsAt: 300 });
  await h.guard.tick(50);
  h.data.limits = snapshot(0, { usedPercent: 99, resetsAt: 300 });
  await h.guard.tick(150);
  assert.equal(h.mutations().length, 0);
  h.data.limits = snapshot(0);
  await h.guard.tick(301);
  assert.equal(h.mutations().length, 0);
  await h.guard.tick(306);
  assert.equal(h.mutations().length, 1);
  const unknown = harness(true, true);
  unknown.data.turn.status = "completed";
  unknown.data.limits.rateLimits.primary.resetsAt = null;
  await unknown.guard.tick(50);
  unknown.data.limits = snapshot(0);
  await unknown.guard.tick(500);
  assert.equal(unknown.mutations().length, 0);
});

test("explicit continuation can start when quota reset before watcher launch", async () => {
  const h = harness(true, true);
  h.data.turn.status = "completed";
  h.data.limits = snapshot(0);
  await h.guard.tick(200);
  assert.equal(h.mutations().length, 0);
  await h.guard.tick(215);
  assert.equal(h.mutations().length, 1);
});
