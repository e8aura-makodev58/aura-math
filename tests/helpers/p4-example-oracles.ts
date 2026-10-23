/** Independent arithmetic and rolling-cube oracles, reused from Phase A's test implementation. */
import { expect } from "vitest";
import type { Lesson, Step } from "../../src/core/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test oracles read family-specific input
export type S = Record<string, any>;
export const goal = (l: Lesson, g: string) =>
  l.steps.find((s) => s.goal === g)!;
export const chosen = (step: Step) =>
  step.choices!.find((c) => c.id === step.answer)!;
export const chosenMany = (step: Step) =>
  step.choices!.filter((c) => (step.answer as string[]).includes(c.id));
const num = (l: Lesson, g: string) => Number(goal(l, g).answer);
const plain = (text: string) => text.replace(/\u00a0/g, " ");
const PLACE_INDEX: Record<string, number> = {
  "ten-thousands": 0,
  thousands: 1,
  hundreds: 2,
  tens: 3,
  ones: 4,
};
function roundHalfUp(n: number, step: number) {
  const rest = n % step;
  return rest * 2 >= step ? n - rest + step : n - rest;
}
function countFactors(n: number) {
  let count = 0;
  for (let k = 1; k * k <= n; k++)
    if (n % k === 0) count += k * k === n ? 1 : 2;
  return count;
}
/** Rolls a cube over the squares of a net; returns the cube face stamped on each square. */
export function rollCube(cells: [number, number][]): Map<string, number> {
  const have = new Set(cells.map(([x, y]) => `${x},${y}`));
  const stamp = new Map<string, number>();
  // [bottom, top, north, south, east, west] hold cube face ids 0..5; opposite faces are f ^ 1.
  const visit = (x: number, y: number, o: number[]) => {
    const key = `${x},${y}`;
    if (!have.has(key) || stamp.has(key)) return;
    stamp.set(key, o[0]);
    const [b, t, n, s, e, w] = o;
    visit(x + 1, y, [e, w, n, s, t, b]);
    visit(x - 1, y, [w, e, n, s, b, t]);
    visit(x, y + 1, [s, n, b, t, e, w]);
    visit(x, y - 1, [n, s, t, b, e, w]);
  };
  visit(cells[0][0], cells[0][1], [0, 1, 2, 3, 4, 5]);
  return stamp;
}
export function cellsOf(net: string, match: (ch: string) => boolean) {
  const out: [number, number][] = [];
  net
    .split("/")
    .forEach((row, y) =>
      [...row].forEach((ch, x) => match(ch) && out.push([x, y])),
    );
  return out;
}
const foldsToCube = (cells: [number, number][]) => {
  if (cells.length !== 6) return false;
  const faces = rollCube(cells);
  return faces.size === 6 && new Set(faces.values()).size === 6;
};
const AXES: Record<string, number> = {
  rectangle: 2,
  square: 4,
  "isosceles-triangle": 1,
  rhombus: 2,
  kite: 1,
  parallelogram: 0,
  trapezoid: 1,
  "right-triangle": 0,
  house: 1,
};
const SOLID_FACTS: Record<string, [number, number, number]> = {
  cube: [6, 12, 8],
  cuboid: [6, 12, 8],
  "triangular-prism": [5, 9, 6],
  "square-pyramid": [5, 8, 5],
};
export const ORACLES: Record<string, (s: S, l: Lesson) => void> = {
  "p4-place-value-100k": (s, l) => {
    const digits = String(s.n);
    const i = PLACE_INDEX[s.place];
    expect(num(l, "digit-value")).toBe(Number(digits[i]) * 10 ** (4 - i));
    expect(chosen(goal(l, "place")).meaning).toBe(s.place);
    expect(chosen(goal(l, "compare")).meaning).toBe(
      String(s.n) > String(s.m) ? "left" : "right",
    );
  },
  "p4-rounding": (s, l) => {
    expect(num(l, "rounded")).toBe(roundHalfUp(s.n, s.roundTo));
    const twice = (s.n % s.roundTo) * 2;
    expect(chosen(goal(l, "nearer")).meaning).toBe(
      twice === s.roundTo ? "halfway" : twice < s.roundTo ? "lower" : "upper",
    );
  },
  "p4-factors": (s, l) => {
    expect(num(l, "count")).toBe(countFactors(s.n));
    const odd = chosen(goal(l, "not-factor"));
    expect(s.n % Number(odd.label)).not.toBe(0);
    for (const c of goal(l, "not-factor").choices!)
      if (c !== odd) expect(s.n % Number(c.label)).toBe(0);
    const [f, g] = chosen(goal(l, "pair")).label.split(" and ").map(Number);
    expect(f * g).toBe(s.n);
  },
  "p4-estimate-by-rounding": (s, l) => {
    expect(num(l, "estimate")).toBe(
      roundHalfUp(s.n, s.roundTo) + roundHalfUp(s.m, s.roundTo),
    );
    // The draft story frame carries exactly the three numbers and the item, and nothing else.
    expect(l.story).toBe(l.steps[0].prompt);
    let rest = plain(l.story);
    for (const n of [s.n, s.m, s.roundTo]) {
      const shown = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      expect(rest).toContain(shown);
      rest = rest.replace(shown, "");
    }
    expect(rest).not.toMatch(/\d/);
    expect(l.story).toContain(s.unit);
  },
  "p4-read-bar-chart": (s, l) => {
    expect(num(l, "scale")).toBe(s.step);
    expect(num(l, "read")).toBe(s.values[s.a]);
    expect(num(l, "total")).toBe(s.values[s.a] + s.values[s.b]);
  },
  "p4-double-bar-chart": (s, l) => {
    expect(num(l, "read-pair")).toBe(s.values2[s.a]);
    expect(num(l, "difference")).toBe(Math.abs(s.values[s.a] - s.values2[s.a]));
    let best = 0;
    s.values.forEach((v: number, i: number) => {
      if (
        Math.abs(v - s.values2[i]) > Math.abs(s.values[best] - s.values2[best])
      )
        best = i;
    });
    expect(chosen(goal(l, "gap")).label).toBe(s.labels[best]);
  },
  "p4-bar-chart-practice": (s, l) => {
    const [x, y] = [...s.values].sort((a: number, b: number) => b - a);
    expect(num(l, "top-two-total")).toBe(x + y);
  },
  "p4-read-line-graph": (s, l) => {
    expect(num(l, "scale")).toBe(10);
    expect(num(l, "read")).toBe(s.values[s.a]);
    expect(chosen(goal(l, "compare")).meaning).toBe(
      s.values[s.a] > s.values[s.b] ? "left" : "right",
    );
  },
  "p4-line-graph-change": (s, l) => {
    expect(num(l, "read")).toBe(s.values[s.a]);
    expect(num(l, "difference")).toBe(Math.abs(s.values[s.b] - s.values[s.a]));
    expect(chosen(goal(l, "biggest-rise")).meaning).toBe("biggest");
  },
  "p4-line-graph-target": (s, l) => {
    const days = s.labels.filter(
      (_: string, i: number) => s.values[i] > s.target,
    );
    expect(chosenMany(goal(l, "above")).map((c) => c.label)).toEqual(days);
    let sum = 0;
    for (const v of s.values) if (v > s.target) sum += v;
    expect(num(l, "total")).toBe(sum);
  },
  "p4-line-graph-practice": (s, l) => {
    expect(num(l, "spread")).toBe(
      s.values.reduce((a: number, b: number) => (a > b ? a : b)) -
        s.values.reduce((a: number, b: number) => (a < b ? a : b)),
    );
  },
  "p4-read-pie-chart": (s, l) => {
    let slices = 0;
    for (const p of s.parts) slices += p;
    expect(num(l, "slices")).toBe(slices);
    expect(chosen(goal(l, "larger")).meaning).toBe(
      s.parts[s.a] > s.parts[s.b] ? "left" : "right",
    );
  },
  "p4-read-pie-sectors": (s, l) => {
    expect(num(l, "parts")).toBe(s.parts[s.b]);
    expect(chosen(goal(l, "sector-fraction")).meaning).toBe(
      { 4: "half", 2: "quarter", 1: "eighth" }[s.parts[s.a] as 1 | 2 | 4],
    );
  },
  "p4-pie-chart-count": (s, l) => {
    expect(num(l, "one-slice")).toBe(s.unit);
    expect(num(l, "category")).toBe(s.parts[s.a] * s.unit);
    expect(num(l, "more")).toBe(s.parts[s.a] * s.unit - s.parts[s.b] * s.unit);
  },
  "p4-pie-chart-total": (s, l) => {
    expect(num(l, "one-slice")).toBe(s.unit);
    expect(num(l, "total")).toBe(s.slices * s.unit);
    expect(num(l, "other")).toBe(s.parts[s.b] * s.unit);
  },
  "p4-pie-chart-practice": (s, l) => {
    let rest = 0;
    s.parts.forEach(
      (p: number, i: number) => i !== s.a && (rest += p * s.unit),
    );
    expect(num(l, "rest")).toBe(rest);
  },
  "p4-read-protractor": (s, l) => {
    expect(num(l, "read")).toBe(s.degrees);
    expect(chosen(goal(l, "scale")).meaning).toBe(s.flip ? "inner" : "outer");
    expect(chosen(goal(l, "classify")).meaning).toBe(
      s.degrees > 90 ? "obtuse" : s.degrees === 90 ? "right" : "acute",
    );
  },
  "p4-estimate-then-measure": (s, l) => {
    expect(num(l, "read")).toBe(s.degrees);
    expect(
      Math.abs(
        Number(chosen(goal(l, "estimate")).label.replace(/\D/g, "")) -
          s.degrees,
      ),
    ).toBe(5);
  },
  "p4-angle-practice": (s, l) => expect(num(l, "read")).toBe(s.degrees),
  "p4-turns": (s, l) => {
    expect(num(l, "degrees")).toBe(s.quarters * 90);
    const compass = ["N", "E", "S", "W"];
    let at = compass.indexOf(s.from);
    for (let i = 0; i < s.quarters; i++)
      at = (at + (s.direction === "clockwise" ? 1 : 3)) % 4;
    expect(chosen(goal(l, "facing")).meaning).toBe(`heading:${compass[at]}`);
  },
  "p4-lines-of-symmetry": (s, l) => {
    expect(num(l, "count")).toBe(AXES[s.shape]);
    expect(chosenMany(goal(l, "axes"))).toHaveLength(AXES[s.shape]);
  },
  "p4-symmetry-practice": (s, l) => expect(num(l, "count")).toBe(AXES[s.shape]),
  "p4-symmetric-figure": (s, l) => {
    expect(num(l, "to-shade")).toBe(s.cells.length);
    expect(num(l, "total")).toBe(s.cells.length + s.cells.length);
    expect(chosen(goal(l, "match")).meaning).toBe("mirror");
  },
  "p4-cube-net-check": (s, l) => {
    expect(num(l, "count")).toBe(6);
    const folds = s.nets.map((n: string) =>
      foldsToCube(cellsOf(n, (c) => c === "#")),
    );
    expect(folds.filter(Boolean)).toHaveLength(1);
    expect(chosen(goal(l, "valid")).meaning).toBe(`net:${folds.indexOf(true)}`);
    expect(folds[s.asked]).toBe(false);
    expect(chosen(goal(l, "why")).meaning).toBe("overlap");
  },
  "p4-cube-opposite-faces": (s, l) => {
    const cells = cellsOf(s.nets[0], (c) => c !== ".");
    const faces = rollCube(cells);
    const letterAt = new Map(
      cells.map(([x, y]) => [
        faces.get(`${x},${y}`)!,
        s.nets[0].split("/")[y][x],
      ]),
    );
    const mine = [...letterAt].find(([, ch]) => ch === s.face)![0];
    expect(chosen(goal(l, "opposite")).meaning).toBe(
      `face:${letterAt.get(mine ^ 1)}`,
    );
    expect(chosenMany(goal(l, "touching"))).toHaveLength(4);
  },
  "p4-complete-the-net": (s, l) => {
    const piece = cellsOf(s.nets[0], (c) => c === "#");
    const good = [..."abcd"].filter((ch) =>
      foldsToCube([...piece, ...cellsOf(s.nets[0], (c) => c === ch)]),
    );
    expect(chosenMany(goal(l, "spots")).map((c) => c.meaning)).toEqual(
      good.map((ch) => `spot:${ch}`),
    );
  },
  "p4-solid-from-net": (s, l) => {
    const [faces, edges, vertices] = SOLID_FACTS[s.solid];
    expect([num(l, "faces"), num(l, "edges"), num(l, "vertices")]).toEqual([
      faces,
      edges,
      vertices,
    ]);
    expect(faces - edges + vertices).toBe(2);
  },
  "p4-rectangle-missing-side": (s, l) => {
    expect(num(l, "missing-side")).toBe(
      s.unknownSide === "width" ? s.width : s.height,
    );
    expect(chosen(goal(l, "relation")).meaning).toBe(
      s.knownMeasure === "area" ? "area-divide" : "perimeter-subtract",
    );
  },
  "p4-composite-area": (s, l) => {
    expect(num(l, "component")).toBe(s.cutWidth * s.cutHeight);
    expect(num(l, "area")).toBe(
      (s.width - s.cutWidth) * s.height + s.cutWidth * (s.height - s.cutHeight),
    );
  },
  "p4-composite-perimeter": (s, l) => {
    expect(num(l, "missing-edge")).toBe(s.width - s.cutWidth);
    // Walk the six outside edges of the L-shape.
    expect(num(l, "perimeter")).toBe(
      s.width +
        s.height +
        (s.width - s.cutWidth) +
        (s.height - s.cutHeight) +
        s.cutWidth +
        s.cutHeight,
    );
  },
  "p4-measurement-practice": (s, l) => {
    expect(num(l, "final")).toBe(
      s.requestedMeasure === "area"
        ? s.width * s.height - s.cutWidth * s.cutHeight
        : 2 * s.width + 2 * s.height,
    );
  },
};
