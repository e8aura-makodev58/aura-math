/**
 * Framework-free request handling for `/api/admin/settings/*`, adapted to Vite by
 * `scripts/admin-settings-plugin.ts` (development server only). Server-side only.
 *
 * Access needs all of:
 * - transport (R-116): a same-origin `Origin` that is either `https://<Host>`, or plain HTTP on a
 *   loopback host name from a loopback socket peer with no proxy forwarding headers. This is a
 *   browser same-origin check, never authentication: the Cloudflare tunnel delivers internet
 *   requests from a loopback peer. Vite's host validation (`allowedHosts`, never `true`) runs
 *   before this and is what defeats DNS rebinding;
 * - `Content-Type: application/json` (forces a CORS preflight for any cross-site form);
 * - the admin token as `Authorization: Bearer` on every route, compared in constant time. Failed
 *   guesses are counted globally (all tunnelled peers look like 127.0.0.1): twenty a minute give
 *   429, but a valid token still works (R-124). The first admin request of any kind creates the
 *   data root and token lazily (R-119); the token is printed only to the server console.
 *
 * Every body has an exact field set. Replies never contain a key: only `••••last4` hints.
 */
import { Buffer } from "node:buffer";
import {
  MODEL_ID_PATTERN,
  capabilitiesFor,
  isProviderId,
  type ProviderId,
} from "./catalogue";
import {
  ProviderFailure,
  TEST_MAX_OUTPUT_TOKENS,
  TEST_PROMPT,
  type ProviderTransport,
} from "./providers";
import { SettingsError, type SettingsStore } from "./store";
import {
  MAX_STORY_COUNT,
  estimateInputTokens,
  storyRequest,
  validateCandidates,
} from "./story-generation";
import { StoryQueue, readApprovedForPublic } from "./story-queue";
import {
  STORY_SLOTS_PROMPT_VERSION,
  isStorySlotProfile,
} from "../content/story-slots";

export const ADMIN_PREFIX = "/api/admin/settings/";
export const MAX_ADMIN_BODY_BYTES = 8192;
export const TEST_CONFIRMATION = "TEST_MAY_COST";
export const AUTH_WINDOW_MS = 60_000;
export const MAX_FAILED_UNLOCKS = 20;
export const DISCOVERY_PER_MINUTE = 12;
const DISCOVERY_CACHE_MS = 10 * 60_000;

export interface AdminRequest {
  method: string;
  path: string;
  remoteAddress: string | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  /** Set by the adapter when the body exceeded MAX_ADMIN_BODY_BYTES. */
  bodyTooLarge?: boolean;
}

export interface AdminResponse {
  status: number;
  body: unknown;
}

export interface AdminDeps {
  /** Opens the store; called at most once, on the first admin request. */
  openStore(): Promise<SettingsStore>;
  transport: ProviderTransport;
  now?(): number;
  /** Opens the story queue in the prepared data root; defaults to `StoryQueue.open`. */
  openStories?(root: string): Promise<StoryQueue>;
}

export const ADMIN_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const ACTIONS = new Set([
  "read",
  "credential",
  "remove-key",
  "save",
  "models",
  "test",
  "stories-generate",
  "stories-list",
  "stories-approve",
  "stories-reject",
  "stories-remove",
]);

const header = (req: AdminRequest, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Set by proxies such as cloudflared. Untrusted hints: they can only tighten the rules. */
const FORWARDING_HEADERS = [
  "cf-connecting-ip",
  "cf-ray",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
];

export const isLoopbackPeer = (address: string | undefined) =>
  address !== undefined && LOOPBACK_PEERS.has(address);

/** Same-origin HTTPS, or same-origin loopback HTTP from a loopback peer. */
export function transportAllowed(req: AdminRequest): boolean {
  const origin = header(req, "origin");
  const host = header(req, "host");
  if (!origin || !host) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin.toLowerCase().replace(/\/$/, "")) return false;
  if (parsed.host !== host.toLowerCase()) return false;
  if (parsed.protocol === "https:") return true;
  return (
    parsed.protocol === "http:" &&
    LOOPBACK_HOSTS.has(parsed.hostname) &&
    isLoopbackPeer(req.remoteAddress) &&
    !FORWARDING_HEADERS.some((name) => header(req, name) !== undefined)
  );
}

const fail = (
  status: number,
  code: string,
  message: string,
): AdminResponse => ({
  status,
  body: { error: { code, message } },
});

function exact(
  body: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new SettingsError(
      "INVALID_FIELDS",
      "The request body must be a JSON object.",
    );
  const keys = Object.keys(body);
  if (
    keys.length !== fields.length ||
    !fields.every((field) => keys.includes(field))
  )
    throw new SettingsError(
      "INVALID_FIELDS",
      "The request has missing or extra fields.",
    );
  return body as Record<string, unknown>;
}

function provider(value: unknown): ProviderId {
  if (!isProviderId(value))
    throw new SettingsError("INVALID_SETTINGS", "Select a supported provider.");
  return value;
}

function price(value: unknown) {
  if (value === null) return null;
  const body = exact(value, ["inputUsdPerMTok", "outputUsdPerMTok"]);
  if (
    typeof body.inputUsdPerMTok !== "number" ||
    typeof body.outputUsdPerMTok !== "number"
  )
    throw new SettingsError("INVALID_SETTINGS", "Prices must be numbers.");
  return {
    inputUsdPerMTok: body.inputUsdPerMTok,
    outputUsdPerMTok: body.outputUsdPerMTok,
  };
}

const failureMessage = (failure: ProviderFailure) => {
  if (
    failure.kind === "http" &&
    (failure.status === 401 || failure.status === 403)
  )
    return "The provider rejected the key. Check or replace the key.";
  if (failure.kind === "http" && failure.status === 404)
    return "The provider did not recognise the model. Check the model ID.";
  if (failure.kind === "http" && failure.status === 429)
    return "The provider is rate limiting this key. Try again later.";
  if (failure.kind === "http")
    return `The provider returned an error (HTTP ${failure.status}).`;
  if (failure.kind === "invalid")
    return "The provider's reply could not be read.";
  return "The provider could not be reached or timed out.";
};

export function createAdminHandler(deps: AdminDeps) {
  const now = deps.now ?? Date.now;
  let storePromise: Promise<SettingsStore> | undefined;
  const failures: number[] = [];
  const discoveries: number[] = [];
  const discovered = new Map<ProviderId, { at: number; models: string[] }>();
  let inFlight = false;
  let storiesPromise: Promise<StoryQueue> | undefined;

  const stories = (settings: SettingsStore) => {
    storiesPromise ??= (deps.openStories ?? StoryQueue.open)(settings.root);
    storiesPromise.catch(() => (storiesPromise = undefined));
    return storiesPromise;
  };

  const store = () => {
    storePromise ??= deps.openStore();
    // A failed open is retried on the next request (for example after fixing the folder).
    storePromise.catch(() => (storePromise = undefined));
    return storePromise;
  };

  function authorize(
    req: AdminRequest,
    settings: SettingsStore,
  ): AdminResponse | undefined {
    const at = now();
    while (failures.length && at - failures[0] > AUTH_WINDOW_MS)
      failures.shift();
    const supplied = header(req, "authorization") ?? "";
    const token = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";
    if (token && settings.verifyToken(token)) return undefined;
    // No token supplied is not a guess (the page sends this once to create the token).
    if (!token)
      return fail(401, "ADMIN_REQUIRED", "Unlock with the admin token.");
    if (failures.length >= MAX_FAILED_UNLOCKS)
      return fail(
        429,
        "ADMIN_RATE_LIMIT",
        "Too many unlock attempts. Wait a minute and try again.",
      );
    failures.push(at);
    return fail(401, "ADMIN_REQUIRED", "Unlock with the admin token.");
  }

  async function discover(settings: SettingsStore, id: ProviderId) {
    const key = settings.credentialFor(id);
    if (!key)
      throw new SettingsError(
        "INVALID_SETTINGS",
        "Save a key for this provider before refreshing models.",
      );
    const at = now();
    const cached = discovered.get(id);
    if (cached && at - cached.at < DISCOVERY_CACHE_MS)
      return { status: "READY", models: cached.models, cached: true };
    while (discoveries.length && at - discoveries[0] > 60_000)
      discoveries.shift();
    const unavailable = {
      status: "UNAVAILABLE",
      models: [] as string[],
      message:
        "Model discovery is unavailable. Enter the exact model ID from your provider console.",
    };
    if (discoveries.length >= DISCOVERY_PER_MINUTE) return unavailable;
    discoveries.push(at);
    try {
      const models = await deps.transport.listModels(id, key);
      discovered.set(id, { at, models });
      return { status: "READY", models, cached: false };
    } catch {
      return unavailable;
    }
  }

  async function connectionTest(settings: SettingsStore) {
    const { provider: id, model } = settings.current();
    const key = settings.credentialFor(id);
    if (!key || !model || !MODEL_ID_PATTERN.test(model))
      throw new SettingsError(
        "INVALID_SETTINGS",
        "Save a model and a key before testing.",
      );
    if (inFlight)
      throw new SettingsError(
        "BUSY",
        "A connection test is already running.",
        409,
      );
    inFlight = true;
    try {
      // Generous input estimate: about 2 characters per token plus message overhead.
      const reservation = await settings.reserve({
        provider: id,
        model,
        inputTokens: Math.ceil(TEST_PROMPT.length / 2) + 64,
        maxOutputTokens: TEST_MAX_OUTPUT_TOKENS,
      });
      try {
        const result = await deps.transport.testCall(
          id,
          key,
          model,
          capabilitiesFor(id, model),
        );
        const usage =
          result.inputTokens !== undefined && result.outputTokens !== undefined
            ? {
                kind: "usage" as const,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
              }
            : { kind: "unknown" as const };
        const { costUsd } = await settings.settle(reservation, usage, true);
        return {
          status: "PASS",
          servedModel:
            result.servedModel && MODEL_ID_PATTERN.test(result.servedModel)
              ? result.servedModel
              : null,
          stopReason:
            result.stopReason && /^[a-z_]{1,40}$/.test(result.stopReason)
              ? result.stopReason
              : null,
          costUsd,
          usageReported: usage.kind === "usage",
          snapshot: settings.snapshot(),
        };
      } catch (error) {
        const failure =
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure("network");
        // A provider error status means nothing was billed; otherwise keep the worst case.
        const { costUsd } = await settings.settle(
          reservation,
          failure.kind === "http"
            ? { kind: "not-charged" }
            : { kind: "unknown" },
          false,
        );
        return {
          status: "UNAVAILABLE",
          message: failureMessage(failure),
          costUsd,
          snapshot: settings.snapshot(),
        };
      }
    } finally {
      inFlight = false;
    }
  }

  /**
   * One provider call for up to ten slot sets for one profile, through the same reserve and settle
   * as the connection test. Refused before any call when live calls are off, the model has no
   * price, the cap would be exceeded, the breaker is open or the pending queue is full. A call that
   * yields no valid set counts as a failure for the circuit breaker (R-117). No retry.
   */
  async function generateStories(
    settings: SettingsStore,
    queue: StoryQueue,
    profileValue: unknown,
    countValue: unknown,
  ) {
    if (!isStorySlotProfile(profileValue))
      throw new SettingsError("INVALID_STORY", "Choose a story profile.");
    if (
      typeof countValue !== "number" ||
      !Number.isInteger(countValue) ||
      countValue < 1 ||
      countValue > MAX_STORY_COUNT
    )
      throw new SettingsError(
        "INVALID_STORY",
        `Ask for 1 to ${MAX_STORY_COUNT} stories.`,
      );
    const profile = profileValue,
      count = countValue;
    const snap = settings.snapshot();
    if (!snap.enabled)
      throw new SettingsError(
        "LIVE_OFF",
        "Live model calls are off. Turn them on in Live calls first.",
        409,
      );
    const { provider: id, model } = settings.current();
    const key = settings.credentialFor(id);
    if (!key || !model || !MODEL_ID_PATTERN.test(model))
      throw new SettingsError(
        "LIVE_OFF",
        "Save a model and a key before generating stories.",
        409,
      );
    if (queue.pendingRoom() < count)
      throw new SettingsError(
        "QUEUE_FULL",
        "The pending list is full. Approve or reject some stories first.",
        409,
      );
    if (inFlight)
      throw new SettingsError("BUSY", "A model call is already running.", 409);
    inFlight = true;
    try {
      const request = storyRequest(profile, count);
      const reservation = await settings.reserve({
        provider: id,
        model,
        inputTokens: estimateInputTokens(request),
        maxOutputTokens: request.maxOutputTokens,
      });
      let result;
      try {
        result = await deps.transport.generateJson(
          id,
          key,
          model,
          capabilitiesFor(id, model),
          request,
        );
      } catch (error) {
        const failure =
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure("network");
        const { costUsd } = await settings.settle(
          reservation,
          failure.kind === "http"
            ? { kind: "not-charged" }
            : { kind: "unknown" },
          false,
        );
        return {
          status: "UNAVAILABLE",
          message: failureMessage(failure),
          costUsd,
          kept: 0,
          dropped: 0,
          reasons: {},
          snapshot: settings.snapshot(),
          stories: queue.list(),
        };
      }
      const outcome = validateCandidates(
        profile,
        result.text,
        count,
        queue.knownKeys(),
      );
      const usage =
        result.inputTokens !== undefined && result.outputTokens !== undefined
          ? {
              kind: "usage" as const,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            }
          : { kind: "unknown" as const };
      let added: number;
      try {
        added = await queue.addPending(profile, outcome.kept, {
          provider: id,
          model,
          servedModel:
            result.servedModel && MODEL_ID_PATTERN.test(result.servedModel)
              ? result.servedModel
              : null,
          settingsRevision: snap.revision,
          promptVersion: STORY_SLOTS_PROMPT_VERSION,
          createdAt: new Date(now()).toISOString(),
        });
      } catch (error) {
        await settings.settle(reservation, usage, false);
        throw error;
      }
      const { costUsd } = await settings.settle(reservation, usage, added > 0);
      return {
        status: added > 0 ? "READY" : "NONE_VALID",
        costUsd,
        usageReported: usage.kind === "usage",
        received: outcome.received,
        kept: added,
        dropped: outcome.dropped + (outcome.kept.length - added),
        reasons: outcome.reasons,
        snapshot: settings.snapshot(),
        stories: queue.list(),
      };
    } finally {
      inFlight = false;
    }
  }

  async function dispatch(
    action: string,
    body: unknown,
    settings: SettingsStore,
  ) {
    switch (action) {
      case "read":
        exact(body, []);
        return settings.snapshot();
      case "credential": {
        const fields = exact(body, ["provider", "apiKey"]);
        return settings.saveCredential(
          provider(fields.provider),
          fields.apiKey as string,
        );
      }
      case "remove-key": {
        const fields = exact(body, ["provider"]);
        const id = provider(fields.provider);
        discovered.delete(id);
        return settings.removeCredential(id);
      }
      case "save": {
        const fields = exact(body, [
          "provider",
          "model",
          "enabled",
          "dailyCapUsd",
          "price",
        ]);
        if (
          typeof fields.model !== "string" ||
          typeof fields.enabled !== "boolean" ||
          typeof fields.dailyCapUsd !== "number"
        )
          throw new SettingsError(
            "INVALID_SETTINGS",
            "A settings field has the wrong type.",
          );
        return settings.save({
          provider: provider(fields.provider),
          model: fields.model.trim(),
          enabled: fields.enabled,
          dailyCapUsd: fields.dailyCapUsd,
          price: price(fields.price),
        });
      }
      case "models": {
        const fields = exact(body, ["provider"]);
        return discover(settings, provider(fields.provider));
      }
      case "test": {
        const fields = exact(body, ["confirm"]);
        if (fields.confirm !== TEST_CONFIRMATION)
          throw new SettingsError(
            "CONFIRM_REQUIRED",
            "Confirm that the connection test may cost money.",
          );
        return connectionTest(settings);
      }
      case "stories-generate": {
        const fields = exact(body, ["profile", "count"]);
        return generateStories(
          settings,
          await stories(settings),
          fields.profile,
          fields.count,
        );
      }
      case "stories-list":
        exact(body, []);
        return (await stories(settings)).list();
      case "stories-approve": {
        const fields = exact(body, ["id"]);
        return (await stories(settings)).approve(fields.id, new Date(now()));
      }
      case "stories-reject": {
        const fields = exact(body, ["id"]);
        return (await stories(settings)).reject(fields.id);
      }
      case "stories-remove": {
        const fields = exact(body, ["id"]);
        return (await stories(settings)).remove(fields.id);
      }
    }
    throw new SettingsError("UNKNOWN_ACTION", "Unknown settings command.", 404);
  }

  /** Returns undefined when the path is not an admin settings route. */
  return async function handleAdminRequest(
    req: AdminRequest,
  ): Promise<AdminResponse | undefined> {
    if (!req.path.startsWith(ADMIN_PREFIX)) return undefined;
    const action = req.path.slice(ADMIN_PREFIX.length);
    if (!ACTIONS.has(action))
      return fail(404, "UNKNOWN_ACTION", "Unknown settings command.");
    if (req.method !== "POST")
      return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");
    if (!transportAllowed(req))
      return fail(
        403,
        "ADMIN_TRANSPORT_REQUIRED",
        "Open settings on this computer (localhost) or over same-origin HTTPS.",
      );
    if (
      !(header(req, "content-type") ?? "")
        .toLowerCase()
        .startsWith("application/json")
    )
      return fail(415, "JSON_REQUIRED", "Send JSON.");
    if (req.bodyTooLarge || Buffer.byteLength(req.body) > MAX_ADMIN_BODY_BYTES)
      return fail(413, "BODY_TOO_LARGE", "The request is too large.");
    try {
      const settings = await store();
      const denied = authorize(req, settings);
      if (denied) return denied;
      const result = await dispatch(action, parse(req.body), settings);
      return {
        status: 200,
        body: { ...result, transport: deps.transport.kind },
      };
    } catch (error) {
      if (error instanceof SettingsError)
        return fail(error.status, error.code, error.message);
      return fail(
        503,
        "SETTINGS_UNAVAILABLE",
        "Settings could not be read or saved.",
      );
    }
  };
}

function parse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new SettingsError(
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }
}

export const PUBLIC_STORIES_PATH = "/api/stories/approved";
export const PUBLIC_STORIES_PER_MINUTE = 120;

export interface PublicStoryDeps {
  /** The configured data root; resolving it must not create anything. */
  root(): string;
  forbiddenRoots: readonly string[];
  now?(): number;
}

/**
 * Unauthenticated, read-only route for the development preview: `GET /api/stories/approved`
 * returns only adult-approved slot sets with an opaque id. It never opens the settings store, never
 * creates or writes a file, never calls a provider, and fails closed to an empty list. Requests are
 * counted globally (tunnelled peers all look like loopback): over the limit gives 429.
 */
export function createPublicStoryHandler(deps: PublicStoryDeps) {
  const now = deps.now ?? Date.now;
  const recent: number[] = [];
  return async function handlePublicStories(
    req: Pick<AdminRequest, "method" | "path">,
  ): Promise<AdminResponse | undefined> {
    if (req.path !== PUBLIC_STORIES_PATH) return undefined;
    if (req.method !== "GET")
      return fail(405, "METHOD_NOT_ALLOWED", "Use GET.");
    const at = now();
    while (recent.length && at - recent[0] > 60_000) recent.shift();
    if (recent.length >= PUBLIC_STORIES_PER_MINUTE)
      return fail(429, "RATE_LIMIT", "Too many requests. Try again soon.");
    recent.push(at);
    let sets: Awaited<ReturnType<typeof readApprovedForPublic>> = [];
    try {
      sets = await readApprovedForPublic(deps.root(), deps.forbiddenRoots);
    } catch {
      sets = [];
    }
    return { status: 200, body: { version: 1, sets } };
  };
}
