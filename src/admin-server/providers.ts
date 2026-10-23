/**
 * Provider transports for the admin model settings: model discovery and the paid connection test.
 * Server-side only. Endpoints are fixed constants from the catalogue; there are no retries and no
 * redirects. Failures are reduced to a kind and an HTTP status, so provider error bodies (which can
 * echo request headers) never leave this module.
 */
import { Buffer } from "node:buffer";
import * as nodeProcess from "node:process";
import { PROVIDERS, type Capabilities, type ProviderId } from "./catalogue";

export const PROVIDER_TIMEOUT_MS = 25_000;
export const DISCOVERY_LIMIT_BYTES = 1_048_576;
export const REPLY_LIMIT_BYTES = 65_536;
export const TEST_MAX_OUTPUT_TOKENS = 64;
export const TEST_PROMPT = "Connection check. Reply with the single word OK.";

export type FailureKind = "http" | "network" | "invalid";

export class ProviderFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly status?: number,
  ) {
    super(`Provider ${kind} failure${status ? ` (${status})` : ""}`);
  }
}

export interface TestResult {
  /** Reported by the provider; undefined when the reply carried no usage. */
  inputTokens?: number;
  outputTokens?: number;
  servedModel?: string;
  stopReason?: string;
}

/** A request for a JSON reply (story slot candidates). The prompt holds fixed text only. */
export interface JsonRequest {
  system: string;
  user: string;
  /** JSON schema of the reply; sent as structured output only where the capability table says. */
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
}
export interface JsonResult extends TestResult {
  /** The reply text, untrusted. Empty when the provider refused or stopped early. */
  text: string;
}

export interface ProviderTransport {
  readonly kind: "live" | "fake";
  listModels(provider: ProviderId, apiKey: string): Promise<string[]>;
  testCall(
    provider: ProviderId,
    apiKey: string,
    model: string,
    capabilities: Capabilities,
  ): Promise<TestResult>;
  generateJson(
    provider: ProviderId,
    apiKey: string,
    model: string,
    capabilities: Capabilities,
    request: JsonRequest,
  ): Promise<JsonResult>;
}

const EXCLUDED_WORDS = [
  "embedding",
  "embed",
  "whisper",
  "tts",
  "dall-e",
  "moderation",
  "image",
  "audio",
  "realtime",
  "transcribe",
];

/** aura-health filter: plausible text-model ids only, sorted, at most 500. */
export function filterModelIds(provider: ProviderId, ids: unknown[]): string[] {
  const kept = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !id || id.length > 160) continue;
    if (!/^[A-Za-z0-9_.:/~@+-]+$/.test(id)) continue;
    const lower = id.toLowerCase();
    if (provider === "anthropic" && !lower.startsWith("claude-")) continue;
    if (EXCLUDED_WORDS.some((word) => lower.includes(word))) continue;
    kept.add(id);
  }
  return [...kept].sort().slice(0, 500);
}

async function readCapped(response: Response, limit: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderFailure("invalid");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderFailure("invalid");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProviderFailure("invalid");
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function openAiRequest(
  fetchImpl: FetchLike,
  provider: ProviderId,
  apiKey: string,
  path: "/models" | "/chat/completions",
  payload: unknown,
  limit: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(PROVIDERS[provider].baseURL + path, {
      method: payload === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(payload === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderFailure("network");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ProviderFailure("http", response.status);
  }
  return readCapped(response, limit);
}

const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

/** Minimal Anthropic client surface, so tests can inject a fake without the SDK. */
export interface AnthropicLike {
  models: {
    list(params: { limit: number }): AsyncIterable<{ id: string }>;
  };
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: { role: "user"; content: string }[];
      output_config?: {
        effort?: "low";
        format?: { type: "json_schema"; schema: Record<string, unknown> };
      };
    }): Promise<{
      model?: string;
      stop_reason?: string | null;
      usage?: { input_tokens?: number; output_tokens?: number };
      content?: { type: string; text?: string }[];
    }>;
  };
}

export interface LiveTransportOptions {
  fetchImpl?: FetchLike;
  anthropic?: (apiKey: string) => Promise<AnthropicLike>;
  env?: Record<string, string | undefined>;
}

/**
 * The SDK is constructed with an explicit key, `authToken: null` and a fixed base URL, so
 * ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN in the environment cannot redirect the request or add
 * credentials (R-118). No retries.
 */
export async function createAnthropicClient(
  apiKey: string,
): Promise<AnthropicLike> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({
    apiKey,
    authToken: null,
    baseURL: PROVIDERS.anthropic.baseURL,
    timeout: PROVIDER_TIMEOUT_MS,
    maxRetries: 0,
  }) as unknown as AnthropicLike;
}

function sdkFailure(error: unknown): ProviderFailure {
  if (error instanceof ProviderFailure) return error;
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400
    ? new ProviderFailure("http", status)
    : new ProviderFailure("network");
}

export function createLiveTransport(
  options: LiveTransportOptions = {},
): ProviderTransport {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const anthropic = options.anthropic ?? createAnthropicClient;
  const env = options.env ?? nodeProcess.env;
  const guard = () => {
    // Node 22 can route fetch through an environment proxy when this is set; refuse instead.
    if (env.NODE_USE_ENV_PROXY) throw new ProviderFailure("network");
  };
  return {
    kind: "live",
    async listModels(provider, apiKey) {
      guard();
      if (provider === "anthropic") {
        try {
          const client = await anthropic(apiKey);
          const ids: string[] = [];
          for await (const model of client.models.list({ limit: 100 })) {
            ids.push(model.id);
            if (ids.length >= 500) break;
          }
          return filterModelIds(provider, ids);
        } catch (error) {
          throw sdkFailure(error);
        }
      }
      const data = await openAiRequest(
        fetchImpl,
        provider,
        apiKey,
        "/models",
        undefined,
        DISCOVERY_LIMIT_BYTES,
      );
      const rows =
        data &&
        typeof data === "object" &&
        Array.isArray((data as { data?: unknown }).data)
          ? (data as { data: unknown[] }).data
          : [];
      return filterModelIds(
        provider,
        rows.map((row) =>
          row && typeof row === "object"
            ? (row as { id?: unknown }).id
            : undefined,
        ),
      );
    },
    async testCall(provider, apiKey, model, capabilities) {
      guard();
      if (provider === "anthropic") {
        try {
          const client = await anthropic(apiKey);
          const response = await client.messages.create({
            model,
            max_tokens: TEST_MAX_OUTPUT_TOKENS,
            messages: [{ role: "user", content: TEST_PROMPT }],
            ...(capabilities.effort
              ? { output_config: { effort: "low" as const } }
              : {}),
          });
          return {
            inputTokens: count(response.usage?.input_tokens),
            outputTokens: count(response.usage?.output_tokens),
            servedModel:
              typeof response.model === "string" ? response.model : undefined,
            stopReason: response.stop_reason ?? undefined,
          };
        } catch (error) {
          throw sdkFailure(error);
        }
      }
      // OpenAI rejects max_tokens on current models; OpenRouter and DeepSeek document max_tokens.
      // DeepSeek thinking is turned off, as in aura-health, so the small test stays small.
      const payload = {
        model,
        stream: false,
        messages: [{ role: "user", content: TEST_PROMPT }],
        ...(provider === "openai"
          ? { max_completion_tokens: TEST_MAX_OUTPUT_TOKENS, store: false }
          : { max_tokens: TEST_MAX_OUTPUT_TOKENS }),
        ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      };
      const data = (await openAiRequest(
        fetchImpl,
        provider,
        apiKey,
        "/chat/completions",
        payload,
        REPLY_LIMIT_BYTES,
      )) as {
        model?: unknown;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
        choices?: { finish_reason?: unknown }[];
      } | null;
      if (!data || typeof data !== "object" || !Array.isArray(data.choices))
        throw new ProviderFailure("invalid");
      const finish = data.choices[0]?.finish_reason;
      return {
        inputTokens: count(data.usage?.prompt_tokens),
        outputTokens: count(data.usage?.completion_tokens),
        servedModel: typeof data.model === "string" ? data.model : undefined,
        stopReason: typeof finish === "string" ? finish : undefined,
      };
    },
    async generateJson(provider, apiKey, model, capabilities, request) {
      guard();
      if (provider === "anthropic") {
        try {
          const client = await anthropic(apiKey);
          const outputConfig = {
            ...(capabilities.effort ? { effort: "low" as const } : {}),
            ...(capabilities.structuredOutput
              ? {
                  format: {
                    type: "json_schema" as const,
                    schema: request.schema,
                  },
                }
              : {}),
          };
          const response = await client.messages.create({
            model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
            ...(Object.keys(outputConfig).length
              ? { output_config: outputConfig }
              : {}),
          });
          const stop = response.stop_reason ?? undefined;
          const block = response.content?.find(
            (item) => item.type === "text" && typeof item.text === "string",
          );
          return {
            inputTokens: count(response.usage?.input_tokens),
            outputTokens: count(response.usage?.output_tokens),
            servedModel:
              typeof response.model === "string" ? response.model : undefined,
            stopReason: stop,
            text:
              stop === "refusal" || stop === "max_tokens" || !block?.text
                ? ""
                : block.text.slice(0, REPLY_LIMIT_BYTES),
          };
        } catch (error) {
          throw sdkFailure(error);
        }
      }
      // OpenAI gets strict json_schema; OpenRouter and DeepSeek get json_object (support for
      // schemas varies by model). Local validation is authoritative for every provider.
      const payload = {
        model,
        stream: false,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        ...(provider === "openai"
          ? {
              max_completion_tokens: request.maxOutputTokens,
              store: false,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: request.schemaName,
                  strict: true,
                  schema: request.schema,
                },
              },
            }
          : {
              max_tokens: request.maxOutputTokens,
              response_format: { type: "json_object" },
            }),
        ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      };
      const data = (await openAiRequest(
        fetchImpl,
        provider,
        apiKey,
        "/chat/completions",
        payload,
        REPLY_LIMIT_BYTES,
      )) as {
        model?: unknown;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
        choices?: {
          finish_reason?: unknown;
          message?: { content?: unknown; refusal?: unknown };
        }[];
      } | null;
      if (!data || typeof data !== "object" || !Array.isArray(data.choices))
        throw new ProviderFailure("invalid");
      const choice = data.choices[0];
      const finish = choice?.finish_reason;
      const content = choice?.message?.content;
      return {
        inputTokens: count(data.usage?.prompt_tokens),
        outputTokens: count(data.usage?.completion_tokens),
        servedModel: typeof data.model === "string" ? data.model : undefined,
        stopReason: typeof finish === "string" ? finish : undefined,
        text: typeof content === "string" && finish !== "length" ? content : "",
      };
    },
  };
}

/**
 * Network-free transport for automated tests and the browser test server
 * (`AURA_MATH_FAKE_PROVIDER=1`). OpenRouter discovery always fails so the manual-entry path is
 * exercised. It never contacts any provider.
 */
export function createFakeTransport(): ProviderTransport {
  const catalogue: Record<ProviderId, string[] | null> = {
    anthropic: ["claude-haiku-4-5", "claude-opus-5-5", "claude-sonnet-5-5"],
    openai: ["fake-openai-small", "fake-openai-large"],
    openrouter: null,
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
  };
  return {
    kind: "fake",
    async listModels(provider) {
      const ids = catalogue[provider];
      if (!ids) throw new ProviderFailure("network");
      return filterModelIds(provider, ids);
    },
    async testCall(_provider, _apiKey, model) {
      return {
        inputTokens: 20,
        outputTokens: 8,
        servedModel: model,
        stopReason: "end_turn",
      };
    },
    async generateJson(_provider, _apiKey, model, _capabilities, request) {
      return {
        inputTokens: 900,
        outputTokens: 300,
        servedModel: model,
        stopReason: "end_turn",
        text: JSON.stringify({ candidates: fakeCandidates(request) }),
      };
    },
  };
}

const FAKE_COUNT_ITEMS = [
  "toy cars",
  "paper boats",
  "glass jars",
  "drawing pins",
  "craft sticks",
  "badges",
  "postcards",
  "keychains",
  "bookmarks",
  "pebbles",
];
const FAKE_MATERIALS = ["yarn", "twine", "ribbon tape", "felt", "garden hose"];
const FAKE_PLACES = [
  "sports hall",
  "school garden",
  "reading corner",
  "void deck",
  "staff room",
  "computer lab",
];
let fakeCall = 0;

/**
 * Deterministic fake candidates shaped by the request's schema: valid sets, then one set with a
 * digit that the server must drop, so the admin page always shows a dropped count.
 */
function fakeCandidates(request: JsonRequest): Record<string, string>[] {
  const count = Number(/exactly (\d+)/.exec(request.user)?.[1] ?? 3);
  const candidates = request.schema.properties as {
    candidates: {
      items: {
        properties: Record<string, { enum?: string[] }>;
      };
    };
  };
  const fields = candidates.candidates.items.properties;
  const names = fields.name.enum ?? ["Siti"];
  const material = !fields.place;
  const result: Record<string, string>[] = [];
  for (let i = 0; i < Math.max(0, count - 1); i++) {
    const k = fakeCall++;
    const items = material ? FAKE_MATERIALS : FAKE_COUNT_ITEMS;
    const set: Record<string, string> = {
      name: names[(k * 13) % names.length],
      item: items[k % items.length],
    };
    if (!material) set.place = FAKE_PLACES[(k * 7) % FAKE_PLACES.length];
    result.push(set);
  }
  const bad: Record<string, string> = { name: names[0], item: "item 7" };
  if (!material) bad.place = FAKE_PLACES[0];
  result.push(bad);
  return result;
}
