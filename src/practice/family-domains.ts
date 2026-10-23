/**
 * Bounded, explicit same-skill domains for the P4 families that build their lessons through an
 * author capability's `rewrite`. Development-preview only: never import from the learner entry.
 *
 * Each profile names the catalogue starter it serves, a signature that recognises that starter's
 * skill (so an edited future starter with the same ID is refused), and an explicit enumeration of
 * specifications. `createVariantRun` keeps only the elements that pass the topic's own
 * `validateSpec`; the tests check that every kept element also builds into a valid package and
 * agrees with independent oracles. Answers always come from the topic model, never from here.
 * The 3D and 2D workbench lessons (fold, collide, fold-solid, bench and mirror benches) are not
 * served: their checks depend on interaction state that a fresh specification would not exercise.
 */
import type { AuthorTopic } from "../authoring/topic-capability";
import { angleMeasureAuthor } from "../authoring/angle-measure";
import { areaPerimeterAuthor } from "../authoring/area-perimeter";
import { barChartsAuthor } from "../authoring/bar-charts";
import { lineGraphsAuthor } from "../authoring/line-graphs";
import { netsAuthor } from "../authoring/nets";
import { pieChartsAuthor } from "../authoring/pie-charts";
import { symmetryAuthor } from "../authoring/symmetry";
import { wholeNumbersAuthor } from "../authoring/whole-numbers";
import type { RuntimeTopic } from "../topics/capability";
import { angleMeasureTopic } from "../topics/angle-measure";
import { areaPerimeterTopic } from "../topics/area-perimeter";
import { barChartsTopic } from "../topics/bar-charts";
import { lineGraphsTopic } from "../topics/line-graphs";
import {
  netsTopic,
  parseNet,
  squareCells,
  whyReason,
  type ParsedNet,
} from "../topics/nets";
import { pieChartsTopic } from "../topics/pie-charts";
import {
  axisCount,
  candidateLines,
  symmetryTopic,
  SHAPE_IDS,
} from "../topics/symmetry";
import { wholeNumbersTopic } from "../topics/whole-numbers";
import type { StoryProfileId } from "../content/story-frames";

type Spec = Record<string, unknown>;
export interface FamilyProfile {
  topic: RuntimeTopic;
  author: AuthorTopic;
  /** Recognises the starter's skill; anything else is refused. */
  signature(spec: Spec): boolean;
  /** Explicit bounded enumeration (before the topic's validateSpec guard). */
  domain(spec: Spec): Spec[];
  /** Fields that make two examples different for the learner. */
  parameters(spec: Spec): unknown;
  /** Single-choice goals whose option order is meaningful (A to D, ascending numbers). */
  ordered?: readonly string[];
  /** Fresh contexts from the draft story-frame bank. */
  story?: StoryProfileId;
}

const range = (from: number, to: number, step = 1) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};
/** Five rotations of a list and five of its reverse: same values, different bars or points. */
function arrangements(values: number[]): number[][] {
  const out = new Map<string, number[]>();
  for (const list of [values, [...values].reverse()])
    for (let r = 0; r < list.length; r++) {
      const next = [...list.slice(r), ...list.slice(0, r)];
      out.set(next.join(","), next);
    }
  return [...out.values()];
}
function permutations(values: number[]): number[][] {
  if (values.length <= 1) return [values];
  const out = new Map<string, number[]>();
  values.forEach((v, i) => {
    for (const rest of permutations([
      ...values.slice(0, i),
      ...values.slice(i + 1),
    ]))
      out.set([v, ...rest].join(","), [v, ...rest]);
  });
  return [...out.values()];
}
const pairs = (n: number) =>
  range(0, n - 1).flatMap((a) =>
    range(0, n - 1)
      .filter((b) => b !== a)
      .map((b) => [a, b] as const),
  );
const pick = (s: Spec, keys: string[]) => keys.map((k) => s[k]);

/* ---------------------------------------------------------------------------------------- */
/* Whole numbers                                                                            */
/* ---------------------------------------------------------------------------------------- */
const PLACES = ["ten-thousands", "thousands", "hundreds", "tens", "ones"];
function placeValueDomain(s: Spec): Spec[] {
  const out: Spec[] = [];
  for (const d1 of range(1, 9))
    for (const d2 of range(0, 9))
      for (const d3 of range(0, 9)) {
        const d4 = (d2 + d3 + 3) % 10,
          d5 = (d1 + d3 + 6) % 10;
        const digits = [d1, d2, d3, d4, d5];
        // Swap the tens and ones, or the hundreds and tens, so the two numbers differ late.
        const swapAt = (d1 + d2) % 2 ? 2 : 3;
        if (digits[swapAt] === digits[swapAt + 1]) continue;
        const other = [...digits];
        [other[swapAt], other[swapAt + 1]] = [other[swapAt + 1], other[swapAt]];
        for (const place of PLACES)
          out.push({
            ...s,
            n: Number(digits.join("")),
            m: Number(other.join("")),
            place,
          });
      }
  return out;
}
function roundingDomain(s: Spec): Spec[] {
  const out: Spec[] = [];
  for (const a of range(1, 9))
    for (const b of range(0, 9))
      for (const c of range(0, 9))
        for (const roundTo of [10, 100, 1000])
          out.push({
            ...s,
            n: a * 1000 + b * 100 + c * 10 + ((a + 2 * b + 3 * c) % 10),
            roundTo,
          });
  return out;
}
function estimateDomain(s: Spec): Spec[] {
  const first = range(1, 5).flatMap((a) =>
    range(0, 9).map(
      (b) => a * 1000 + b * 100 + ((3 * a + b) % 10) * 10 + ((a + b + 5) % 10),
    ),
  );
  const second = range(1, 4).flatMap((a) =>
    range(0, 9).map(
      (b) => a * 1000 + b * 100 + ((b + 7) % 10) * 10 + ((2 * a + b + 1) % 10),
    ),
  );
  const out: Spec[] = [];
  for (const n of first)
    for (const m of second)
      for (const roundTo of [10, 100, 1000]) out.push({ ...s, n, m, roundTo });
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* Bar charts and line graphs: fixed labels, fresh values and questions                     */
/* ---------------------------------------------------------------------------------------- */
function barReadDomain(s: Spec): Spec[] {
  const sets: [number, number[]][] = [
    [10, [20, 35, 15, 40, 25]],
    [10, [30, 15, 45, 25, 50]],
    [10, [45, 20, 35, 10, 30]],
    [10, [25, 40, 55, 15, 35]],
    [5, [10, 25, 15, 35, 20]],
    [5, [30, 15, 40, 25, 10]],
    [20, [40, 70, 30, 90, 50]],
    [20, [60, 30, 80, 50, 110]],
  ];
  return sets.flatMap(([step, values]) =>
    arrangements(values).flatMap((v) =>
      pairs(v.length).map(([a, b]) => ({ ...s, step, values: v, a, b })),
    ),
  );
}
function barDoubleDomain(s: Spec): Spec[] {
  const sets: [number[], number[]][] = [
    [
      [20, 35, 15, 35],
      [25, 10, 35, 30],
    ],
    [
      [30, 15, 40, 20],
      [15, 35, 25, 30],
    ],
    [
      [45, 20, 30, 25],
      [25, 30, 10, 40],
    ],
    [
      [10, 40, 25, 35],
      [30, 20, 45, 15],
    ],
  ];
  const out: Spec[] = [];
  for (const [first, second] of sets)
    for (const swap of [false, true])
      for (const reverse of [false, true])
        for (let r = 0; r < 4; r++) {
          const turn = (v: number[]) => {
            const list = reverse ? [...v].reverse() : v;
            return [...list.slice(r), ...list.slice(0, r)];
          };
          const [v1, v2] = swap ? [second, first] : [first, second];
          for (const a of range(0, 3))
            out.push({ ...s, values: turn(v1), values2: turn(v2), a, b: 0 });
        }
  return out;
}
function barPracticeDomain(s: Spec): Spec[] {
  const sets: [number, number[]][] = [
    [10, [30, 55, 40, 65, 20]],
    [10, [45, 25, 60, 35, 50]],
    [10, [20, 70, 45, 30, 55]],
    [10, [35, 50, 25, 65, 40]],
    [5, [15, 30, 20, 45, 35]],
    [20, [60, 120, 80, 140, 40]],
  ];
  return sets.flatMap(([step, values]) =>
    arrangements(values).map((v) => ({ ...s, step, values: v })),
  );
}
function lineDomain(s: Spec, sets: number[][], withPairs: boolean): Spec[] {
  return sets.flatMap((values) =>
    arrangements(values).flatMap((v) =>
      withPairs
        ? pairs(v.length).map(([a, b]) => ({ ...s, values: v, a, b }))
        : [{ ...s, values: v }],
    ),
  );
}
function lineThresholdDomain(s: Spec): Spec[] {
  const sets = [
    [25, 40, 35, 55, 45, 30],
    [30, 50, 20, 45, 35, 15],
    [45, 25, 60, 30, 40, 20],
  ];
  return sets.flatMap((values) =>
    arrangements(values).flatMap((v) =>
      range(20, 50, 5).map((target) => ({ ...s, values: v, target })),
    ),
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Pie charts: fixed labels, fresh slices, counts and questions                             */
/* ---------------------------------------------------------------------------------------- */
function pieDomain(
  s: Spec,
  sets: [number, number[]][],
  units: number[],
  questions: (n: number) => (readonly [number, number])[],
): Spec[] {
  const out: Spec[] = [];
  for (const [slices, parts] of sets)
    for (const p of permutations(parts))
      for (const unit of units)
        for (const [a, b] of questions(p.length))
          out.push({ ...s, slices, parts: p, unit, a, b });
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* Angles                                                                                   */
/* ---------------------------------------------------------------------------------------- */
const angleDomain = (s: Spec, from: number, to: number) =>
  range(from, to, 5).flatMap((degrees) =>
    [false, true].map((flip) => ({ ...s, degrees, flip })),
  );
const turnsDomain = (s: Spec) =>
  ["N", "E", "S", "W"].flatMap((from) =>
    ["clockwise", "anticlockwise"].flatMap((direction) =>
      [1, 2, 3].map((quarters) => ({ ...s, from, direction, quarters })),
    ),
  );

/* ---------------------------------------------------------------------------------------- */
/* Symmetry                                                                                 */
/* ---------------------------------------------------------------------------------------- */
/** Shaded figures for a vertical mirror, as [row, column] with column 0 to 2 and row 0 to 3. */
const FIGURES: [number, number][][] = [
  [
    [0, 2],
    [1, 1],
    [1, 2],
    [2, 0],
    [3, 1],
  ],
  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 2],
    [3, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 0],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 1],
    [2, 2],
    [3, 0],
    [3, 1],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
    [3, 1],
  ],
];
function symmetricFigureDomain(s: Spec): Spec[] {
  const out: Spec[] = [];
  const placements: {
    mirror: string;
    cols: number;
    rows: number;
    shift: number;
  }[] = [
    { mirror: "vertical", cols: 6, rows: 4, shift: 0 },
    { mirror: "vertical", cols: 6, rows: 6, shift: 0 },
    { mirror: "vertical", cols: 8, rows: 4, shift: 0 },
    { mirror: "vertical", cols: 8, rows: 4, shift: 1 },
    { mirror: "vertical", cols: 8, rows: 6, shift: 1 },
    { mirror: "horizontal", cols: 6, rows: 6, shift: 0 },
    { mirror: "horizontal", cols: 8, rows: 6, shift: 0 },
    { mirror: "horizontal", cols: 8, rows: 6, shift: 2 },
  ];
  for (const figure of FIGURES)
    for (const { mirror, cols, rows, shift } of placements) {
      // A horizontal mirror uses the figure turned on its side: row and column swap.
      const cells = figure.map(([r, c]) =>
        mirror === "vertical" ? `${r},${c + shift}` : `${c},${r + shift}`,
      );
      for (const probe of cells)
        out.push({ ...s, mirror, cols, rows, cells, probe });
    }
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* Nets                                                                                     */
/* ---------------------------------------------------------------------------------------- */
/** The eleven nets of a cube, one orientation each. The topic's own folding check confirms them. */
export const CUBE_NETS = [
  "#.../####/#...",
  "#.../####/.#..",
  "#.../####/..#.",
  "#.../####/...#",
  ".#../####/.#..",
  ".#../####/..#.",
  "##../.###/.#..",
  "##../.###/..#.",
  "##../.###/...#",
  "##../.##./..##",
  "###../..###",
];
const rows = (net: string) => net.split("/").map((r) => [...r]);
const join = (grid: string[][]) => grid.map((r) => r.join("")).join("/");
function turn(net: string): string {
  const g = rows(net);
  const h = g.length,
    w = g[0].length;
  return join(
    Array.from({ length: w }, (_, r) =>
      Array.from({ length: h }, (_, c) => g[h - 1 - c][r]),
    ),
  );
}
const mirror = (net: string) => join(rows(net).map((r) => [...r].reverse()));
/** The eight turns and reflections of a text net, without repeats. */
export function orientations(net: string): string[] {
  const out = new Set<string>();
  let current = net;
  for (let i = 0; i < 4; i++) {
    out.add(current);
    out.add(mirror(current));
    current = turn(current);
  }
  return [...out];
}
function letterNet(net: string, shift: number): string {
  let k = 0;
  return net.replace(/#/g, () => "ABCDEF"[(k++ + shift) % 6]);
}
function cubeCheckDomain(s: Spec): Spec[] {
  const invalid = (s.nets as string[]).filter((_, i) => i !== 1);
  const out: Spec[] = [];
  for (const valid of CUBE_NETS)
    for (const order of permutations([0, 1, 2, 3])) {
      const pool = [valid, ...invalid];
      const nets = order.map((i) => pool[i]);
      for (const asked of range(0, 3))
        if (
          nets[asked] !== valid &&
          // The builder's "corner" reason is much longer than its distractors, so its length
          // would give the answer away (choice balance). Ask only about overlapping nets here.
          whyReason(squareCells(parseNet(nets[asked]) as ParsedNet)) ===
            "overlap"
        )
          out.push({ ...s, nets, asked });
    }
  return out;
}
function oppositeDomain(s: Spec): Spec[] {
  return CUBE_NETS.flatMap((net) =>
    range(0, 5).flatMap((shift) =>
      [..."ABCDEF"].map((face) => ({
        ...s,
        nets: [letterNet(net, shift)],
        face,
      })),
    ),
  );
}
function completeDomain(s: Spec): Spec[] {
  const base = (s.nets as string[])[0];
  return orientations(base).flatMap((net) =>
    permutations([0, 1, 2, 3]).map((order) => ({
      ...s,
      nets: [net.replace(/[abcd]/g, (ch) => "abcd"[order["abcd".indexOf(ch)]])],
    })),
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Area and perimeter                                                                       */
/* ---------------------------------------------------------------------------------------- */
function compositeDomain(s: Spec, measures: string[]): Spec[] {
  const out: Spec[] = [];
  for (const width of range(8, 16))
    for (const height of range(6, 12))
      for (const cutWidth of range(2, Math.floor(width / 2)))
        for (const cutHeight of range(2, Math.floor(height / 2)))
          for (const corner of [
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ])
            for (const requestedMeasure of measures)
              out.push({
                ...s,
                width,
                height,
                cutWidth,
                cutHeight,
                corner,
                requestedMeasure,
              });
  return out;
}
function missingSideDomain(s: Spec): Spec[] {
  const out: Spec[] = [];
  for (const width of range(3, 15))
    for (const height of range(2, 12))
      if (width !== height)
        for (const unknownSide of ["width", "height"])
          for (const knownMeasure of ["area", "perimeter"])
            out.push({ ...s, width, height, unknownSide, knownMeasure });
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* Profiles                                                                                 */
/* ---------------------------------------------------------------------------------------- */
const task = (name: string) => (s: Spec) => s.task === name;
const same = (s: Spec, fixed: Spec) =>
  Object.entries(fixed).every(
    ([k, v]) => JSON.stringify(s[k]) === JSON.stringify(v),
  );
const whole = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: wholeNumbersTopic,
  author: wholeNumbersAuthor,
  ...p,
});
const bars = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: barChartsTopic,
  author: barChartsAuthor,
  ...p,
});
const lines = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: lineGraphsTopic,
  author: lineGraphsAuthor,
  ...p,
});
const pies = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: pieChartsTopic,
  author: pieChartsAuthor,
  ordered: ["sector-fraction"],
  ...p,
});
const angles = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: angleMeasureTopic,
  author: angleMeasureAuthor,
  ...p,
});
const mirrors = (
  p: Omit<FamilyProfile, "topic" | "author">,
): FamilyProfile => ({ topic: symmetryTopic, author: symmetryAuthor, ...p });
const nets = (p: Omit<FamilyProfile, "topic" | "author">): FamilyProfile => ({
  topic: netsTopic,
  author: netsAuthor,
  ordered: ["valid", "opposite"],
  ...p,
});
const measures = (
  p: Omit<FamilyProfile, "topic" | "author">,
): FamilyProfile => ({
  topic: areaPerimeterTopic,
  author: areaPerimeterAuthor,
  ...p,
});
const BAR_LABELS = (s: Spec) =>
  pick(s, ["step", "values", "values2", "a", "b"]);
const LINE_KEYS = (s: Spec) => pick(s, ["values", "a", "b", "target"]);
const PIE_KEYS = (s: Spec) => pick(s, ["slices", "parts", "unit", "a", "b"]);
const SHAPE_KEYS = (s: Spec) =>
  pick(s, [
    "width",
    "height",
    "cutWidth",
    "cutHeight",
    "corner",
    "unknownSide",
    "knownMeasure",
    "requestedMeasure",
  ]);

export const FAMILY_PROFILES: Record<string, FamilyProfile> = {
  "p4-place-value-100k": whole({
    signature: task("place-value"),
    domain: placeValueDomain,
    parameters: (s) => pick(s, ["n", "m", "place"]),
  }),
  "p4-rounding": whole({
    signature: task("rounding"),
    domain: roundingDomain,
    parameters: (s) => pick(s, ["n", "roundTo"]),
  }),
  "p4-factors": whole({
    signature: task("factors"),
    domain: (s) => range(12, 60).map((n) => ({ ...s, n })),
    parameters: (s) => pick(s, ["n"]),
    ordered: ["not-factor"],
  }),
  "p4-estimate-by-rounding": whole({
    signature: task("practice"),
    domain: estimateDomain,
    parameters: (s) => pick(s, ["n", "m", "roundTo"]),
    story: "whole-estimate-add",
  }),
  "p4-read-bar-chart": bars({
    signature: (s) =>
      same(s, {
        task: "read",
        labels: ["Cats", "Dogs", "Fish", "Birds", "Mice"],
        quantity: "Pets chosen by pupils",
      }),
    domain: barReadDomain,
    parameters: BAR_LABELS,
  }),
  "p4-double-bar-chart": bars({
    signature: (s) =>
      same(s, {
        task: "double",
        labels: ["P4A", "P4B", "P4C", "P4D"],
        series: ["Boys", "Girls"],
        step: 10,
      }),
    domain: barDoubleDomain,
    parameters: BAR_LABELS,
  }),
  "p4-bar-chart-practice": bars({
    signature: (s) =>
      same(s, {
        task: "practice",
        labels: ["Art", "Chess", "Swim", "Music", "Drama"],
      }),
    domain: barPracticeDomain,
    parameters: BAR_LABELS,
  }),
  "p4-read-line-graph": lines({
    signature: (s) => same(s, { task: "read", step: 10 }),
    domain: (s) =>
      lineDomain(
        s,
        [
          [20, 35, 25, 45, 30],
          [30, 15, 40, 25, 50],
          [45, 30, 20, 35, 15],
          [10, 25, 40, 30, 45],
        ],
        true,
      ),
    parameters: LINE_KEYS,
  }),
  "p4-line-graph-change": lines({
    signature: (s) => same(s, { task: "change", step: 10 }),
    domain: (s) =>
      lineDomain(
        s,
        [
          [15, 30, 20, 50, 35],
          [20, 45, 30, 35, 25],
          [40, 25, 30, 55, 45],
          [10, 20, 45, 35, 40],
        ],
        true,
      ),
    parameters: LINE_KEYS,
  }),
  "p4-line-graph-target": lines({
    signature: (s) => same(s, { task: "threshold", step: 10 }),
    domain: lineThresholdDomain,
    parameters: LINE_KEYS,
  }),
  "p4-line-graph-practice": lines({
    signature: (s) => same(s, { task: "practice", step: 10 }),
    domain: (s) =>
      lineDomain(
        s,
        [
          [35, 60, 45, 25, 50],
          [20, 55, 40, 30, 65],
          [50, 25, 35, 70, 45],
          [15, 40, 60, 30, 45],
        ],
        false,
      ),
    parameters: LINE_KEYS,
  }),
  "p4-read-pie-chart": pies({
    signature: (s) => same(s, { task: "read", unit: 0 }),
    domain: (s) =>
      pieDomain(
        s,
        [
          [8, [3, 2, 1, 2]],
          [10, [4, 3, 2, 1]],
          [12, [5, 3, 2, 2]],
          [6, [2, 1, 2, 1]],
        ],
        [0],
        pairs,
      ),
    parameters: PIE_KEYS,
  }),
  "p4-read-pie-sectors": pies({
    signature: (s) => same(s, { task: "sectors", slices: 8 }),
    domain: (s) =>
      pieDomain(
        s,
        [
          [8, [4, 2, 1, 1]],
          [8, [2, 2, 2, 2]],
        ],
        [0],
        pairs,
      ),
    parameters: PIE_KEYS,
  }),
  "p4-pie-chart-count": pies({
    signature: (s) => same(s, { task: "count", slices: 10 }),
    domain: (s) => pieDomain(s, [[10, [4, 3, 2, 1]]], range(2, 12), pairs),
    parameters: PIE_KEYS,
  }),
  "p4-pie-chart-total": pies({
    signature: (s) => same(s, { task: "total", slices: 6 }),
    domain: (s) => pieDomain(s, [[6, [3, 2, 1]]], range(2, 20), pairs),
    parameters: PIE_KEYS,
  }),
  "p4-pie-chart-practice": pies({
    signature: (s) => same(s, { task: "practice", slices: 12 }),
    domain: (s) =>
      pieDomain(s, [[12, [5, 3, 2, 2]]], range(2, 20), (n) =>
        range(0, n - 1).map((a) => [a, s.b as number] as const),
      ),
    parameters: PIE_KEYS,
  }),
  "p4-read-protractor": angles({
    signature: task("read"),
    domain: (s) => angleDomain(s, 15, 165),
    parameters: (s) => pick(s, ["degrees", "flip"]),
  }),
  "p4-estimate-then-measure": angles({
    signature: task("estimate"),
    domain: (s) => angleDomain(s, 20, 160),
    parameters: (s) => pick(s, ["degrees", "flip"]),
  }),
  "p4-angle-practice": angles({
    signature: task("practice"),
    domain: (s) => angleDomain(s, 15, 165),
    parameters: (s) => pick(s, ["degrees", "flip"]),
  }),
  "p4-turns": angles({
    signature: task("turns"),
    domain: turnsDomain,
    parameters: (s) => pick(s, ["from", "direction", "quarters"]),
  }),
  "p4-lines-of-symmetry": mirrors({
    signature: task("lines"),
    // Only shapes whose dashed candidates include every line of symmetry, so the "test the
    // lines" step and the "how many lines" step agree (a square shows only some of its four).
    domain: (s) =>
      SHAPE_IDS.filter(
        (shape) =>
          axisCount(shape) > 0 &&
          candidateLines(shape).filter((c) => c.symmetric).length ===
            axisCount(shape),
      ).map((shape) => ({ ...s, shape })),
    parameters: (s) => pick(s, ["shape"]),
  }),
  "p4-symmetry-practice": mirrors({
    signature: task("practice"),
    domain: (s) => SHAPE_IDS.map((shape) => ({ ...s, shape })),
    parameters: (s) => pick(s, ["shape"]),
  }),
  "p4-symmetric-figure": mirrors({
    signature: task("complete"),
    domain: symmetricFigureDomain,
    parameters: (s) => pick(s, ["mirror", "cols", "rows", "cells", "probe"]),
  }),
  "p4-cube-net-check": nets({
    signature: task("check"),
    domain: cubeCheckDomain,
    parameters: (s) => pick(s, ["nets", "asked"]),
  }),
  "p4-cube-opposite-faces": nets({
    signature: task("opposite"),
    domain: oppositeDomain,
    parameters: (s) => pick(s, ["nets", "face"]),
  }),
  "p4-complete-the-net": nets({
    signature: task("complete"),
    domain: completeDomain,
    parameters: (s) => pick(s, ["nets"]),
  }),
  "p4-solid-from-net": nets({
    signature: task("solid"),
    domain: (s) =>
      ["cube", "cuboid", "triangular-prism", "square-pyramid"].map((solid) => ({
        ...s,
        solid,
      })),
    parameters: (s) => pick(s, ["solid"]),
  }),
  "p4-rectangle-missing-side": measures({
    signature: task("missing-side"),
    domain: missingSideDomain,
    parameters: SHAPE_KEYS,
  }),
  "p4-composite-area": measures({
    signature: task("composite-area"),
    domain: (s) => compositeDomain(s, [s.requestedMeasure as string]),
    parameters: SHAPE_KEYS,
  }),
  "p4-composite-perimeter": measures({
    signature: task("composite-perimeter"),
    domain: (s) => compositeDomain(s, [s.requestedMeasure as string]),
    parameters: SHAPE_KEYS,
  }),
  "p4-measurement-practice": measures({
    signature: task("practice"),
    domain: (s) => compositeDomain(s, ["area", "perimeter"]),
    parameters: SHAPE_KEYS,
  }),
};
