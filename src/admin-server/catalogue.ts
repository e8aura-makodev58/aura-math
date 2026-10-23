/**
 * Fixed provider catalogue, per-model capabilities and the seed price table for the admin model
 * settings. Server-side only (the development-server plugin and its tests); the admin page keeps
 * its own copies of the few labels it shows, so no browser bundle imports this file.
 *
 * Endpoints are constants: the admin chooses a provider, never a base URL.
 */
export type ProviderId = "anthropic" | "openai" | "openrouter" | "deepseek";

export interface ProviderEntry {
  label: string;
  baseURL: string;
  /** Prefilled suggestion only; the admin still has to save it. */
  defaultModel: string;
}

export const PROVIDERS: Readonly<Record<ProviderId, ProviderEntry>> = {
  anthropic: {
    label: "Anthropic",
    baseURL: "https://api.anthropic.com",
    defaultModel: "claude-opus-5-5",
  },
  openai: {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "",
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "",
  },
  // OpenAI-compatible; endpoint as in aura-health's provider catalogue.
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === "string" && (PROVIDER_IDS as string[]).includes(value);

/** Same bound as aura-health: ids are never placed in a URL path. */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9_.:/~@+-]{1,160}$/;

export interface Capabilities {
  /** `output_config.effort` is accepted. */
  effort: boolean;
  /** `fallbacks: "default"` (beta server-side-fallback-2026-07-01) is accepted. */
  fallbacks: boolean;
  /** `output_config.format` json_schema is expected to work (unverified live). */
  structuredOutput: boolean;
  /** The model is in this table; unknown models get the most conservative request shape. */
  known: boolean;
}

/**
 * From the bundled Claude API reference (cached 2026-09-25), not checked live. Haiku 4.5 rejects
 * `effort`; fallbacks exist only on the four models listed with it.
 */
const ANTHROPIC_CAPABILITIES: Record<string, Omit<Capabilities, "known">> = {
  "claude-opus-5-5": { effort: true, fallbacks: true, structuredOutput: true },
  "claude-opus-5": { effort: true, fallbacks: true, structuredOutput: true },
  "claude-fable-5-1": { effort: true, fallbacks: true, structuredOutput: true },
  "claude-sonnet-5-5": {
    effort: true,
    fallbacks: true,
    structuredOutput: true,
  },
  "claude-sonnet-5": { effort: true, fallbacks: false, structuredOutput: true },
  "claude-opus-4-8": { effort: true, fallbacks: false, structuredOutput: true },
  "claude-haiku-4-5": {
    effort: false,
    fallbacks: false,
    structuredOutput: false,
  },
};

export function capabilitiesFor(
  provider: ProviderId,
  model: string,
): Capabilities {
  if (provider === "anthropic" && ANTHROPIC_CAPABILITIES[model])
    return { ...ANTHROPIC_CAPABILITIES[model], known: true };
  return {
    effort: false,
    fallbacks: false,
    structuredOutput: false,
    known: false,
  };
}

export type PriceSource = "bundled-unverified" | "admin";

export interface PriceEntry {
  provider: ProviderId;
  model: string;
  /** US dollars per million input tokens. */
  inputUsdPerMTok: number;
  /** US dollars per million output tokens (thinking is billed as output). */
  outputUsdPerMTok: number;
  source: PriceSource;
}

/**
 * Only Opus 5.5 is seeded, from the bundled API reference and marked unverified until the admin
 * checks it against the live price page. Every other model has no price, so live calls are refused
 * until the admin enters one.
 */
export const SEED_PRICES: readonly PriceEntry[] = [
  {
    provider: "anthropic",
    model: "claude-opus-5-5",
    inputUsdPerMTok: 4,
    outputUsdPerMTok: 20,
    source: "bundled-unverified",
  },
];

export const DEFAULT_DAILY_CAP_USD = 1;
export const MAX_DAILY_CAP_USD = 100;
export const MAX_PRICE_USD_PER_MTOK = 1000;
