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

/**
 * Pie charts as fractions of a whole. Every answer is exact integer arithmetic on the slice counts.
 * Percentages and sector angles are never shown, asked or offered as choices. Angles exist only as
 * whole-degree integers inside this module so the drawing can be built and tested.
 */
export type PieTask = "read" | "sectors" | "count" | "total" | "practice";
export interface PieChartsSpec {
  task: PieTask;
  /** Number of equal slices the whole is cut into. Always 8 for `sectors`. */
  slices: number;
  /** Plain category labels, drawn beside their sectors. */
  categories: string[];
  /** Slices per category; the parts add up to `slices`. */
  parts: number[];
  /** Items one slice stands for: 0 for `read` and `sectors`, otherwise 2 to 20. */
  unit: number;
  /** What is counted, for example "pupils". */
  quantity: string;
  /** First category asked about. */
  a: number;
  /** Second category asked about. */
  b: number;
}

export const SLICE_COUNTS = [4, 5, 6, 8, 10, 12];
export const SECTOR_SLICES = 8;
export const SECTOR_PARTS = [1, 2, 4];
export const MAX_WHOLE = 240;
export const PIE_TASKS: PieTask[] = [
  "read",
  "sectors",
  "count",
  "total",
  "practice",
];
const FRACTION_WORD: Record<number, string> = {
  4: "half",
  2: "quarter",
  1: "eighth",
};
export const sectorWord = (parts: number) => FRACTION_WORD[parts] ?? "";

const KEYS = [
  "task",
  "slices",
  "categories",
  "parts",
  "unit",
  "quantity",
  "a",
  "b",
];
const plain = (v: unknown, max: number): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max && !/[<>&"']/.test(v);
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const sameFraction = (n1: number, d1: number, n2: number, d2: number) =>
  n1 * d2 === n2 * d1;

/** Whole-degree size of a sector: exact because every slice count divides 360. */
export const degreesPerSlice = (slices: number) => 360 / slices;
export const sectorDegrees = (s: Pick<PieChartsSpec, "slices" | "parts">) =>
  s.parts.map((p) => p * degreesPerSlice(s.slices));

/* ------------------------------------------------------------------------------------------ */
/* Layout: label boxes and the pure collision test                                            */
/* ------------------------------------------------------------------------------------------ */

export const VIEW = { w: 400, h: 310, cx: 200, cy: 160, r: 95, labelR: 111 };
export const LABEL_SIZE = 15;
export const CALLOUT_SIZE = 16;
/** Conservative width of one bold capital in em: wider than the real average so the check errs safe. */
export const CAP_EM = 0.65;
export interface LabelBox {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type Anchor = "start" | "middle" | "end";
export const estimatedWidth = (chars: number, size: number) =>
  chars * CAP_EM * size;

/** Where a category label sits: just outside the rim at the sector's middle angle. */
export function labelAnchor(midDegrees: number): {
  x: number;
  y: number;
  anchor: Anchor;
} {
  const t = (midDegrees * Math.PI) / 180;
  const x = VIEW.cx + VIEW.labelR * Math.sin(t);
  const y = VIEW.cy - VIEW.labelR * Math.cos(t);
  const anchor: Anchor =
    Math.abs(x - VIEW.cx) < 8 ? "middle" : x > VIEW.cx ? "start" : "end";
  return { x, y, anchor };
}
export function boxFor(
  id: string,
  text: string,
  x: number,
  y: number,
  anchor: Anchor,
  size: number,
): LabelBox {
  const w = estimatedWidth(text.length, size);
  const h = size * 1.2;
  const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { id, x0, y0: y - h / 2, x1: x0 + w, y1: y + h / 2 };
}
/** The text drawn above the pie, if any: the whole, or the one count that is given. */
export function calloutText(s: PieChartsSpec): string | null {
  if (s.task === "count" || s.task === "practice")
    return `Total: ${s.slices * s.unit} ${s.quantity}`;
  if (s.task === "total")
    return `${s.categories[s.a]}: ${s.parts[s.a] * s.unit} ${s.quantity}`;
  return null;
}
export const CALLOUT_X = 12;
export const CALLOUT_Y = 20;

export function labelBoxes(s: PieChartsSpec): LabelBox[] {
  const boxes: LabelBox[] = [];
  let before = 0;
  s.categories.forEach((name, i) => {
    const start = (before * 360) / s.slices;
    const end = ((before + s.parts[i]) * 360) / s.slices;
    const { x, y, anchor } = labelAnchor((start + end) / 2);
    boxes.push(boxFor(`label:${i}`, name, x, y, anchor, LABEL_SIZE));
    before += s.parts[i];
  });
  const callout = calloutText(s);
  if (callout)
    boxes.push(
      boxFor("callout", callout, CALLOUT_X, CALLOUT_Y, "start", CALLOUT_SIZE),
    );
  return boxes;
}
export const boxesOverlap = (a: LabelBox, b: LabelBox, gap = 0) =>
  a.x0 < b.x1 + gap &&
  b.x0 < a.x1 + gap &&
  a.y0 < b.y1 + gap &&
  b.y0 < a.y1 + gap;
/** Pure: names every box that leaves the viewBox and every pair of boxes that overlap. */
export function labelProblems(
  boxes: LabelBox[],
  width = VIEW.w,
  height = VIEW.h,
  gap = 0,
): string[] {
  const problems: string[] = [];
  for (const b of boxes)
    if (b.x0 < 0 || b.y0 < 0 || b.x1 > width || b.y1 > height)
      problems.push(`${b.id} leaves the picture`);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxesOverlap(boxes[i], boxes[j], gap))
        problems.push(`${boxes[i].id} overlaps ${boxes[j].id}`);
  return problems;
}

/* ------------------------------------------------------------------------------------------ */
/* Validation                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export function validatePieChartsSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a pie-chart specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown pie-chart field");
  const s = input as unknown as PieChartsSpec;
  if (!PIE_TASKS.includes(s.task)) errors.push("Unsupported pie-chart task");
  if (!isInt(s.slices, 4, 12) || !SLICE_COUNTS.includes(s.slices))
    errors.push("The pie has 4, 5, 6, 8, 10 or 12 equal slices");
  if (!plain(s.quantity, 30))
    errors.push("Say what is counted in a few plain words");
  const cats = s.categories;
  if (
    !Array.isArray(cats) ||
    cats.length < 3 ||
    cats.length > 5 ||
    cats.some((c) => !plain(c, 8)) ||
    new Set(cats.map((c) => String(c).trim().toLowerCase())).size !==
      cats.length
  )
    errors.push(
      "Use three to five different short labels of up to eight plain characters",
    );
  if (
    !Array.isArray(s.parts) ||
    !Array.isArray(cats) ||
    s.parts.length !== cats.length ||
    s.parts.some((p) => !isInt(p, 1, 10))
  )
    errors.push("Give each label a whole number of slices, at least 1");
  if (!isInt(s.unit, 0, 20))
    errors.push("The number each slice stands for must be a whole number");
  if (!isInt(s.a, 0, 4) || !isInt(s.b, 0, 4))
    errors.push("Categories asked about must be whole-number positions");
  if (errors.length) return errors;
  const n = cats.length;
  if (s.a >= n || s.b >= n)
    errors.push("Choose categories that exist on the pie");
  if (sum(s.parts) !== s.slices)
    errors.push(
      "The slices of all the labels must add up to the number of slices",
    );
  if (s.parts.some((p) => p > s.slices - 2))
    errors.push("No label may take all but one of the slices, or more");
  if (errors.length) return errors;
  if (s.task === "sectors") {
    if (s.slices !== SECTOR_SLICES)
      errors.push("The sector lesson uses a pie of exactly 8 equal parts");
    if (n > 4) errors.push("The sector lesson uses three or four labels");
    if (s.parts.some((p) => !SECTOR_PARTS.includes(p)))
      errors.push("Sector sizes are 1, 2 or 4 of the 8 parts");
  }
  if (s.task === "read" || s.task === "sectors") {
    if (s.unit !== 0)
      errors.push("This task shows no numbers, so items per slice must be 0");
  } else {
    if (!isInt(s.unit, 2, 20))
      errors.push("Each slice stands for a whole number from 2 to 20");
    else if (s.slices * s.unit > MAX_WHOLE)
      errors.push(`The whole pie may be at most ${MAX_WHOLE}`);
  }
  if (errors.length) return errors;
  const usesBoth = s.task !== "practice";
  if (usesBoth && s.a === s.b) errors.push("Choose two different labels");
  if (s.task === "read" && s.a !== s.b && s.parts[s.a] === s.parts[s.b])
    errors.push("The two labels must cover different numbers of slices");
  if (s.task === "read") {
    const p = s.parts[s.a],
      N = s.slices;
    const options = [
      [p, N],
      [N - p, N],
      [p, N - p],
    ];
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++)
        if (
          sameFraction(
            options[i][0],
            options[i][1],
            options[j][0],
            options[j][1],
          )
        )
          errors.push(
            "The fractions offered would not all be different: avoid a label with exactly half of the slices",
          );
  }
  if (s.task === "count" && s.parts[s.a] <= s.parts[s.b])
    errors.push("The first label must cover more slices than the second");
  if (s.task === "total" && s.parts[s.a] < 2)
    errors.push("The label with the known count needs at least 2 slices");
  if (errors.length) return errors;
  const callout = calloutText(s);
  if (
    callout &&
    estimatedWidth(callout.length, CALLOUT_SIZE) + CALLOUT_X > VIEW.w - 8
  )
    errors.push(
      "The words above the pie are too long: shorten what is counted or the label",
    );
  const problems = labelProblems(labelBoxes(s));
  if (problems.length)
    errors.push(
      `Labels would not fit beside the pie (${problems[0]}): shorten a label or change the slices`,
    );
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Answers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export function pieChartsAnswer(s: PieChartsSpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "slices":
      return String(s.slices);
    case "fraction":
      return choiceFor(step, "share");
    case "larger":
      return choiceFor(step, s.parts[s.a] > s.parts[s.b] ? "left" : "right");
    case "sector-fraction":
      return choiceFor(step, sectorWord(s.parts[s.a]));
    case "parts":
      return String(s.parts[s.b]);
    case "share":
      return choiceFor(step, "share");
    case "one-slice":
      return String(s.unit);
    case "category":
      return String(s.parts[s.a] * s.unit);
    case "more":
      return String((s.parts[s.a] - s.parts[s.b]) * s.unit);
    case "total":
      return String(s.slices * s.unit);
    case "other":
      return String(s.parts[s.b] * s.unit);
    case "rest":
      return String((s.slices - s.parts[s.a]) * s.unit);
  }
  return "";
}

export const GOALS: Record<PieTask, string[]> = {
  read: ["slices", "fraction", "larger", "reflection"],
  sectors: ["sector-fraction", "parts", "share", "reflection"],
  count: ["one-slice", "category", "more", "reflection"],
  total: ["one-slice", "total", "other", "reflection"],
  practice: ["rest", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  slices: "exact",
  fraction: "choice",
  larger: "choice",
  "sector-fraction": "choice",
  parts: "exact",
  share: "choice",
  "one-slice": "exact",
  category: "exact",
  more: "exact",
  total: "exact",
  other: "exact",
  rest: "exact",
  reflection: "choice",
};
export function validatePieChartsSteps(lesson: Lesson): string[] {
  const errors = validatePieChartsSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as PieChartsSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported pie-chart goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    const answer = pieChartsAnswer(s, step);
    if (
      goal !== "reflection" &&
      (JSON.stringify(step.answer) !== JSON.stringify(answer) ||
        answer === "" ||
        (Array.isArray(answer) && !answer.length))
    )
      errors.push("Answer contradicts pie-chart model");
    if (goal === "fraction") {
      errors.push(...checkMeanings(step, ["share", "rest", "ratio"], goal));
      const p = s.parts[s.a],
        N = s.slices;
      const expected: Record<string, string> = {
        share: `${p}/${N}`,
        rest: `${N - p}/${N}`,
        ratio: `${p}/${N - p}`,
      };
      for (const c of step.choices ?? [])
        if (c.label !== expected[c.meaning ?? ""])
          errors.push("Fraction choices contradict the pie");
    }
    if (goal === "larger")
      errors.push(...checkMeanings(step, ["left", "right", "same"], goal));
    if (goal === "sector-fraction")
      errors.push(...checkMeanings(step, ["half", "quarter", "eighth"], goal));
    if (goal === "share")
      errors.push(...checkMeanings(step, ["share", "amount", "angle"], goal));
  }
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Text alternative                                                                           */
/* ------------------------------------------------------------------------------------------ */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/**
 * The text alternative lists the data of the picture (as the line graphs do): the slices of every
 * label and any number drawn. For a screen-reader user this gives away what a sighted learner reads
 * from the picture, and that is recorded for accessibility review.
 */
export function describe(s: PieChartsSpec): string {
  if (validatePieChartsSpec(s).length)
    return "A pie chart that needs correcting.";
  if (s.task === "sectors")
    return `Pie chart of ${s.quantity}. The whole circle is 8 equal parts and the cuts are not drawn. ${s.categories
      .map((c, i) => `${c} covers ${s.parts[i]} of the 8 parts`)
      .join(". ")}.`;
  const note =
    s.task === "count" || s.task === "practice"
      ? ` The whole pie shows ${s.slices * s.unit} ${s.quantity}.`
      : s.task === "total"
        ? ` ${s.categories[s.a]} shows ${s.parts[s.a] * s.unit} ${s.quantity}.`
        : "";
  return `Pie chart of ${s.quantity}, cut into ${s.slices} equal slices. ${s.categories
    .map((c, i) => `${c} covers ${plural(s.parts[i], "slice")}`)
    .join(". ")}.${note}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Drawing                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Five fills, each at least 3:1 against the page; sectors are told apart by labels and the white stroke. */
export const PIE_FILLS = [
  "#2a7a96",
  "#c0561f",
  "#7a5c9a",
  "#4f8a3c",
  "#8a6d00",
];
export const PIE_PAGE = "#fffdf8";
export const PIE_INK = "#243b31";
const fix = (v: number) => v.toFixed(2);
export const pointAt = (degrees: number, radius = VIEW.r) => {
  const t = (degrees * Math.PI) / 180;
  return [
    VIEW.cx + radius * Math.sin(t),
    VIEW.cy - radius * Math.cos(t),
  ] as const;
};
/** Path of one sector: from 12 o'clock, clockwise, large-arc flag when it exceeds a half. */
export function sectorPath(
  slices: number,
  from: number,
  count: number,
): string {
  const [x1, y1] = pointAt((from * 360) / slices);
  const [x2, y2] = pointAt(((from + count) * 360) / slices);
  const large = count * 2 > slices ? 1 : 0;
  return `M ${VIEW.cx} ${VIEW.cy} L ${fix(x1)} ${fix(y1)} A ${VIEW.r} ${VIEW.r} 0 ${large} 1 ${fix(x2)} ${fix(y2)} Z`;
}

export function pieSvg(s: PieChartsSpec): string {
  let before = 0;
  const sectors = s.categories
    .map((_, i) => {
      const d = sectorPath(s.slices, before, s.parts[i]);
      before += s.parts[i];
      return `<path class="pie-sector" d="${d}" fill="${PIE_FILLS[i]}" stroke="${PIE_PAGE}" stroke-width="2" stroke-linejoin="round"/>`;
    })
    .join("");
  // Faint spokes show the equal slices; the sector lesson hides them on purpose.
  const spokes =
    s.task === "sectors"
      ? ""
      : Array.from({ length: s.slices }, (_, k) => {
          const [x, y] = pointAt((k * 360) / s.slices);
          return `<line class="pie-spoke" x1="${VIEW.cx}" y1="${VIEW.cy}" x2="${fix(x)}" y2="${fix(y)}" stroke="${PIE_PAGE}" stroke-opacity=".6" stroke-width="1.5"/>`;
        }).join("");
  let at = 0;
  const labels = s.categories
    .map((name, i) => {
      const mid = ((at + s.parts[i] / 2) * 360) / s.slices;
      at += s.parts[i];
      const { x, y, anchor } = labelAnchor(mid);
      return `<text class="pie-label" x="${fix(x)}" y="${fix(y)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${LABEL_SIZE}" font-weight="700" fill="${PIE_INK}">${esc(name)}</text>`;
    })
    .join("");
  const callout = calloutText(s);
  const head = callout
    ? `<text class="pie-callout" x="${CALLOUT_X}" y="${CALLOUT_Y}" dominant-baseline="central" font-size="${CALLOUT_SIZE}" font-weight="700" fill="${PIE_INK}">${esc(callout)}</text>`
    : "";
  return `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${VIEW.w}px;max-width:100%;height:auto">${head}${sectors}${spokes}${labels}</svg>`;
}

const adapter = makeAdapter<PieChartsSpec>({
  id: "pie-charts",
  answerFor: pieChartsAnswer,
  describe,
});

export const pieChartsTopic: RuntimeTopic = {
  id: "pie-charts",
  label: "Pie charts",
  visualTitle: "Read the pie chart",
  adapter,
  validateSpec: validatePieChartsSpec,
  validateSteps: validatePieChartsSteps,
  answer: (l, step) =>
    pieChartsAnswer(l.specification as unknown as PieChartsSpec, step),
  render: (l) => {
    const s = l.specification as unknown as PieChartsSpec;
    if (validatePieChartsSpec(s).length)
      return `<div class="pie-charts-model"><p>Correct the pie chart to see the picture.</p></div>`;
    // The text alternative lists the data; it is not shown on screen.
    return `<div class="pie-charts-model" role="img" aria-label="${esc(describe(s))}">${pieSvg(s)}</div>`;
  },
};
