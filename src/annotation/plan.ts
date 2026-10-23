/**
 * Annotation plans: a small, declarative description of *which* dimensions and notes a diagram
 * shows and on which side. A plan never contains coordinates, numbers or free text.
 *
 * - The topic supplies a catalogue of measurable features with known endpoints and a disclosure
 *   state (given, unknown or derived), derived from the mathematical model.
 * - A plan (hand-written, defaulted by the topic, or proposed by an LLM) selects from the catalogue.
 * - The deterministic validator rejects anything that would show a hidden value, reference a
 *   missing feature, omit a needed one, or produce colliding labels.
 * - The deterministic engine in `src/ui/dimensions.ts` then does all the drawing.
 */
import {
  labelCollisions,
  layoutDimensions,
  renderDimensionLayer,
  type Box,
  type DimensionLayout,
  type Leader,
  type LinearDimension,
  type Point,
  type Side,
} from "../ui/dimensions";

export type Disclosure = "given" | "unknown" | "derived";
export interface AnnotationFeature {
  id: string;
  /** Human-readable label used in prompts and error messages. */
  description: string;
  value: number;
  unit: string;
  disclosure: Disclosure;
  /** The lesson cannot be read without this dimension being shown. */
  needed: boolean;
  /** Where the feature may be dimensioned, with the endpoints measured on that side. */
  placements: Partial<Record<Side, { from: Point; to: Point }>>;
}
export interface AnnotationNote {
  kind: string;
  description: string;
  /** Learner-facing text, built by the topic from given values only. */
  text: string;
  target: Point;
  placements: Partial<Record<Side, Point>>;
  needed: boolean;
}
export interface AnnotationCatalogue {
  figure: Box;
  features: AnnotationFeature[];
  notes: AnnotationNote[];
}
export type DimensionShow = "value" | "unknown";
export interface AnnotationPlan {
  dimensions: { feature: string; side: Side; show: DimensionShow }[];
  notes: { kind: string; placement: Side }[];
}
export const MAX_PLAN_DIMENSIONS = 8;
export const MAX_PLAN_NOTES = 3;
const SIDES: Side[] = ["top", "bottom", "left", "right"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));

export function labelFor(
  feature: AnnotationFeature,
  show: DimensionShow,
): string {
  return show === "unknown" ? "?" : `${feature.value} ${feature.unit}`;
}

/** Turns a plan into engine inputs. Throws on plans that did not pass `validatePlan`. */
export function planToEngine(
  catalogue: AnnotationCatalogue,
  plan: AnnotationPlan,
): { dimensions: LinearDimension[]; leaders: Leader[] } {
  const dimensions = plan.dimensions.map((d) => {
    const feature = catalogue.features.find((f) => f.id === d.feature)!;
    const place = feature.placements[d.side]!;
    return {
      id: `dim-${feature.id}`,
      from: place.from,
      to: place.to,
      side: d.side,
      label: labelFor(feature, d.show),
      unknown: d.show === "unknown",
    };
  });
  const leaders = plan.notes.map((n) => {
    const note = catalogue.notes.find((x) => x.kind === n.kind)!;
    return {
      id: `note-${note.kind}`,
      target: note.target,
      anchor: note.placements[n.placement]!,
      text: note.text,
    };
  });
  return { dimensions, leaders };
}

export function layoutPlan(
  catalogue: AnnotationCatalogue,
  plan: AnnotationPlan,
): DimensionLayout {
  const { dimensions, leaders } = planToEngine(catalogue, plan);
  return layoutDimensions(catalogue.figure, dimensions, leaders);
}

/**
 * Deterministic gate for any plan, however it was produced. Returns author-facing errors; an empty
 * list means the plan is safe to draw. Never trusts numbers or text from the plan.
 */
export function validatePlan(
  input: unknown,
  catalogue: AnnotationCatalogue,
): string[] {
  const errors: string[] = [];
  if (!isRecord(input) || !onlyKeys(input, ["dimensions", "notes"]))
    return ["Plan must be an object with only dimensions and notes."];
  const { dimensions, notes } = input;
  if (!Array.isArray(dimensions) || !Array.isArray(notes))
    return ["Plan needs a dimensions list and a notes list."];
  if (dimensions.length > MAX_PLAN_DIMENSIONS)
    errors.push(`Use at most ${MAX_PLAN_DIMENSIONS} dimensions.`);
  if (notes.length > MAX_PLAN_NOTES)
    errors.push(`Use at most ${MAX_PLAN_NOTES} notes.`);
  if (errors.length) return errors;
  const seenFeatures = new Set<string>();
  const seenNotes = new Set<string>();
  const shown = new Map<string, DimensionShow>();
  dimensions.forEach((entry, i) => {
    const path = `dimensions[${i}]`;
    if (!isRecord(entry) || !onlyKeys(entry, ["feature", "side", "show"])) {
      errors.push(`${path}: expected feature, side and show only.`);
      return;
    }
    const feature = catalogue.features.find((f) => f.id === entry.feature);
    if (!feature) {
      errors.push(`${path}: unknown feature ${JSON.stringify(entry.feature)}.`);
      return;
    }
    if (seenFeatures.has(feature.id))
      errors.push(`${path}: ${feature.id} is dimensioned twice.`);
    seenFeatures.add(feature.id);
    if (!SIDES.includes(entry.side as Side)) {
      errors.push(`${path}: side must be top, bottom, left or right.`);
      return;
    }
    if (!feature.placements[entry.side as Side])
      errors.push(
        `${path}: ${feature.id} cannot be dimensioned on the ${entry.side}; allowed: ${Object.keys(feature.placements).join(", ")}.`,
      );
    if (entry.show !== "value" && entry.show !== "unknown") {
      errors.push(`${path}: show must be "value" or "unknown".`);
      return;
    }
    if (entry.show === "value" && feature.disclosure !== "given")
      errors.push(
        `${path}: ${feature.description} is ${feature.disclosure}; its value must stay hidden. Use show "unknown".`,
      );
    if (entry.show === "unknown" && feature.disclosure === "given")
      errors.push(
        `${path}: ${feature.description} is given; showing "?" would hide information the lesson provides.`,
      );
    shown.set(feature.id, entry.show);
  });
  notes.forEach((entry, i) => {
    const path = `notes[${i}]`;
    if (!isRecord(entry) || !onlyKeys(entry, ["kind", "placement"])) {
      errors.push(`${path}: expected kind and placement only.`);
      return;
    }
    const note = catalogue.notes.find((n) => n.kind === entry.kind);
    if (!note) {
      errors.push(`${path}: unknown note ${JSON.stringify(entry.kind)}.`);
      return;
    }
    if (seenNotes.has(note.kind)) errors.push(`${path}: duplicate note.`);
    seenNotes.add(note.kind);
    if (!note.placements[entry.placement as Side])
      errors.push(
        `${path}: note ${note.kind} cannot be placed at ${entry.placement}; allowed: ${Object.keys(note.placements).join(", ")}.`,
      );
  });
  for (const feature of catalogue.features)
    if (feature.needed && !shown.has(feature.id))
      errors.push(
        `Missing needed dimension: ${feature.description} (${feature.id}).`,
      );
  for (const note of catalogue.notes)
    if (note.needed && !seenNotes.has(note.kind))
      errors.push(`Missing needed note: ${note.description} (${note.kind}).`);
  if (errors.length) return errors;
  const layout = layoutPlan(catalogue, input as unknown as AnnotationPlan);
  for (const [a, b] of labelCollisions(layout))
    errors.push(`Labels ${a} and ${b} would overlap; change a side.`);
  return errors;
}

export function renderPlan(
  catalogue: AnnotationCatalogue,
  plan: AnnotationPlan,
): { markup: string; layout: DimensionLayout } {
  const layout = layoutPlan(catalogue, plan);
  return { markup: renderDimensionLayer(layout), layout };
}
