/**
 * Request handling for the development-only annotation endpoint. Pure and framework-free so it can
 * be tested without a server or network; `scripts/annotation-dev-plugin.ts` adapts it to Vite.
 *
 * Because `npm run dev` listens on all interfaces, the endpoint (which spends the author's API
 * credit) accepts only loopback requests that carry a custom header and a same-origin Origin.
 */
import { proposeAnnotations, type ModelCall } from "./proposer";
import { annotationTopics } from "./topics";

export const STATUS_PATH = "/__annotation/status";
export const PROPOSE_PATH = "/__annotation/propose";
export const REQUEST_HEADER = "x-aura-annotation";
export const MAX_BODY_BYTES = 20_000;
const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 12;

export interface AnnotationRequest {
  method: string;
  path: string;
  remoteAddress: string | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}
export interface AnnotationResponse {
  status: number;
  body: unknown;
}
export interface HandlerDeps {
  /** Whether credentials look available; the real check happens on the first call. */
  configured(): boolean;
  model(): string;
  call(): ModelCall;
  now?(): number;
}
export interface HandlerState {
  inFlight: boolean;
  calls: number[];
}
export const newHandlerState = (): HandlerState => ({
  inFlight: false,
  calls: [],
});

const header = (req: AnnotationRequest, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};
const isLoopback = (address: string | undefined) =>
  address === "127.0.0.1" ||
  address === "::1" ||
  address === "::ffff:127.0.0.1";
const fail = (status: number, message: string): AnnotationResponse => ({
  status,
  body: { error: message },
});

/** Returns undefined when the path is not an annotation route, so the caller can pass it on. */
export async function handleAnnotationRequest(
  req: AnnotationRequest,
  deps: HandlerDeps,
  state: HandlerState,
): Promise<AnnotationResponse | undefined> {
  if (req.path !== STATUS_PATH && req.path !== PROPOSE_PATH) return undefined;
  if (!isLoopback(req.remoteAddress))
    return fail(
      403,
      "The annotation tool accepts requests from this computer only.",
    );
  if (header(req, REQUEST_HEADER) !== "1")
    return fail(403, "Missing annotation request header.");
  const origin = header(req, "origin");
  const host = header(req, "host");
  if (origin && origin !== `http://${host}`)
    return fail(403, "Cross-origin requests are not allowed.");
  if (req.path === STATUS_PATH) {
    if (req.method !== "GET") return fail(405, "Use GET.");
    return {
      status: 200,
      body: {
        configured: deps.configured(),
        model: deps.model(),
        topics: Object.keys(annotationTopics),
      },
    };
  }
  if (req.method !== "POST") return fail(405, "Use POST.");
  if (new TextEncoder().encode(req.body).length > MAX_BODY_BYTES)
    return fail(413, "Request is too large.");
  if (!deps.configured())
    return fail(
      503,
      "No API credentials found. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart the development server.",
    );
  let input: unknown;
  try {
    input = JSON.parse(req.body);
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const record = input as Record<string, unknown> | null;
  if (
    !record ||
    typeof record !== "object" ||
    typeof record.topic !== "string" ||
    !record.specification ||
    typeof record.specification !== "object" ||
    Array.isArray(record.specification)
  )
    return fail(400, "Expected a topic and a specification.");
  const topic = annotationTopics[record.topic as keyof typeof annotationTopics];
  if (!topic) return fail(400, "This topic does not support dimension lines.");
  // A stored plan is irrelevant to a fresh proposal.
  const { annotations: _ignored, ...specification } =
    record.specification as Record<string, unknown>;
  void _ignored;
  const specErrors = topic.validateSpec(specification);
  if (specErrors.length)
    return {
      status: 400,
      body: {
        error: "The lesson model is not valid yet.",
        details: specErrors,
      },
    };
  const now = (deps.now ?? Date.now)();
  state.calls = state.calls.filter((t) => now - t < WINDOW_MS);
  if (state.inFlight) return fail(429, "A proposal is already running.");
  if (state.calls.length >= MAX_CALLS_PER_WINDOW)
    return fail(429, "Too many proposals this minute. Wait a little.");
  state.inFlight = true;
  state.calls.push(now);
  try {
    const result = await proposeAnnotations(
      deps.call(),
      {
        topicLabel: topic.label,
        taskDescription: topic.taskDescription(specification),
        catalogue: topic.catalogue(specification),
      },
      topic.defaultPlan(specification),
    );
    return { status: 200, body: result };
  } finally {
    state.inFlight = false;
  }
}
