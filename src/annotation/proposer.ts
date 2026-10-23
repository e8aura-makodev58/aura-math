/**
 * The agentic half of dimensioning: ask a language model to *choose* an annotation plan, then let
 * the deterministic validator accept or reject it.
 *
 * Boundaries that keep this safe:
 * - The model sees feature names, descriptions, disclosure states and allowed sides, never numeric
 *   values, so it cannot leak a hidden value and cannot do the mathematics.
 * - The model returns only references (feature id, side, show value|unknown). It cannot supply
 *   coordinates, numbers or free text; the schema forbids it and `validatePlan` re-checks.
 * - A rejected plan is sent back with the validator's errors for repair, at most `maxRounds` times.
 * - If no round produces a valid plan the deterministic default is returned. The caller never
 *   receives an unvalidated plan.
 *
 * This module has no network code; the model call is injected, so tests need no API.
 */
import {
  MAX_PLAN_DIMENSIONS,
  MAX_PLAN_NOTES,
  validatePlan,
  type AnnotationCatalogue,
  type AnnotationPlan,
} from "./plan";

export interface ProposalContext {
  /** Short topic label, e.g. "Area and perimeter". */
  topicLabel: string;
  /** One or two sentences on the figure and the learner's task, without numbers. */
  taskDescription: string;
  catalogue: AnnotationCatalogue;
}
export interface ModelRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** JSON Schema the response must satisfy (structured output). */
  schema: Record<string, unknown>;
}
/** Sends one request and returns the model's raw JSON text. Throws on transport or refusal errors. */
export type ModelCall = (request: ModelRequest) => Promise<string>;
export interface ProposalAttempt {
  round: number;
  errors: string[];
}
export interface ProposalResult {
  plan: AnnotationPlan;
  source: "model" | "default";
  rounds: number;
  attempts: ProposalAttempt[];
  /** Set when the model path failed for a non-validation reason (network, refusal, truncation). */
  failure?: string;
}
export const DEFAULT_MAX_ROUNDS = 3;

export const SYSTEM_PROMPT = [
  "You lay out the dimension lines on a small maths diagram for a Primary school lesson.",
  "You only choose which dimensions and notes to show and on which side. You never draw, never write numbers, and never write any text.",
  "Return JSON that matches the schema. Use only the feature ids, sides and note kinds you are given.",
  "Rules:",
  '- A feature whose disclosure is "given" must be shown with show "value".',
  '- A feature whose disclosure is "unknown" or "derived" must be shown with show "unknown" (it appears as a question mark) when you include it, and must never be shown with show "value".',
  "- Include every feature marked needed. Include optional features only when they help the learner and add no clutter.",
  "- Use only a side listed as allowed for that feature. Prefer sides that keep labels apart and keep dimensions on the side away from other labels.",
  "- Include each feature at most once. Include notes only if they are marked needed or clearly help.",
].join("\n");

const SIDES = ["top", "bottom", "left", "right"];

/** JSON Schema built from the catalogue so the model can only name real features and note kinds. */
export function proposalSchema(
  catalogue: AnnotationCatalogue,
): Record<string, unknown> {
  const features = catalogue.features.map((f) => f.id);
  const notes = catalogue.notes.map((n) => n.kind);
  const dimension = {
    type: "object",
    additionalProperties: false,
    required: ["feature", "side", "show"],
    properties: {
      feature: { type: "string", enum: features },
      side: { type: "string", enum: SIDES },
      show: { type: "string", enum: ["value", "unknown"] },
    },
  };
  const note = {
    type: "object",
    additionalProperties: false,
    required: ["kind", "placement"],
    properties: {
      kind: { type: "string", enum: notes.length ? notes : ["none"] },
      placement: { type: "string", enum: SIDES },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["dimensions", "notes"],
    properties: {
      dimensions: { type: "array", items: dimension },
      notes: { type: "array", items: note },
    },
  };
}

/** What the model is told about the figure. Deliberately contains no numeric values. */
export function describeCatalogueForModel(ctx: ProposalContext): string {
  const payload = {
    topic: ctx.topicLabel,
    task: ctx.taskDescription,
    limits: { maxDimensions: MAX_PLAN_DIMENSIONS, maxNotes: MAX_PLAN_NOTES },
    features: ctx.catalogue.features.map((f) => ({
      id: f.id,
      description: f.description,
      disclosure: f.disclosure,
      needed: f.needed,
      allowedSides: Object.keys(f.placements),
    })),
    notes: ctx.catalogue.notes.map((n) => ({
      kind: n.kind,
      description: n.description,
      needed: n.needed,
      allowedPlacements: Object.keys(n.placements),
    })),
  };
  return `Choose the annotation plan for this diagram.\n${JSON.stringify(payload, null, 2)}`;
}

export function buildRequest(
  ctx: ProposalContext,
  history: { role: "user" | "assistant"; content: string }[] = [],
): ModelRequest {
  return {
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: describeCatalogueForModel(ctx) },
      ...history,
    ],
    schema: proposalSchema(ctx.catalogue),
  };
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  // Structured output returns bare JSON; tolerate a fenced block from a looser provider.
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function proposeAnnotations(
  call: ModelCall,
  ctx: ProposalContext,
  defaultPlan: AnnotationPlan,
  options: { maxRounds?: number } = {},
): Promise<ProposalResult> {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const attempts: ProposalAttempt[] = [];
  let history: { role: "user" | "assistant"; content: string }[] = [];
  for (let round = 1; round <= maxRounds; round++) {
    let raw: string;
    try {
      raw = await call(buildRequest(ctx, history));
    } catch (error) {
      return {
        plan: defaultPlan,
        source: "default",
        rounds: round,
        attempts,
        failure: error instanceof Error ? error.message : "Model call failed.",
      };
    }
    let errors: string[];
    let candidate: unknown;
    try {
      candidate = parseJson(raw);
      errors = validatePlan(candidate, ctx.catalogue);
    } catch {
      errors = ["The reply was not valid JSON."];
    }
    attempts.push({ round, errors });
    if (!errors.length)
      return {
        plan: candidate as AnnotationPlan,
        source: "model",
        rounds: round,
        attempts,
      };
    history = [
      ...history,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Your plan was rejected by the checker:\n${errors.map((e) => `- ${e}`).join("\n")}\nReturn a corrected plan as JSON only.`,
      },
    ];
  }
  return { plan: defaultPlan, source: "default", rounds: maxRounds, attempts };
}
