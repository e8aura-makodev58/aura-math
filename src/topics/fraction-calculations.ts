import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
import { assessExact, formatFraction, parseFraction } from "./exact";

export interface FractionCalculationsSpec {
  task: "mixed" | "add-subtract" | "of-quantity" | "practice";
  whole: number;
  numerator: number;
  denominator: number;
  otherNumerator: number;
  otherDenominator: number;
  operation: "add" | "subtract";
  quantity: number;
  unit: string;
}
const plain = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const fractionValue = (s: FractionCalculationsSpec) => {
  if (s.task === "mixed")
    return {
      numerator: s.whole * s.denominator + s.numerator,
      denominator: s.denominator,
    };
  if (s.task === "of-quantity")
    return { numerator: s.quantity * s.numerator, denominator: s.denominator };
  if (s.task === "practice")
    return {
      numerator: s.quantity * (s.denominator - s.numerator),
      denominator: s.denominator,
    };
  return {
    numerator:
      s.numerator * s.otherDenominator +
      (s.operation === "add" ? 1 : -1) * s.otherNumerator * s.denominator,
    denominator: s.denominator * s.otherDenominator,
  };
};
export function validateFractionCalculationsSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Expected fraction-calculations specification"];
  const s = input as FractionCalculationsSpec,
    errors: string[] = [];
  if (
    Object.keys(s).some(
      (key) =>
        ![
          "task",
          "whole",
          "numerator",
          "denominator",
          "otherNumerator",
          "otherDenominator",
          "operation",
          "quantity",
          "unit",
        ].includes(key),
    )
  )
    errors.push("Unknown fraction-calculations field");
  if (!["mixed", "add-subtract", "of-quantity", "practice"].includes(s.task))
    errors.push("Unsupported fraction task");
  for (const key of [
    "whole",
    "numerator",
    "denominator",
    "otherNumerator",
    "otherDenominator",
    "quantity",
  ] as const)
    if (!Number.isSafeInteger(s[key]))
      errors.push(`${key} must be a whole number`);
  if (errors.length) return errors;
  if (
    s.denominator < 2 ||
    s.denominator > 12 ||
    s.numerator < 1 ||
    s.numerator >= s.denominator
  )
    errors.push(
      "First fraction must be a proper fraction with denominator 2–12",
    );
  if (s.whole < 0 || s.whole > 9) errors.push("Whole part must be 0–9");
  if (
    s.otherDenominator < 2 ||
    s.otherDenominator > 12 ||
    s.otherNumerator < 1 ||
    s.otherNumerator >= s.otherDenominator
  )
    errors.push("Second fraction must be proper with denominator 2–12");
  if (!["add", "subtract"].includes(s.operation))
    errors.push("Unsupported fraction operation");
  if (s.quantity < 1 || s.quantity > 120) errors.push("Quantity must be 1–120");
  if (
    typeof s.unit !== "string" ||
    !s.unit.trim() ||
    s.unit.length > 40 ||
    /[<>]/.test(s.unit)
  )
    errors.push("Unit needs a short plain label");
  if (errors.length) return errors;
  if (s.task === "mixed" && s.whole < 1)
    errors.push("Mixed number needs at least one whole");
  if (s.task === "add-subtract") {
    if (
      s.denominator % s.otherDenominator &&
      s.otherDenominator % s.denominator
    )
      errors.push("Denominators must be equal or one must divide the other");
    const result = fractionValue(s);
    if (result.numerator < 0 || result.numerator > 10 * result.denominator)
      errors.push("Fraction result must be nonnegative and at most ten wholes");
  }
  if (
    (s.task === "of-quantity" || s.task === "practice") &&
    s.quantity % s.denominator
  )
    errors.push("Quantity must divide into exact equal parts");
  return errors;
}
export function fractionCalculationsAnswer(
  s: FractionCalculationsSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "reflection") return step.answer;
  if (goal === "whole-parts") return String(s.whole * s.denominator);
  if (goal === "one-part") return String(s.quantity / s.denominator);
  if (goal === "taken")
    return String((s.quantity / s.denominator) * s.numerator);
  if (goal === "remaining")
    return String(s.quantity - (s.quantity / s.denominator) * s.numerator);
  if (goal === "improper") return formatFraction(fractionValue(s));
  if (goal === "calculate" || goal === "simplest")
    return formatFraction(fractionValue(s));
  if (goal === "equal-units")
    return (
      step.choices?.find((choice) => choice.meaning === "common-partition")
        ?.id ?? ""
    );
  return "";
}
export function validateFractionCalculationsSteps(l: Lesson): string[] {
  const errors = validateFractionCalculationsSpec(l.specification);
  if (errors.length) return errors;
  const s = l.specification as unknown as FractionCalculationsSpec;
  const goals =
    s.task === "mixed"
      ? ["whole-parts", "improper", "reflection"]
      : s.task === "add-subtract"
        ? ["equal-units", "calculate", "simplest", "reflection"]
        : s.task === "of-quantity"
          ? ["one-part", "taken", "reflection"]
          : ["remaining", "reflection"];
  if (l.steps.map((step) => step.goal).join(",") !== goals.join(","))
    errors.push("Unsupported fraction goal sequence");
  for (const step of l.steps) {
    if (
      step.kind !==
      (["reflection", "equal-units"].includes(step.goal ?? "")
        ? "choice"
        : "exact")
    )
      errors.push("Response kind contradicts fraction goal");
    if (
      step.goal !== "reflection" &&
      String(step.answer) !== String(fractionCalculationsAnswer(s, step))
    )
      errors.push("Answer contradicts fraction model");
    if (
      step.goal === "equal-units" &&
      step.choices
        ?.map((choice) => choice.meaning)
        .sort()
        .join(",") !== "common-partition,mixed-parts,numerators"
    )
      errors.push(
        "Equal-unit choices need one common-partition answer and two distinct distractors",
      );
  }
  return errors;
}
const adapter: Adapter = {
  id: "fraction-calculations",
  initialState: (lesson) => ({
    specification: structuredClone(lesson.specification),
  }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    step.kind === "exact"
      ? assessExact(
          state,
          step,
          parseFraction,
          fractionCalculationsAnswer(
            state.specification as unknown as FractionCalculationsSpec,
            step,
          ),
          step.goal === "simplest",
        )
      : assess(
          state,
          step,
          fractionCalculationsAnswer(
            state.specification as unknown as FractionCalculationsSpec,
            step,
          ),
        ),
  describe: (state) => {
    const s = state.specification as unknown as FractionCalculationsSpec;
    if (s.task === "mixed")
      return `${s.whole} whole fraction strips and ${s.numerator} of ${s.denominator} equal parts of another strip.`;
    if (s.task === "add-subtract")
      return `Two equal wholes split into ${s.denominator} and ${s.otherDenominator} parts. Compare equal-size parts before ${s.operation === "add" ? "adding" : "subtracting"}.`;
    return `One set of ${s.quantity} ${s.unit}, divided into ${s.denominator} equal groups. ${s.numerator} groups are selected.`;
  },
};
export const fractionCalculationsTopic: RuntimeTopic = {
  id: "fraction-calculations",
  label: "Fractions and quantities",
  visualTitle: "Equal parts",
  adapter,
  validateSpec: validateFractionCalculationsSpec,
  validateSteps: validateFractionCalculationsSteps,
  answer: (lesson, step) =>
    fractionCalculationsAnswer(
      lesson.specification as unknown as FractionCalculationsSpec,
      step,
    ),
  render: (lesson) => {
    const s = lesson.specification as unknown as FractionCalculationsSpec;
    const description = adapter.describe({ specification: s });
    const denominator = s.denominator;
    const strips =
      s.task === "mixed" ? s.whole + 1 : s.task === "add-subtract" ? 2 : 1;
    const width = 300,
      height = strips * 34 + 26;
    const parts = Array.from({ length: strips }, (_, row) => {
      const count =
        row === 0 && s.task === "add-subtract"
          ? denominator
          : row === 1 && s.task === "add-subtract"
            ? s.otherDenominator
            : denominator;
      const selected =
        s.task === "mixed"
          ? row < s.whole
            ? count
            : s.numerator
          : s.task === "add-subtract"
            ? row === 0
              ? s.numerator
              : s.otherNumerator
            : s.numerator;
      return Array.from(
        { length: count },
        (_, column) =>
          `<rect x="${10 + (column * 280) / count}" y="${12 + row * 34}" width="${280 / count}" height="27" fill="${column < selected ? "#eac796" : "#fffaf0"}" stroke="#35634b"/>`,
      ).join("");
    }).join("");
    return `<div class="fraction-calculations-model" role="img" aria-label="${plain(description)}"><svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${parts}</svg><p>${plain(description)}</p></div>`;
  },
  interpretation: (lesson) => {
    const s = lesson.specification as unknown as FractionCalculationsSpec;
    if (s.task !== "practice") return undefined;
    const taken = (s.quantity / s.denominator) * s.numerator;
    return {
      entities: ["whole", "fraction", "taken", "remaining"],
      quantities: [
        { entity: "whole", value: s.quantity, unit: s.unit, state: "given" },
        {
          entity: "fraction",
          value: formatFraction({
            numerator: s.numerator,
            denominator: s.denominator,
          }),
          unit: "fraction",
          state: "given",
        },
        { entity: "taken", value: taken, unit: s.unit, state: "derived" },
        {
          entity: "remaining",
          value: s.quantity - taken,
          unit: s.unit,
          state: "derived",
        },
      ],
      relationships: [
        {
          kind: "operation",
          id: "taken",
          operation: "fraction-of",
          inputs: ["whole", "fraction"],
          output: "taken",
        },
        {
          kind: "operation",
          id: "remaining",
          operation: "subtract",
          inputs: ["whole", "taken"],
          output: "remaining",
        },
      ],
      unknown: "remaining",
      sourceSpans: [{ start: 0, end: lesson.story.length, text: lesson.story }],
      assumptions: ["The whole set has equal-size parts."],
      ambiguities: [],
    };
  },
};
