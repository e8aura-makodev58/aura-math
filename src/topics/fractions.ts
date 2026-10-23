import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
export interface FractionWhole {
  id: string;
  label: string;
  width: number;
  height: number;
  widths: number[];
  shaded: number[];
}
export interface FractionsSpec {
  task: "equal-parts" | "name" | "compare";
  wholes: FractionWhole[];
}
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const equal = (w: FractionWhole) => w.widths.every((x) => x === w.widths[0]);
export function validateFractionsSpec(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Fractions specification must be an object."];
  const s = input as FractionsSpec;
  if (Object.keys(s).some((k) => !["task", "wholes"].includes(k)))
    errors.push("Unknown fractions field.");
  if (!["equal-parts", "name", "compare"].includes(s.task))
    errors.push("Unsupported fractions task.");
  if (
    !Array.isArray(s.wholes) ||
    s.wholes.length !==
      (s.task === "equal-parts" ? 3 : s.task === "name" ? 1 : 2)
  )
    return [...errors, "Wrong number of rectangle models."];
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const w of s.wholes) {
    if (!w || typeof w !== "object") {
      errors.push("Invalid rectangle.");
      continue;
    }
    if (
      Object.keys(w).some(
        (k) =>
          !["id", "label", "width", "height", "widths", "shaded"].includes(k),
      )
    )
      errors.push("Unknown rectangle field.");
    if (typeof w.id !== "string" || !w.id || ids.has(w.id))
      errors.push("Rectangle IDs must be unique.");
    ids.add(w.id);
    if (typeof w.label !== "string" || !w.label.trim() || labels.has(w.label))
      errors.push("Rectangle labels must be unique and nonempty.");
    labels.add(w.label);
    if (
      !Number.isSafeInteger(w.width) ||
      w.width < 12 ||
      w.width > 240 ||
      !Number.isSafeInteger(w.height) ||
      w.height < 12 ||
      w.height > 120
    )
      errors.push(
        "Whole dimensions must be integer widths 12–240 and heights 12–120.",
      );
    if (
      !Array.isArray(w.widths) ||
      ![2, 3, 4].includes(w.widths.length) ||
      w.widths.some((x) => !Number.isSafeInteger(x) || x <= 0) ||
      w.widths.reduce((a, b) => a + b, 0) !== w.width
    )
      errors.push(
        "Partitions must cover the whole exactly, with 2–4 positive integer widths.",
      );
    if (
      !Array.isArray(w.shaded) ||
      w.shaded.length < 1 ||
      !Array.isArray(w.widths) ||
      w.shaded.length >= w.widths.length ||
      new Set(w.shaded).size !== w.shaded.length ||
      w.shaded.some(
        (i) => !Number.isInteger(i) || i < 0 || i >= w.widths.length,
      )
    )
      errors.push(
        "Shade unique part indices, at least one but fewer than all parts.",
      );
  }
  if (errors.length) return errors;
  if (s.task === "equal-parts" && s.wholes.filter(equal).length !== 1)
    errors.push("Equal-parts task requires exactly one equal partition.");
  if (s.task !== "equal-parts" && s.wholes.some((w) => !equal(w)))
    errors.push("Fraction models require equal-area parts.");
  if (s.task === "compare") {
    const [a, b] = s.wholes;
    if (a.width !== b.width || a.height !== b.height)
      errors.push("Compare fractions of equal-sized wholes.");
    if (
      a.widths.length !== b.widths.length &&
      (a.shaded.length !== 1 || b.shaded.length !== 1)
    )
      errors.push("Compare only unit or like fractions.");
  }
  return errors;
}
export function fractionsAnswer(
  spec: FractionsSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "reflection") return step.answer;
  const [a, b] = spec.wholes;
  if (goal === "parts")
    return (spec.task === "equal-parts" ? spec.wholes.find(equal)! : a).widths
      .length;
  if (goal === "shaded")
    return (spec.task === "equal-parts" ? spec.wholes.find(equal)! : a).shaded
      .length;
  if (goal === "other-shaded") return b.shaded.length;
  let meaning = "";
  if (goal === "partition")
    meaning = `partition:${spec.wholes.find(equal)?.id}`;
  if (goal === "fraction")
    meaning = `fraction:${a.shaded.length}/${a.widths.length}`;
  if (goal === "compare") {
    const delta =
      a.shaded.length * b.widths.length - b.shaded.length * a.widths.length;
    meaning = `relation:${delta > 0 ? "left" : delta < 0 ? "right" : "same"}`;
  }
  return step.choices?.find((c) => c.meaning === meaning)?.id ?? "";
}
export function validateFractionsSteps(lesson: Lesson): string[] {
  const errors = validateFractionsSpec(lesson.specification);
  if (errors.length) return errors;
  const spec = lesson.specification as unknown as FractionsSpec;
  const allowed =
    spec.task === "equal-parts"
      ? ["partition", "parts", "shaded", "reflection"]
      : spec.task === "name"
        ? ["parts", "shaded", "fraction", "reflection"]
        : ["shaded", "other-shaded", "compare", "reflection"];
  if (
    lesson.steps.length !== allowed.length ||
    new Set(lesson.steps.map((st) => st.goal)).size !== allowed.length ||
    allowed.some((goal) => !lesson.steps.some((st) => st.goal === goal))
  )
    errors.push("Fractions lesson must contain each task goal exactly once.");
  for (const step of lesson.steps) {
    if (!allowed.includes(step.goal ?? step.id))
      errors.push(`Unsupported fractions goal ${step.goal}.`);
    if (step.goal === "reflection") continue;
    const numeric = ["parts", "shaded", "other-shaded"].includes(
      step.goal ?? step.id,
    );
    if (step.kind !== (numeric ? "number" : "choice"))
      errors.push("Fractions response kind contradicts goal.");
    if (!numeric) {
      const meanings = step.choices?.map((c) => c.meaning);
      if (!meanings || new Set(meanings).size !== meanings.length)
        errors.push("Fraction choice meanings must be unique.");
      if (step.choices?.length !== 3)
        errors.push("Fraction choice tasks require three distinct options.");
      for (const c of step.choices ?? []) {
        if (
          step.goal === "partition" &&
          !spec.wholes.some((w) => c.meaning === `partition:${w.id}`)
        )
          errors.push("Partition choice must reference a rectangle.");
        if (
          step.goal === "compare" &&
          !["relation:left", "relation:right", "relation:same"].includes(
            c.meaning ?? "",
          )
        )
          errors.push("Unsupported comparison choice.");
        if (
          step.goal === "fraction" &&
          (!/^fraction:[1-3]\/[2-4]$/.test(c.meaning ?? "") ||
            Number(c.meaning?.split(":")[1]?.split("/")[0]) >=
              Number(c.meaning?.split("/")[1]))
        )
          errors.push("Unsupported fraction choice.");
      }
    }
    if (step.answer !== fractionsAnswer(spec, step) || step.answer === "")
      errors.push(`Answer contradicts fractions goal ${step.id}.`);
  }
  return errors;
}
const adapter: Adapter = {
  id: "fractions",
  initialState: (l) => ({ specification: structuredClone(l.specification) }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      fractionsAnswer(state.specification as unknown as FractionsSpec, step),
    ),
  describe: (state) =>
    describeFractions(state.specification as unknown as FractionsSpec),
};
export function describeFractions(s: FractionsSpec): string {
  return s.wholes
    .map(
      (w) =>
        `${w.label}: whole width ${w.width}, height ${w.height}; consecutive part widths ${w.widths.join(", ")}; shaded parts ${w.shaded.map((i) => i + 1).join(", ")}.`,
    )
    .join(" ");
}
export const fractionsTopic: RuntimeTopic = {
  id: "fractions",
  label: "Fractions",
  visualTitle: "Equal-whole pictures",
  adapter,
  validateSpec: validateFractionsSpec,
  validateSteps: validateFractionsSteps,
  answer: (l, s) =>
    fractionsAnswer(l.specification as unknown as FractionsSpec, s),
  render: (l) => {
    const s = l.specification as unknown as FractionsSpec;
    return `<div class="fraction-models">${s.wholes
      .map((w) => {
        let x = 0;
        return `<figure><figcaption>${esc(w.label)}</figcaption><svg viewBox="0 0 ${w.width + 4} ${w.height + 4}" role="img" aria-label="${esc(describeFractions({ ...s, wholes: [w] }))}">${w.widths
          .map((width, i) => {
            const rect = `<rect x="${x + 2}" y="2" width="${width}" height="${w.height}" fill="${w.shaded.includes(i) ? "#6d977c" : "#fff8ee"}" stroke="#315c46" stroke-width="1"/>`;
            x += width;
            return rect;
          })
          .join("")}</svg></figure>`;
      })
      .join(
        "",
      )}</div><p class="diagram-note">Use the equal-sized whole pictures. Parts must have equal area before we name a fraction.</p>`;
  },
};
