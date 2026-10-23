import type { Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import {
  checkKinds,
  checkMeanings,
  choiceFor,
  esc,
  grouped,
  hasOnlyKeys,
  isInt,
  isRecord,
  makeAdapter,
} from "./p4-kit";

export type WholePlace =
  "ten-thousands" | "thousands" | "hundreds" | "tens" | "ones";
export interface WholeNumbersSpec {
  task: "place-value" | "rounding" | "factors" | "practice";
  /** Main number. */
  n: number;
  /** Second number: compared in place-value, added after rounding in practice. */
  m: number;
  /** Target place for place-value. */
  place: WholePlace;
  roundTo: 10 | 100 | 1000;
  unit: string;
}
export const PLACE_UNIT: Record<WholePlace, number> = {
  "ten-thousands": 10000,
  thousands: 1000,
  hundreds: 100,
  tens: 10,
  ones: 1,
};
export const PLACE_LABEL: Record<WholePlace, string> = {
  "ten-thousands": "ten thousands",
  thousands: "thousands",
  hundreds: "hundreds",
  tens: "tens",
  ones: "ones",
};
const PLACES = Object.keys(PLACE_UNIT) as WholePlace[];

export const digitAt = (n: number, place: WholePlace) =>
  Math.floor(n / PLACE_UNIT[place]) % 10;
export const lowerMultiple = (n: number, step: number) =>
  Math.floor(n / step) * step;
/** Halfway rounds up, the school convention: 5 or more rounds up. */
export function roundedTo(n: number, step: number): number {
  const lower = lowerMultiple(n, step);
  return (n - lower) * 2 >= step ? lower + step : lower;
}
export type Nearness = "lower" | "upper" | "halfway";
export function nearness(n: number, step: number): Nearness {
  const twice = (n - lowerMultiple(n, step)) * 2;
  return twice < step ? "lower" : twice > step ? "upper" : "halfway";
}
export function factorsOf(n: number): number[] {
  const result: number[] = [];
  for (let k = 1; k <= n; k++) if (n % k === 0) result.push(k);
  return result;
}
/** Smallest factor above 1, which gives the first non-trivial factor pair. */
export const firstFactor = (n: number) =>
  factorsOf(n).find((k) => k > 1 && k < n) ?? n;
/** Three smaller factors and one near-miss non-factor, in ascending order. */
export function factorOptions(n: number): {
  factors: number[];
  notFactor: number;
} {
  const inner = factorsOf(n).filter((k) => k > 1 && k < n);
  const factors = inner.slice(0, 3);
  let notFactor = factors[factors.length - 1] + 1;
  while (n % notFactor === 0) notFactor++;
  return { factors, notFactor };
}
export const estimateTotal = (s: WholeNumbersSpec) =>
  roundedTo(s.n, s.roundTo) + roundedTo(s.m, s.roundTo);

const KEYS = ["task", "n", "m", "place", "roundTo", "unit"];
export function validateWholeNumbersSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a whole-number specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown whole-number field");
  const s = input as unknown as WholeNumbersSpec;
  if (!["place-value", "rounding", "factors", "practice"].includes(s.task))
    errors.push("Unsupported whole-number task");
  if (!PLACES.includes(s.place)) errors.push("Choose a supported place");
  if (![10, 100, 1000].includes(s.roundTo))
    errors.push("Round to 10, 100 or 1000");
  if (typeof s.unit !== "string" || !s.unit.trim() || s.unit.length > 40)
    errors.push("Unit needs a short plain label");
  if (!isInt(s.n, 0, 99_999))
    errors.push("n must be a whole number up to 99 999");
  if (!isInt(s.m, 0, 99_999))
    errors.push("m must be a whole number up to 99 999");
  if (errors.length) return errors;
  if (s.task === "place-value") {
    if (s.n < 10_000 || s.m < 10_000)
      errors.push("Place-value numbers must have five digits");
    else {
      if (s.n === s.m) errors.push("The two numbers must differ");
      if (digitAt(s.n, s.place) === 0)
        errors.push("The target place must hold a non-zero digit");
      const digit = String(digitAt(s.n, s.place));
      if (String(s.n).split(digit).length !== 2)
        errors.push(
          "The target digit must appear once in the number so the place is unambiguous",
        );
    }
  } else if (s.task === "rounding") {
    if (s.n <= s.roundTo || s.n % s.roundTo === 0)
      errors.push(
        "Choose a number above the step that is not already a multiple",
      );
  } else if (s.task === "factors") {
    if (s.n < 12 || s.n > 60 || factorsOf(s.n).length < 5)
      errors.push("Choose a number from 12 to 60 with at least five factors");
  } else {
    if (s.n < 101 || s.m < 101 || s.n > 9_999 || s.m > 9_999)
      errors.push("Practice numbers must be 101 to 9 999");
    else if (s.n % s.roundTo === 0 || s.m % s.roundTo === 0)
      errors.push("Practice numbers must not already be multiples of the step");
    else if (s.n === s.m) errors.push("The two numbers must differ");
  }
  return errors;
}

export function wholeNumbersAnswer(
  s: WholeNumbersSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "place":
      return choiceFor(step, s.place);
    case "digit-value":
      return String(digitAt(s.n, s.place) * PLACE_UNIT[s.place]);
    case "compare":
      return choiceFor(step, s.n > s.m ? "left" : "right");
    case "between":
      return choiceFor(step, "between");
    case "nearer":
      return choiceFor(step, nearness(s.n, s.roundTo));
    case "rounded":
      return String(roundedTo(s.n, s.roundTo));
    case "pair":
      return choiceFor(step, "product-matches");
    case "count":
      return String(factorsOf(s.n).length);
    case "not-factor":
      return choiceFor(step, "not-factor");
    case "estimate":
      return String(estimateTotal(s));
  }
  return "";
}

const GOALS: Record<WholeNumbersSpec["task"], string[]> = {
  "place-value": ["place", "digit-value", "compare", "reflection"],
  rounding: ["between", "nearer", "rounded", "reflection"],
  factors: ["pair", "count", "not-factor", "reflection"],
  practice: ["estimate", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  place: "choice",
  "digit-value": "exact",
  compare: "choice",
  between: "choice",
  nearer: "choice",
  rounded: "exact",
  pair: "choice",
  count: "exact",
  "not-factor": "choice",
  estimate: "exact",
  reflection: "choice",
};
const MEANINGS: Record<string, string[]> = {
  compare: ["left", "right", "same"],
  between: ["between", "below", "above"],
  nearer: ["lower", "upper", "halfway"],
  pair: ["product-matches", "wrong-product", "sum-matches"],
};
export function validateWholeNumbersSteps(lesson: Lesson): string[] {
  const errors = validateWholeNumbersSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as WholeNumbersSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported whole-number goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    if (
      goal !== "reflection" &&
      (step.answer === "" || step.answer !== wholeNumbersAnswer(s, step))
    )
      errors.push("Answer contradicts whole-number model");
    if (MEANINGS[goal]?.length)
      errors.push(...checkMeanings(step, MEANINGS[goal], goal));
    if (goal === "place") {
      const meanings = (step.choices ?? []).map((c) => c.meaning ?? "");
      if (
        meanings.length !== 3 ||
        new Set(meanings).size !== 3 ||
        !meanings.includes(s.place) ||
        meanings.some((m) => !PLACES.includes(m as WholePlace))
      )
        errors.push(
          "Place choices must name three different places including the target",
        );
    }
    if (goal === "not-factor") {
      const meanings = (step.choices ?? []).map((c) => c.meaning);
      if (
        meanings.length !== 4 ||
        meanings.filter((m) => m === "not-factor").length !== 1 ||
        meanings.some((m) => m !== "factor" && m !== "not-factor")
      )
        errors.push("Offer three factors and one number that is not a factor");
    }
  }
  return errors;
}

function describe(s: WholeNumbersSpec): string {
  switch (s.task) {
    case "place-value":
      return `Place chart for ${grouped(s.n)} and ${grouped(s.m)}, with columns for ten thousands, thousands, hundreds, tens and ones.`;
    case "rounding": {
      const lower = lowerMultiple(s.n, s.roundTo);
      return `Number line marked at ${[lower - s.roundTo, lower, lower + s.roundTo, lower + 2 * s.roundTo].map(grouped).join(", ")}. The number ${grouped(s.n)} is marked on the line, with a notch halfway between two of the marks.`;
    }
    case "factors":
      return `${s.n} counters arranged in ${firstFactor(s.n)} equal rows of ${s.n / firstFactor(s.n)}.`;
    case "practice":
      return `Two quantities: ${grouped(s.n)} ${s.unit} and ${grouped(s.m)} ${s.unit}. Round each to the nearest ${grouped(s.roundTo)}, then add.`;
  }
}

function chart(values: number[]): string {
  const heads = ["Ten thousands", "Thousands", "Hundreds", "Tens", "Ones"];
  return `<div class="decimal-chart" tabindex="0" role="region" aria-label="Place chart; scroll sideways on small screens"><table><caption>Place chart</caption><thead><tr><th>Number</th>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${values
    .map((v) => {
      const digits = String(v).padStart(5, "0").split("");
      return `<tr><th>${grouped(v)}</th>${digits.map((d) => `<td>${d}</td>`).join("")}</tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function numberLine(s: WholeNumbersSpec): string {
  const lower = lowerMultiple(s.n, s.roundTo);
  const marks = [
    lower - s.roundTo,
    lower,
    lower + s.roundTo,
    lower + 2 * s.roundTo,
  ];
  // Sized for a phone, where it shrinks to about 0.75 of this width.
  const x0 = 44,
    gap = 104,
    y = 84;
  const x = (i: number) => x0 + i * gap;
  const dot = x0 + gap + ((s.n - lower) / s.roundTo) * gap;
  const ticks = marks
    .map(
      (m, i) =>
        `<line x1="${x(i)}" y1="${y - 10}" x2="${x(i)}" y2="${y + 10}" stroke="#3b5a4a" stroke-width="2.5"/><text x="${x(i)}" y="${y + 32}" text-anchor="middle" font-size="16" font-weight="600" fill="#243b31">${grouped(m)}</text>`,
    )
    .join("");
  const half = x0 + gap + gap / 2;
  return `<svg viewBox="0 0 ${x0 * 2 + gap * 3} 150" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${x0 * 2 + gap * 3}px;max-width:100%;height:auto"><line x1="${x(0) - 20}" y1="${y}" x2="${x(3) + 20}" y2="${y}" stroke="#3b5a4a" stroke-width="3" stroke-linecap="round"/>${ticks}<line x1="${half}" y1="${y - 6}" x2="${half}" y2="${y + 6}" stroke="#9a6a1c" stroke-width="2" stroke-dasharray="3 3"/><text x="${half}" y="${y + 52}" text-anchor="middle" font-size="13" fill="#7a5214">halfway</text><circle cx="${dot}" cy="${y}" r="8" fill="#e0773a" stroke="#7a3a12" stroke-width="2"/><text x="${dot}" y="${y - 22}" text-anchor="middle" font-size="17" font-weight="700" fill="#7a3a12" stroke="#fffdf8" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${grouped(s.n)}</text></svg>`;
}
function factorArray(s: WholeNumbersSpec): string {
  const rows = firstFactor(s.n),
    cols = s.n / rows;
  const gap = 18;
  const dots = Array.from({ length: s.n }, (_, i) => {
    const r = Math.floor(i / cols),
      c = i % cols;
    return `<circle cx="${24 + c * gap}" cy="${24 + r * gap}" r="6" fill="#e0773a" stroke="#7a3a12" stroke-width="1.5"/>`;
  }).join("");
  const w = 48 + (cols - 1) * gap,
    h = 48 + (rows - 1) * gap;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${w}px;max-width:100%;height:auto">${dots}</svg>`;
}
function badges(s: WholeNumbersSpec): string {
  const card = (x: number, v: number) =>
    `<rect x="${x}" y="14" width="184" height="92" rx="16" fill="#fbeadb" stroke="#8a4a1c" stroke-width="2"/><text x="${x + 92}" y="62" text-anchor="middle" font-size="30" font-weight="700" fill="#5e3010">${grouped(v)}</text><text x="${x + 92}" y="90" text-anchor="middle" font-size="15" fill="#5e3010">${esc(s.unit)}</text>`;
  return `<svg viewBox="0 0 400 120" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:400px;max-width:100%;height:auto">${card(8, s.n)}${card(208, s.m)}</svg>`;
}

const adapter = makeAdapter<WholeNumbersSpec>({
  id: "whole-numbers",
  answerFor: wholeNumbersAnswer,
  describe,
});

export const wholeNumbersTopic: RuntimeTopic = {
  id: "whole-numbers",
  label: "Whole numbers",
  visualTitle: "Numbers to 100 000",
  adapter,
  validateSpec: validateWholeNumbersSpec,
  validateSteps: validateWholeNumbersSteps,
  answer: (l, step) =>
    wholeNumbersAnswer(l.specification as unknown as WholeNumbersSpec, step),
  render: (l) => {
    const s = l.specification as unknown as WholeNumbersSpec;
    const model =
      s.task === "place-value"
        ? chart([s.n, s.m])
        : s.task === "rounding"
          ? numberLine(s)
          : s.task === "factors"
            ? factorArray(s)
            : badges(s);
    return `<div class="whole-numbers-model" role="img" aria-label="${esc(describe(s))}">${model}<p>${esc(describe(s))}</p></div>`;
  },
  interpretation: (l) => {
    const s = l.specification as unknown as WholeNumbersSpec;
    if (s.task !== "practice") return undefined;
    const a = roundedTo(s.n, s.roundTo),
      b = roundedTo(s.m, s.roundTo);
    return {
      entities: [
        "first",
        "second",
        "first-rounded",
        "second-rounded",
        "estimate",
      ],
      quantities: [
        { entity: "first", value: s.n, unit: s.unit, state: "given" },
        { entity: "second", value: s.m, unit: s.unit, state: "given" },
        { entity: "first-rounded", value: a, unit: s.unit, state: "derived" },
        { entity: "second-rounded", value: b, unit: s.unit, state: "derived" },
        { entity: "estimate", value: a + b, unit: s.unit, state: "derived" },
      ],
      relationships: [
        {
          kind: "operation",
          id: "first-rounded",
          operation: "round",
          inputs: ["first"],
          output: "first-rounded",
        },
        {
          kind: "operation",
          id: "second-rounded",
          operation: "round",
          inputs: ["second"],
          output: "second-rounded",
        },
        {
          kind: "operation",
          id: "estimate",
          operation: "add",
          inputs: ["first-rounded", "second-rounded"],
          output: "estimate",
        },
      ],
      unknown: "estimate",
      sourceSpans: [{ start: 0, end: l.story.length, text: l.story }],
      assumptions: ["Each number is rounded to the same place before adding."],
      ambiguities: [],
    } as ReturnType<NonNullable<RuntimeTopic["interpretation"]>>;
  },
};
