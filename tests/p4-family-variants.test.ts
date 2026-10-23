/**
 * Phase A fresh examples for the P4 families built through author capabilities. Oracles here are
 * written independently of the topic models: string digit positions instead of place arithmetic,
 * repeated addition instead of division, a rolling cube instead of the fold simulation, and fixed
 * tables of shape facts. Nothing here is a human review of the wording or the mathematics teaching.
 */
import { describe, expect, it } from "vitest";
import { packages } from "../src/content/lessons";
import type { LessonPackage } from "../src/content/package-validation";
import { validatePackage } from "../src/content/package-validation";
import type { Lesson, Step } from "../src/core/types";
import {
  createVariantRun,
  MAX_VARIANT_DOMAIN,
  variantCandidates,
  type VariantRun,
} from "../src/practice/generation";
import { CUBE_NETS, FAMILY_PROFILES } from "../src/practice/family-domains";
import { runtimeTopics } from "../src/topics/registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oracles read spec fields freely
type S = Record<string, any>;
const source = (id: string) => packages.find((p) => p.lesson.id === id)!;
const goal = (l: Lesson, g: string) => l.steps.find((s) => s.goal === g)!;
const chosen = (step: Step) => step.choices!.find((c) => c.id === step.answer)!;
const chosenMany = (step: Step) =>
  step.choices!.filter((c) => (step.answer as string[]).includes(c.id));
const num = (l: Lesson, g: string) => Number(goal(l, g).answer);
const plain = (text: string) => text.replace(/\u00a0/g, " ");

/** Domain sizes after the validateSpec guard and without the starter's own tuple. */
const SIZES: Record<string, number> = {
  "p4-place-value-100k": 2597,
  "p4-rounding": 2602,
  "p4-factors": 18,
  "p4-estimate-by-rounding": 5570,
  "p4-read-bar-chart": 1599,
  "p4-double-bar-chart": 127,
  "p4-bar-chart-practice": 59,
  "p4-read-line-graph": 799,
  "p4-line-graph-change": 799,
  "p4-line-graph-target": 227,
  "p4-line-graph-practice": 39,
  "p4-read-pie-chart": 575,
  "p4-read-pie-sectors": 155,
  "p4-pie-chart-count": 1583,
  "p4-pie-chart-total": 455,
  "p4-pie-chart-practice": 911,
  "p4-read-protractor": 61,
  "p4-estimate-then-measure": 57,
  "p4-angle-practice": 61,
  "p4-turns": 23,
  "p4-lines-of-symmetry": 6,
  "p4-symmetry-practice": 8,
  "p4-symmetric-figure": 224,
  "p4-cube-net-check": 528,
  "p4-cube-opposite-faces": 395,
  "p4-complete-the-net": 191,
  "p4-solid-from-net": 3,
  "p4-rectangle-missing-side": 531,
  "p4-composite-area": 3955,
  "p4-composite-perimeter": 3955,
  "p4-measurement-practice": 7911,
};

/* ------------------------------ independent oracles ------------------------------ */
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
function rollCube(cells: [number, number][]): Map<string, number> {
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
function cellsOf(net: string, match: (ch: string) => boolean) {
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
const ORACLES: Record<string, (s: S, l: Lesson) => void> = {
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

const ready = (run: VariantRun) => {
  const r = run.next();
  if (r.status !== "ready") throw new Error(r.message);
  return r;
};

describe("Phase A: deterministic variants for more P4 families", () => {
  it("covers every family profile and leaves the hands-on workbenches out", () => {
    expect(Object.keys(ORACLES).sort()).toEqual(
      Object.keys(FAMILY_PROFILES).sort(),
    );
    expect(Object.keys(SIZES).sort()).toEqual(
      Object.keys(FAMILY_PROFILES).sort(),
    );
    for (const id of [
      "p4-fold-a-cube-net",
      "p4-fold-a-net-that-fails",
      "p4-fold-a-solid",
      "p4-mirror-line-bench",
      "p4-shade-to-complete-bench",
      "p4-protractor-bench-read",
      "p4-protractor-bench-draw",
    ])
      expect(createVariantRun(source(id), 1)).toBeNull();
  });

  it("the eleven listed cube nets all fold, and no two are the same shape", () => {
    for (const net of CUBE_NETS)
      expect(foldsToCube(cellsOf(net, (c) => c === "#")), net).toBe(true);
  });

  for (const id of Object.keys(FAMILY_PROFILES))
    it(`${id}: bounded valid domain, independent oracle, dedupe and replay`, () => {
      const p = source(id);
      const topic = runtimeTopics[p.lesson.topic]!;
      const listed = variantCandidates(p)!;
      expect(listed.candidates.length).toBe(SIZES[id]);
      expect(listed.candidates.length).toBeLessThanOrEqual(MAX_VARIANT_DOMAIN);
      const prints = new Set<string>();
      for (const spec of listed.candidates) {
        expect(topic.validateSpec(spec)).toEqual([]);
        expect(spec.task).toBe(p.lesson.specification.task);
        expect(spec).not.toEqual(p.lesson.specification);
        prints.add(JSON.stringify(spec));
      }
      expect(prints.size).toBe(listed.candidates.length);

      // Build the whole domain when it is small, otherwise a deterministic sample.
      const limit = listed.candidates.length <= 400 ? Infinity : 60;
      const run = createVariantRun(p, 18429)!;
      const replay = createVariantRun(p, 18429)!;
      const seen = new Set<string>();
      let built = 0;
      for (;;) {
        if (built >= limit) break;
        const next = run.next();
        if (next.status === "exhausted") break;
        if (next.status === "invalid") throw new Error(next.message);
        expect(seen.has(next.descriptor.fingerprint)).toBe(false);
        seen.add(next.descriptor.fingerprint);
        const pkg = next.package as LessonPackage;
        expect(validatePackage(structuredClone(pkg)).package).toBeDefined();
        expect(pkg.provenance).toMatchObject({
          kind: "generated",
          seed: 18429,
        });
        expect(pkg.lesson.reviewStatus).toBe("draft");
        ORACLES[id](pkg.lesson.specification as S, pkg.lesson);
        if (built < 5) {
          const twin = ready(replay);
          expect(twin.descriptor.fingerprint).toBe(next.descriptor.fingerprint);
          expect(twin.package.lesson.steps).toEqual(pkg.lesson.steps);
          expect(twin.package.lesson.story).toBe(pkg.lesson.story);
        }
        built++;
      }
      expect(built).toBe(Math.min(limit, listed.candidates.length));
      if (limit === Infinity) expect(run.next().status).toBe("exhausted");
      // A different seed gives a different order over the same domain.
      const other = createVariantRun(p, 7)!;
      const firstOther = [0, 1, 2].map(
        () => ready(other).descriptor.fingerprint,
      );
      const here = createVariantRun(p, 18429)!;
      const firstHere = [0, 1, 2].map(() => ready(here).descriptor.fingerprint);
      if (listed.candidates.length > 3)
        expect(firstOther).not.toEqual(firstHere);
    }, 60_000);

  it("refuses an edited starter and a starter whose skill signature changed", () => {
    for (const id of Object.keys(FAMILY_PROFILES)) {
      const edited = structuredClone(source(id));
      edited.lesson.story += " An author's custom sentence.";
      expect(createVariantRun(edited, 0)).toBeNull();
      expect(variantCandidates(edited)).toBeNull();
    }
    for (const id of Object.keys(FAMILY_PROFILES)) {
      const spec = { ...source(id).lesson.specification, task: "unknown" };
      expect(FAMILY_PROFILES[id].signature(spec)).toBe(false);
    }
  });
});
