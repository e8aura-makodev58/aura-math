import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as nodeProcess from "node:process";
import {
  ADMIN_HEADERS,
  ADMIN_PREFIX,
  DISCOVERY_PER_MINUTE,
  MAX_FAILED_UNLOCKS,
  TEST_CONFIRMATION,
  createAdminHandler,
  transportAllowed,
  type AdminRequest,
} from "../src/admin-server/handler";
import {
  CREDENTIALS_FILE,
  DataRootError,
  SETTINGS_FILE,
  SettingsStore,
  TOKEN_FILE,
  USAGE_FILE,
  defaultDataRoot,
  writeAtomic,
} from "../src/admin-server/store";
import {
  ProviderFailure,
  createAnthropicClient,
  createFakeTransport,
  createLiveTransport,
  filterModelIds,
  type AnthropicLike,
  type ProviderTransport,
} from "../src/admin-server/providers";
import { capabilitiesFor } from "../src/admin-server/catalogue";

const KEY = "sk-test-SECRET-key-material-9z7Q";
const OTHER_KEY = "or-test-OTHER-secret-material-4k2P";
const LOCAL = {
  remoteAddress: "127.0.0.1",
  host: "localhost:5195",
  origin: "http://localhost:5195",
};

let root: string;
let logs: string[];
let clock: Date;

beforeEach(async () => {
  root = join(await mkdtemp(join(tmpdir(), "aura-admin-")), "data");
  logs = [];
  clock = new Date(2026, 9, 11, 9, 0, 0);
});
afterEach(async () => {
  await rm(resolve(root, ".."), { recursive: true, force: true });
});

const openStore = () =>
  SettingsStore.open({
    root,
    forbiddenRoots: [nodeProcess.env.PWD ?? resolve(".")],
    now: () => clock,
    log: (line) => logs.push(line),
  });

function setup(transport: ProviderTransport = createFakeTransport()) {
  const opened = vi.fn(openStore);
  const spy = {
    listModels: vi.fn(transport.listModels.bind(transport)),
    testCall: vi.fn(transport.testCall.bind(transport)),
    generateJson: vi.fn(transport.generateJson.bind(transport)),
  };
  const handle = createAdminHandler({
    openStore: opened,
    transport: { kind: transport.kind, ...spy },
    now: () => clock.getTime(),
  });
  const replies: string[] = [];
  async function send(
    action: string,
    body: unknown,
    options: {
      token?: string | null;
      method?: string;
      origin?: string | null;
      host?: string;
      remoteAddress?: string;
      contentType?: string | null;
      raw?: string;
    } = {},
  ) {
    const headers: AdminRequest["headers"] = {
      host: options.host ?? LOCAL.host,
    };
    const origin = options.origin === undefined ? LOCAL.origin : options.origin;
    if (origin !== null) headers.origin = origin;
    const contentType =
      options.contentType === undefined
        ? "application/json"
        : options.contentType;
    if (contentType !== null) headers["content-type"] = contentType;
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await handle({
      method: options.method ?? "POST",
      path: ADMIN_PREFIX + action,
      remoteAddress: options.remoteAddress ?? LOCAL.remoteAddress,
      headers,
      body: options.raw ?? JSON.stringify(body),
    });
    replies.push(JSON.stringify(response));
    return response!;
  }
  return { handle, send, opened, spy, replies };
}

async function tokenOf() {
  return (await readFile(join(root, TOKEN_FILE), "utf8")).trim();
}

async function unlocked(transport?: ProviderTransport) {
  const harness = setup(transport);
  expect((await harness.send("read", {})).status).toBe(401);
  const token = await tokenOf();
  const send = (action: string, body: unknown, options = {}) =>
    harness.send(action, body, { token, ...options });
  return { ...harness, token, send };
}

const save = (overrides: Record<string, unknown> = {}) => ({
  provider: "anthropic",
  model: "claude-opus-5-5",
  enabled: false,
  dailyCapUsd: 1,
  price: null,
  ...overrides,
});

const mode = async (path: string) => (await stat(path)).mode & 0o777;

describe("data root and token", () => {
  it("defaults outside the repository and refuses a relative override", () => {
    expect(defaultDataRoot({ HOME: "/home/x", XDG_DATA_HOME: "/data/x" })).toBe(
      "/data/x/aura-math",
    );
    expect(() =>
      defaultDataRoot({ AURA_MATH_DATA_DIR: "relative/dir" }),
    ).toThrow(DataRootError);
    expect(defaultDataRoot({ AURA_MATH_DATA_DIR: "/tmp/abc" })).toBe(
      "/tmp/abc",
    );
  });

  it("creates nothing until the first admin request, then a 0700 root and 0600 token", async () => {
    const { send, opened } = setup();
    await expect(stat(root)).rejects.toThrow();
    expect(opened).not.toHaveBeenCalled();
    // Every route needs the token; a tokenless request is refused but creates the token.
    const reply = await send("read", {});
    expect(reply).toMatchObject({
      status: 401,
      body: { error: { code: "ADMIN_REQUIRED" } },
    });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(await mode(root)).toBe(0o700);
    expect(await mode(join(root, TOKEN_FILE))).toBe(0o600);
    const token = await tokenOf();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(reply)).not.toContain(token);
    // Printed once, with its path; a later process only prints the path.
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain(token);
    expect(logs[0]).toContain(join(root, TOKEN_FILE));
    await send("read", {});
    expect(opened).toHaveBeenCalledTimes(1);
    await openStore();
    expect(logs).toHaveLength(2);
    expect(logs[1]).not.toContain(token);
    expect(await tokenOf()).toBe(token);
  });

  it("refuses a short or tampered token file and fails closed", async () => {
    await openStore();
    await writeFile(join(root, TOKEN_FILE), "short");
    await expect(openStore()).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    const { send } = setup();
    expect((await send("read", {})).status).toBe(503);
  });

  it("refuses a data root inside the repository or a served folder, including through a symlink", async () => {
    const repo = resolve(".");
    await expect(
      SettingsStore.open({
        root: join(repo, ".aura-data-test"),
        forbiddenRoots: [repo],
      }),
    ).rejects.toBeInstanceOf(DataRootError);
    await expect(stat(join(repo, ".aura-data-test"))).rejects.toThrow();
    const served = join(root, "..", "served");
    await writeFile(join(root, "..", "placeholder"), "x");
    await symlinkDir(served, join(root, "..", "link"));
    await expect(
      SettingsStore.open({
        root: join(root, "..", "link", "inner"),
        forbiddenRoots: [served],
      }),
    ).rejects.toBeInstanceOf(DataRootError);
    const { send } = setup();
    // A refused root is reported to the admin with a safe message.
    const handler = createAdminHandler({
      openStore: () =>
        SettingsStore.open({ root: join(repo, ".x"), forbiddenRoots: [repo] }),
      transport: createFakeTransport(),
    });
    const reply = await handler({
      method: "POST",
      path: ADMIN_PREFIX + "read",
      remoteAddress: "127.0.0.1",
      headers: {
        host: LOCAL.host,
        origin: LOCAL.origin,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(reply).toMatchObject({
      status: 503,
      body: { error: { code: "DATA_ROOT_REFUSED" } },
    });
    expect(send).toBeDefined();
  });

  it("writes atomically: a failure before rename keeps the old file and leaves no temp file", async () => {
    await openStore();
    await writeAtomic(root, "sample.json", { value: 1 });
    expect(await mode(join(root, "sample.json"))).toBe(0o600);
    await expect(
      writeAtomic(
        root,
        "sample.json",
        { value: 2 },
        {
          beforeRename() {
            throw new Error("simulated crash");
          },
        },
      ),
    ).rejects.toThrow("simulated crash");
    expect(
      JSON.parse(await readFile(join(root, "sample.json"), "utf8")),
    ).toEqual({ value: 1 });
    expect(
      (await readdir(root)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("re-applies owner-only permissions to existing files and rejects corrupt settings", async () => {
    const { send } = await unlocked();
    await send("credential", { provider: "anthropic", apiKey: KEY });
    await chmod(join(root, CREDENTIALS_FILE), 0o644);
    await openStore();
    expect(await mode(join(root, CREDENTIALS_FILE))).toBe(0o600);
    expect(await mode(join(root, SETTINGS_FILE))).toBe(0o600);
    await writeFile(join(root, SETTINGS_FILE), "{not json");
    await expect(openStore()).rejects.toMatchObject({
      code: "SETTINGS_CORRUPT",
    });
  });

  it("loads a settings file written before a provider was added", async () => {
    const { send } = await unlocked();
    await send("credential", { provider: "anthropic", apiKey: KEY });
    const path = join(root, SETTINGS_FILE);
    const saved = JSON.parse(
      await (await import("node:fs/promises")).readFile(path, "utf8"),
    );
    delete saved.models.deepseek;
    await writeFile(path, JSON.stringify(saved));
    await expect(openStore()).resolves.toBeDefined();
  });
});

async function symlinkDir(target: string, link: string) {
  await rm(target, { recursive: true, force: true });
  await (await import("node:fs/promises")).mkdir(target, { recursive: true });
  await symlink(target, link);
}

describe("authorisation and transport", () => {
  it("accepts loopback http and same-origin https; refuses cross-origin, LAN http and missing Origin", () => {
    const req = (
      origin: string | undefined,
      host: string,
      remoteAddress: string,
    ) =>
      transportAllowed({
        method: "POST",
        path: ADMIN_PREFIX + "read",
        remoteAddress,
        headers: origin ? { origin, host } : { host },
        body: "{}",
      });
    expect(req("http://localhost:5195", "localhost:5195", "127.0.0.1")).toBe(
      true,
    );
    expect(
      req("http://127.0.0.1:5195", "127.0.0.1:5195", "::ffff:127.0.0.1"),
    ).toBe(true);
    expect(req("http://[::1]:5195", "[::1]:5195", "::1")).toBe(true);
    expect(req("https://tutor.example", "tutor.example", "192.168.1.20")).toBe(
      true,
    );
    expect(req(undefined, "localhost:5195", "127.0.0.1")).toBe(false);
    expect(req("http://localhost:5178", "localhost:5195", "127.0.0.1")).toBe(
      false,
    );
    expect(req("http://evil.example:5195", "localhost:5195", "127.0.0.1")).toBe(
      false,
    );
    expect(
      req("http://192.168.1.5:5195", "192.168.1.5:5195", "192.168.1.20"),
    ).toBe(false);
    expect(
      req("http://192.168.1.5:5195", "192.168.1.5:5195", "127.0.0.1"),
    ).toBe(false);
    expect(req("http://localhost:5195", "localhost:5195", "192.168.1.20")).toBe(
      false,
    );
    expect(req("https://other.example", "tutor.example", "192.168.1.20")).toBe(
      false,
    );
    expect(req("null", "localhost:5195", "127.0.0.1")).toBe(false);
  });

  it("rejects tunnelled requests: a loopback peer is never authentication", async () => {
    const { send, token } = await unlocked();
    const tunnel = {
      remoteAddress: "127.0.0.1",
      host: "aura-math.makodev58.com",
      origin: "https://aura-math.makodev58.com",
    };
    // Same-origin HTTPS through the tunnel still needs the token.
    const anonymous = await send("read", {}, { ...tunnel, token: null });
    expect(anonymous).toMatchObject({
      status: 401,
      body: { error: { code: "ADMIN_REQUIRED" } },
    });
    expect(JSON.stringify(anonymous)).not.toContain(token);
    for (const action of ["credential", "remove-key", "save", "models", "test"])
      expect((await send(action, {}, { ...tunnel, token: null })).status).toBe(
        401,
      );
    // With the host-header override (Host: localhost) an external Origin no longer matches.
    expect(
      (
        await send(
          "read",
          {},
          { ...tunnel, host: "localhost:5178", token: null },
        )
      ).status,
    ).toBe(403);
    // A forged local Origin through the proxy is refused because of the forwarding headers.
    const forged = await harnessRequest(token, {
      host: "localhost:5178",
      origin: "http://localhost:5178",
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(forged.status).toBe(403);
    // A real tunnelled request with the token works (HTTPS same origin).
    expect((await send("read", {}, tunnel)).status).toBe(200);
  });

  it("requires the token; 401 on wrong or missing, 429 after 20 failures, valid token still works", async () => {
    const { send, token } = await unlocked();
    expect((await send("read", {}, { token: null })).status).toBe(401);
    expect((await send("read", {}, { token: "wrong" })).status).toBe(401);
    expect((await send("read", {}, { token: token + "x" })).status).toBe(401);
    for (let i = 2; i < MAX_FAILED_UNLOCKS; i++)
      expect((await send("read", {}, { token: "wrong" })).status).toBe(401);
    const locked = await send("read", {}, { token: "wrong" });
    expect(locked).toMatchObject({
      status: 429,
      body: { error: { code: "ADMIN_RATE_LIMIT" } },
    });
    // The limit is global, not per peer: a different (HTTPS) client is limited too.
    expect(
      (
        await send(
          "read",
          {},
          {
            token: "wrong",
            remoteAddress: "192.168.1.20",
            host: "tutor.example",
            origin: "https://tutor.example",
          },
        )
      ).status,
    ).toBe(429);
    expect((await send("read", {})).status).toBe(200);
    clock = new Date(clock.getTime() + 61_000);
    expect((await send("read", {}, { token: "wrong" })).status).toBe(401);
  });

  it("refuses wrong method, origin, content type, size and unknown actions before touching storage", async () => {
    const { send, opened } = setup();
    expect((await send("read", {}, { method: "GET" })).status).toBe(405);
    expect(
      (await send("read", {}, { origin: "http://localhost:5178" })).status,
    ).toBe(403);
    expect((await send("read", {}, { origin: null })).status).toBe(403);
    expect(
      (await send("read", {}, { remoteAddress: "192.168.1.20" })).status,
    ).toBe(403);
    expect((await send("read", {}, { contentType: "text/plain" })).status).toBe(
      415,
    );
    expect((await send("read", {}, { raw: "x".repeat(9000) })).status).toBe(
      413,
    );
    expect((await send("delete-everything", {})).status).toBe(404);
    expect(opened).not.toHaveBeenCalled();
    expect(
      await setup().handle({ ...base(), path: "/api/other" }),
    ).toBeUndefined();
  });

  it("sends no-store and nosniff headers", () => {
    expect(ADMIN_HEADERS["cache-control"]).toBe("no-store");
    expect(ADMIN_HEADERS["x-content-type-options"]).toBe("nosniff");
  });

  it("enforces exact fields and types", async () => {
    const { send } = await unlocked();
    expect((await send("read", { extra: 1 })).status).toBe(400);
    expect((await send("read", [], {})).status).toBe(400);
    expect((await send("read", null, { raw: "{" })).status).toBe(400);
    expect((await send("credential", { provider: "anthropic" })).status).toBe(
      400,
    );
    expect(
      (
        await send("credential", {
          provider: "anthropic",
          apiKey: KEY,
          extra: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (await send("credential", { provider: "anthropic", apiKey: 12345678 }))
        .status,
    ).toBe(400);
    expect(
      (await send("credential", { provider: "acme", apiKey: KEY })).status,
    ).toBe(400);
    expect(
      (
        await send("credential", {
          provider: "anthropic",
          apiKey: "has space x",
        })
      ).status,
    ).toBe(400);
    expect((await send("save", save({ enabled: "yes" }))).status).toBe(400);
    expect((await send("save", save({ model: "bad model id" }))).status).toBe(
      400,
    );
    expect((await send("save", save({ dailyCapUsd: 0 }))).status).toBe(400);
    expect((await send("save", save({ dailyCapUsd: 1.005 }))).status).toBe(400);
    expect((await send("save", save({ dailyCapUsd: 101 }))).status).toBe(400);
    expect(
      (await send("save", save({ price: { inputUsdPerMTok: 1 } }))).status,
    ).toBe(400);
    expect(
      (
        await send(
          "save",
          save({ price: { inputUsdPerMTok: -1, outputUsdPerMTok: 2 } }),
        )
      ).status,
    ).toBe(400);
    const { model: _model, ...missing } = save();
    void _model;
    expect((await send("save", missing)).status).toBe(400);
    expect(
      (await send("test", { confirm: TEST_CONFIRMATION, extra: 1 })).status,
    ).toBe(400);
  });
});

async function harnessRequest(token: string, headers: Record<string, string>) {
  const handler = createAdminHandler({
    openStore,
    transport: createFakeTransport(),
  });
  return (await handler({
    method: "POST",
    path: ADMIN_PREFIX + "read",
    remoteAddress: "127.0.0.1",
    headers: {
      ...headers,
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: "{}",
  }))!;
}

function base(): AdminRequest {
  return {
    method: "POST",
    path: ADMIN_PREFIX + "read",
    remoteAddress: "127.0.0.1",
    headers: {
      host: LOCAL.host,
      origin: LOCAL.origin,
      "content-type": "application/json",
    },
    body: "{}",
  };
}

describe("write-only keys and settings", () => {
  it("never returns or logs a key; shows only ••••last4; replace and remove work", async () => {
    const { send, replies } = await unlocked();
    const first = await send("read", {});
    expect(first.body).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-5-5",
      enabled: false,
      dailyCapUsd: 1,
      transport: "fake",
      spend: { todayUsd: 0, monthUsd: 0 },
    });
    const saved = await send("credential", {
      provider: "anthropic",
      apiKey: KEY,
    });
    expect(saved.status).toBe(200);
    const anthropic = (
      saved.body as { providers: { id: string }[] }
    ).providers.find((entry) => entry.id === "anthropic");
    expect(anthropic).toMatchObject({
      credentialConfigured: true,
      credentialHint: "••••9z7Q",
    });
    await send("credential", { provider: "openrouter", apiKey: OTHER_KEY });
    await send("credential", {
      provider: "anthropic",
      apiKey: KEY.replace("9z7Q", "aaaa"),
    });
    const replaced = await send("read", {});
    expect(JSON.stringify(replaced.body)).toContain("••••aaaa");
    // Stored on disk owner-only, and only there.
    const stored = JSON.parse(
      await readFile(join(root, CREDENTIALS_FILE), "utf8"),
    );
    expect(stored.openrouter).toBe(OTHER_KEY);
    expect(await mode(join(root, CREDENTIALS_FILE))).toBe(0o600);
    expect(await readFile(join(root, SETTINGS_FILE), "utf8")).not.toContain(
      OTHER_KEY,
    );
    await send("models", { provider: "anthropic" });
    await send("test", { confirm: TEST_CONFIRMATION });
    const removed = await send("remove-key", { provider: "openrouter" });
    expect(JSON.stringify(removed.body)).not.toContain("••••4k2P");
    for (const reply of replies) {
      expect(reply).not.toContain(KEY);
      expect(reply).not.toContain(OTHER_KEY);
      expect(reply).not.toContain(KEY.slice(0, 20));
    }
    for (const line of logs) {
      expect(line).not.toContain(KEY);
      expect(line).not.toContain(OTHER_KEY);
    }
  });

  it("changes the revision on every write and persists across a restart", async () => {
    const { send } = await unlocked();
    const a = (await send("read", {})).body as { revision: string };
    const b = (await send("save", save({ dailyCapUsd: 2.5 }))).body as {
      revision: string;
    };
    const c = (await send("credential", { provider: "openai", apiKey: KEY }))
      .body as {
      revision: string;
    };
    expect(new Set([a.revision, b.revision, c.revision]).size).toBe(3);
    const reopened = (await openStore()).snapshot();
    expect(reopened.dailyCapUsd).toBe(2.5);
    expect(reopened.revision).toBe(c.revision);
  });

  it("refuses to enable without a key or a price, and disables when the active key is removed", async () => {
    const { send } = await unlocked();
    expect(await send("save", save({ enabled: true }))).toMatchObject({
      status: 400,
    });
    await send("credential", { provider: "anthropic", apiKey: KEY });
    const on = await send("save", save({ enabled: true }));
    expect(on.body).toMatchObject({ enabled: true, liveReady: true });
    await send("credential", { provider: "openai", apiKey: OTHER_KEY });
    const noPrice = await send(
      "save",
      save({ provider: "openai", model: "fake-openai-small", enabled: true }),
    );
    expect(noPrice).toMatchObject({
      status: 400,
      body: { error: { code: "PRICE_UNKNOWN" } },
    });
    const priced = await send(
      "save",
      save({
        provider: "openai",
        model: "fake-openai-small",
        enabled: true,
        price: { inputUsdPerMTok: 0.5, outputUsdPerMTok: 1.5 },
      }),
    );
    expect(priced.body).toMatchObject({
      provider: "openai",
      enabled: true,
      liveReady: true,
    });
    const prices = (
      priced.body as {
        prices: { model: string; source: string; verified: boolean }[];
      }
    ).prices;
    expect(
      prices.find((entry) => entry.model === "fake-openai-small"),
    ).toMatchObject({
      source: "admin",
      verified: true,
    });
    expect(
      prices.find((entry) => entry.model === "claude-opus-5-5"),
    ).toMatchObject({
      source: "bundled-unverified",
      verified: false,
    });
    const off = await send("remove-key", { provider: "openai" });
    expect(off.body).toMatchObject({ enabled: false, liveReady: false });
  });

  it("reports per-model capabilities", () => {
    expect(capabilitiesFor("anthropic", "claude-opus-5-5")).toMatchObject({
      effort: true,
      fallbacks: true,
      known: true,
    });
    expect(capabilitiesFor("anthropic", "claude-haiku-4-5")).toMatchObject({
      effort: false,
      fallbacks: false,
    });
    expect(capabilitiesFor("openai", "gpt-anything").known).toBe(false);
  });
});

describe("dollar budget", () => {
  it("refuses live calls for a model with no price, without calling the provider", async () => {
    const { send, spy } = await unlocked();
    await send("credential", { provider: "anthropic", apiKey: KEY });
    await send("save", save({ model: "claude-sonnet-5-5" }));
    const reply = await send("test", { confirm: TEST_CONFIRMATION });
    expect(reply).toMatchObject({
      status: 409,
      body: { error: { code: "PRICE_UNKNOWN" } },
    });
    expect(spy.testCall).not.toHaveBeenCalled();
  });

  it("requires the confirm string for the paid test", async () => {
    const { send, spy } = await unlocked();
    await send("credential", { provider: "anthropic", apiKey: KEY });
    expect((await send("test", { confirm: "yes" })).status).toBe(400);
    expect((await send("test", {})).status).toBe(400);
    expect(spy.testCall).not.toHaveBeenCalled();
    expect(
      (await send("test", { confirm: TEST_CONFIRMATION })).body,
    ).toMatchObject({
      status: "PASS",
    });
    expect(spy.testCall).toHaveBeenCalledTimes(1);
  });

  it("reserves the worst case, writes it before the call, then settles from reported usage", async () => {
    let usageDuringCall = "";
    const transport: ProviderTransport = {
      kind: "fake",
      listModels: async () => [],
      testCall: async () => {
        usageDuringCall = await readFile(join(root, USAGE_FILE), "utf8");
        return { inputTokens: 20, outputTokens: 8 };
      },
      generateJson: async () => ({ text: "" }),
    };
    const { send } = await unlocked(transport);
    await send("credential", { provider: "anthropic", apiKey: KEY });
    const reply = await send("test", { confirm: TEST_CONFIRMATION });
    // Worst case: (ceil(48/2)+64) input × $4/M + 64 output × $20/M = 352 + 1280 micro-dollars.
    expect(JSON.parse(usageDuringCall).todayMicroUsd).toBe(1632);
    // Settled: 20 × $4/M + 8 × $20/M = 240 micro-dollars.
    expect(reply.body).toMatchObject({
      status: "PASS",
      costUsd: 0.00024,
      snapshot: {
        spend: { todayUsd: 0.00024, monthUsd: 0.00024, callsToday: 1 },
      },
    });
  });

  it("enforces the daily cap and rolls over by local day and month", async () => {
    const store = await openStore();
    await store.saveCredential("anthropic", KEY);
    await store.save({
      ...save(),
      provider: "anthropic",
      dailyCapUsd: 0.02,
    } as never);
    const request = {
      provider: "anthropic" as const,
      model: "claude-opus-5-5",
      inputTokens: 1000,
      maxOutputTokens: 350,
    };
    // 1000 × 4 + 350 × 20 = 11000 micro-dollars; a second one would exceed US$0.02.
    const first = await store.reserve(request);
    await expect(store.reserve(request)).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
    });
    await store.settle(
      first,
      { kind: "usage", inputTokens: 1000, outputTokens: 50 },
      true,
    );
    expect(store.snapshot().spend.todayUsd).toBeCloseTo(0.005, 9);
    const second = await store.reserve(request);
    await store.settle(second, { kind: "not-charged" }, false);
    expect(store.snapshot().spend.todayUsd).toBeCloseTo(0.005, 9);
    const third = await store.reserve({
      ...request,
      inputTokens: 100,
      maxOutputTokens: 10,
    });
    await store.settle(third, { kind: "unknown" }, false);
    expect(store.snapshot().spend.todayUsd).toBeCloseTo(0.0056, 9);
    clock = new Date(2026, 9, 12, 0, 0, 1);
    expect(store.snapshot().spend).toMatchObject({
      todayUsd: 0,
      callsToday: 0,
    });
    expect(store.snapshot().spend.monthUsd).toBeCloseTo(0.0056, 9);
    // A reservation made yesterday settles against yesterday only.
    clock = new Date(2026, 9, 12, 23, 59, 0);
    const late = await store.reserve(request);
    clock = new Date(2026, 10, 1, 0, 1, 0);
    await store.settle(
      late,
      { kind: "usage", inputTokens: 1, outputTokens: 1 },
      true,
    );
    expect(store.snapshot().spend).toMatchObject({ todayUsd: 0, monthUsd: 0 });
    // Usage survives a restart.
    clock = new Date(2026, 10, 1, 10, 0, 0);
    const again = await store.reserve(request);
    await store.settle(
      again,
      { kind: "usage", inputTokens: 1000, outputTokens: 0 },
      true,
    );
    expect((await openStore()).snapshot().spend.todayUsd).toBeCloseTo(0.004, 9);
  });

  it("opens the circuit breaker after three failures and closes it after ten minutes", async () => {
    const failing: ProviderTransport = {
      kind: "fake",
      listModels: async () => [],
      testCall: async () => {
        throw new ProviderFailure("http", 401);
      },
      generateJson: async () => ({ text: "" }),
    };
    const { send, spy } = await unlocked(failing);
    await send("credential", { provider: "anthropic", apiKey: KEY });
    for (let i = 0; i < 3; i++) {
      const reply = await send("test", { confirm: TEST_CONFIRMATION });
      expect(reply.body).toMatchObject({
        status: "UNAVAILABLE",
        costUsd: 0,
        message: "The provider rejected the key. Check or replace the key.",
      });
    }
    const paused = await send("test", { confirm: TEST_CONFIRMATION });
    expect(paused).toMatchObject({
      status: 409,
      body: { error: { code: "BREAKER_OPEN" } },
    });
    expect(spy.testCall).toHaveBeenCalledTimes(3);
    expect((await send("read", {})).body).toMatchObject({
      breaker: { open: true },
    });
    clock = new Date(clock.getTime() + 10 * 60_000 + 1);
    expect((await send("read", {})).body).toMatchObject({
      breaker: { open: false },
    });
  });
});

describe("discovery", () => {
  it("lists models with a key, and tells the admin to enter an id when discovery fails", async () => {
    const { send } = await unlocked();
    expect((await send("models", { provider: "anthropic" })).status).toBe(400);
    await send("credential", { provider: "anthropic", apiKey: KEY });
    await send("credential", { provider: "openrouter", apiKey: OTHER_KEY });
    expect(
      (await send("models", { provider: "anthropic" })).body,
    ).toMatchObject({
      status: "READY",
      models: ["claude-haiku-4-5", "claude-opus-5-5", "claude-sonnet-5-5"],
    });
    const failed = await send("models", { provider: "openrouter" });
    expect(failed.body).toMatchObject({ status: "UNAVAILABLE", models: [] });
    expect((failed.body as { message: string }).message).toMatch(
      /Enter the exact model ID/,
    );
  });

  it("rate-limits discovery calls to the provider", async () => {
    const { send, spy } = await unlocked();
    await send("credential", { provider: "openrouter", apiKey: OTHER_KEY });
    for (let i = 0; i < DISCOVERY_PER_MINUTE + 2; i++)
      expect(
        (await send("models", { provider: "openrouter" })).body,
      ).toMatchObject({
        status: "UNAVAILABLE",
      });
    expect(spy.listModels).toHaveBeenCalledTimes(DISCOVERY_PER_MINUTE);
    clock = new Date(clock.getTime() + 61_000);
    await send("models", { provider: "openrouter" });
    expect(spy.listModels).toHaveBeenCalledTimes(DISCOVERY_PER_MINUTE + 1);
  });

  it("filters ids like aura-health", () => {
    expect(
      filterModelIds("openai", [
        "gpt-x",
        "text-embedding-3",
        "whisper-1",
        "",
        5,
        "a b",
        "gpt-x",
      ]),
    ).toEqual(["gpt-x"]);
    expect(filterModelIds("anthropic", ["claude-opus-5-5", "other"])).toEqual([
      "claude-opus-5-5",
    ]);
  });
});

describe("live transport with fakes (no network)", () => {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("uses fixed endpoints, max_completion_tokens and store:false for OpenAI, no redirects", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const transport = createLiveTransport({
      env: {},
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return url.endsWith("/models")
          ? reply(200, { data: [{ id: "gpt-z" }, { id: "dall-e-3" }] })
          : reply(200, {
              model: "gpt-z",
              usage: { prompt_tokens: 12, completion_tokens: 3 },
              choices: [{ finish_reason: "stop" }],
            });
      },
    });
    expect(await transport.listModels("openai", KEY)).toEqual(["gpt-z"]);
    const result = await transport.testCall(
      "openai",
      KEY,
      "gpt-z",
      capabilitiesFor("openai", "gpt-z"),
    );
    expect(result).toEqual({
      inputTokens: 12,
      outputTokens: 3,
      servedModel: "gpt-z",
      stopReason: "stop",
    });
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.openai.com/v1/models",
      "https://api.openai.com/v1/chat/completions",
    ]);
    const payload = JSON.parse(calls[1].init.body as string);
    expect(payload).toMatchObject({
      max_completion_tokens: 64,
      store: false,
      stream: false,
    });
    expect(payload).not.toHaveProperty("max_tokens");
    expect(calls[1].init.redirect).toBe("error");
    await transport.testCall(
      "openrouter",
      KEY,
      "vendor/model",
      capabilitiesFor("openrouter", "x"),
    );
    expect(calls[2].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(calls[2].init.body as string)).toMatchObject({
      max_tokens: 64,
    });
    await transport.testCall(
      "deepseek",
      KEY,
      "deepseek-chat",
      capabilitiesFor("deepseek", "deepseek-chat"),
    );
    expect(calls[3].url).toBe("https://api.deepseek.com/v1/chat/completions");
    const deepseek = JSON.parse(calls[3].init.body as string);
    expect(deepseek).toMatchObject({
      max_tokens: 64,
      thinking: { type: "disabled" },
    });
    expect(deepseek).not.toHaveProperty("max_completion_tokens");
  });

  it("reduces provider errors to a status without the body, and caps reply size", async () => {
    const transport = createLiveTransport({
      env: {},
      fetchImpl: async (url) =>
        url.endsWith("/models")
          ? reply(200, { data: [{ id: "x".repeat(2_000_000) }] })
          : reply(401, { error: { message: `bad key ${KEY}` } }),
    });
    const error = await transport
      .testCall("openai", KEY, "gpt-z", capabilitiesFor("openai", "gpt-z"))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderFailure);
    expect(error).toMatchObject({ kind: "http", status: 401 });
    expect(String((error as Error).message)).not.toContain(KEY);
    await expect(transport.listModels("openai", KEY)).rejects.toMatchObject({
      kind: "invalid",
    });
    const network = createLiveTransport({
      env: {},
      fetchImpl: async () => {
        throw new Error(`connect failed ${KEY}`);
      },
    });
    const failure = await network
      .listModels("openai", KEY)
      .catch((caught: unknown) => caught);
    expect(failure).toMatchObject({ kind: "network" });
    expect(String((failure as Error).message)).not.toContain(KEY);
  });

  it("refuses when NODE_USE_ENV_PROXY is set", async () => {
    const fetchImpl = vi.fn();
    const transport = createLiveTransport({
      env: { NODE_USE_ENV_PROXY: "1" },
      fetchImpl,
    });
    await expect(transport.listModels("openai", KEY)).rejects.toMatchObject({
      kind: "network",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends effort only where the capability table allows it", async () => {
    const created: unknown[] = [];
    const client: AnthropicLike = {
      models: {
        async *list() {
          yield { id: "claude-opus-5-5" };
          yield { id: "not-claude" };
        },
      },
      messages: {
        create: async (params) => {
          created.push(params);
          return {
            model: params.model,
            stop_reason: "end_turn",
            usage: { input_tokens: 9, output_tokens: 4 },
          };
        },
      },
    };
    const transport = createLiveTransport({
      env: {},
      anthropic: async () => client,
    });
    expect(await transport.listModels("anthropic", KEY)).toEqual([
      "claude-opus-5-5",
    ]);
    await transport.testCall(
      "anthropic",
      KEY,
      "claude-opus-5-5",
      capabilitiesFor("anthropic", "claude-opus-5-5"),
    );
    await transport.testCall(
      "anthropic",
      KEY,
      "claude-haiku-4-5",
      capabilitiesFor("anthropic", "claude-haiku-4-5"),
    );
    expect(created[0]).toMatchObject({
      output_config: { effort: "low" },
      max_tokens: 64,
    });
    expect(created[1]).not.toHaveProperty("output_config");
    const failing = createLiveTransport({
      env: {},
      anthropic: async () => ({
        ...client,
        messages: {
          create: async () => {
            throw Object.assign(new Error(`401 ${KEY}`), { status: 401 });
          },
        },
      }),
    });
    const error = await failing
      .testCall(
        "anthropic",
        KEY,
        "claude-opus-5-5",
        capabilitiesFor("anthropic", "claude-opus-5-5"),
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: "http", status: 401 });
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it("builds the SDK client with a fixed base URL, no auth token and no retries, ignoring the environment", async () => {
    const saved = {
      base: nodeProcess.env.ANTHROPIC_BASE_URL,
      auth: nodeProcess.env.ANTHROPIC_AUTH_TOKEN,
    };
    nodeProcess.env.ANTHROPIC_BASE_URL = "https://attacker.example";
    nodeProcess.env.ANTHROPIC_AUTH_TOKEN = "env-token-should-not-be-used";
    try {
      const client = (await createAnthropicClient(KEY)) as unknown as {
        baseURL: string;
        authToken: string | null;
        maxRetries: number;
      };
      expect(client.baseURL).toBe("https://api.anthropic.com");
      expect(client.authToken).toBeNull();
      expect(client.maxRetries).toBe(0);
    } finally {
      if (saved.base === undefined) delete nodeProcess.env.ANTHROPIC_BASE_URL;
      else nodeProcess.env.ANTHROPIC_BASE_URL = saved.base;
      if (saved.auth === undefined) delete nodeProcess.env.ANTHROPIC_AUTH_TOKEN;
      else nodeProcess.env.ANTHROPIC_AUTH_TOKEN = saved.auth;
    }
  });
});

// Loaded by path so `tsc` does not type-check the untyped scripts (the project has no @types/node).
const load = (path: string) => import(/* @vite-ignore */ resolve(path));

describe("Vite wiring", () => {
  it("registers nothing under Vitest, so npm test creates no data root or token", async () => {
    const { adminSettingsPlugin } = await load(
      "scripts/admin-settings-plugin.ts",
    );
    const plugin = adminSettingsPlugin();
    expect(plugin.apply).toBe("serve");
    const use = vi.fn();
    plugin.configureServer({
      middlewares: { use },
      config: { server: { allowedHosts: [] } },
    });
    expect(use).not.toHaveBeenCalled();
  });

  it("never sets allowedHosts: true and builds admin.html only in the author build", async () => {
    const config = (await load("vite.config.ts")).default;
    expect(config.server?.allowedHosts).not.toBe(true);
    expect(config.build?.rollupOptions?.input?.admin).toBe("admin.html");
  });
});
