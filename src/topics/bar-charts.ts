import type { Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import {
  SCALE_STEPS,
  axisTop,
  barPixels,
  estimatedWidth,
  grainFor,
  maxLabelChars,
  maxValueFor,
  rowPixels,
  rowsFor,
  slotWidth,
} from "./chart-scale";
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

/**
 * Bar charts: read a scale, read bars, add bars, compare the two series of a double bar chart.
 * Every answer is exact integer arithmetic on the data. Values are never printed on the bars, no
 * bar has the value zero, and nothing here asks the learner to interpret or average the data.
 */
export type BarTask = "read" | "double" | "practice";
export interface BarChartsSpec {
  task: BarTask;
  /** Three to six distinct plain category labels. */
  labels: string[];
  /** First series: whole numbers, at least 1, each a multiple of the grain of the step. */
  values: number[];
  /** Second series for `double`; an empty array otherwise. */
  values2: number[];
  /** The two series names for `double`; an empty array otherwise. */
  series: string[];
  /** What one gridline step stands for: 2, 5, 10 or 20. */
  step: number;
  /** What the chart shows, drawn as its title. */
  quantity: string;
  /** First category asked about (`read`, `double`); 0 for `practice`. */
  a: number;
  /** Second category asked about (`read` only); 0 otherwise. */
  b: number;
}

export const BAR_TASKS: BarTask[] = ["read", "double", "practice"];
const KEYS = [
  "task",
  "labels",
  "values",
  "values2",
  "series",
  "step",
  "quantity",
  "a",
  "b",
];
const plain = (v: unknown, max: number): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max && !/[<>&"']/.test(v);

/* ------------------------------------------------------------------------------------------ */
/* Layout constants                                                                           */
/* ------------------------------------------------------------------------------------------ */

export const VIEW_W = 400;
export const LEFT = 46;
export const RIGHT_EDGE = 386;
export const BOTTOM = 52;
export const TEXT_SIZE = 15;
export const TITLE_SIZE = 16;
export const TITLE_Y = 22;
export const LEGEND_Y = 44;
export const topOf = (task: BarTask) => (task === "double" ? 62 : 44);
export const BAR_FILLS = ["#2a7a96", "#c0561f"];
export const BAR_PAGE = "#fffdf8";
export const BAR_INK = "#243b31";
export const BAR_TITLE_INK = "#6b5a00";
export const AXIS_INK = "#3b5a4a";
/** Gridlines are a reading aid and kept at 3:1 against the page like the other graphic marks. */
export const GRID_INK = "#8c968f";

/** Rows of the chart: from the largest value of either series. */
export function rowsOf(s: Pick<BarChartsSpec, "values" | "values2" | "step">) {
  return rowsFor(Math.max(...s.values, ...s.values2), s.step);
}
export const topValue = (s: BarChartsSpec) => axisTop(rowsOf(s), s.step);

/* ------------------------------------------------------------------------------------------ */
/* Validation                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Legend geometry: x of the second entry, so the validator and the drawing agree. */
export const legendX2 = (name1: string) =>
  LEFT + 20 + Math.ceil(estimatedWidth(name1.length, TEXT_SIZE)) + 24;

export function validateBarChartsSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a bar-chart specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown bar-chart field");
  const s = input as unknown as BarChartsSpec;
  if (!BAR_TASKS.includes(s.task)) errors.push("Unsupported bar-chart task");
  if (!SCALE_STEPS.includes(s.step))
    errors.push("Each gridline step is 2, 5, 10 or 20");
  if (!plain(s.quantity, 40))
    errors.push("Say what is counted in a few plain words");
  const labels = s.labels;
  if (
    !Array.isArray(labels) ||
    labels.length < 3 ||
    labels.length > 6 ||
    labels.some((l) => !plain(l, 12)) ||
    new Set(labels.map((l) => String(l).trim().toLowerCase())).size !==
      labels.length
  )
    errors.push("Use three to six different plain labels");
  const n = Array.isArray(labels) ? labels.length : 0;
  const sameLength = (v: unknown): v is number[] =>
    Array.isArray(v) && v.length === n;
  if (!sameLength(s.values))
    errors.push("Give every label a value in the first series");
  if (!Array.isArray(s.values2) || !Array.isArray(s.series))
    errors.push("The second series and the series names must be lists");
  if (!isInt(s.a, 0, 5) || !isInt(s.b, 0, 5))
    errors.push("Categories asked about must be whole-number positions");
  if (errors.length) return errors;

  if (s.task === "double") {
    if (!sameLength(s.values2))
      errors.push("Give every label a value in the second series");
    if (
      s.series.length !== 2 ||
      s.series.some((x) => !plain(x, 12)) ||
      s.series[0].trim().toLowerCase() === s.series[1].trim().toLowerCase()
    )
      errors.push("Name the two series with two different short plain names");
  } else if (s.values2.length || s.series.length)
    errors.push("Only a double bar chart has a second series");
  if (errors.length) return errors;

  const grain = grainFor(s.step);
  const limit = maxValueFor(s.step);
  const all = [...s.values, ...s.values2];
  if (all.some((v) => !isInt(v, 1, limit)))
    errors.push(
      `Every bar is a whole number from 1 to ${limit} for this step: no bar may be zero`,
    );
  else if (all.some((v) => v % grain !== 0))
    errors.push(
      `Values must be multiples of ${grain} so every bar can be read exactly`,
    );
  if (errors.length) return errors;

  if (s.a >= n || s.b >= n)
    errors.push("Choose categories that exist on the chart");
  if (s.task === "practice" && (s.a !== 0 || s.b !== 0))
    errors.push("The practice chart asks about no particular label");
  if (s.task === "double" && s.b !== 0)
    errors.push("The second label is only used by the first lesson");
  if (errors.length) return errors;

  if (s.task === "read") {
    if (s.a === s.b) errors.push("Choose two different labels");
    else if (s.values[s.a] === s.values[s.b])
      errors.push("The two bars asked about must have different values");
  }
  if (s.task === "double") {
    const gaps = s.values.map((v, i) => Math.abs(v - s.values2[i]));
    const sorted = [...gaps].sort((x, y) => y - x);
    if (sorted[0] === sorted[1])
      errors.push("One pair of bars must have a clearly biggest gap");
    if (s.values[s.a] === s.values2[s.a])
      errors.push("The two bars of the chosen label must differ");
  }
  if (s.task === "practice") {
    const sorted = [...s.values].sort((x, y) => y - x);
    if (sorted[1] === sorted[2])
      errors.push(
        "The second and third tallest bars must differ so the two tallest are clear",
      );
  }
  if (errors.length) return errors;

  // Width estimates: every label under its slot, the title and the legend inside the picture.
  const fit = maxLabelChars(n, TEXT_SIZE);
  const longest = Math.max(...labels.map((l) => l.length));
  if (longest > fit)
    errors.push(
      `With ${n} bars a label may have at most ${fit} characters: shorten the longest label`,
    );
  if (estimatedWidth(s.quantity.length, TITLE_SIZE) > RIGHT_EDGE - LEFT)
    errors.push("The title above the chart is too long: shorten it");
  if (s.task === "double") {
    const end =
      legendX2(s.series[0]) +
      20 +
      Math.ceil(estimatedWidth(s.series[1].length, TEXT_SIZE));
    if (end > RIGHT_EDGE) errors.push("The two series names are too long");
  }
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Answers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Indexes of the categories ordered by the gap between the two bars, biggest first. */
export function gapOrder(s: BarChartsSpec): number[] {
  return s.values
    .map((v, i) => ({ i, gap: Math.abs(v - s.values2[i]) }))
    .sort((x, y) => y.gap - x.gap || x.i - y.i)
    .map((x) => x.i);
}

export function barChartsAnswer(s: BarChartsSpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "scale":
      return String(s.step);
    case "read":
      return String(s.values[s.a]);
    case "total":
      return String(s.values[s.a] + s.values[s.b]);
    case "read-pair":
      return String(s.values2[s.a]);
    case "difference":
      return String(Math.abs(s.values[s.a] - s.values2[s.a]));
    case "gap":
      return choiceFor(step, "biggest");
    case "top-two-total": {
      const top = [...s.values].sort((x, y) => y - x);
      return String(top[0] + top[1]);
    }
  }
  return "";
}

export const GOALS: Record<BarTask, string[]> = {
  read: ["scale", "read", "total", "reflection"],
  double: ["read-pair", "difference", "gap", "reflection"],
  practice: ["top-two-total", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  scale: "exact",
  read: "exact",
  total: "exact",
  "read-pair": "exact",
  difference: "exact",
  gap: "choice",
  "top-two-total": "exact",
  reflection: "choice",
};
export function validateBarChartsSteps(lesson: Lesson): string[] {
  const errors = validateBarChartsSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as BarChartsSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported bar-chart goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    const answer = barChartsAnswer(s, step);
    if (
      goal !== "reflection" &&
      (JSON.stringify(step.answer) !== JSON.stringify(answer) ||
        answer === "" ||
        (Array.isArray(answer) && !answer.length))
    )
      errors.push("Answer contradicts bar-chart model");
    if (goal === "gap") {
      errors.push(
        ...checkMeanings(step, ["biggest", "other-a", "other-b"], goal),
      );
      const order = gapOrder(s).slice(0, 3);
      const expected: Record<string, string> = {
        biggest: s.labels[order[0]],
        "other-a": s.labels[order[1]],
        "other-b": s.labels[order[2]],
      };
      for (const c of step.choices ?? [])
        if (c.label !== expected[c.meaning ?? ""])
          errors.push("Gap choices contradict the chart");
    }
  }
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Text alternative                                                                           */
/* ------------------------------------------------------------------------------------------ */

/**
 * The text alternative lists the data of the picture (as the line graphs do): every bar's value.
 * For a screen-reader user this gives away what a sighted learner reads from the picture, and that
 * is recorded for accessibility review.
 */
export function describe(s: BarChartsSpec): string {
  if (validateBarChartsSpec(s).length)
    return "A bar chart that needs correcting.";
  const scale = `The scale goes up in steps of ${s.step} from 0 to ${topValue(s)}.`;
  if (s.task === "double")
    return `Double bar chart: ${s.quantity}. ${scale} Solid bars show ${s.series[0]} and striped bars show ${s.series[1]}. ${s.labels
      .map(
        (l, i) =>
          `${l}: ${s.series[0]} ${s.values[i]}, ${s.series[1]} ${s.values2[i]}`,
      )
      .join(". ")}.`;
  return `Bar chart: ${s.quantity}. ${scale} Bars: ${s.labels
    .map((l, i) => `${l} ${s.values[i]}`)
    .join(", ")}.`;
}

/* ------------------------------------------------------------------------------------------ */
/* Drawing                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Whole-unit geometry of every bar, so the drawing and the checks can use exact integers. */
export interface BarRect {
  series: 1 | 2;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function layout(s: BarChartsSpec) {
  const n = s.labels.length;
  const rows = rowsOf(s);
  const rowPx = rowPixels(rows);
  const slot = slotWidth(n);
  const top = topOf(s.task);
  const baseline = top + rows * rowPx;
  const double = s.task === "double";
  const width = double
    ? Math.floor((slot - 10) / 2)
    : 2 * Math.floor((slot * 0.6) / 2);
  const group = double ? 2 * width + 2 : width;
  const bars: BarRect[] = [];
  s.values.forEach((v, i) => {
    const x0 = LEFT + i * slot + Math.floor((slot - group) / 2);
    const series: [1 | 2, number, number][] = [[1, v, x0]];
    if (double) series.push([2, s.values2[i], x0 + width + 2]);
    for (const [which, value, x] of series) {
      const height = barPixels(value, s.step, rows);
      bars.push({
        series: which,
        index: i,
        x,
        y: baseline - height,
        width,
        height,
      });
    }
  });
  return {
    rows,
    rowPx,
    slot,
    top,
    baseline,
    bars,
    height: baseline + BOTTOM,
    right: LEFT + slot * n,
  };
}

export function barSvg(s: BarChartsSpec): string {
  const g = layout(s);
  const double = s.task === "double";
  const labelAll = s.task !== "read"; // the scale task labels only the ends, so the step must be worked out
  const grid = Array.from({ length: g.rows + 1 }, (_, k) => {
    const y = g.baseline - k * g.rowPx;
    const label =
      labelAll || k === 0 || k === g.rows
        ? `<text class="bar-axis-label" x="${LEFT - 10}" y="${y}" text-anchor="end" dominant-baseline="central" font-size="${TEXT_SIZE}" fill="${BAR_INK}">${k * s.step}</text>`
        : "";
    const line =
      k === 0
        ? `<line class="bar-baseline" x1="${LEFT}" y1="${y}" x2="${g.right}" y2="${y}" stroke="${AXIS_INK}" stroke-width="2"/>`
        : `<line class="bar-grid" x1="${LEFT}" y1="${y}" x2="${g.right}" y2="${y}" stroke="${GRID_INK}" stroke-width="1"/>`;
    return `${line}<line class="bar-tick" x1="${LEFT - 5}" y1="${y}" x2="${LEFT}" y2="${y}" stroke="${AXIS_INK}" stroke-width="1.5"/>${label}`;
  }).join("");
  const axis = `<line class="bar-axis" x1="${LEFT}" y1="${g.top}" x2="${LEFT}" y2="${g.baseline}" stroke="${AXIS_INK}" stroke-width="2"/>`;
  const bars = g.bars
    .map((b) => {
      const geometry = `x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"`;
      const hatch =
        b.series === 2
          ? `<rect class="bar-hatch" ${geometry} fill="url(#bar-hatch)"/>`
          : "";
      return `<rect class="bar" data-series="${b.series}" data-index="${b.index}" ${geometry} fill="${BAR_FILLS[b.series - 1]}"/>${hatch}`;
    })
    .join("");
  const cats = s.labels
    .map((name, i) => {
      const cx = LEFT + i * g.slot + g.slot / 2;
      return `<line class="bar-tick" x1="${cx}" y1="${g.baseline}" x2="${cx}" y2="${g.baseline + 5}" stroke="${AXIS_INK}" stroke-width="1.5"/><text class="bar-label" x="${cx}" y="${g.baseline + 24}" text-anchor="middle" font-size="${TEXT_SIZE}" font-weight="600" fill="${BAR_INK}">${esc(name)}</text>`;
    })
    .join("");
  const title = `<text class="bar-title" x="${LEFT}" y="${TITLE_Y}" font-size="${TITLE_SIZE}" font-weight="700" fill="${BAR_TITLE_INK}">${esc(s.quantity)}</text>`;
  let legend = "";
  let defs = "";
  if (double) {
    defs = `<defs><pattern id="bar-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="${BAR_PAGE}" fill-opacity=".75"/></pattern></defs>`;
    const x2 = legendX2(s.series[0]);
    const entry = (i: 0 | 1, x: number) =>
      `<rect class="legend-swatch" data-series="${i + 1}" x="${x}" y="${LEGEND_Y - 7}" width="14" height="14" fill="${BAR_FILLS[i]}"/>${
        i === 1
          ? `<rect class="legend-hatch" x="${x}" y="${LEGEND_Y - 7}" width="14" height="14" fill="url(#bar-hatch)"/>`
          : ""
      }<text class="legend-text" x="${x + 20}" y="${LEGEND_Y}" dominant-baseline="central" font-size="${TEXT_SIZE}" font-weight="600" fill="${BAR_INK}">${esc(s.series[i])}</text>`;
    legend = entry(0, LEFT) + entry(1, x2);
  }
  return `<svg viewBox="0 0 ${VIEW_W} ${g.height}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${VIEW_W}px;max-width:100%;height:auto">${defs}${title}${legend}${grid}${axis}${bars}${cats}</svg>`;
}

const adapter = makeAdapter<BarChartsSpec>({
  id: "bar-charts",
  answerFor: barChartsAnswer,
  describe,
});

export const barChartsTopic: RuntimeTopic = {
  id: "bar-charts",
  label: "Bar charts",
  visualTitle: "Read the bar chart",
  adapter,
  validateSpec: validateBarChartsSpec,
  validateSteps: validateBarChartsSteps,
  answer: (l, step) =>
    barChartsAnswer(l.specification as unknown as BarChartsSpec, step),
  render: (l) => {
    const s = l.specification as unknown as BarChartsSpec;
    if (validateBarChartsSpec(s).length)
      return `<div class="bar-charts-model"><p>Correct the bar chart to see the picture.</p></div>`;
    // The text alternative lists the data; it is not shown on screen because it would give away the readings.
    return `<div class="bar-charts-model" role="img" aria-label="${esc(describe(s))}">${barSvg(s)}</div>`;
  },
};
