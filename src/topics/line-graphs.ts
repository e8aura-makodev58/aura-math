import type { Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import {
  checkKinds,
  checkMeanings,
  choiceFor,
  esc,
  hasOnlyKeys,
  isInt,
  isRecord,
  makeAdapter,
} from "./p4-kit";

export interface LineGraphsSpec {
  task: "read" | "change" | "threshold" | "practice";
  /** Short labels along the bottom, for example days. */
  labels: string[];
  /** One whole-number value per label. */
  values: number[];
  /** What one gridline step stands for. */
  step: 5 | 10 | 20;
  /** What is counted, for the axis title, for example "books borrowed". */
  quantity: string;
  /** Index of the first point asked about. */
  a: number;
  /** Index of the second point asked about. */
  b: number;
  /** Target for the threshold task. */
  target: number;
}

/** Values must be readable to the nearest half step, so no guessing between gridlines. */
export const grainOf = (step: number) => (step === 5 ? 5 : step / 2);
export const rowsOf = (s: Pick<LineGraphsSpec, "values" | "step">) =>
  Math.max(4, Math.ceil(Math.max(...s.values) / s.step));
export const axisMaxOf = (s: Pick<LineGraphsSpec, "values" | "step">) =>
  rowsOf(s) * s.step;
export const risesOf = (values: number[]) =>
  values.slice(1).map((v, i) => v - values[i]);
export const biggestRiseIndex = (values: number[]) => {
  const rises = risesOf(values);
  return rises.indexOf(Math.max(...rises));
};
export const aboveTarget = (s: LineGraphsSpec) =>
  s.values.flatMap((v, i) => (v > s.target ? [i] : []));
export const highestIndex = (values: number[]) =>
  values.indexOf(Math.max(...values));
export const spreadOf = (values: number[]) =>
  Math.max(...values) - Math.min(...values);

const KEYS = [
  "task",
  "labels",
  "values",
  "step",
  "quantity",
  "a",
  "b",
  "target",
];
const plain = (v: unknown, max: number): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max && !/[<>&"']/.test(v);

export function validateLineGraphsSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a line-graph specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown line-graph field");
  const s = input as unknown as LineGraphsSpec;
  if (!["read", "change", "threshold", "practice"].includes(s.task))
    errors.push("Unsupported line-graph task");
  if (![5, 10, 20].includes(s.step))
    errors.push("Each gridline step is 5, 10 or 20");
  if (!plain(s.quantity, 40))
    errors.push("Say what is counted in a few plain words");
  if (
    !Array.isArray(s.labels) ||
    s.labels.length < 4 ||
    s.labels.length > 7 ||
    s.labels.some((l) => !plain(l, 8)) ||
    new Set(s.labels).size !== s.labels.length
  )
    errors.push("Use four to seven different short labels");
  if (
    !Array.isArray(s.values) ||
    !Array.isArray(s.labels) ||
    s.values.length !== s.labels.length ||
    s.values.some((v) => !isInt(v, 0, 100))
  )
    errors.push("Give one whole-number value from 0 to 100 for each label");
  if (!isInt(s.a, 0, 6) || !isInt(s.b, 0, 6) || !isInt(s.target, 0, 100))
    errors.push("Points and target must be whole numbers");
  if (errors.length) return errors;
  const n = s.labels.length;
  const grain = grainOf(s.step);
  if (s.values.some((v) => v % grain !== 0))
    errors.push(
      `Values must be multiples of ${grain} so they can be read exactly`,
    );
  if (Math.ceil(Math.max(...s.values) / s.step) > 10)
    errors.push("Too many gridlines: raise the step or lower the values");
  if (s.a >= n || s.b >= n)
    errors.push("Choose points that exist on the graph");
  if (errors.length) return errors;
  if (s.task === "read" || s.task === "change") {
    if (s.a === s.b) errors.push("Choose two different points");
    else if (s.values[s.a] === s.values[s.b])
      errors.push("The two points must have different values");
  }
  if (s.task === "change") {
    const rises = risesOf(s.values);
    const best = Math.max(...rises);
    if (best <= 0 || rises.filter((r) => r === best).length !== 1)
      errors.push(
        "There must be one clearly biggest rise between neighbouring points",
      );
  }
  if (s.task === "threshold") {
    const above = aboveTarget(s);
    if (s.target % grain !== 0)
      errors.push(`The target must be a multiple of ${grain}`);
    if (!above.length || above.length === n)
      errors.push("Some, but not all, values must be above the target");
    const top = Math.max(...s.values);
    if (s.values.filter((v) => v === top).length !== 1)
      errors.push("There must be one highest value");
  }
  if (s.task === "practice") {
    const hi = Math.max(...s.values),
      lo = Math.min(...s.values);
    if (hi === lo) errors.push("The values must not all be the same");
    if (
      s.values.filter((v) => v === hi).length !== 1 ||
      s.values.filter((v) => v === lo).length !== 1
    )
      errors.push("There must be one highest and one lowest value");
  }
  return errors;
}

export function lineGraphsAnswer(
  s: LineGraphsSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "scale":
      return String(s.step);
    case "read":
      return String(s.values[s.a]);
    case "compare":
      return choiceFor(step, s.values[s.a] > s.values[s.b] ? "left" : "right");
    case "difference":
      return String(Math.abs(s.values[s.b] - s.values[s.a]));
    case "biggest-rise":
      return choiceFor(step, "biggest");
    case "above": {
      const above = new Set(aboveTarget(s).map((i) => `label:${i}`));
      return (step.choices ?? [])
        .filter((c) => above.has(c.meaning ?? ""))
        .map((c) => c.id);
    }
    case "total":
      return String(aboveTarget(s).reduce((sum, i) => sum + s.values[i], 0));
    case "highest":
      return choiceFor(step, "highest");
    case "spread":
      return String(spreadOf(s.values));
  }
  return "";
}

const GOALS: Record<LineGraphsSpec["task"], string[]> = {
  read: ["scale", "read", "compare", "reflection"],
  change: ["read", "difference", "biggest-rise", "reflection"],
  threshold: ["above", "total", "highest", "reflection"],
  practice: ["spread", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  scale: "exact",
  read: "exact",
  compare: "choice",
  difference: "exact",
  "biggest-rise": "choice",
  above: "multi",
  total: "exact",
  highest: "choice",
  spread: "exact",
  reflection: "choice",
};
export function validateLineGraphsSteps(lesson: Lesson): string[] {
  const errors = validateLineGraphsSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as LineGraphsSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported line-graph goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    const answer = lineGraphsAnswer(s, step);
    if (
      goal !== "reflection" &&
      (JSON.stringify(step.answer) !== JSON.stringify(answer) ||
        answer === "" ||
        (Array.isArray(answer) && !answer.length))
    )
      errors.push("Answer contradicts line-graph model");
    if (goal === "compare")
      errors.push(...checkMeanings(step, ["left", "right", "same"], goal));
    if (goal === "biggest-rise")
      errors.push(
        ...checkMeanings(step, ["biggest", "other-a", "other-b"], goal),
      );
    if (goal === "highest")
      errors.push(
        ...checkMeanings(step, ["highest", "other-a", "other-b"], goal),
      );
    if (goal === "above")
      errors.push(
        ...checkMeanings(
          step,
          s.labels.map((_, i) => `label:${i}`),
          goal,
        ),
      );
  }
  return errors;
}

function describe(s: LineGraphsSpec): string {
  const rows = rowsOf(s);
  const points = s.labels.map((l, i) => `${l} ${s.values[i]}`).join(", ");
  return `Line graph of ${s.quantity}. The scale goes up in steps of ${s.step} from 0 to ${rows * s.step}. Points: ${points}.${s.task === "threshold" ? ` A dashed line marks ${s.target}.` : ""}`;
}

function graphSvg(s: LineGraphsSpec): string {
  // Sized for a phone: it shrinks to roughly 0.75 of this width, so text stays near 11px or more.
  const W = 400,
    H = 270,
    L = 46,
    R = 14,
    T = 38,
    B = 48;
  const w = W - L - R,
    h = H - T - B;
  const rows = rowsOf(s),
    top = rows * s.step;
  const y = (v: number) => T + h - (v / top) * h;
  const n = s.labels.length;
  const x = (i: number) => L + 22 + (i * (w - 44)) / (n - 1);
  const all = s.task !== "read"; // the scale task labels only the ends so learners work out the step
  const grid = Array.from({ length: rows + 1 }, (_, k) => {
    const v = k * s.step,
      yy = y(v);
    const label =
      all || k === 0 || k === rows
        ? `<text x="${L - 10}" y="${yy}" text-anchor="end" dominant-baseline="central" font-size="15" fill="#243b31">${v}</text>`
        : "";
    return `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="${k === 0 ? "#3b5a4a" : "#d6d0c2"}" stroke-width="${k === 0 ? 2 : 1}"/><line x1="${L - 5}" y1="${yy}" x2="${L}" y2="${yy}" stroke="#3b5a4a" stroke-width="1.5"/>${label}`;
  }).join("");
  const line = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const dots = s.values
    .map(
      (v, i) =>
        `<circle cx="${x(i)}" cy="${y(v)}" r="5.5" fill="#2a7a96" stroke="#fffdf8" stroke-width="2"/>`,
    )
    .join("");
  const xs = s.labels
    .map(
      (l, i) =>
        `<line x1="${x(i)}" y1="${y(0)}" x2="${x(i)}" y2="${y(0) + 5}" stroke="#3b5a4a" stroke-width="1.5"/><text x="${x(i)}" y="${y(0) + 22}" text-anchor="middle" font-size="15" font-weight="600" fill="#243b31">${esc(l)}</text>`,
    )
    .join("");
  const threshold =
    s.task === "threshold"
      ? `<line x1="${L}" y1="${y(s.target)}" x2="${W - R}" y2="${y(s.target)}" stroke="#9a3b24" stroke-width="2" stroke-dasharray="7 5"/><text x="${W - R}" y="${y(s.target) - 8}" text-anchor="end" font-size="14" font-weight="700" fill="#9a3b24" stroke="#fffdf8" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${s.target}</text>`
      : "";
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${W}px;max-width:100%;height:auto"><text x="${L}" y="22" font-size="16" font-weight="700" fill="#1f5f78">${esc(s.quantity)}</text>${grid}${threshold}<polyline points="${line}" fill="none" stroke="#2a7a96" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xs}</svg>`;
}

const adapter = makeAdapter<LineGraphsSpec>({
  id: "line-graphs",
  answerFor: lineGraphsAnswer,
  describe,
});

export const lineGraphsTopic: RuntimeTopic = {
  id: "line-graphs",
  label: "Line graphs",
  visualTitle: "Read the line graph",
  adapter,
  validateSpec: validateLineGraphsSpec,
  validateSteps: validateLineGraphsSteps,
  answer: (l, step) =>
    lineGraphsAnswer(l.specification as unknown as LineGraphsSpec, step),
  render: (l) => {
    const s = l.specification as unknown as LineGraphsSpec;
    // The text alternative lists the data; it is not shown on screen because it would give away the readings.
    return `<div class="line-graphs-model" role="img" aria-label="${esc(describe(s))}">${graphSvg(s)}</div>`;
  },
  interpretation: (l) => {
    const s = l.specification as unknown as LineGraphsSpec;
    if (s.task !== "practice") return undefined;
    const hi = Math.max(...s.values),
      lo = Math.min(...s.values);
    return {
      entities: ["highest", "lowest", "difference"],
      quantities: [
        { entity: "highest", value: hi, unit: s.quantity, state: "given" },
        { entity: "lowest", value: lo, unit: s.quantity, state: "given" },
        {
          entity: "difference",
          value: hi - lo,
          unit: s.quantity,
          state: "derived",
        },
      ],
      relationships: [
        {
          kind: "operation",
          id: "difference",
          operation: "subtract",
          inputs: ["highest", "lowest"],
          output: "difference",
        },
      ],
      unknown: "difference",
      sourceSpans: [{ start: 0, end: l.story.length, text: l.story }],
      assumptions: [
        "Each value is read from the graph to the nearest half step.",
      ],
      ambiguities: [],
    } as ReturnType<NonNullable<RuntimeTopic["interpretation"]>>;
  },
};
