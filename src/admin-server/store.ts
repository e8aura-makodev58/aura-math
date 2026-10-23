/**
 * Owner-only settings store for the admin model settings (aura-health `SystemSettings` pattern).
 * Server-side only: loaded by the development-server plugin through `ssrLoadModule` and by tests.
 *
 * - The data root lives outside the repository and outside every `server.fs.allow` entry (after
 *   resolving symlinks), so Vite can never serve these files (R-120). Directory 0700, files 0600.
 * - Every write goes to a temporary file in the same directory, is fsynced, then renamed.
 * - Keys are write-only: nothing here returns a key except `credentialFor`, which only the request
 *   handler calls to make a provider request.
 * - Spend is counted in integer micro-dollars from reported usage, reserved at the worst case
 *   before a call and settled after (R-117). Usage has its own file so the settings revision does
 *   not churn on every call.
 */
import { Buffer } from "node:buffer";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import * as nodeProcess from "node:process";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import {
  DEFAULT_DAILY_CAP_USD,
  MAX_DAILY_CAP_USD,
  MAX_PRICE_USD_PER_MTOK,
  MODEL_ID_PATTERN,
  PROVIDERS,
  PROVIDER_IDS,
  SEED_PRICES,
  capabilitiesFor,
  isProviderId,
  type Capabilities,
  type PriceEntry,
  type ProviderId,
} from "./catalogue";

export const TOKEN_FILE = "admin.token";
export const SETTINGS_FILE = "provider-settings.json";
export const CREDENTIALS_FILE = "provider-credentials.json";
export const USAGE_FILE = "usage.json";
export const BREAKER_FAILURES = 3;
export const BREAKER_OPEN_MS = 10 * 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

/** A refusal whose message is safe to show the admin (no keys, no provider text). */
export class SettingsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export class DataRootError extends SettingsError {
  constructor(message: string) {
    super("DATA_ROOT_REFUSED", message, 503);
  }
}

/** `AURA_MATH_DATA_DIR`, else `${XDG_DATA_HOME:-~/.local/share}/aura-math`. Must be absolute. */
export function defaultDataRoot(
  env: Record<string, string | undefined> = nodeProcess.env,
): string {
  const configured = env.AURA_MATH_DATA_DIR;
  if (configured !== undefined && configured !== "") {
    if (!isAbsolute(configured))
      throw new DataRootError("AURA_MATH_DATA_DIR must be an absolute path.");
    return resolve(configured);
  }
  const xdg = env.XDG_DATA_HOME;
  const base =
    xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".local", "share");
  return join(base, "aura-math");
}

/** Real path of the deepest existing ancestor, with the missing tail re-appended. */
async function realOrPlanned(path: string): Promise<string> {
  const missing: string[] = [];
  let current = resolve(path);
  for (;;) {
    try {
      return join(await realpath(current), ...missing.reverse());
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolve(path);
      missing.push(basename(current));
      current = parent;
    }
  }
}

const inside = (child: string, parent: string) =>
  child === parent ||
  child.startsWith(parent.endsWith(sep) ? parent : parent + sep);

async function assertOutside(root: string, forbidden: readonly string[]) {
  for (const entry of forbidden) {
    const real = await realOrPlanned(entry);
    if (inside(root, real))
      throw new DataRootError(
        "The settings data folder must be outside the repository and outside every folder the development server may serve. Set AURA_MATH_DATA_DIR to an owner-only folder elsewhere.",
      );
  }
}

/**
 * Resolves, checks and creates the data root (0700). Checks before and after creation so a symlink
 * created in between cannot move the root into a served folder.
 */
export async function prepareDataRoot(
  root: string,
  forbidden: readonly string[],
): Promise<string> {
  if (!isAbsolute(root))
    throw new DataRootError(
      "The settings data folder must be an absolute path.",
    );
  await assertOutside(await realOrPlanned(root), forbidden);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const real = await realpath(root);
  await assertOutside(real, forbidden);
  const info = await stat(real);
  if (!info.isDirectory())
    throw new DataRootError("The settings data folder is not a directory.");
  if (
    typeof nodeProcess.getuid === "function" &&
    info.uid !== nodeProcess.getuid()
  )
    throw new DataRootError(
      "The settings data folder is owned by another user.",
    );
  await chmod(real, 0o700);
  return real;
}

export interface AtomicHooks {
  /** Test hook: runs after the temporary file is fsynced and before the rename. */
  beforeRename?(name: string): void | Promise<void>;
}

export async function writeAtomic(
  dir: string,
  name: string,
  value: unknown,
  hooks: AtomicHooks = {},
): Promise<void> {
  const temporary = join(dir, `.${name}.${randomBytes(8).toString("hex")}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    try {
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await hooks.beforeRename?.(name);
    await rename(temporary, join(dir, name));
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function readOwnerOnly(dir: string, name: string): Promise<unknown> {
  const path = join(dir, name);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
  await chmod(path, 0o600);
  try {
    return JSON.parse(text);
  } catch {
    throw new SettingsError(
      "SETTINGS_CORRUPT",
      `The settings file ${name} could not be read. Fix or remove it in the data folder.`,
      503,
    );
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Creates the token exclusively at 0600 if missing, otherwise checks and reads it. */
export async function loadOrCreateToken(
  root: string,
  log: (line: string) => void,
): Promise<string> {
  const path = join(root, TOKEN_FILE);
  try {
    const token = randomBytes(32).toString("base64url");
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(token);
      await handle.sync();
    } finally {
      await handle.close();
    }
    log(
      `Aura Math admin settings token (shown once): ${token}\n  Stored owner-only at ${path}`,
    );
    return token;
  } catch (error) {
    if ((error as { code?: string }).code !== "EEXIST") throw error;
  }
  await chmod(path, 0o600);
  const token = (await readFile(path, "utf8")).trim();
  if (!TOKEN_PATTERN.test(token))
    throw new SettingsError(
      "TOKEN_INVALID",
      "The admin token file is invalid. Delete it to create a new token.",
      503,
    );
  log(`Aura Math admin settings token file: ${path}`);
  return token;
}

interface SettingsState {
  version: 1;
  provider: ProviderId;
  models: Record<ProviderId, string>;
  enabled: boolean;
  dailyCapMicroUsd: number;
  prices: PriceEntry[];
  revision: string;
}

interface UsageState {
  version: 1;
  day: string;
  month: string;
  todayMicroUsd: number;
  monthMicroUsd: number;
  callsToday: number;
  consecutiveFailures: number;
  breakerOpenUntil: number;
}

type Credentials = Partial<Record<ProviderId, string>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function corrupt(name: string): never {
  throw new SettingsError(
    "SETTINGS_CORRUPT",
    `The settings file ${name} has an unexpected shape. Fix or remove it in the data folder.`,
    503,
  );
}

function validPrice(value: unknown): value is PriceEntry {
  return (
    isRecord(value) &&
    isProviderId(value.provider) &&
    typeof value.model === "string" &&
    MODEL_ID_PATTERN.test(value.model) &&
    priceNumber(value.inputUsdPerMTok) &&
    priceNumber(value.outputUsdPerMTok) &&
    (value.source === "admin" || value.source === "bundled-unverified")
  );
}

function priceNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_PRICE_USD_PER_MTOK &&
    Math.abs(Math.round(value * 10_000) - value * 10_000) < 1e-6
  );
}

function parseSettings(value: unknown): SettingsState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isProviderId(value.provider) ||
    !isRecord(value.models) ||
    typeof value.enabled !== "boolean" ||
    !isMoney(value.dailyCapMicroUsd) ||
    !Array.isArray(value.prices) ||
    !value.prices.every(validPrice) ||
    typeof value.revision !== "string"
  )
    corrupt(SETTINGS_FILE);
  const models = {} as Record<ProviderId, string>;
  for (const id of PROVIDER_IDS) {
    // A provider added after the file was written starts with its default model.
    const model = value.models[id] ?? PROVIDERS[id].defaultModel;
    if (typeof model !== "string" || (model && !MODEL_ID_PATTERN.test(model)))
      corrupt(SETTINGS_FILE);
    models[id] = model;
  }
  return { ...(value as unknown as SettingsState), models };
}

function parseCredentials(value: unknown): Credentials {
  if (!isRecord(value)) corrupt(CREDENTIALS_FILE);
  const keys: Credentials = {};
  for (const [id, key] of Object.entries(value)) {
    if (!isProviderId(id) || !validKey(key)) corrupt(CREDENTIALS_FILE);
    keys[id] = key;
  }
  return keys;
}

function parseUsage(value: unknown): UsageState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.day !== "string" ||
    typeof value.month !== "string" ||
    !isMoney(value.todayMicroUsd) ||
    !isMoney(value.monthMicroUsd) ||
    !isMoney(value.callsToday) ||
    !isMoney(value.consecutiveFailures) ||
    !isMoney(value.breakerOpenUntil)
  )
    corrupt(USAGE_FILE);
  return value as unknown as UsageState;
}

/** aura-health rule: printable ASCII without spaces, 8 to 1000 characters. */
export function validKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 1000 &&
    /^[\x21-\x7e]+$/.test(value)
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar day and month: the budget resets at the admin's midnight. */
export const dayKey = (at: Date) =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
export const monthKey = (at: Date) =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}`;

export const microToUsd = (micro: number) => micro / 1_000_000;
/** Cost of a token count at a price in US$ per million tokens, in micro-dollars, rounded up. */
export const tokenCostMicro = (tokens: number, usdPerMTok: number) =>
  Math.ceil(tokens * usdPerMTok - 1e-9);

export interface SaveInput {
  provider: ProviderId;
  model: string;
  enabled: boolean;
  dailyCapUsd: number;
  /** Price for this provider and model; null keeps the stored price (or none). */
  price: { inputUsdPerMTok: number; outputUsdPerMTok: number } | null;
}

export interface Reservation {
  id: string;
  microUsd: number;
  day: string;
  month: string;
  provider: ProviderId;
  model: string;
}

export type Settlement =
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  /** The provider answered with an error status: nothing was billed. */
  | { kind: "not-charged" }
  /** Timeout, network failure or missing usage: keep the worst-case charge. */
  | { kind: "unknown" };

export interface ProviderSummary {
  id: ProviderId;
  label: string;
  credentialConfigured: boolean;
  credentialHint: string | null;
  model: string;
  defaultModel: string;
}

export interface SettingsSnapshot {
  provider: ProviderId;
  model: string;
  enabled: boolean;
  revision: string;
  liveReady: boolean;
  providers: ProviderSummary[];
  capabilities: Capabilities;
  dailyCapUsd: number;
  spend: {
    day: string;
    month: string;
    todayUsd: number;
    monthUsd: number;
    callsToday: number;
  };
  breaker: {
    open: boolean;
    consecutiveFailures: number;
    reopensAt: string | null;
  };
  prices: (PriceEntry & { verified: boolean })[];
}

export interface StoreOptions {
  root: string;
  forbiddenRoots: readonly string[];
  now?: () => Date;
  log?: (line: string) => void;
  hooks?: AtomicHooks;
}

const mask = (key: string) => `••••${key.slice(-4)}`;

export class SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  private reservations = new Map<string, Reservation>();

  private constructor(
    readonly root: string,
    private tokenDigest: Buffer,
    private state: SettingsState,
    private keys: Credentials,
    private usage: UsageState,
    private now: () => Date,
    private hooks: AtomicHooks,
  ) {}

  /** Creates the data root and token if needed. Called lazily on the first admin request. */
  static async open(options: StoreOptions): Promise<SettingsStore> {
    const now = options.now ?? (() => new Date());
    const root = await prepareDataRoot(options.root, options.forbiddenRoots);
    const token = await loadOrCreateToken(
      root,
      options.log ?? (() => undefined),
    );
    const stored = await readOwnerOnly(root, SETTINGS_FILE);
    const state =
      stored === undefined
        ? {
            version: 1 as const,
            provider: "anthropic" as const,
            models: Object.fromEntries(
              PROVIDER_IDS.map((id) => [id, PROVIDERS[id].defaultModel]),
            ) as Record<ProviderId, string>,
            enabled: false,
            dailyCapMicroUsd: DEFAULT_DAILY_CAP_USD * 1_000_000,
            prices: SEED_PRICES.map((entry) => ({ ...entry })),
            revision: randomBytes(16).toString("hex"),
          }
        : parseSettings(stored);
    const storedKeys = await readOwnerOnly(root, CREDENTIALS_FILE);
    const keys = storedKeys === undefined ? {} : parseCredentials(storedKeys);
    const storedUsage = await readOwnerOnly(root, USAGE_FILE);
    const at = now();
    const usage =
      storedUsage === undefined
        ? {
            version: 1 as const,
            day: dayKey(at),
            month: monthKey(at),
            todayMicroUsd: 0,
            monthMicroUsd: 0,
            callsToday: 0,
            consecutiveFailures: 0,
            breakerOpenUntil: 0,
          }
        : parseUsage(storedUsage);
    return new SettingsStore(
      root,
      digest(token),
      state,
      keys,
      usage,
      now,
      options.hooks ?? {},
    );
  }

  /** Constant-time comparison of SHA-256 digests, so the length does not leak (R-124). */
  verifyToken(supplied: string): boolean {
    return timingSafeEqual(digest(supplied), this.tokenDigest);
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private rollover() {
    const at = this.now();
    const day = dayKey(at),
      month = monthKey(at);
    if (this.usage.day === day && this.usage.month === month) return false;
    this.usage = {
      ...this.usage,
      day,
      month,
      todayMicroUsd: this.usage.day === day ? this.usage.todayMicroUsd : 0,
      callsToday: this.usage.day === day ? this.usage.callsToday : 0,
      monthMicroUsd: this.usage.month === month ? this.usage.monthMicroUsd : 0,
    };
    return true;
  }

  private priceFor(provider: ProviderId, model: string) {
    return this.state.prices.find(
      (entry) => entry.provider === provider && entry.model === model,
    );
  }

  snapshot(): SettingsSnapshot {
    this.rollover();
    const { provider, models, enabled, revision } = this.state;
    const model = models[provider];
    const at = this.now().getTime();
    const open = this.usage.breakerOpenUntil > at;
    return {
      provider,
      model,
      enabled,
      revision,
      liveReady: Boolean(
        enabled &&
        this.keys[provider] &&
        model &&
        this.priceFor(provider, model),
      ),
      providers: PROVIDER_IDS.map((id) => ({
        id,
        label: PROVIDERS[id].label,
        credentialConfigured: Boolean(this.keys[id]),
        credentialHint: this.keys[id] ? mask(this.keys[id]) : null,
        model: models[id],
        defaultModel: PROVIDERS[id].defaultModel,
      })),
      capabilities: capabilitiesFor(provider, model),
      dailyCapUsd: microToUsd(this.state.dailyCapMicroUsd),
      spend: {
        day: this.usage.day,
        month: this.usage.month,
        todayUsd: microToUsd(this.usage.todayMicroUsd),
        monthUsd: microToUsd(this.usage.monthMicroUsd),
        callsToday: this.usage.callsToday,
      },
      breaker: {
        open,
        consecutiveFailures: this.usage.consecutiveFailures,
        reopensAt: open
          ? new Date(this.usage.breakerOpenUntil).toISOString()
          : null,
      },
      prices: this.state.prices.map((entry) => ({
        ...entry,
        verified: entry.source === "admin",
      })),
    };
  }

  /** The only accessor that returns a key; used by the handler for provider requests. */
  credentialFor(provider: ProviderId): string | undefined {
    return this.keys[provider];
  }

  current(): { provider: ProviderId; model: string } {
    return {
      provider: this.state.provider,
      model: this.state.models[this.state.provider],
    };
  }

  private async revise(changes: Partial<SettingsState>) {
    const next = {
      ...this.state,
      ...changes,
      revision: randomBytes(16).toString("hex"),
    };
    await writeAtomic(this.root, SETTINGS_FILE, next, this.hooks);
    this.state = next;
  }

  saveCredential(provider: ProviderId, key: string) {
    return this.exclusive(async () => {
      if (!validKey(key))
        throw new SettingsError(
          "INVALID_SETTINGS",
          "Enter a valid API key (8 to 1000 printable characters, no spaces).",
        );
      const keys = { ...this.keys, [provider]: key };
      await writeAtomic(this.root, CREDENTIALS_FILE, keys, this.hooks);
      this.keys = keys;
      await this.revise({});
      return this.snapshot();
    });
  }

  removeCredential(provider: ProviderId) {
    return this.exclusive(async () => {
      const keys = { ...this.keys };
      delete keys[provider];
      await writeAtomic(this.root, CREDENTIALS_FILE, keys, this.hooks);
      this.keys = keys;
      // Fail closed: live calls stop when the active provider loses its key.
      await this.revise(
        provider === this.state.provider ? { enabled: false } : {},
      );
      return this.snapshot();
    });
  }

  save(input: SaveInput) {
    return this.exclusive(async () => {
      const { provider, model, enabled, dailyCapUsd, price } = input;
      if (!MODEL_ID_PATTERN.test(model))
        throw new SettingsError(
          "INVALID_SETTINGS",
          "Enter the provider's model ID (letters, digits and _ . : / ~ @ + -, up to 160 characters).",
        );
      if (
        !Number.isFinite(dailyCapUsd) ||
        dailyCapUsd < 0.01 ||
        dailyCapUsd > MAX_DAILY_CAP_USD ||
        Math.abs(Math.round(dailyCapUsd * 100) - dailyCapUsd * 100) > 1e-6
      )
        throw new SettingsError(
          "INVALID_SETTINGS",
          `Enter a daily cap from US$0.01 to US$${MAX_DAILY_CAP_USD}, in whole cents.`,
        );
      if (
        price &&
        (!priceNumber(price.inputUsdPerMTok) ||
          !priceNumber(price.outputUsdPerMTok))
      )
        throw new SettingsError(
          "INVALID_SETTINGS",
          `Enter prices above 0 and up to US$${MAX_PRICE_USD_PER_MTOK} per million tokens.`,
        );
      const prices = price
        ? [
            ...this.state.prices.filter(
              (entry) =>
                !(entry.provider === provider && entry.model === model),
            ),
            { provider, model, ...price, source: "admin" as const },
          ]
        : this.state.prices;
      if (enabled) {
        if (!this.keys[provider])
          throw new SettingsError(
            "INVALID_SETTINGS",
            "Save an API key for this provider before enabling live calls.",
          );
        if (
          !prices.some(
            (entry) => entry.provider === provider && entry.model === model,
          )
        )
          throw new SettingsError(
            "PRICE_UNKNOWN",
            "Enter this model's prices before enabling live calls.",
          );
      }
      await this.revise({
        provider,
        models: { ...this.state.models, [provider]: model },
        enabled,
        dailyCapMicroUsd: Math.round(dailyCapUsd * 100) * 10_000,
        prices,
      });
      return this.snapshot();
    });
  }

  /**
   * Reserves the worst case (estimated input plus `maxOutputTokens` of output) before a paid call.
   * The reservation is written to the usage file at once, so a crash counts the worst case.
   */
  reserve(request: {
    provider: ProviderId;
    model: string;
    inputTokens: number;
    maxOutputTokens: number;
  }) {
    return this.exclusive(async () => {
      this.rollover();
      const price = this.priceFor(request.provider, request.model);
      if (!price)
        throw new SettingsError(
          "PRICE_UNKNOWN",
          "This model has no price yet. Enter its prices before making live calls.",
          409,
        );
      if (this.usage.breakerOpenUntil > this.now().getTime())
        throw new SettingsError(
          "BREAKER_OPEN",
          "Live calls are paused for a few minutes after repeated failures.",
          409,
        );
      const microUsd =
        tokenCostMicro(request.inputTokens, price.inputUsdPerMTok) +
        tokenCostMicro(request.maxOutputTokens, price.outputUsdPerMTok);
      if (this.usage.todayMicroUsd + microUsd > this.state.dailyCapMicroUsd)
        throw new SettingsError(
          "BUDGET_EXCEEDED",
          "Today's spending cap would be exceeded. Raise the cap or wait until tomorrow.",
          409,
        );
      const next = {
        ...this.usage,
        todayMicroUsd: this.usage.todayMicroUsd + microUsd,
        monthMicroUsd: this.usage.monthMicroUsd + microUsd,
        callsToday: this.usage.callsToday + 1,
      };
      await writeAtomic(this.root, USAGE_FILE, next, this.hooks);
      this.usage = next;
      const reservation: Reservation = {
        id: randomBytes(8).toString("hex"),
        microUsd,
        day: next.day,
        month: next.month,
        provider: request.provider,
        model: request.model,
      };
      this.reservations.set(reservation.id, reservation);
      return reservation;
    });
  }

  /**
   * Replaces the reservation with the reported cost (or zero when the provider refused before
   * billing). `success` drives the circuit breaker; a call with no usable result is a failure.
   */
  settle(reservation: Reservation, settlement: Settlement, success: boolean) {
    return this.exclusive(async () => {
      if (!this.reservations.delete(reservation.id))
        throw new SettingsError(
          "RESERVATION_UNKNOWN",
          "Unknown reservation.",
          500,
        );
      this.rollover();
      const price = this.priceFor(reservation.provider, reservation.model);
      let actual = reservation.microUsd;
      if (settlement.kind === "not-charged") actual = 0;
      else if (settlement.kind === "usage" && price)
        actual =
          tokenCostMicro(settlement.inputTokens, price.inputUsdPerMTok) +
          tokenCostMicro(settlement.outputTokens, price.outputUsdPerMTok);
      const delta = actual - reservation.microUsd;
      const sameDay = this.usage.day === reservation.day;
      const sameMonth = this.usage.month === reservation.month;
      const failures = success ? 0 : this.usage.consecutiveFailures + 1;
      const next = {
        ...this.usage,
        todayMicroUsd: sameDay
          ? Math.max(0, this.usage.todayMicroUsd + delta)
          : this.usage.todayMicroUsd,
        monthMicroUsd: sameMonth
          ? Math.max(0, this.usage.monthMicroUsd + delta)
          : this.usage.monthMicroUsd,
        consecutiveFailures: failures >= BREAKER_FAILURES ? 0 : failures,
        breakerOpenUntil:
          failures >= BREAKER_FAILURES
            ? this.now().getTime() + BREAKER_OPEN_MS
            : this.usage.breakerOpenUntil,
      };
      await writeAtomic(this.root, USAGE_FILE, next, this.hooks);
      this.usage = next;
      return { costUsd: microToUsd(actual) };
    });
  }
}
