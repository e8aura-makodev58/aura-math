/**
 * Author-side model call for annotation proposals, using the official Anthropic SDK.
 * Imported only by the development-server plugin and its tests; never by the learner or preview
 * bundles. Credentials come from the environment or an `ant auth login` profile (SDK default),
 * never from a file in this repository.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelCall, ModelRequest } from "./proposer";

/** Opus 5.5 is the project default for Claude features unless the author overrides it. */
export const DEFAULT_ANNOTATION_MODEL = "claude-opus-5-5";
/** Header for `fallbacks: "default"`, which reroutes a declined request server-side. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class ModelFailure extends Error {}

export interface AnnotationCallOptions {
  client?: Pick<Anthropic, "beta">;
  model?: string;
  maxTokens?: number;
}

export function createAnthropicCall(
  options: AnnotationCallOptions = {},
): ModelCall {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_ANNOTATION_MODEL;
  return async (request: ModelRequest) => {
    const response = await client.beta.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: request.system,
      messages: request.messages,
      // Thinking is always on for this model; a small choice task needs little of it.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: request.schema },
      },
    });
    if (response.stop_reason === "refusal")
      throw new ModelFailure(
        `The model declined this request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}.`,
      );
    if (response.stop_reason === "max_tokens")
      throw new ModelFailure("The model's reply was cut off.");
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text" || !text.text.trim())
      throw new ModelFailure("The model returned no text.");
    return text.text;
  };
}

/** Plain-language message for an SDK error, without echoing request bodies or credentials. */
export function describeModelError(error: unknown): string {
  if (error instanceof ModelFailure) return error.message;
  if (error instanceof Anthropic.AuthenticationError)
    return "The API credentials were rejected. Check ANTHROPIC_API_KEY or run `ant auth login`.";
  if (error instanceof Anthropic.RateLimitError)
    return "The model is rate limited. Try again shortly.";
  if (error instanceof Anthropic.BadRequestError)
    return "The model rejected the request.";
  if (error instanceof Anthropic.APIConnectionError)
    return "Could not reach the Anthropic API from the development server.";
  if (error instanceof Anthropic.APIError)
    return `The Anthropic API returned an error (${error.status}).`;
  return "The model call failed.";
}
