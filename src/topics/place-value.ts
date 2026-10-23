import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
export type Place = "hundreds" | "tens" | "ones";
export interface PlaceValueSpec {
  value: number;
  task: "read-model" | "zero-place" | "digit-value";
  targetPlace: Place;
}
export const placeUnits = { hundreds: 100, tens: 10, ones: 1 };
export function digitAt(spec: PlaceValueSpec): number {
  return Math.floor(spec.value / placeUnits[spec.targetPlace]) % 10;
}
export function placeValueAnswer(
  spec: PlaceValueSpec,
  step: Step,
): Step["answer"] {
  if (step.goal === "recognise")
    return step.choices?.find((c) => c.meaning === spec.targetPlace)?.id ?? "";
  if (step.goal === "calculate")
    return spec.task === "read-model"
      ? spec.value
      : digitAt(spec) * placeUnits[spec.targetPlace];
  return step.answer;
}
export function validatePlaceValueSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Expected place-value specification"];
  const s = input as Record<string, unknown>;
  const errors: string[] = [];
  if (Object.keys(s).some((k) => !["value", "task", "targetPlace"].includes(k)))
    errors.push("Unknown place-value specification field");
  if (
    !Number.isSafeInteger(s.value) ||
    Number(s.value) < 0 ||
    Number(s.value) > 999
  )
    errors.push("Value must be an integer from 0 to 999");
  if (!["read-model", "zero-place", "digit-value"].includes(String(s.task)))
    errors.push("Unsupported place-value task");
  if (!["hundreds", "tens", "ones"].includes(String(s.targetPlace)))
    errors.push("Every task needs a named target place");
  if (
    !errors.length &&
    s.task === "zero-place" &&
    digitAt(s as unknown as PlaceValueSpec) !== 0
  )
    errors.push("Zero-place task needs a zero in the target place");
  return errors;
}
function validateSteps(lesson: Lesson): string[] {
  const s = lesson.specification as unknown as PlaceValueSpec;
  const errors: string[] = [];
  if (
    lesson.steps.map((x) => x.goal).join(",") !==
    "recognise,calculate,reflection"
  )
    errors.push("Expected recognise, calculate and reflection goals");
  for (const step of lesson.steps) {
    if (
      step.goal === "recognise" &&
      (step.kind !== "choice" ||
        step.choices?.length !== 3 ||
        new Set(step.choices.map((c) => c.meaning)).size !== 3 ||
        !step.choices.every((c) =>
          ["hundreds", "tens", "ones"].includes(c.meaning ?? ""),
        ))
    )
      errors.push("Recognise needs one choice per place");
    if (step.goal === "calculate" && step.kind !== "number")
      errors.push("Calculate needs a number response");
    if (step.goal === "reflection" && step.kind !== "choice")
      errors.push("Reflection needs an authored choice");
    if (step.goal !== "reflection" && step.answer !== placeValueAnswer(s, step))
      errors.push("Answer contradicts place-value model");
    if (
      s.task === "digit-value" &&
      step.goal === "calculate" &&
      [step.prompt, ...step.hints].some(
        (t) => !t.toLowerCase().includes(s.targetPlace),
      )
    )
      errors.push(
        "Digit-value prompt and every hint must name the target place",
      );
  }
  return errors;
}
export const placeValueAdapter: Adapter = {
  id: "place-value",
  initialState: (lesson) => ({
    specification: structuredClone(lesson.specification),
  }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      placeValueAnswer(state.specification as unknown as PlaceValueSpec, step),
    ),
  describe: (state) => {
    const s = state.specification as unknown as PlaceValueSpec;
    return `Base-ten chart: ${Math.floor(s.value / 100)} hundreds blocks, ${Math.floor(s.value / 10) % 10} tens rods and ${s.value % 10} ones counters. Each hundreds block represents 100, each tens rod 10 and each ones counter 1.`;
  },
};
function render(lesson: Lesson): string {
  const s = lesson.specification as unknown as PlaceValueSpec;
  return `<svg viewBox="0 0 600 320" role="img" aria-label="${placeValueAdapter.describe({ specification: s })}">${(
    ["hundreds", "tens", "ones"] as Place[]
  )
    .map((place, column) => {
      const count = Math.floor(s.value / placeUnits[place]) % 10;
      return `<g transform="translate(${column * 200} 0)"><rect x="4" y="4" width="192" height="310" rx="12" fill="#f7f4e9" stroke="#647b64"/><text x="100" y="30" text-anchor="middle" fill="#254d3b" font-size="19">${place}</text><text x="100" y="54" text-anchor="middle" font-size="13">Each represents ${placeUnits[place]}</text>${Array.from(
        { length: count },
        (_, i) => {
          const x = 24 + (i % 3) * 54,
            y = 76 + Math.floor(i / 3) * 70;
          return place === "hundreds"
            ? `<rect x="${x}" y="${y}" width="40" height="40" fill="#b5cfbd" stroke="#315c46"/><path d="${Array.from({ length: 9 }, (_, line) => `M${x + (line + 1) * 4} ${y}v40M${x} ${y + (line + 1) * 4}h40`).join("")}" stroke="#315c46" stroke-width=".7"/>`
            : place === "tens"
              ? `<rect x="${x + 14}" y="${y}" width="12" height="50" fill="#eac58c" stroke="#765321"/><path d="${Array.from({ length: 9 }, (_, line) => `M${x + 14} ${y + (line + 1) * 5}h12`).join("")}" stroke="#765321" stroke-width=".7"/>`
              : `<circle cx="${x + 20}" cy="${y + 20}" r="10" fill="#8dbba4" stroke="#315c46"/>`;
        },
      ).join(
        "",
      )}${count === 0 ? '<text x="100" y="150" text-anchor="middle" font-size="16">No blocks here</text>' : ""}</g>`;
    })
    .join("")}</svg>`;
}
export const placeValueTopic: RuntimeTopic = {
  id: "place-value",
  label: "Place value",
  visualTitle: "Base-ten chart",
  adapter: placeValueAdapter,
  validateSpec: validatePlaceValueSpec,
  validateSteps,
  answer: (l, s) =>
    placeValueAnswer(l.specification as unknown as PlaceValueSpec, s),
  render,
};
