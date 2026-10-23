import type { Lesson, Step } from "../core/types";
import { lazyWorkbench } from "../workbench/lazy";
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
  parseWhole,
} from "./p4-kit";
import type { Rational } from "./exact";

export type Heading = "N" | "E" | "S" | "W";
export const HEADINGS: Heading[] = ["N", "E", "S", "W"];
export const HEADING_NAME: Record<Heading, string> = {
  N: "north",
  E: "east",
  S: "south",
  W: "west",
};
export interface AngleMeasureSpec {
  task:
    "read" | "estimate" | "turns" | "practice" | "bench-read" | "bench-draw";
  /** The angle to measure, a multiple of 5 so it can be read exactly. */
  degrees: number;
  /** True when the angle's base arm lies along the left end of the protractor baseline. */
  flip: boolean;
  /** Turns task: the starting direction. */
  from: Heading;
  direction: "clockwise" | "anticlockwise";
  /** Turns task: how many quarter turns. */
  quarters: number;
}

export const kindOfAngle = (d: number): "acute" | "right" | "obtuse" =>
  d < 90 ? "acute" : d === 90 ? "right" : "obtuse";
/** One close estimate and two clearly wrong ones, all between 0 and 180 degrees. */
export function estimateOptions(d: number): {
  close: number;
  low: number;
  high: number;
} {
  const close = d <= 90 ? d + 5 : d - 5;
  const low = d - 45 >= 10 ? d - 45 : d + 50;
  const high = d + 45 <= 170 ? d + 45 : d - 50;
  return { close, low, high };
}
export function headingAfter(s: AngleMeasureSpec): Heading {
  const i = HEADINGS.indexOf(s.from);
  const step = s.direction === "clockwise" ? s.quarters : -s.quarters;
  return HEADINGS[(((i + step) % 4) + 4) % 4];
}
export const turnName = (q: number) =>
  q === 1 ? "quarter" : q === 2 ? "half" : "three-quarter";

const KEYS = ["task", "degrees", "flip", "from", "direction", "quarters"];
export function validateAngleMeasureSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected an angle specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown angle field");
  const s = input as unknown as AngleMeasureSpec;
  if (
    ![
      "read",
      "estimate",
      "turns",
      "practice",
      "bench-read",
      "bench-draw",
    ].includes(s.task)
  )
    errors.push("Unsupported angle task");
  if (!isInt(s.degrees, 5, 175) || s.degrees % 5 !== 0)
    errors.push("The angle must be a multiple of 5 from 5 to 175 degrees");
  if (typeof s.flip !== "boolean")
    errors.push("Say which end of the protractor the base arm uses");
  if (!HEADINGS.includes(s.from))
    errors.push("Choose north, east, south or west");
  if (!["clockwise", "anticlockwise"].includes(s.direction))
    errors.push("Turn clockwise or anticlockwise");
  if (!isInt(s.quarters, 1, 3))
    errors.push("Turn one, two or three quarter turns");
  return errors;
}

export function angleMeasureAnswer(
  s: AngleMeasureSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "scale":
      return choiceFor(step, s.flip ? "inner" : "outer");
    case "supplement":
      return String(180 - s.degrees);
    case "read":
      return String(s.degrees);
    case "classify":
      return choiceFor(step, kindOfAngle(s.degrees));
    case "estimate":
      return choiceFor(step, "close");
    case "fraction":
      return choiceFor(step, turnName(s.quarters));
    case "degrees":
      return String(s.quarters * 90);
    case "facing":
      return choiceFor(step, `heading:${headingAfter(s)}`);
  }
  return "";
}

const GOALS: Record<AngleMeasureSpec["task"], string[]> = {
  "bench-read": ["read", "classify", "reflection"],
  "bench-draw": ["supplement", "classify", "reflection"],
  read: ["scale", "read", "classify", "reflection"],
  estimate: ["estimate", "read", "reflection"],
  turns: ["fraction", "degrees", "facing", "reflection"],
  practice: ["read", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  supplement: "exact",
  scale: "choice",
  read: "exact",
  classify: "choice",
  estimate: "choice",
  fraction: "choice",
  degrees: "exact",
  facing: "choice",
  reflection: "choice",
};
export function validateAngleMeasureSteps(lesson: Lesson): string[] {
  const errors = validateAngleMeasureSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as AngleMeasureSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported angle goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    if (
      goal !== "reflection" &&
      (step.answer === "" || step.answer !== angleMeasureAnswer(s, step))
    )
      errors.push("Answer contradicts angle model");
    if (goal === "scale")
      errors.push(...checkMeanings(step, ["outer", "inner", "either"], goal));
    if (goal === "classify")
      errors.push(...checkMeanings(step, ["acute", "right", "obtuse"], goal));
    if (goal === "estimate")
      errors.push(...checkMeanings(step, ["close", "low", "high"], goal));
    if (goal === "fraction")
      errors.push(
        ...checkMeanings(step, ["quarter", "half", "three-quarter"], goal),
      );
    if (goal === "facing")
      errors.push(
        ...checkMeanings(
          step,
          HEADINGS.map((h) => `heading:${h}`),
          goal,
        ),
      );
  }
  return errors;
}

function describe(s: AngleMeasureSpec): string {
  if (s.task === "turns")
    return `A compass with north at the top. A robot faces ${HEADING_NAME[s.from]}. A curved arrow shows it turning ${s.direction}.`;
  return `A protractor with two scales: the outer scale reads from 0 at the right end, and the inner scale reads from 0 at the left end. An angle is drawn with its corner at the centre. One arm lies along the ${s.flip ? "left" : "right"} end of the baseline, and the other arm points up across the scales.`;
}

const INK = "#3f5aa8";
const rad = (deg: number) => (deg * Math.PI) / 180;
const r1 = (n: number) => Math.round(n * 100) / 100;
function protractorSvg(s: AngleMeasureSpec): string {
  const cx = 220,
    cy = 228,
    R = 170;
  const at = (theta: number, radius: number) => ({
    x: r1(cx + radius * Math.cos(rad(theta))),
    y: r1(cy - radius * Math.sin(rad(theta))),
  });
  let marks = "";
  for (let a = 0; a <= 180; a += 5) {
    const major = a % 10 === 0;
    const p = at(a, R),
      q = at(a, R - (a % 90 === 0 ? 22 : major ? 14 : 8));
    marks += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#3b5a4a" stroke-width="${major ? 1.6 : 1}"/>`;
    if (major) {
      const o = at(a, R + 17),
        i = at(a, R - 36);
      marks += `<text x="${o.x}" y="${o.y}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="#243b31">${a}</text><text x="${i.x}" y="${i.y}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#4a5c52">${180 - a}</text>`;
    }
  }
  const armAngle = s.flip ? 180 - s.degrees : s.degrees;
  const baseAngle = s.flip ? 180 : 0;
  const tip = (theta: number) => at(theta, R + 30);
  const arc = (() => {
    const from = at(baseAngle, 48),
      to = at(armAngle, 48);
    // The small arc always sweeps through the inside of the angle.
    const sweep = s.flip ? 1 : 0;
    return `<path d="M ${from.x} ${from.y} A 48 48 0 0 ${sweep} ${to.x} ${to.y}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  })();
  const arm = (theta: number) => {
    const t = tip(theta);
    return `<line x1="${cx}" y1="${cy}" x2="${t.x}" y2="${t.y}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  };
  return `<svg viewBox="0 0 440 262" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:440px;max-width:100%;height:auto"><path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} Z" fill="#e8ecf9" fill-opacity=".7" stroke="#3b5a4a" stroke-width="2"/>${marks}${arc}${arm(baseAngle)}${arm(armAngle)}<circle cx="${cx}" cy="${cy}" r="4.5" fill="${INK}"/></svg>`;
}
function compassSvg(s: AngleMeasureSpec): string {
  const cx = 150,
    cy = 150;
  const vec = (phi: number, radius: number) => ({
    x: r1(cx + radius * Math.sin(rad(phi))),
    y: r1(cy - radius * Math.cos(rad(phi))),
  });
  const phi0 = HEADINGS.indexOf(s.from) * 90;
  const sign = s.direction === "clockwise" ? 1 : -1;
  const phi1 = phi0 + sign * s.quarters * 90;
  const start = vec(phi0, 58),
    end = vec(phi1, 58);
  const large = s.quarters * 90 > 180 ? 1 : 0;
  const sweep = sign === 1 ? 1 : 0;
  // Arrowhead at the end of the turn, along the direction of travel.
  const tx = sign * Math.cos(rad(phi1)),
    ty = sign * Math.sin(rad(phi1));
  const head = [
    `${r1(end.x + tx * 4)},${r1(end.y + ty * 4)}`,
    `${r1(end.x - tx * 9 - ty * 7)},${r1(end.y - ty * 9 + tx * 7)}`,
    `${r1(end.x - tx * 9 + ty * 7)},${r1(end.y - ty * 9 - tx * 7)}`,
  ].join(" ");
  const labels = HEADINGS.map((h, i) => {
    const p = vec(i * 90, 128);
    return `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="#243b31">${h}</text>`;
  }).join("");
  const body = vec(phi0, 86);
  return `<svg viewBox="0 0 300 300" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:300px;max-width:100%;height:auto"><circle cx="${cx}" cy="${cy}" r="104" fill="#e8ecf9" fill-opacity=".7" stroke="#3b5a4a" stroke-width="2"/><line x1="${cx}" y1="${cy - 104}" x2="${cx}" y2="${cy + 104}" stroke="#3b5a4a" stroke-width="1" stroke-dasharray="4 4"/><line x1="${cx - 104}" y1="${cy}" x2="${cx + 104}" y2="${cy}" stroke="#3b5a4a" stroke-width="1" stroke-dasharray="4 4"/>${labels}<line x1="${cx}" y1="${cy}" x2="${body.x}" y2="${body.y}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="${body.x}" cy="${body.y}" r="8" fill="${INK}"/><path d="M ${start.x} ${start.y} A 58 58 0 ${large} ${sweep} ${end.x} ${end.y}" fill="none" stroke="#9a3b24" stroke-width="3.5" stroke-linecap="round"/><polygon points="${head}" fill="#9a3b24"/><circle cx="${cx}" cy="${cy}" r="4" fill="#243b31"/></svg>`;
}

/** Degrees may be typed with or without a unit: 70, 70°, 70 deg or 70 degrees. */
export function parseDegrees(value: unknown): Rational | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return parseWhole(
    String(value)
      .trim()
      .replace(/\s*(?:°|degrees?|deg)$/i, ""),
  );
}
const adapter = makeAdapter<AngleMeasureSpec>({
  id: "angle-measure",
  answerFor: angleMeasureAnswer,
  describe,
  parser: parseDegrees,
});
export const angleMeasureTopic: RuntimeTopic = {
  id: "angle-measure",
  label: "Angle measure",
  visualTitle: "Measure with a protractor",
  adapter,
  validateSpec: validateAngleMeasureSpec,
  validateSteps: validateAngleMeasureSteps,
  answer: (l, step) =>
    angleMeasureAnswer(l.specification as unknown as AngleMeasureSpec, step),
  workbench: (lesson, step) =>
    ["bench-read", "bench-draw"].includes(String(lesson.specification.task)) &&
    ["read", "supplement"].includes(step.goal ?? "") &&
    !validateAngleMeasureSpec(lesson.specification).length
      ? lazyWorkbench(() =>
          import("./protractor-workbench").then((m) =>
            m.protractorFactory(lesson, step),
          ),
        )
      : null,
  render: (l) => {
    const s = l.specification as unknown as AngleMeasureSpec;
    const svg = s.task === "turns" ? compassSvg(s) : protractorSvg(s);
    return `<div class="angle-measure-model" role="img" aria-label="${esc(describe(s))}">${svg}<p>${esc(describe(s))}</p></div>`;
  },
};
