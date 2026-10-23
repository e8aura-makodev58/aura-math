import type { Lesson, Step } from "../core/types";
import { lazyWorkbench } from "../workbench/lazy";
import type { RuntimeTopic } from "./capability";
import {
  checkKinds,
  checkMeanings,
  choiceFor,
  esc,
  hasOnlyKeys,
  isRecord,
  isInt,
  makeAdapter,
} from "./p4-kit";

export type ShapeId =
  | "rectangle"
  | "square"
  | "isosceles-triangle"
  | "rhombus"
  | "kite"
  | "parallelogram"
  | "trapezoid"
  | "right-triangle"
  | "house";
export type Pt = [number, number];
/** Vertices are in half-units, so every midpoint of a bounding box is a whole number. */
export const SHAPES: Record<ShapeId, { name: string; points: Pt[] }> = {
  rectangle: {
    name: "rectangle",
    points: [
      [0, 0],
      [12, 0],
      [12, 8],
      [0, 8],
    ],
  },
  square: {
    name: "square",
    points: [
      [0, 0],
      [8, 0],
      [8, 8],
      [0, 8],
    ],
  },
  "isosceles-triangle": {
    name: "isosceles triangle",
    points: [
      [0, 0],
      [12, 0],
      [6, 10],
    ],
  },
  rhombus: {
    name: "rhombus",
    points: [
      [6, 0],
      [12, 4],
      [6, 8],
      [0, 4],
    ],
  },
  kite: {
    name: "kite",
    points: [
      [6, 0],
      [10, 4],
      [6, 12],
      [2, 4],
    ],
  },
  parallelogram: {
    name: "parallelogram",
    points: [
      [0, 0],
      [10, 0],
      [14, 6],
      [4, 6],
    ],
  },
  trapezoid: {
    name: "trapezoid with equal sloping sides",
    points: [
      [2, 0],
      [10, 0],
      [12, 6],
      [0, 6],
    ],
  },
  "right-triangle": {
    name: "right-angled triangle",
    points: [
      [0, 0],
      [10, 0],
      [0, 6],
    ],
  },
  house: {
    name: "house shape",
    points: [
      [0, 0],
      [8, 0],
      [8, 6],
      [4, 10],
      [0, 6],
    ],
  },
};
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/**
 * Does reflecting every vertex across the line through `a2/2` with direction `d` give back the vertex
 * set? All arithmetic is exact integer arithmetic in doubled units, with no tolerance. The shapes
 * here are convex, so equal vertex sets mean the same polygon.
 */
export function reflectsOnto(points: Pt[], a2: Pt, d: Pt): boolean {
  const dd = d[0] * d[0] + d[1] * d[1];
  if (!dd) return false;
  return points.every(([x, y]) => {
    const v: Pt = [2 * x - a2[0], 2 * y - a2[1]];
    const pn = v[0] * d[0] + v[1] * d[1];
    const nx = 2 * pn * d[0] - v[0] * dd;
    const ny = 2 * pn * d[1] - v[1] * dd;
    const rx = a2[0] * dd + nx,
      ry = a2[1] * dd + ny; // reflected point times 2 * dd
    return points.some(([px, py]) => rx === 2 * px * dd && ry === 2 * py * dd);
  });
}
/** A line normalised to integer coefficients so equal lines compare equal. */
function lineKey(a2: Pt, d: Pt): string {
  let a = -d[1],
    b = d[0],
    c = a * a2[0] + b * a2[1];
  const g = gcd(gcd(a, b), c) || 1;
  a /= g;
  b /= g;
  c /= g;
  if (a < 0 || (a === 0 && b < 0)) [a, b, c] = [-a, -b, -c];
  return `${a},${b},${c}`;
}
/** Every line of symmetry of a convex polygon. A reflection sends vertex 0 to some vertex or fixes it. */
export function symmetryAxes(points: Pt[]): string[] {
  const n = points.length;
  const keys = new Set<string>();
  const bisector = (p: Pt, q: Pt): [Pt, Pt] => [
    [p[0] + q[0], p[1] + q[1]],
    [-(q[1] - p[1]), q[0] - p[0]],
  ];
  const candidates: [Pt, Pt][] = [];
  for (let j = 1; j < n; j++) candidates.push(bisector(points[0], points[j]));
  candidates.push(bisector(points[1], points[n - 1]));
  for (const [a2, d] of candidates)
    if (reflectsOnto(points, a2, d)) keys.add(lineKey(a2, d));
  return [...keys];
}
export const axisCount = (shape: ShapeId) =>
  symmetryAxes(SHAPES[shape].points).length;

export interface CandidateLine {
  id: "A" | "B" | "C" | "D";
  a: Pt;
  b: Pt;
  /** Plain description used in the text alternative. */
  words: string;
  symmetric: boolean;
}
/** Four lines to judge: up to two real lines of symmetry and the rest near misses. */
export function shapePoints(shape: ShapeId, rotation = 0): Pt[] {
  return SHAPES[shape].points.map((point) => {
    let [x, y] = point;
    for (let turn = 0; turn < rotation; turn++) [x, y] = [-y, x];
    return [x, y];
  });
}
export function candidateLines(shape: ShapeId, rotation = 0): CandidateLine[] {
  const pts = shapePoints(shape, rotation);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  const pad = 2;
  const pool: { a: Pt; b: Pt; words: string }[] = [
    {
      a: [mx, y0 - pad],
      b: [mx, y1 + pad],
      words: "straight down through the middle",
    },
    {
      a: [x0 - pad, my],
      b: [x1 + pad, my],
      words: "straight across through the middle",
    },
    {
      a: [x0, y0],
      b: [x1, y1],
      words: "from bottom-left to top-right corner",
    },
    {
      a: [x0, y1],
      b: [x1, y0],
      words: "from top-left to bottom-right corner",
    },
    {
      a: [mx - 2, y0 - pad],
      b: [mx - 2, y1 + pad],
      words: "straight down, left of the middle",
    },
    {
      a: [x0 - pad, my - 2],
      b: [x1 + pad, my - 2],
      words: "straight across, below the middle",
    },
  ].map((c) => ({ ...c, a: c.a as Pt, b: c.b as Pt }));
  const judged = pool.map((c) => ({
    ...c,
    symmetric: reflectsOnto(
      pts,
      [2 * c.a[0], 2 * c.a[1]],
      [c.b[0] - c.a[0], c.b[1] - c.a[1]],
    ),
  }));
  const chosen = [
    ...judged.filter((c) => c.symmetric).slice(0, shape === "square" ? 4 : 2),
    ...judged.filter((c) => !c.symmetric),
  ].slice(0, 4);
  const shift = SHAPE_IDS.indexOf(shape) % chosen.length;
  const rotated = [...chosen.slice(shift), ...chosen.slice(0, shift)];
  return rotated.map((c, i) => ({
    ...c,
    id: "ABCD"[i] as CandidateLine["id"],
  }));
}

export interface SymmetrySpec {
  task: "lines" | "complete" | "practice" | "place" | "shade";
  shape: ShapeId;
  cols: number;
  rows: number;
  mirror: "vertical" | "horizontal";
  /** Shaded squares as "row,column", all on the first side of the mirror line. */
  cells: string[];
  /** The marked square, "row,column", one of the shaded ones. */
  probe: string;
  /** Quarter-turn rotation for shape tasks. */
  rotation?: number;
}
const cellOf = (text: string): Pt | null => {
  const m = /^(\d+),(\d+)$/.exec(text);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const key = (r: number, c: number) => `${r},${c}`;
export function mirrorCell(s: SymmetrySpec, r: number, c: number): Pt {
  return s.mirror === "vertical" ? [r, s.cols - 1 - c] : [s.rows - 1 - r, c];
}
const onFirstSide = (s: SymmetrySpec, r: number, c: number) =>
  s.mirror === "vertical" ? c < s.cols / 2 : r < s.rows / 2;
export const shadedCount = (s: SymmetrySpec) => s.cells.length;

/** Three squares on the far side: the true mirror image and two plausible mistakes. */
export function matchOptions(
  s: SymmetrySpec,
): { id: string; cell: Pt; meaning: string }[] {
  const [r, c] = cellOf(s.probe)!;
  const [mr, mc] = mirrorCell(s, r, c);
  const inside = (a: number, b: number) =>
    a >= 0 && b >= 0 && a < s.rows && b < s.cols && !onFirstSide(s, a, b);
  const towards =
    s.mirror === "vertical"
      ? inside(mr, mc - 1)
        ? [mr, mc - 1]
        : [mr, mc + 1]
      : inside(mr - 1, mc)
        ? [mr - 1, mc]
        : [mr + 1, mc];
  const flipped: Pt =
    s.mirror === "vertical" ? [s.rows - 1 - r, mc] : [mr, s.cols - 1 - c];
  const other: Pt =
    key(flipped[0], flipped[1]) !== key(mr, mc)
      ? flipped
      : s.mirror === "vertical"
        ? inside(mr + 1, mc)
          ? [mr + 1, mc]
          : [mr - 1, mc]
        : inside(mr, mc + 1)
          ? [mr, mc + 1]
          : [mr, mc - 1];
  // The letters rotate with the question, so the matching square is not always "A".
  const shift = (r + c + s.cells.length) % 3;
  const letter = (i: number) => "ABC"[(i + shift) % 3];
  return [
    { id: letter(0), cell: [mr, mc] as Pt, meaning: "mirror" },
    { id: letter(1), cell: towards as Pt, meaning: "shifted" },
    { id: letter(2), cell: other, meaning: "flipped" },
  ].sort((x, y) => x.id.localeCompare(y.id));
}

const KEYS = [
  "task",
  "shape",
  "cols",
  "rows",
  "mirror",
  "cells",
  "probe",
  "rotation",
];
export function validateSymmetrySpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a symmetry specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown symmetry field");
  const s = input as unknown as SymmetrySpec;
  if (!["lines", "complete", "practice", "place", "shade"].includes(s.task))
    errors.push("Unsupported symmetry task");
  if (
    s.rotation !== undefined &&
    (!isInt(s.rotation, 0, 3) ||
      !["lines", "place", "practice"].includes(s.task))
  )
    errors.push("Only shape tasks accept quarter-turn rotation 0 to 3");
  if (!SHAPE_IDS.includes(s.shape)) errors.push("Choose a supported shape");
  if (![6, 8].includes(s.cols) || ![4, 6].includes(s.rows))
    errors.push("The grid is 6 or 8 columns by 4 or 6 rows");
  if (!["vertical", "horizontal"].includes(s.mirror))
    errors.push("Choose a vertical or horizontal mirror line");
  if (!Array.isArray(s.cells) || s.cells.some((c) => typeof c !== "string"))
    errors.push("List the shaded squares as row,column pairs");
  if (typeof s.probe !== "string") errors.push("Mark one shaded square");
  if (errors.length) return errors;
  if ((s.task === "lines" || s.task === "place") && axisCount(s.shape) < 1)
    errors.push("Choose a shape that has at least one line of symmetry");
  if (s.task === "complete" || s.task === "shade") {
    const seen = new Set<string>();
    for (const text of s.cells) {
      const cell = cellOf(text);
      if (!cell || cell[0] >= s.rows || cell[1] >= s.cols)
        errors.push(`Square ${JSON.stringify(text)} is not on the grid`);
      else if (!onFirstSide(s, cell[0], cell[1]))
        errors.push(
          `Square ${text} is not on the shaded side of the mirror line`,
        );
      else if (seen.has(text)) errors.push(`Square ${text} is listed twice`);
      seen.add(text);
    }
    const half = (s.cols * s.rows) / 2;
    if (!errors.length && (s.cells.length < 3 || s.cells.length > half - 2))
      errors.push(
        "Shade between 3 squares and all but 2 of the squares on one side",
      );
    if (!errors.length && !s.cells.includes(s.probe))
      errors.push("The marked square must be one of the shaded squares");
  }
  if ((s.task === "place" || s.task === "shade") && s.cols !== 6)
    errors.push("Hands-on grids use six columns");
  if (
    s.task === "place" &&
    candidateLines(s.shape, s.rotation).filter((c) => c.symmetric).length !== 1
  )
    errors.push("Choose a shape with one candidate mirror line");
  return errors;
}

export function symmetryAnswer(s: SymmetrySpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
    case "place":
      return choiceFor(
        step,
        `line:${candidateLines(s.shape, s.rotation).find((c) => c.symmetric)!.id}`,
      );
    case "shade": {
      const cells = new Set(
        s.cells.map((text) => {
          const [r, c] = cellOf(text)!;
          return mirrorCell(s, r, c).join(",");
        }),
      );
      return (step.choices ?? [])
        .filter((c) => cells.has((c.meaning ?? "").replace("cell:", "")))
        .map((c) => c.id);
    }
    case "transfer":
      return choiceFor(step, "mirror");
    case "axes": {
      const yes = new Set(
        candidateLines(s.shape, s.rotation)
          .filter((c) => c.symmetric)
          .map((c) => `line:${c.id}`),
      );
      return (step.choices ?? [])
        .filter((c) => yes.has(c.meaning ?? ""))
        .map((c) => c.id);
    }
    case "count":
      return String(axisCount(s.shape));
    case "match":
      return choiceFor(step, "mirror");
    case "to-shade":
      return String(shadedCount(s));
    case "total":
      return String(2 * shadedCount(s));
  }
  return "";
}

const GOALS: Record<SymmetrySpec["task"], string[]> = {
  place: ["place", "count", "reflection"],
  shade: ["shade", "transfer", "reflection"],
  lines: ["axes", "count", "reflection"],
  complete: ["match", "to-shade", "total", "reflection"],
  practice: ["count", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  place: "choice",
  shade: "multi",
  transfer: "choice",
  axes: "multi",
  count: "exact",
  match: "choice",
  "to-shade": "exact",
  total: "exact",
  reflection: "choice",
};
export function validateSymmetrySteps(lesson: Lesson): string[] {
  const errors = validateSymmetrySpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as SymmetrySpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported symmetry goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    const answer = symmetryAnswer(s, step);
    if (
      goal !== "reflection" &&
      (JSON.stringify(step.answer) !== JSON.stringify(answer) ||
        answer === "" ||
        (Array.isArray(answer) && !answer.length))
    )
      errors.push("Answer contradicts symmetry model");
    if (goal === "axes" || goal === "place")
      errors.push(
        ...checkMeanings(
          step,
          candidateLines(s.shape, s.rotation).map((c) => `line:${c.id}`),
          goal,
        ),
      );
    if (goal === "shade") {
      const cells: string[] = [];
      for (let r = 0; r < s.rows; r++)
        for (let c = 0; c < s.cols; c++)
          if (!onFirstSide(s, r, c)) cells.push(`cell:${r},${c}`);
      errors.push(...checkMeanings(step, cells, goal));
    }
    if (goal === "match" || goal === "transfer")
      errors.push(
        ...checkMeanings(step, ["mirror", "shifted", "flipped"], goal),
      );
  }
  return errors;
}

function describe(s: SymmetrySpec): string {
  if (s.task === "complete")
    return `A grid ${s.cols} squares wide and ${s.rows} high with a dashed ${s.mirror} mirror line down the middle. Some squares are shaded on one side of the line, and one of them is marked X. Squares A, B and C on the other side are labelled.`;
  const shape = SHAPES[s.shape].name;
  if (s.task === "practice") return `A ${shape} drawn on plain paper.`;
  return `A ${shape} with four dashed lines. ${candidateLines(
    s.shape,
    s.rotation,
  )
    .map((c) => `Line ${c.id} runs ${c.words}.`)
    .join(" ")}`;
}

const INK = "#8a3a68";
function shapeSvg(s: SymmetrySpec, withLines: boolean): string {
  const pts = shapePoints(s.shape, s.rotation);
  const k = 22;
  // y points up, as drawn on paper. The viewBox is fitted to everything drawn, labels included.
  const X = (x: number) => x * k,
    Y = (y: number) => -y * k;
  const poly = pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
  const xs = pts.map((p) => X(p[0])),
    ys = pts.map((p) => Y(p[1]));
  let lines = "";
  if (withLines)
    for (const c of candidateLines(s.shape, s.rotation)) {
      const [ax, ay, bx, by] = [X(c.a[0]), Y(c.a[1]), X(c.b[0]), Y(c.b[1])];
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len,
        uy = (by - ay) / len;
      const lx = bx + ux * 18,
        ly = by + uy * 18;
      xs.push(ax, bx, lx - 14, lx + 14);
      ys.push(ay, by, ly - 14, ly + 14);
      lines += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#3b5a4a" stroke-width="2" stroke-dasharray="7 5"/><circle cx="${lx}" cy="${ly}" r="12" fill="#fffdf8" stroke="#3b5a4a" stroke-width="1.5"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="#243b31">${c.id}</text>`;
    }
  const pad = 10;
  const minX = Math.floor(Math.min(...xs) - pad),
    minY = Math.floor(Math.min(...ys) - pad);
  const w = Math.ceil(Math.max(...xs) + pad) - minX,
    h = Math.ceil(Math.max(...ys) + pad) - minY;
  return `<svg viewBox="${minX} ${minY} ${w} ${h}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${w}px;max-width:100%;height:auto"><polygon points="${poly}" fill="#f6e4ee" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${lines}</svg>`;
}
function gridSvg(s: SymmetrySpec): string {
  const cell = 40,
    pad = 12;
  const w = s.cols * cell + 2 * pad,
    h = s.rows * cell + 2 * pad;
  const shaded = new Set(s.cells);
  const options = new Map(
    matchOptions(s).map((o) => [key(o.cell[0], o.cell[1]), o.id]),
  );
  let body = "";
  for (let r = 0; r < s.rows; r++)
    for (let c = 0; c < s.cols; c++) {
      const x = pad + c * cell,
        y = pad + r * cell;
      const on = shaded.has(key(r, c));
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${on ? "#d9a3c2" : "#fffdf8"}" stroke="#c9bfae" stroke-width="1"/>`;
      if (on && key(r, c) === s.probe)
        body += `<text x="${x + cell / 2}" y="${y + cell / 2}" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="700" fill="#5a1f44">X</text>`;
      const id = options.get(key(r, c));
      if (id)
        body += `<text x="${x + cell / 2}" y="${y + cell / 2}" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="700" fill="#243b31">${id}</text>`;
    }
  const mid =
    s.mirror === "vertical"
      ? `<line x1="${pad + (s.cols / 2) * cell}" y1="${pad - 6}" x2="${pad + (s.cols / 2) * cell}" y2="${pad + s.rows * cell + 6}"`
      : `<line x1="${pad - 6}" y1="${pad + (s.rows / 2) * cell}" x2="${pad + s.cols * cell + 6}" y2="${pad + (s.rows / 2) * cell}"`;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false" style="display:block;margin-inline:auto;width:${w}px;max-width:100%;height:auto">${body}${mid} stroke="${INK}" stroke-width="3" stroke-dasharray="8 5"/></svg>`;
}

const adapter = makeAdapter<SymmetrySpec>({
  id: "symmetry",
  answerFor: symmetryAnswer,
  describe,
});
export const symmetryTopic: RuntimeTopic = {
  id: "symmetry",
  label: "Symmetry",
  visualTitle: "Mirror, fold and match",
  adapter,
  validateSpec: validateSymmetrySpec,
  validateSteps: validateSymmetrySteps,
  answer: (l, step) =>
    symmetryAnswer(l.specification as unknown as SymmetrySpec, step),
  workbench: (lesson, step) =>
    ["place", "shade"].includes(step.goal ?? "") &&
    !validateSymmetrySpec(lesson.specification).length
      ? lazyWorkbench(() =>
          import("./symmetry-workbench").then((m) =>
            m.symmetryFactory(lesson, step),
          ),
        )
      : null,
  render: (l) => {
    const s = l.specification as unknown as SymmetrySpec;
    const svg =
      s.task === "complete" || s.task === "shade"
        ? gridSvg(s)
        : shapeSvg(s, s.task === "lines");
    return `<div class="symmetry-model" role="img" aria-label="${esc(describe(s))}">${svg}<p>${esc(describe(s))}</p></div>`;
  },
};
