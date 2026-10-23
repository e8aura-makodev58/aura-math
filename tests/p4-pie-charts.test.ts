/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { pieChartsAuthor } from "../src/authoring/pie-charts";
import { createAuthorModel } from "../src/authoring/model";
import { validatePackage } from "../src/content/package-validation";
import {
  LABEL_SIZE,
  PIE_FILLS,
  SLICE_COUNTS,
  VIEW,
  boxesOverlap,
  describe as describePie,
  labelBoxes,
  labelProblems,
  pieChartsTopic,
  sectorDegrees,
  validatePieChartsSpec,
  validatePieChartsSteps,
  type LabelBox,
  type PieChartsSpec,
} from "../src/topics/pie-charts";
import library from "../content/library.json";

const saved = import.meta.glob("../content/lessons/p4-*pie-*.json", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const template = (form: string) => pieChartsAuthor.template(form, `${form}-t`);
const specOf = (form: string): PieChartsSpec =>
  template(form).lesson.specification as unknown as PieChartsSpec;
const base = (
  form: string,
  over: Partial<PieChartsSpec> = {},
): PieChartsSpec => ({
  ...specOf(form),
  ...over,
});
const FORMS = pieChartsAuthor.forms.map((f) => f.id);
const expected: Record<string, Record<string, string>> = {
  "p4-read-pie-chart": { slices: "8" },
  "p4-read-pie-sectors": { parts: "2" },
  "p4-pie-chart-count": { "one-slice": "6", category: "24", more: "12" },
  "p4-pie-chart-total": { "one-slice": "7", total: "42", other: "21" },
  "p4-pie-chart-practice": { rest: "35" },
};

/* ---------------------------------------------------------------------------------------- */
/* Independent oracle, written differently from the production multiplications              */
/* ---------------------------------------------------------------------------------------- */

/** One owner per slice: category index repeated once for every slice it covers. */
const ownersOf = (parts: number[]) =>
  parts.flatMap((p, i) => Array.from({ length: p }, () => i));
const slicesOf = (owners: number[], i: number) =>
  owners.filter((o) => o === i).length;
/** Smallest u in 1 to 240 with u times the slices of a known category equal to the known count. */
function unitBySearch(owners: number[], known: number, who: number) {
  for (let u = 1; u <= 240; u++)
    if (u * slicesOf(owners, who) === known) return u;
  return -1;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function compositions(n: number, k: number, max: number): number[][] {
  const out: number[][] = [];
  const go = (left: number, arr: number[]) => {
    if (arr.length === k) {
      if (left === 0) out.push(arr);
      return;
    }
    for (let p = 1; p <= Math.min(max, left); p++) go(left - p, [...arr, p]);
  };
  go(n, []);
  return out;
}
const NAMES = ["Alpha", "Bravo", "Cedar", "Delta", "Ember"];

/** Accumulation of degrees: every slice adds 360/N to its owner's running total. */
function degreesByAccumulation(owners: number[], k: number) {
  const totals = Array<number>(k).fill(0);
  let running = 0;
  for (const o of owners) {
    totals[o] += 360 / owners.length;
    running += 360 / owners.length;
  }
  return { totals, running };
}

/**
 * Reads the arcs back out of the drawing. This is a DRAWING check only: the endpoint angles are
 * rounded to whole degrees (two-decimal coordinates keep the error under 0.01 degrees) and the
 * result never decides any answer.
 */
function readArcs(html: string) {
  const arcs = [...html.matchAll(/<path class="pie-sector" d="([^"]+)"/g)].map(
    (m) => {
      const nums = m[1].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const [cx, cy, x1, y1, rx, ry, rot, large, sweep, x2, y2] = nums;
      const at = (x: number, y: number) =>
        ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
      const start = Math.round(at(x1, y1)) % 360;
      const end = Math.round(at(x2, y2)) % 360;
      return {
        cx,
        cy,
        rx,
        ry,
        rot,
        large,
        sweep,
        start,
        degrees: (end - start + 360) % 360,
      };
    },
  );
  return arcs;
}
const drawnText = (html: string) =>
  [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

const lessonTexts = (form: string) => {
  const l = template(form).lesson;
  return [
    l.title,
    l.objective,
    l.story,
    ...l.steps.flatMap((s) => [
      s.title,
      s.prompt,
      ...s.hints,
      ...(s.choices ?? []).map((c) => c.label),
    ]),
  ];
};

describe("pie-chart packages", () => {
  for (const form of FORMS) {
    it(`${form}: validates, matches the oracle and completes in both modes`, () => {
      const p = template(form);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      expect(validatePieChartsSteps(p.lesson)).toEqual([]);
      for (const [id, value] of Object.entries(expected[form]))
        expect(p.lesson.steps.find((s) => s.id === id)!.answer).toBe(value);
      // The reflection is the last step and every step has four hints.
      expect(p.lesson.steps.at(-1)!.goal).toBe("reflection");
      for (const step of p.lesson.steps) expect(step.hints).toHaveLength(4);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, pieChartsTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, pieChartsTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, pieChartsTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, pieChartsTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });

    it(`${form}: the saved starter equals the re-emitted one, with no interpretation`, () => {
      const emitted =
        JSON.stringify(pieChartsAuthor.template(form, form), null, 2) + "\n";
      const file = Object.entries(saved).find(([path]) =>
        path.endsWith(`/${form}.json`),
      );
      expect(file, `saved file for ${form}`).toBeDefined();
      expect(JSON.parse(file![1]).lesson).toEqual(JSON.parse(emitted).lesson);
      // The practice lesson (and every other pie lesson) carries no interpretation.
      expect(template(form).interpretation).toBeUndefined();
      expect(pieChartsTopic.interpretation).toBeUndefined();
    });

    it(`${form}: no two steps share an answer and choice ids are opaque`, () => {
      const lesson = template(form).lesson;
      const answers = lesson.steps.map((s) => JSON.stringify(s.answer));
      expect(new Set(answers).size).toBe(answers.length);
      for (const step of lesson.steps) {
        if (!step.choices) continue;
        const position = step.choices.findIndex((c) => c.id === step.answer);
        expect(step.answer).not.toBe(`k${position}`);
        expect(step.choices.every((c) => /^k\d+$/.test(c.id))).toBe(true);
        expect(new Set(step.choices.map((c) => c.id)).size).toBe(
          step.choices.length,
        );
      }
    });

    it(`${form}: shows no percentages and no angles, and keeps its answers off the page`, () => {
      const text = lessonTexts(form).join(" ");
      expect(text).not.toMatch(/%|percent|degree|°|\bangle/i);
      const lesson = template(form).lesson;
      const html = pieChartsTopic.render(lesson);
      const words = drawnText(html);
      expect(words.join(" ")).not.toMatch(/%|°/);
      // Everything a learner can see before answering: story, prompts, drawn words.
      const visible = [
        lesson.story,
        ...lesson.steps
          .filter((s) => s.goal !== "reflection")
          .map((s) => s.prompt),
        ...words,
      ].join(" | ");
      for (const step of lesson.steps)
        if (step.kind === "exact")
          expect(visible).not.toMatch(
            new RegExp(`(?<![\\d/])${step.answer}(?![\\d/])`),
          );
      if (form === "p4-read-pie-chart" || form === "p4-read-pie-sectors") {
        // No numbers are drawn at all.
        expect(words.every((w) => !/\d/.test(w))).toBe(true);
      }
      const fractionLabels = lesson.steps
        .filter((s) => s.goal === "sector-fraction")
        .flatMap((s) => s.choices!.map((c) => c.label));
      for (const word of ["half", "quarter", "eighth"])
        expect(visible.toLowerCase()).not.toContain(word);
      expect(fractionLabels.length === 0 || fractionLabels.length === 3).toBe(
        true,
      );
    });
  }

  it("keeps the five lessons in the library with the right order, prerequisites and practice set", () => {
    const entries = library.lessons.filter((l) => l.topic === "pie-charts");
    expect(entries.map((l) => l.lessonId)).toEqual(FORMS);
    expect(entries.map((l) => l.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(entries.map((l) => l.skillId)).toEqual(FORMS);
    expect(entries.every((l) => l.level === "P4")).toBe(true);
    expect(entries[1].prerequisites).toEqual(["p4-read-pie-chart"]);
    const topic = library.topics.find((t) => t.id === "pie-charts")!;
    expect(topic.strand).toBe("Data");
    expect(topic.skills.map((s) => s.id)).toEqual(FORMS);
    const collection = library.collections.find(
      (c) => c.id === "p4-preparation",
    )!;
    for (const id of FORMS) expect(collection.lessonIds).toContain(id);
    // Only the practice lesson joins the mixed set.
    expect(collection.practiceIds!.filter((id) => FORMS.includes(id))).toEqual([
      "p4-pie-chart-practice",
    ]);
  });

  it("keeps every pie lesson draft, candidate-level and tagged", () => {
    for (const form of FORMS) {
      const p = template(form);
      expect(p.lesson.reviewStatus).toBe("draft");
      expect(p.lesson.level).toBe("P4 candidate");
      expect(p.library!.tags).toEqual(
        expect.arrayContaining(["P4", "pie-charts", "level-unconfirmed"]),
      );
      expect(p.curriculum!.objectiveId).toMatch(/^candidate\.p4\.pie-charts\./);
    }
  });
});

describe("pie-chart model against the independent oracle", () => {
  it("accumulated degrees add to 360 and agree with the model for every composition", () => {
    for (const N of SLICE_COUNTS)
      for (let k = 3; k <= 5; k++)
        for (const parts of compositions(N, k, N - 2)) {
          const { totals, running } = degreesByAccumulation(ownersOf(parts), k);
          expect(running).toBeCloseTo(360, 9);
          expect(totals).toEqual(sectorDegrees({ slices: N, parts }));
          expect(totals.reduce((a, b) => a + b, 0)).toBe(360);
          for (const d of totals) expect(Number.isInteger(d)).toBe(true);
        }
  });

  it("derived answers agree with the owners-array oracle over every slice count and composition", () => {
    let checked = 0;
    for (const N of SLICE_COUNTS)
      for (let k = 3; k <= 5; k++)
        for (const parts of compositions(N, k, N - 2)) {
          const owners = ownersOf(parts);
          expect(owners).toHaveLength(N);
          const names = NAMES.slice(0, k);
          const units = [...new Set([2, 7, Math.min(20, Math.floor(240 / N))])];
          // practice: any asked category.
          for (const a of [0, k - 1])
            for (const unit of units) {
              const s: PieChartsSpec = {
                task: "practice",
                slices: N,
                categories: names,
                parts,
                unit,
                quantity: "pupils",
                a,
                b: a === 0 ? 1 : 0,
              };
              const lesson = pieChartsAuthor.rewrite({
                ...template("p4-pie-chart-practice").lesson,
                specification: s as unknown as Record<string, unknown>,
              });
              expect(validatePieChartsSteps(lesson), JSON.stringify(s)).toEqual(
                [],
              );
              const whole = unit * owners.length;
              expect(unitBySearch(owners, slicesOf(owners, a) * unit, a)).toBe(
                unit,
              );
              expect(lesson.steps[0].answer).toBe(
                String(whole - slicesOf(owners, a) * unit),
              );
              checked++;
            }
          // count: first category must cover more slices than the second.
          for (let a = 0; a < k; a++)
            for (let b = 0; b < k; b++) {
              if (slicesOf(owners, a) <= slicesOf(owners, b)) continue;
              for (const unit of units) {
                const s: PieChartsSpec = {
                  task: "count",
                  slices: N,
                  categories: names,
                  parts,
                  unit,
                  quantity: "pupils",
                  a,
                  b,
                };
                const lesson = pieChartsAuthor.rewrite({
                  ...template("p4-pie-chart-count").lesson,
                  specification: s as unknown as Record<string, unknown>,
                });
                expect(validatePieChartsSteps(lesson)).toEqual([]);
                const whole = unit * owners.length;
                const [one, cat, more] = lesson.steps;
                // The whole is given; one slice is found by search, not by division.
                let u = -1;
                for (let t = 1; t <= 240 && u < 0; t++)
                  if (t * owners.length === whole) u = t;
                expect(one.answer).toBe(String(u));
                expect(cat.answer).toBe(String(slicesOf(owners, a) * u));
                expect(more.answer).toBe(
                  String((slicesOf(owners, a) - slicesOf(owners, b)) * u),
                );
                checked++;
              }
            }
          // total: from one known category find the unit by search, then the whole.
          for (let a = 0; a < k; a++) {
            if (slicesOf(owners, a) < 2) continue;
            const b = a === 0 ? 1 : 0;
            for (const unit of units) {
              const s: PieChartsSpec = {
                task: "total",
                slices: N,
                categories: names,
                parts,
                unit,
                quantity: "pupils",
                a,
                b,
              };
              const lesson = pieChartsAuthor.rewrite({
                ...template("p4-pie-chart-total").lesson,
                specification: s as unknown as Record<string, unknown>,
              });
              expect(validatePieChartsSteps(lesson)).toEqual([]);
              const known = slicesOf(owners, a) * unit;
              const u = unitBySearch(owners, known, a);
              expect(u).toBe(unit);
              const [one, total, other] = lesson.steps;
              expect(one.answer).toBe(String(u));
              expect(total.answer).toBe(String(u * owners.length));
              expect(other.answer).toBe(String(u * slicesOf(owners, b)));
              checked++;
            }
          }
          // read: the three fractions are different and the right one has the right label.
          for (let a = 0; a < k; a++) {
            const b = a === 0 ? 1 : 0;
            const s: PieChartsSpec = {
              task: "read",
              slices: N,
              categories: names,
              parts,
              unit: 0,
              quantity: "pupils",
              a,
              b,
            };
            const mine = slicesOf(owners, a);
            const halfway = mine * 2 === N;
            const errors = validatePieChartsSpec(s);
            if (halfway || slicesOf(owners, a) === slicesOf(owners, b)) {
              expect(errors.length).toBeGreaterThan(0);
              continue;
            }
            expect(errors, JSON.stringify(s)).toEqual([]);
            const lesson = pieChartsAuthor.rewrite({
              ...template("p4-read-pie-chart").lesson,
              specification: s as unknown as Record<string, unknown>,
            });
            const [slicesStep, fraction, larger] = lesson.steps;
            expect(slicesStep.answer).toBe(String(owners.length));
            const shown = fraction.choices!.map((c) => c.label);
            // Different as reduced fractions: reduce each and compare.
            const reduced = shown.map((t) => {
              const [n, d] = t.split("/").map(Number);
              return `${n / gcd(n, d)}/${d / gcd(n, d)}`;
            });
            expect(new Set(reduced).size).toBe(3);
            expect(
              fraction.choices!.find((c) => c.id === fraction.answer)!.label,
            ).toBe(`${mine}/${N}`);
            const bigger = mine > slicesOf(owners, b) ? names[a] : names[b];
            expect(
              larger.choices!.find((c) => c.id === larger.answer)!.label,
            ).toBe(bigger);
            checked++;
          }
        }
    expect(checked).toBeGreaterThan(3000);
  }, 60_000);

  it("sector sizes of one half, one quarter and one eighth are named from the whole", () => {
    let checked = 0;
    for (let k = 3; k <= 4; k++)
      for (const parts of compositions(8, k, 6).filter((c) =>
        c.every((p) => [1, 2, 4].includes(p)),
      ))
        for (let a = 0; a < k; a++)
          for (let b = 0; b < k; b++) {
            if (a === b) continue;
            const s: PieChartsSpec = {
              task: "sectors",
              slices: 8,
              categories: NAMES.slice(0, k),
              parts,
              unit: 0,
              quantity: "pupils",
              a,
              b,
            };
            expect(validatePieChartsSpec(s), JSON.stringify(s)).toEqual([]);
            const lesson = pieChartsAuthor.rewrite({
              ...template("p4-read-pie-sectors").lesson,
              specification: s as unknown as Record<string, unknown>,
            });
            expect(validatePieChartsSteps(lesson)).toEqual([]);
            const owners = ownersOf(parts);
            const n = slicesOf(owners, a);
            const g = gcd(n, 8);
            const [fraction, count] = lesson.steps;
            expect(
              fraction.choices!.find((c) => c.id === fraction.answer)!.label,
            ).toContain(`(${n / g}/${8 / g})`);
            expect(count.answer).toBe(String(slicesOf(owners, b)));
            checked++;
          }
    expect(checked).toBeGreaterThan(20);
    // The only compositions of 8 into sizes 1, 2 and 4 with 3 or 4 labels.
    const shapes = new Set(
      [3, 4].flatMap((k) =>
        compositions(8, k, 6)
          .filter((c) => c.every((p) => [1, 2, 4].includes(p)))
          .map((c) => [...c].sort((x, y) => y - x).join()),
      ),
    );
    expect([...shapes].sort()).toEqual(["2,2,2,2", "4,2,1,1", "4,2,2"]);
  });

  it("draws every sector as the model says, clockwise from 12 o'clock", () => {
    for (const N of SLICE_COUNTS)
      for (let k = 3; k <= 5; k++)
        for (const parts of compositions(N, k, N - 2)) {
          const s: PieChartsSpec = {
            task: "practice",
            slices: N,
            categories: NAMES.slice(0, k),
            parts,
            unit: 2,
            quantity: "pupils",
            a: 0,
            b: 1,
          };
          const arcs = readArcs(
            pieChartsTopic.render({
              ...template("p4-pie-chart-practice").lesson,
              specification: s as unknown as Record<string, unknown>,
            }),
          );
          expect(arcs).toHaveLength(k);
          const degrees = sectorDegrees({ slices: N, parts });
          let before = 0;
          arcs.forEach((arc, i) => {
            expect(arc.degrees).toBe(degrees[i]);
            expect(arc.start).toBe(before % 360);
            expect([arc.cx, arc.cy]).toEqual([VIEW.cx, VIEW.cy]);
            expect([arc.rx, arc.ry, arc.rot]).toEqual([VIEW.r, VIEW.r, 0]);
            expect(arc.sweep).toBe(1);
            expect(arc.large).toBe(degrees[i] > 180 ? 1 : 0);
            before += degrees[i];
          });
          expect(before).toBe(360);
        }
  });

  it("draws spokes on the equal-slice tasks and none on the sector task", () => {
    for (const form of FORMS) {
      const html = pieChartsTopic.render(template(form).lesson);
      const spokes = (html.match(/class="pie-spoke"/g) ?? []).length;
      if (form === "p4-read-pie-sectors") expect(spokes).toBe(0);
      else expect(spokes).toBe(specOf(form).slices);
      expect(html).toContain('stroke="#fffdf8" stroke-width="2"');
    }
    expect(
      pieChartsTopic.render(template("p4-read-pie-sectors").lesson),
    ).not.toContain("<line");
  });
});

describe("label layout", () => {
  const box = (
    id: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): LabelBox => ({
    id,
    x0,
    y0,
    x1,
    y1,
  });
  it("finds overlaps and boxes outside the picture in hand-built cases", () => {
    const a = box("a", 10, 10, 60, 28);
    const overlapping = box("b", 50, 20, 100, 38);
    const touching = box("c", 60, 10, 110, 28);
    const apart = box("d", 10, 40, 60, 58);
    const outside = box("e", 380, 100, 430, 118);
    expect(boxesOverlap(a, overlapping)).toBe(true);
    expect(boxesOverlap(a, touching)).toBe(false);
    expect(boxesOverlap(a, apart)).toBe(false);
    expect(labelProblems([a, overlapping])).toEqual(["a overlaps b"]);
    expect(labelProblems([a, touching, apart])).toEqual([]);
    expect(labelProblems([outside])).toEqual(["e leaves the picture"]);
    expect(labelProblems([box("f", -1, 0, 20, 10)])).toEqual([
      "f leaves the picture",
    ]);
    // A gap turns touching boxes into a problem.
    expect(labelProblems([a, touching], 400, 310, 2)).toEqual(["a overlaps c"]);
  });

  it("rejects a specification whose labels would collide", () => {
    // Labels wider than the slot beside a tiny sector push two labels into each other.
    const crowded: PieChartsSpec = {
      task: "practice",
      slices: 12,
      categories: ["Wwwwwwww", "Wwwwwwww", "Wwwwwwww", "Wwwwwwww", "Wwwwwwww"],
      parts: [1, 1, 1, 1, 8],
      unit: 2,
      quantity: "pupils",
      a: 4,
      b: 0,
    };
    // Whether or not this exact case collides, the validator and the pure function must agree.
    const problems = labelProblems(labelBoxes(crowded));
    const errors = validatePieChartsSpec(crowded);
    expect(errors.some((e) => /Labels would not fit/.test(e))).toBe(
      problems.length > 0,
    );
    // A callout that cannot fit is refused through the same boxes.
    const long = base("p4-pie-chart-practice", {
      quantity: "pupils who like the long names",
    });
    expect(validatePieChartsSpec(long).join(" ")).toMatch(/too long/);
  });

  it("keeps every label inside the picture and clear of the others for all generated pies", () => {
    for (const length of [1, 5, 8])
      for (const N of SLICE_COUNTS)
        for (let k = 3; k <= 5; k++)
          for (const parts of compositions(N, k, N - 2)) {
            const categories = Array.from(
              { length: k },
              (_, i) => "ABCDE"[i] + "x".repeat(length - 1),
            );
            for (const unit of [2, Math.min(20, Math.floor(240 / N))]) {
              const s: PieChartsSpec = {
                task: "practice",
                slices: N,
                categories,
                parts,
                unit,
                quantity: "pupils",
                a: 0,
                b: 1,
              };
              const boxes = labelBoxes(s);
              expect(boxes).toHaveLength(k + 1);
              expect(labelProblems(boxes), JSON.stringify(s)).toEqual([]);
              // Labels also stay clear of the pie itself.
              for (const b of boxes.filter((x) => x.id !== "callout"))
                for (const [x, y] of [
                  [b.x0, b.y0],
                  [b.x1, b.y0],
                  [b.x0, b.y1],
                  [b.x1, b.y1],
                ])
                  expect(
                    Math.hypot(x - VIEW.cx, y - VIEW.cy),
                    JSON.stringify(s),
                  ).toBeGreaterThan(VIEW.r + 4);
            }
          }
  });

  it("anchors labels by side and uses the estimate of 0.65 em per bold capital", () => {
    const s = specOf("p4-read-pie-chart");
    const [first] = labelBoxes(s);
    expect(first.x1 - first.x0).toBeCloseTo(
      "Soccer".length * 0.65 * LABEL_SIZE,
      9,
    );
    const html = pieChartsTopic.render(template("p4-read-pie-chart").lesson);
    expect(html).toMatch(/text-anchor="start"/);
    expect(html).toMatch(/text-anchor="end"/);
  });
});

describe("pie-chart validation", () => {
  it("rejects malformed specifications", () => {
    const cases: [PieChartsSpec | Record<string, unknown>, RegExp][] = [
      [base("p4-read-pie-chart", { parts: [3, 2, 1, 1] }), /add up/],
      [base("p4-read-pie-chart", { slices: 7 }), /4, 5, 6, 8, 10 or 12/],
      [base("p4-read-pie-chart", { slices: 9 }), /4, 5, 6, 8, 10 or 12/],
      [
        base("p4-read-pie-chart", {
          categories: ["A", "B", "C", "D", "E", "F"],
          parts: [1, 1, 1, 1, 1, 3],
        }),
        /three to five/,
      ],
      [
        base("p4-read-pie-chart", { categories: ["A", "B"], parts: [4, 4] }),
        /three to five/,
      ],
      [
        base("p4-read-pie-chart", {
          categories: ["Art", "art", "Chess", "Swim"],
        }),
        /different/,
      ],
      [
        base("p4-read-pie-chart", {
          categories: ["Soccer", "<b>", "Chess", "Art"],
        }),
        /three to five/,
      ],
      [
        base("p4-read-pie-chart", {
          categories: ["Soccer", "Swim", "Chess", "Abcdefghi"],
        }),
        /three to five/,
      ],
      [
        base("p4-read-pie-chart", { parts: [3, 2, 1] }),
        /whole number of slices/,
      ],
      [
        base("p4-read-pie-chart", { parts: [3, 2, 0, 3] }),
        /whole number of slices/,
      ],
      [
        base("p4-read-pie-chart", { parts: [3, 2, 1.5, 1.5] }),
        /whole number of slices/,
      ],
      [
        base("p4-read-pie-chart", { parts: [6, 1, 0.5, 0.5] }),
        /whole number of slices/,
      ],
      [
        base("p4-read-pie-chart", { parts: [6, 1, 1, 0] }),
        /whole number of slices/,
      ],
      [
        base("p4-read-pie-chart", {
          categories: ["A", "B", "C"],
          parts: [7, 0, 1],
        }),
        /whole number of slices/,
      ],
      [base("p4-read-pie-chart", { unit: 6 }), /must be 0/],
      [base("p4-pie-chart-count", { unit: 0 }), /from 2 to 20/],
      [base("p4-pie-chart-count", { unit: 1 }), /from 2 to 20/],
      [base("p4-pie-chart-count", { unit: 2.5 }), /whole number/],
      [base("p4-pie-chart-count", { unit: 21 }), /whole number/],
      [base("p4-pie-chart-count", { a: 1, b: 0 }), /more slices/],
      [base("p4-pie-chart-count", { a: 1, b: 1 }), /two different/],
      [base("p4-pie-chart-total", { a: 2, b: 0 }), /at least 2 slices/],
      [base("p4-pie-chart-practice", { unit: 0 }), /from 2 to 20/],
      [base("p4-pie-chart-practice", { quantity: "" }), /plain words/],
      [
        base("p4-pie-chart-practice", { quantity: "pupils & friends" }),
        /plain words/,
      ],
      [base("p4-read-pie-chart", { a: 9 }), /whole-number positions/],
      [base("p4-read-pie-chart", { a: 0, b: 4 }), /exist/],
      [base("p4-read-pie-chart", { a: 2, b: 2 }), /two different/],
      [
        base("p4-read-pie-chart", { a: 1, b: 3 }),
        /different numbers of slices/,
      ],
      [
        base("p4-read-pie-chart", {
          categories: ["A", "B", "C"],
          parts: [4, 3, 1],
          a: 0,
          b: 1,
        }),
        /would not all be different/,
      ],
      [
        base("p4-read-pie-chart", { task: "angles" as "read" }),
        /Unsupported pie-chart task/,
      ],
      [
        base("p4-read-pie-sectors", { slices: 6, parts: [2, 2, 1, 1] }),
        /exactly 8/,
      ],
      [base("p4-read-pie-sectors", { parts: [3, 3, 1, 1] }), /1, 2 or 4/],
      [
        base("p4-read-pie-sectors", {
          categories: ["A", "B", "C", "D", "E"],
          parts: [2, 2, 2, 1, 1],
        }),
        /three or four/,
      ],
      [base("p4-read-pie-sectors", { unit: 4 }), /must be 0/],
      [base("p4-read-pie-sectors", { a: 1, b: 1 }), /two different/],
    ];
    for (const [spec, pattern] of cases)
      expect(
        validatePieChartsSpec(spec).join(" "),
        JSON.stringify(spec),
      ).toMatch(pattern);
    expect(validatePieChartsSpec(null)).not.toEqual([]);
    expect(validatePieChartsSpec([])).not.toEqual([]);
    expect(validatePieChartsSpec("pie")).not.toEqual([]);
    expect(
      validatePieChartsSpec({ ...base("p4-read-pie-chart"), extra: 1 }),
    ).toContain("Unknown pie-chart field");
    for (const field of ["categories", "parts"])
      expect(
        validatePieChartsSpec({ ...base("p4-read-pie-chart"), [field]: "abc" }),
      ).not.toEqual([]);
    expect(
      validatePieChartsSpec({ ...base("p4-read-pie-chart"), unit: "6" }),
    ).not.toEqual([]);
    expect(
      validatePieChartsSpec({ ...base("p4-read-pie-chart"), slices: "8" }),
    ).not.toEqual([]);
  });

  it("rejects a step list that contradicts the model", () => {
    const lesson = template("p4-read-pie-chart").lesson;
    lesson.steps[0].answer = "7";
    expect(validatePieChartsSteps(lesson).join(" ")).toMatch(/contradicts/);
    const fraction = template("p4-read-pie-chart").lesson;
    fraction.steps[1].choices![0].label = "9/9";
    expect(validatePieChartsSteps(fraction).join(" ")).toMatch(
      /Fraction choices/,
    );
    const kind = template("p4-pie-chart-count").lesson;
    kind.steps[0].kind = "choice";
    expect(validatePieChartsSteps(kind).join(" ")).toMatch(/Response kind/);
    const goals = template("p4-pie-chart-practice").lesson;
    goals.steps.reverse();
    expect(validatePieChartsSteps(goals).join(" ")).toMatch(/goal sequence/);
    const meanings = template("p4-read-pie-sectors").lesson;
    meanings.steps[2].choices!.find((c) => c.meaning === "angle")!.meaning =
      "share";
    expect(validatePieChartsSteps(meanings).join(" ")).toMatch(
      /each supported meaning/,
    );
    const wrongWord = template("p4-read-pie-sectors").lesson;
    wrongWord.steps[0].answer = wrongWord.steps[0].choices![2].id;
    expect(validatePieChartsSteps(wrongWord).join(" ")).toMatch(/contradicts/);
  });

  it("lists the data in the text alternative, escapes it and draws legible text", () => {
    expect(describePie(specOf("p4-read-pie-chart"))).toBe(
      "Pie chart of pupils, cut into 8 equal slices. Soccer covers 3 slices. Swim covers 2 slices. Chess covers 1 slice. Art covers 2 slices.",
    );
    expect(describePie(specOf("p4-pie-chart-count"))).toContain(
      "The whole pie shows 60 pupils.",
    );
    expect(describePie(specOf("p4-pie-chart-total"))).toContain(
      "Noodles shows 14 pupils.",
    );
    expect(describePie(specOf("p4-read-pie-sectors"))).toContain(
      "Rice covers 4 of the 8 parts",
    );
    expect(describePie(base("p4-read-pie-chart", { parts: [1] }))).toBe(
      "A pie chart that needs correcting.",
    );
    for (const form of FORMS) {
      const html = pieChartsTopic.render(template(form).lesson);
      expect(html).toMatch(/role="img"/);
      expect(html).toMatch(/aria-hidden="true"/);
      expect(html).not.toContain("<script");
      const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(html)!.map(Number);
      expect([w, h]).toEqual([400, 310]);
      for (const size of html.matchAll(/font-size="(\d+)"/g))
        expect(Number(size[1])).toBeGreaterThanOrEqual(15);
      // Every drawn word is dark ink, never a sector colour.
      for (const colour of html.matchAll(/<text[^>]*fill="(#[0-9a-f]{6})"/g))
        expect(PIE_FILLS).not.toContain(colour[1]);
    }
    const broken = pieChartsTopic.render({
      ...template("p4-read-pie-chart").lesson,
      specification: { task: "read" },
    });
    expect(broken).toContain("Correct the pie chart");
    expect(broken).not.toContain("<svg");
  });
});

describe("pie-chart author tooling", () => {
  it("offers a form and the right fields for each lesson", () => {
    expect(FORMS).toEqual([
      "p4-read-pie-chart",
      "p4-read-pie-sectors",
      "p4-pie-chart-count",
      "p4-pie-chart-total",
      "p4-pie-chart-practice",
    ]);
    const keys = (form: string) =>
      pieChartsAuthor.fields(template(form).lesson).map((f) => f.key);
    expect(keys("p4-read-pie-chart")).toEqual([
      "quantity",
      "categories",
      "parts",
      "slices",
      "a",
      "b",
    ]);
    expect(keys("p4-read-pie-sectors")).toEqual([
      "quantity",
      "categories",
      "parts",
      "a",
      "b",
    ]);
    expect(keys("p4-pie-chart-count")).toContain("total");
    expect(keys("p4-pie-chart-practice")).not.toContain("b");
    const totalField = pieChartsAuthor
      .fields(template("p4-pie-chart-count").lesson)
      .find((f) => f.key === "total")!;
    expect(totalField.value).toBe(60);
    expect(() => pieChartsAuthor.template("nope", "x")).toThrow();
  });

  it("keeps edits coherent and malformed text editable", () => {
    const model = createAuthorModel(template("p4-pie-chart-count"));
    model.patch({ kind: "topic", key: "total", value: "70" });
    const spec = () =>
      model.working.lesson.specification as unknown as PieChartsSpec;
    expect(spec().unit).toBe(7);
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(model.working.lesson.steps[0].answer).toBe("7");
    expect(model.working.lesson.steps[1].answer).toBe("28");
    // A total the ten slices cannot share equally keeps a fraction, so the validator names it.
    model.patch({ kind: "topic", key: "total", value: "75" });
    expect(spec().unit).toBe(7.5);
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    model.patch({ kind: "topic", key: "total", value: "60" });
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    model.patch({ kind: "topic", key: "parts", value: "4, 3, x, 1" });
    expect(spec().parts).toEqual(["4", "3", "x", "1"]);
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    model.patch({ kind: "topic", key: "parts", value: "5, 3, 1, 1" });
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(model.working.lesson.steps[1].answer).toBe("30");
    model.patch({
      kind: "topic",
      key: "categories",
      value: "Cat, Dog, Fish, Bird",
    });
    model.applyWording();
    expect(model.working.lesson.steps[1].prompt).toContain("Cat group");
    model.patch({ kind: "topic", key: "slices", value: "12" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);

    const total = createAuthorModel(template("p4-pie-chart-total"));
    total.patch({ kind: "topic", key: "b", value: "1" });
    total.patch({ kind: "topic", key: "a", value: "0" });
    total.applyWording();
    expect(total.working.lesson.steps[0].prompt).toContain("Rice group has 21");
    expect(total.working.lesson.steps[1].answer).toBe("42");

    const sectors = createAuthorModel(template("p4-read-pie-sectors"));
    sectors.patch({ kind: "topic", key: "parts", value: "2, 2, 2, 2" });
    expect(sectors.issues.filter((i) => i.severity === "error")).toEqual([]);
    sectors.applyWording();
    expect(
      sectors.working.lesson.steps[0].choices!.find(
        (c) => c.id === sectors.working.lesson.steps[0].answer,
      )!.label,
    ).toBe("A quarter (1/4)");
    sectors.patch({ kind: "topic", key: "parts", value: "3, 3, 1, 1" });
    expect(sectors.issues.some((i) => i.severity === "error")).toBe(true);

    const read = createAuthorModel(template("p4-read-pie-chart"));
    read.patch({ kind: "topic", key: "quantity", value: "pupils <b>" });
    expect(read.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("rewrite keeps the authored reflection and restores wording and answers", () => {
    const lesson = template("p4-pie-chart-total").lesson;
    const reflection = lesson.steps.at(-1)!;
    const edited = structuredClone(lesson);
    edited.steps[0].prompt = "stale";
    edited.steps[1].answer = "1";
    edited.steps.at(-1)!.hints[0] = "My own hint";
    const fixed = pieChartsAuthor.rewrite(edited);
    expect(fixed.steps[0].prompt).toBe(lesson.steps[0].prompt);
    expect(fixed.steps[1].answer).toBe("42");
    expect(fixed.steps.at(-1)!.hints[0]).toBe("My own hint");
    expect(fixed.steps.at(-1)!.answer).toBe(reflection.answer);
    const derived = pieChartsAuthor.derive(edited);
    expect(derived.steps[1].answer).toBe("42");
  });
});
