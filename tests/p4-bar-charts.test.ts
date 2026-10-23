/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
  createSession,
  nextStep,
  submit,
  switchMode,
  useHint,
} from "../src/core/runtime";
import { barChartsAuthor } from "../src/authoring/bar-charts";
import { createAuthorModel } from "../src/authoring/model";
import { validatePackage } from "../src/content/package-validation";
import {
  BAR_FILLS,
  barChartsTopic,
  describe as describeBars,
  validateBarChartsSpec,
  validateBarChartsSteps,
  type BarChartsSpec,
} from "../src/topics/bar-charts";
import {
  barPixels,
  grainFor,
  maxLabelChars,
  maxValueFor,
  rowPixels,
  rowsFor,
  slotWidth,
} from "../src/topics/chart-scale";
import library from "../content/library.json";

const saved = import.meta.glob("../content/lessons/p4-*bar-chart*.json", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const template = (form: string) => barChartsAuthor.template(form, `${form}-t`);
const specOf = (form: string): BarChartsSpec =>
  template(form).lesson.specification as unknown as BarChartsSpec;
const base = (
  form: string,
  over: Partial<BarChartsSpec> = {},
): BarChartsSpec => ({ ...specOf(form), ...over });
const FORMS = barChartsAuthor.forms.map((f) => f.id);
const expected: Record<string, Record<string, string>> = {
  "p4-read-bar-chart": { scale: "10", read: "35", total: "75" },
  "p4-double-bar-chart": { "read-pair": "35", difference: "20" },
  "p4-bar-chart-practice": { "top-two-total": "120" },
};

/* ---------------------------------------------------------------------------------------- */
/* Independent oracle, written differently from the production arithmetic                   */
/* ---------------------------------------------------------------------------------------- */

/** Rows by loop: the smallest row count, at least four, whose top reaches the largest value. */
function rowsByLoop(values: number[], step: number) {
  const biggest = values.reduce((m, v) => (v > m ? v : m), 0);
  let rows = 4;
  while (rows * step < biggest) rows++;
  return rows;
}
/** The two tallest by sorting (not by a running maximum). */
const topTwo = (values: number[]) => {
  const sorted = [...values].sort((x, y) => y - x);
  return [sorted[0], sorted[1]];
};
/** Gaps recomputed with a sort of (gap, label) pairs. */
function gapsSorted(a: number[], b: number[], names: string[]) {
  return names
    .map((name, i) => ({ name, gap: a[i] > b[i] ? a[i] - b[i] : b[i] - a[i] }))
    .sort((x, y) => (x.gap === y.gap ? 0 : x.gap < y.gap ? 1 : -1));
}
/** A tiny deterministic generator so the sweeps are repeatable. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

interface Drawn {
  bars: {
    series: number;
    index: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
  hatches: { x: number; y: number; w: number; h: number }[];
  baseline: number;
  gridYs: number[];
  texts: { cls: string; text: string; x: number; y: number }[];
  viewBox: number[];
  swatches: { series: number }[];
  legendHatch: number;
}
const attr = (tag: string, name: string) =>
  Number(new RegExp(`${name}="(-?\\d+(?:\\.\\d+)?)"`).exec(tag)![1]);
/** Everything the checks need, read back out of the rendered markup only. */
function readSvg(html: string): Drawn {
  const tags = (cls: string) =>
    [...html.matchAll(new RegExp(`<rect class="${cls}"[^>]*>`, "g"))].map(
      (m) => m[0],
    );
  const line = (cls: string) =>
    [...html.matchAll(new RegExp(`<line class="${cls}"[^>]*>`, "g"))].map(
      (m) => m[0],
    );
  const vb = /viewBox="([^"]+)"/.exec(html)![1].split(" ").map(Number);
  return {
    bars: tags("bar").map((t) => ({
      series: attr(t, "data-series"),
      index: attr(t, "data-index"),
      x: attr(t, " x"),
      y: attr(t, " y"),
      w: attr(t, "width"),
      h: attr(t, "height"),
    })),
    hatches: tags("bar-hatch").map((t) => ({
      x: attr(t, " x"),
      y: attr(t, " y"),
      w: attr(t, "width"),
      h: attr(t, "height"),
    })),
    baseline: attr(line("bar-baseline")[0], "y1"),
    gridYs: line("bar-grid").map((t) => attr(t, "y1")),
    texts: [
      ...html.matchAll(
        /<text class="([^"]+)" x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*>([^<]*)<\/text>/g,
      ),
    ].map((m) => ({
      cls: m[1],
      x: Number(m[2]),
      y: Number(m[3]),
      text: m[4],
    })),
    viewBox: vb,
    swatches: tags("legend-swatch").map((t) => ({
      series: attr(t, "data-series"),
    })),
    legendHatch: tags("legend-hatch").length,
  };
}
/** Reads a bar's value from its pixel height using only the gridlines of the same drawing. */
function valuesFromDrawing(html: string, step: number) {
  const d = readSvg(html);
  const topGrid = Math.min(...d.gridYs);
  const rows = d.gridYs.length;
  const rowPx = (d.baseline - topGrid) / rows;
  return {
    d,
    rows,
    rowPx,
    read: d.bars.map((b) => ({
      series: b.series,
      index: b.index,
      exact: (b.h * step) % rowPx === 0,
      value: (b.h * step) / rowPx,
      bottom: b.y + b.h,
    })),
  };
}

const render = (spec: BarChartsSpec) =>
  barChartsTopic.render({
    ...template("p4-read-bar-chart").lesson,
    specification: spec as unknown as Record<string, unknown>,
  });

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

describe("bar-chart packages", () => {
  for (const form of FORMS) {
    it(`${form}: validates, matches the oracle and completes in both modes`, () => {
      const p = template(form);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      expect(validateBarChartsSteps(p.lesson)).toEqual([]);
      for (const [id, value] of Object.entries(expected[form]))
        expect(p.lesson.steps.find((s) => s.id === id)!.answer).toBe(value);
      expect(p.lesson.steps.at(-1)!.goal).toBe("reflection");
      // Four hints on every step; the last is the labelled reveal that names the answer.
      for (const step of p.lesson.steps) expect(step.hints).toHaveLength(4);
      for (const step of p.lesson.steps.filter(
        (s) => s.goal !== "reflection" && s.kind === "exact",
      ))
        expect(step.hints[3]).toContain(`Enter ${step.answer}`);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, barChartsTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, barChartsTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, barChartsTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, barChartsTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });

    it(`${form}: the saved starter equals the re-emitted one, with no interpretation`, () => {
      const emitted =
        JSON.stringify(barChartsAuthor.template(form, form), null, 2) + "\n";
      const file = Object.entries(saved).find(([path]) =>
        path.endsWith(`/${form}.json`),
      );
      expect(file, `saved file for ${form}`).toBeDefined();
      expect(JSON.parse(file![1]).lesson).toEqual(JSON.parse(emitted).lesson);
      expect(template(form).interpretation).toBeUndefined();
      expect(barChartsTopic.interpretation).toBeUndefined();
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

    it(`${form}: asks nothing about meaning or averages and keeps answers off the page`, () => {
      const text = lessonTexts(form).join(" ");
      expect(text).not.toMatch(
        /average|mean\b|median|why do you think|predict/i,
      );
      const lesson = template(form).lesson;
      const rendered = barChartsTopic.render(lesson);
      const words = readSvg(rendered)
        .texts.filter((t) => t.cls !== "bar-axis-label")
        .map((t) => t.text);
      // What the learner sees before answering: the story, prompts and every non-axis word drawn.
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
            new RegExp(`(?<![\\w/])${step.answer}(?![\\w/])`),
          );
    });
  }

  it("keeps the three lessons in the library with order, prerequisites, strand and practice set", () => {
    const entries = library.lessons.filter((l) => l.topic === "bar-charts");
    expect(entries.map((l) => l.lessonId)).toEqual(FORMS);
    expect(entries.map((l) => l.sequence)).toEqual([1, 2, 3]);
    expect(entries.map((l) => l.skillId)).toEqual(FORMS);
    expect(entries.map((l) => l.prerequisites)).toEqual([
      [],
      ["p4-read-bar-chart"],
      ["p4-double-bar-chart"],
    ]);
    const topic = library.topics.find((t) => t.id === "bar-charts")!;
    expect(topic.strand).toBe("Data");
    expect(topic.skills.map((s) => s.id)).toEqual(FORMS);
    const collection = library.collections.find(
      (c) => c.id === "p4-preparation",
    )!;
    for (const id of FORMS) expect(collection.lessonIds).toContain(id);
    expect(collection.practiceIds!.filter((id) => FORMS.includes(id))).toEqual([
      "p4-bar-chart-practice",
    ]);
  });

  it("keeps every bar lesson draft, tagged as a P3 bridge and sourced to the P3 and P4 pages", () => {
    for (const form of FORMS) {
      const p = template(form);
      expect(p.lesson.reviewStatus).toBe("draft");
      expect(p.lesson.level).toBe("P4 candidate");
      expect(p.library!.tags).toEqual([
        "P4",
        "bar-charts",
        "general revision",
        "p3-bridge",
      ]);
      expect(p.curriculum!.objectiveId).toMatch(/^candidate\.p4\.bar-charts\./);
      expect(p.curriculum!.evidenceStatus).toBe("candidate");
      expect(p.curriculum!.sources).toEqual([
        "https://practicle.sg/primary-3-math/",
        "https://practicle.sg/primary-4-math/",
      ]);
    }
  });
});

describe("bar-chart scale rules", () => {
  it("derives the maximum value from rows and step, with the true bounds per step", () => {
    expect([2, 5, 10, 20].map(maxValueFor)).toEqual([20, 50, 100, 200]);
    expect([2, 5, 10, 20].map(grainFor)).toEqual([1, 5, 5, 10]);
    for (const step of [2, 5, 10, 20])
      for (let top = 1; top <= 10 * step; top++)
        expect(rowsFor(top, step)).toBe(rowsByLoop([top], step));
  });

  it("gives every allowed row count an even row height and whole-pixel bars", () => {
    for (const step of [2, 5, 10, 20])
      for (let rows = 4; rows <= 10; rows++) {
        const px = rowPixels(rows);
        expect(px % 2).toBe(0);
        // Independent: the plot never exceeds 200 pixels.
        expect(px * rows).toBeLessThanOrEqual(200);
        expect(px * rows).toBeGreaterThan(rows * 18);
        for (let v = grainFor(step); v <= rows * step; v += grainFor(step))
          expect(Number.isInteger(barPixels(v, step, rows))).toBe(true);
      }
  });

  it("rejects zero, off-grain and over-tall values for each step", () => {
    const mk = (step: number, values: number[]) =>
      base("p4-read-bar-chart", {
        step,
        values,
        labels: ["Cats", "Dogs", "Fish", "Birds", "Mice"],
        a: 1,
        b: 3,
      });
    // step 10, grain 5, limit 100
    expect(validateBarChartsSpec(mk(10, [20, 35, 15, 100, 25]))).toEqual([]);
    expect(validateBarChartsSpec(mk(10, [20, 35, 15, 105, 25]))[0]).toMatch(
      /from 1 to 100/,
    );
    expect(validateBarChartsSpec(mk(10, [20, 35, 0, 40, 25]))[0]).toMatch(
      /no bar may be zero/,
    );
    expect(validateBarChartsSpec(mk(10, [20, 37, 15, 40, 25]))[0]).toMatch(
      /multiples of 5/,
    );
    // step 2, grain 1, limit 20
    expect(validateBarChartsSpec(mk(2, [3, 7, 5, 20, 1]))).toEqual([]);
    expect(validateBarChartsSpec(mk(2, [3, 7, 5, 21, 1]))[0]).toMatch(
      /from 1 to 20/,
    );
    // step 5, grain 5, limit 50
    expect(validateBarChartsSpec(mk(5, [5, 10, 15, 50, 25]))).toEqual([]);
    expect(validateBarChartsSpec(mk(5, [5, 10, 15, 55, 25]))[0]).toMatch(
      /from 1 to 50/,
    );
    expect(validateBarChartsSpec(mk(5, [5, 12, 15, 40, 25]))[0]).toMatch(
      /multiples of 5/,
    );
    // step 20, grain 10, limit 200
    expect(validateBarChartsSpec(mk(20, [10, 50, 150, 200, 90]))).toEqual([]);
    expect(validateBarChartsSpec(mk(20, [10, 50, 150, 210, 90]))[0]).toMatch(
      /from 1 to 200/,
    );
    expect(validateBarChartsSpec(mk(20, [10, 55, 150, 200, 90]))[0]).toMatch(
      /multiples of 10/,
    );
  });

  it("matches an independently written label-fit rule for every bar count and length", () => {
    // Slot is whole units of 340 over the bars; text is 15 units at 0.65 em per bold capital.
    const fits = (n: number, chars: number) =>
      chars * 975 <= (Math.trunc(340 / n) - 4) * 100;
    expect([3, 4, 5, 6].map((n) => maxLabelChars(n, 15))).toEqual([
      11, 8, 6, 5,
    ]);
    for (const n of [3, 4, 5, 6]) {
      expect(slotWidth(n)).toBe(Math.trunc(340 / n));
      for (let chars = 1; chars <= 12; chars++) {
        const labels = Array.from({ length: n }, (_, i) =>
          i === 0 ? "W".repeat(chars) : `L${i}`,
        );
        const values = labels.map((_, i) => 10 + 5 * i);
        const errors = validateBarChartsSpec({
          ...specOf("p4-read-bar-chart"),
          labels,
          values,
          a: 0,
          b: 1,
        });
        const labelProblem = errors.some((e) =>
          /at most \d+ characters/.test(e),
        );
        expect(labelProblem, `${n} bars, ${chars} chars`).toBe(
          !fits(n, chars) && chars >= 2,
        );
      }
    }
    // The wording names the real limit.
    expect(
      validateBarChartsSpec({
        ...specOf("p4-read-bar-chart"),
        labels: ["Abcdefg", "Dogs", "Fish", "Birds", "Mice"],
      })[0],
    ).toMatch(/at most 6 characters/);
  });
});

describe("bar-chart drawing against the model", () => {
  const sweepSpecs = (): BarChartsSpec[] => {
    const rnd = lcg(7);
    const out: BarChartsSpec[] = [];
    for (const task of ["read", "double", "practice"] as const)
      for (const step of [2, 5, 10, 20])
        for (let n = 3; n <= 6; n++)
          for (let trial = 0; trial < 6; trial++) {
            const grain = grainFor(step);
            const top = Math.floor((10 * step) / grain);
            const pick = () => grain * (1 + Math.floor(rnd() * top));
            const spec: BarChartsSpec = {
              task,
              labels: ["Ant", "Bee", "Cat", "Dog", "Elk", "Fox"].slice(0, n),
              values: Array.from({ length: n }, pick),
              values2: task === "double" ? Array.from({ length: n }, pick) : [],
              series: task === "double" ? ["Reds", "Blues"] : [],
              step,
              quantity: "Things counted",
              a: task === "practice" ? 0 : 1,
              b: task === "read" ? 2 : 0,
            };
            if (validateBarChartsSpec(spec).length === 0) out.push(spec);
          }
    return out;
  };

  it("reads every bar's value back from the rendered rectangles and compares with the model", () => {
    const specs = sweepSpecs();
    expect(specs.length).toBeGreaterThan(150);
    for (const spec of specs) {
      const html = render(spec);
      const { d, rows, rowPx, read } = valuesFromDrawing(html, spec.step);
      const both = [...spec.values, ...spec.values2];
      expect(rows).toBe(rowsByLoop(both, spec.step));
      expect(Number.isInteger(rowPx)).toBe(true);
      expect(rowPx % 2).toBe(0);
      expect(d.bars).toHaveLength(both.length);
      for (const bar of read) {
        const model =
          bar.series === 1 ? spec.values[bar.index] : spec.values2[bar.index];
        expect(bar.exact).toBe(true);
        expect(bar.value).toBe(model);
        // Every bar stands on the baseline.
        expect(bar.bottom).toBe(d.baseline);
      }
      // The width of the picture is the phone rule and the height holds the whole plot.
      expect(d.viewBox.slice(0, 3)).toEqual([0, 0, 400]);
      expect(d.viewBox[3]).toBeGreaterThan(d.baseline);
    }
  });

  it("keeps bars inside their slot, off the axis and clear of one another", () => {
    for (const spec of sweepSpecs()) {
      const n = spec.labels.length;
      const slot = Math.trunc(340 / n);
      const d = readSvg(render(spec));
      for (const bar of d.bars) {
        const left = 46 + bar.index * slot;
        expect(bar.x).toBeGreaterThanOrEqual(left + 2);
        expect(bar.x + bar.w).toBeLessThanOrEqual(left + slot - 2);
        expect(bar.w).toBeGreaterThanOrEqual(14);
        expect(Number.isInteger(bar.x) && Number.isInteger(bar.w)).toBe(true);
      }
      if (spec.task === "double")
        for (let i = 0; i < n; i++) {
          const pair = d.bars
            .filter((b) => b.index === i)
            .sort((p, q) => p.series - q.series);
          expect(pair.map((p) => p.series)).toEqual([1, 2]);
          // Series 2 is to the right of series 1 with a visible gap.
          expect(pair[1].x - (pair[0].x + pair[0].w)).toBeGreaterThanOrEqual(2);
          expect(pair[0].w).toBe(pair[1].w);
        }
      else expect(d.bars.map((b) => b.series)).toEqual(Array(n).fill(1));
    }
  });

  it("tells double bars apart by a pattern overlay and a legend swatch, not colour alone", () => {
    for (const form of ["p4-double-bar-chart"]) {
      const html = render(specOf(form));
      const d = readSvg(html);
      const second = d.bars.filter((b) => b.series === 2);
      expect(second).toHaveLength(4);
      // One overlay per second-series bar with the identical rectangle; none on series 1.
      expect(d.hatches).toHaveLength(second.length);
      for (const bar of second)
        expect(
          d.hatches.some(
            (h) =>
              h.x === bar.x && h.y === bar.y && h.w === bar.w && h.h === bar.h,
          ),
        ).toBe(true);
      expect(html).toContain('<pattern id="bar-hatch"');
      expect(html).toContain('fill="url(#bar-hatch)"');
      // The legend has both swatches, the second with the same pattern, and names both series.
      expect(d.swatches.map((s) => s.series)).toEqual([1, 2]);
      expect(d.legendHatch).toBe(1);
      expect(
        d.texts.filter((t) => t.cls === "legend-text").map((t) => t.text),
      ).toEqual(["Boys", "Girls"]);
      expect(BAR_FILLS[0]).not.toBe(BAR_FILLS[1]);
    }
    // Single charts have no overlay, no pattern and no legend.
    const single = render(specOf("p4-read-bar-chart"));
    expect(single).not.toContain("bar-hatch");
    expect(single).not.toContain("legend");
  });

  it("never prints a bar value on or near a bar and labels the axis as the lesson needs", () => {
    for (const spec of sweepSpecs()) {
      const d = readSvg(render(spec));
      // Only these kinds of words are drawn.
      for (const t of d.texts)
        expect([
          "bar-title",
          "bar-axis-label",
          "bar-label",
          "legend-text",
        ]).toContain(t.cls);
      const axis = d.texts.filter((t) => t.cls === "bar-axis-label");
      const rows = d.gridYs.length;
      const shown = axis.map((t) => Number(t.text)).sort((p, q) => p - q);
      if (spec.task === "read") expect(shown).toEqual([0, rows * spec.step]);
      else
        expect(shown).toEqual(
          Array.from({ length: rows + 1 }, (_, k) => k * spec.step),
        );
      // Axis labels are left of the axis, category labels are under the baseline.
      for (const t of axis) expect(t.x).toBeLessThan(46);
      for (const t of d.texts.filter((u) => u.cls === "bar-label"))
        expect(t.y).toBeGreaterThan(d.baseline);
      // No text sits inside any bar rectangle.
      for (const t of d.texts)
        for (const b of d.bars)
          expect(
            t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h,
            `${t.text} inside a bar`,
          ).toBe(false);
    }
  });

  it("draws text at 15 units or more, in a 400-wide picture, with dark ink for words", () => {
    for (const form of FORMS) {
      const html = barChartsTopic.render(template(form).lesson);
      expect(html).toMatch(/role="img"/);
      expect(html).toMatch(/aria-hidden="true"/);
      expect(html).not.toContain("<script");
      expect(/viewBox="0 0 400 \d+"/.test(html)).toBe(true);
      const sizes = [...html.matchAll(/font-size="(\d+)"/g)].map((m) => +m[1]);
      expect(sizes.length).toBeGreaterThan(5);
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual(15);
      for (const colour of html.matchAll(/<text[^>]*fill="(#[0-9a-f]{6})"/g))
        expect(BAR_FILLS).not.toContain(colour[1]);
    }
  });

  it("matches the oracle's answers for every generated chart", () => {
    for (const spec of sweepSpecs()) {
      const base0 = template(
        spec.task === "read"
          ? "p4-read-bar-chart"
          : spec.task === "double"
            ? "p4-double-bar-chart"
            : "p4-bar-chart-practice",
      ).lesson;
      const lesson = barChartsAuthor.rewrite({
        ...base0,
        specification: spec as unknown as Record<string, unknown>,
      });
      expect(validateBarChartsSteps(lesson)).toEqual([]);
      const answerOf = (id: string) =>
        lesson.steps.find((s) => s.id === id)?.answer;
      if (spec.task === "read") {
        expect(answerOf("scale")).toBe(String(spec.step));
        expect(answerOf("read")).toBe(String(spec.values[1]));
        expect(answerOf("total")).toBe(String(spec.values[1] + spec.values[2]));
      }
      if (spec.task === "double") {
        expect(answerOf("read-pair")).toBe(String(spec.values2[1]));
        const g = gapsSorted(spec.values, spec.values2, spec.labels);
        expect(g[0].gap).toBeGreaterThan(g[1].gap); // a unique biggest gap
        expect(answerOf("difference")).toBe(
          String(Math.abs(spec.values[1] - spec.values2[1])),
        );
        const step = lesson.steps.find((s) => s.id === "gap")!;
        const chosen = step.choices!.find((c) => c.id === step.answer)!;
        expect(chosen.label).toBe(g[0].name);
        expect(step.choices!.map((c) => c.label).sort()).toEqual(
          g
            .slice(0, 3)
            .map((x) => x.name)
            .sort(),
        );
      }
      if (spec.task === "practice") {
        const [p, q] = topTwo(spec.values);
        expect(answerOf("top-two-total")).toBe(String(p + q));
      }
    }
  });

  it("keeps the legend inside the picture for the longest allowed series names", () => {
    // Independent arithmetic: swatch 14 + gap 6, text at 0.65 em of 15 units, 24 units between entries.
    const entry = (chars: number) => 20 + Math.ceil(chars * 0.65 * 15);
    expect(46 + entry(12) + 24 + entry(12)).toBeLessThanOrEqual(386);
    const html = render(
      base("p4-double-bar-chart", { series: ["Abcdefghijkl", "Mnopqrstuvwx"] }),
    );
    const texts = readSvg(html).texts.filter((x) => x.cls === "legend-text");
    expect(texts).toHaveLength(2);
    expect(texts[1].x + Math.ceil(12 * 0.65 * 15)).toBeLessThanOrEqual(386);
  });

  it("explains the starter charts in the text alternative, which lists the data", () => {
    expect(describeBars(specOf("p4-read-bar-chart"))).toBe(
      "Bar chart: Pets chosen by pupils. The scale goes up in steps of 10 from 0 to 40. Bars: Cats 20, Dogs 35, Fish 15, Birds 40, Mice 25.",
    );
    expect(describeBars(specOf("p4-double-bar-chart"))).toBe(
      "Double bar chart: Pupils in each class. The scale goes up in steps of 10 from 0 to 40. Solid bars show Boys and striped bars show Girls. P4A: Boys 20, Girls 25. P4B: Boys 35, Girls 10. P4C: Boys 15, Girls 35. P4D: Boys 35, Girls 30.",
    );
    expect(describeBars(base("p4-bar-chart-practice", { values: [1] }))).toBe(
      "A bar chart that needs correcting.",
    );
    const broken = barChartsTopic.render({
      ...template("p4-read-bar-chart").lesson,
      specification: { task: "read" },
    });
    expect(broken).toContain("Correct the bar chart");
    expect(broken).not.toContain("<svg");
    // Markup in a label never reaches the picture (the validator rejects it first).
    expect(
      validateBarChartsSpec(
        base("p4-read-bar-chart", {
          labels: ["<b>", "Dogs", "Fish", "Birds", "Mice"],
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe("bar-chart validation", () => {
  it("rejects malformed specifications", () => {
    const cases: [BarChartsSpec | Record<string, unknown>, RegExp][] = [
      [base("p4-read-bar-chart", { task: "nope" as never }), /Unsupported/],
      [base("p4-read-bar-chart", { step: 3 }), /2, 5, 10 or 20/],
      [base("p4-read-bar-chart", { step: 50 }), /2, 5, 10 or 20/],
      [
        base("p4-read-bar-chart", {
          labels: ["A", "B"],
          values: [10, 20],
          a: 0,
          b: 1,
        }),
        /three to six/,
      ],
      [
        base("p4-read-bar-chart", {
          labels: ["A", "B", "C", "D", "E", "F", "G"],
          values: [10, 20, 30, 40, 50, 10, 20],
        }),
        /three to six/,
      ],
      [
        base("p4-read-bar-chart", {
          labels: ["Cats", "cats", "Fish", "Birds", "Mice"],
        }),
        /different/,
      ],
      [
        base("p4-read-bar-chart", {
          labels: ["Cats", "<i>", "Fish", "Birds", "Mice"],
        }),
        /plain labels/,
      ],
      [
        base("p4-read-bar-chart", {
          labels: ["Cats", " ", "Fish", "Birds", "Mice"],
        }),
        /plain labels/,
      ],
      [
        base("p4-read-bar-chart", {
          labels: ["Cats", "Dogs", "Fish", "Birds", "Abcdefghijklm"],
        }),
        /plain labels/,
      ],
      [base("p4-read-bar-chart", { values: [20, 35, 15] }), /first series/],
      [
        base("p4-read-bar-chart", { values: [20, 35.5, 15, 40, 25] }),
        /whole number/,
      ],
      [
        base("p4-read-bar-chart", {
          values: [20, "35" as unknown as number, 15, 40, 25],
        }),
        /whole number/,
      ],
      [
        base("p4-read-bar-chart", { values: [20, -10, 15, 40, 25] }),
        /whole number/,
      ],
      [base("p4-read-bar-chart", { values: [20, 35, 0, 40, 25] }), /zero/],
      [
        base("p4-read-bar-chart", { values: [20, 35, 15, 40, 28] }),
        /multiples/,
      ],
      [
        base("p4-read-bar-chart", { values: [20, 35, 15, 40, 1e9] }),
        /from 1 to/,
      ],
      [
        base("p4-read-bar-chart", { values2: [10, 20, 30, 40, 50] }),
        /second series/,
      ],
      [base("p4-read-bar-chart", { series: ["A", "B"] }), /second series/],
      [{ ...specOf("p4-read-bar-chart"), extra: 1 }, /Unknown/],
      [{ ...specOf("p4-read-bar-chart"), values: "20,35" }, /first series/],
      [{ ...specOf("p4-read-bar-chart"), values2: "x" }, /must be lists/],
      [{ ...specOf("p4-read-bar-chart"), labels: null }, /three to six/],
      [base("p4-read-bar-chart", { a: 9 }), /whole-number positions|exist/],
      [base("p4-read-bar-chart", { a: 1.5 }), /whole-number positions/],
      [base("p4-read-bar-chart", { a: 5, b: 3 }), /exist/],
      [base("p4-read-bar-chart", { a: 2, b: 2 }), /two different labels/],
      [
        base("p4-read-bar-chart", { a: 0, b: 4, values: [20, 35, 15, 40, 20] }),
        /different values/,
      ],
      [
        base("p4-read-bar-chart", {
          quantity: "A very long title that goes on and on",
        }),
        /too long/,
      ],
      [base("p4-read-bar-chart", { quantity: "Pets <b>" }), /plain words/],
      [base("p4-read-bar-chart", { quantity: "" }), /plain words/],
      [
        base("p4-double-bar-chart", { values2: [] }),
        /second series|Only a double|every label a value/,
      ],
      [base("p4-double-bar-chart", { values2: [25, 10, 35] }), /second series/],
      [base("p4-double-bar-chart", { series: ["Boys"] }), /two series/],
      [base("p4-double-bar-chart", { series: ["Boys", "boys"] }), /two series/],
      [base("p4-double-bar-chart", { series: ["Boys", "<b>"] }), /two series/],
      [
        base("p4-double-bar-chart", { values2: [20, 10, 40, 30] }),
        /biggest gap/,
      ],
      [
        base("p4-double-bar-chart", { a: 2, values2: [25, 10, 15, 30] }),
        /must differ/,
      ],
      [base("p4-double-bar-chart", { b: 1 }), /second label/],
      [
        base("p4-bar-chart-practice", { values: [30, 55, 40, 40, 20] }),
        /second and third/,
      ],
      [base("p4-bar-chart-practice", { a: 1 }), /no particular label/],
      [base("p4-bar-chart-practice", { b: 2 }), /no particular label/],
      [null as unknown as Record<string, unknown>, /Expected/],
      [[] as unknown as Record<string, unknown>, /Expected/],
    ];
    for (const [spec, pattern] of cases) {
      const errors = validateBarChartsSpec(spec);
      expect(errors.length, JSON.stringify(spec)).toBeGreaterThan(0);
      expect(errors.join(" | "), JSON.stringify(spec)).toMatch(pattern);
    }
    // The starters themselves are valid.
    for (const form of FORMS)
      expect(validateBarChartsSpec(specOf(form))).toEqual([]);
  });

  it("rejects a step list that contradicts the model", () => {
    const lesson = template("p4-read-bar-chart").lesson;
    lesson.steps[0].answer = "5";
    expect(validateBarChartsSteps(lesson).join(" ")).toMatch(/contradicts/);
    const kind = template("p4-bar-chart-practice").lesson;
    kind.steps[0].kind = "choice";
    expect(validateBarChartsSteps(kind).join(" ")).toMatch(/Response kind/);
    const goals = template("p4-double-bar-chart").lesson;
    goals.steps.reverse();
    expect(validateBarChartsSteps(goals).join(" ")).toMatch(/goal sequence/);
    const meanings = template("p4-double-bar-chart").lesson;
    meanings.steps[2].choices!.find((c) => c.meaning === "other-a")!.meaning =
      "biggest";
    expect(validateBarChartsSteps(meanings).join(" ")).toMatch(
      /each supported meaning/,
    );
    const wrongChoice = template("p4-double-bar-chart").lesson;
    wrongChoice.steps[2].answer = wrongChoice.steps[2].choices!.find(
      (c) => c.meaning === "other-a",
    )!.id;
    expect(validateBarChartsSteps(wrongChoice).join(" ")).toMatch(
      /contradicts/,
    );
    const labels = template("p4-double-bar-chart").lesson;
    labels.steps[2].choices![0].label = "Nowhere";
    expect(validateBarChartsSteps(labels).join(" ")).toMatch(/Gap choices/);
    const broken = template("p4-read-bar-chart").lesson;
    broken.specification = { task: "read" };
    expect(validateBarChartsSteps(broken).length).toBeGreaterThan(0);
  });
});

describe("bar-chart sessions: selection orders, malformed input, hints and modes", () => {
  const adapter = barChartsTopic.adapter;

  it("accepts the gap choice after wrong choices picked in any order", () => {
    const p = template("p4-double-bar-chart");
    const gap = p.lesson.steps.findIndex((s) => s.goal === "gap");
    const wrong = p.lesson.steps[gap]
      .choices!.filter((c) => c.id !== p.lesson.steps[gap].answer)
      .map((c) => c.id);
    const orders = [wrong, [...wrong].reverse(), [wrong[0]], []];
    for (const order of orders) {
      let session = createSession(p.lesson, adapter, "independent");
      for (const step of p.lesson.steps.slice(0, gap)) {
        session = submit(session, p.lesson, adapter, {
          type: "answer",
          value: step.answer,
        });
        session = nextStep(session, p.lesson, adapter);
      }
      for (const id of order) {
        session = submit(session, p.lesson, adapter, {
          type: "answer",
          value: id,
        });
        expect(session.feedback?.outcome).toBe("incorrect");
        expect(session.stepIndex).toBe(gap);
      }
      session = submit(session, p.lesson, adapter, {
        type: "answer",
        value: p.lesson.steps[gap].answer,
      });
      expect(session.feedback?.outcome).toBe("correct");
      expect(
        session.history.filter((h) => h.outcome === "incorrect"),
      ).toHaveLength(order.length);
    }
  });

  it("treats malformed numbers and unsupported actions as not assessable and not counted", () => {
    const p = template("p4-read-bar-chart");
    let session = createSession(p.lesson, adapter, "independent");
    for (const value of [
      "1o",
      "ten",
      "-10",
      "10.5",
      "1e1",
      "",
      "1 0 0 0 0 0",
    ]) {
      const next = submit(session, p.lesson, adapter, {
        type: "answer",
        value,
      });
      expect(["unassessable", "incorrect"]).toContain(next.feedback?.outcome);
      if (next.feedback?.outcome === "unassessable")
        expect(next.submissions).toBe(0);
    }
    for (const type of ["toggle", "drag", "reveal", "", "ANSWER"]) {
      const next = submit(session, p.lesson, adapter, { type, value: "10" });
      expect(next.feedback?.outcome).toBe("unassessable");
      expect(next.feedback?.feedbackKey).toBe("answer.unsupported");
      expect(next.submissions).toBe(0);
      expect(next.history).toEqual([]);
    }
    // Grouped digits are accepted, a wrong number is counted once.
    session = submit(session, p.lesson, adapter, {
      type: "answer",
      value: "20",
    });
    expect(session.feedback?.outcome).toBe("incorrect");
    expect(session.submissions).toBe(1);
    session = submit(session, p.lesson, adapter, {
      type: "answer",
      value: " 10 ",
    });
    expect(session.feedback?.outcome).toBe("correct");
    // Once correct, further submissions change nothing until the next step.
    const frozen = submit(session, p.lesson, adapter, {
      type: "answer",
      value: "99",
    });
    expect(frozen).toBe(session);
  });

  it("records hint rungs, the reveal and mode switches in the history without changing the answers", () => {
    const p = template("p4-bar-chart-practice");
    let session = createSession(p.lesson, adapter, "independent");
    expect(session.hadSupport).toBe(false);
    for (let i = 0; i < 5; i++) session = useHint(session);
    expect(session.hintRung).toBe(4);
    expect(session.hintsUsed).toBe(4);
    expect(session.events.filter((e) => e.type === "reveal")).toHaveLength(1);
    expect(session.hadSupport).toBe(true);
    session = switchMode(session, "guided");
    expect(session.hadFacilitator).toBe(true);
    expect(session.events.at(-1)).toMatchObject({
      type: "mode",
      from: "independent",
      to: "guided",
    });
    session = submit(session, p.lesson, adapter, {
      type: "answer",
      value: "120",
    });
    expect(session.feedback?.outcome).toBe("correct");
    // Hints are no longer available on a correct step, and switching back is recorded.
    expect(useHint(session)).toBe(session);
    session = switchMode(session, "independent");
    expect(session.mode).toBe("independent");
    expect(session.hadFacilitator).toBe(true);
    session = nextStep(session, p.lesson, adapter);
    expect(session.hintRung).toBe(0); // a new step starts with no hint shown
    expect(session.hintsUsed).toBe(4); // the count is kept
    expect(session.history).toHaveLength(1);
  });

  it("never lets the answer ids be guessed from the position", () => {
    const step = template("p4-double-bar-chart").lesson.steps.find(
      (s) => s.goal === "gap",
    )!;
    expect(step.choices).toHaveLength(3);
    expect(step.choices!.map((c) => c.id)).not.toEqual(["k0", "k1", "k2"]);
  });
});

describe("bar-chart author tooling", () => {
  it("offers a form and the right fields for each lesson", () => {
    expect(FORMS).toEqual([
      "p4-read-bar-chart",
      "p4-double-bar-chart",
      "p4-bar-chart-practice",
    ]);
    const keys = (form: string) =>
      barChartsAuthor.fields(template(form).lesson).map((f) => f.key);
    expect(keys("p4-read-bar-chart")).toEqual([
      "quantity",
      "labels",
      "values",
      "step",
      "a",
      "b",
    ]);
    expect(keys("p4-double-bar-chart")).toEqual([
      "quantity",
      "labels",
      "values",
      "values2",
      "series",
      "step",
      "a",
    ]);
    expect(keys("p4-bar-chart-practice")).toEqual([
      "quantity",
      "labels",
      "values",
      "step",
    ]);
    const stepField = barChartsAuthor
      .fields(template("p4-read-bar-chart").lesson)
      .find((f) => f.key === "step")!;
    expect(stepField.options!.map((o) => o.value)).toEqual([
      "2",
      "5",
      "10",
      "20",
    ]);
    expect(() => barChartsAuthor.template("nope", "x")).toThrow();
  });

  it("keeps edits coherent and malformed text editable", () => {
    const model = createAuthorModel(template("p4-read-bar-chart"));
    const spec = () =>
      model.working.lesson.specification as unknown as BarChartsSpec;
    const errors = () => model.issues.filter((i) => i.severity === "error");
    model.patch({ kind: "topic", key: "values", value: "20, 30, 15, 45, 25" });
    expect(spec().values).toEqual([20, 30, 15, 45, 25]);
    expect(errors()).toEqual([]);
    expect(model.working.lesson.steps[1].answer).toBe("30");
    expect(model.working.lesson.steps[2].answer).toBe("75");
    model.patch({ kind: "topic", key: "values", value: "20, 30, x, 45, 25" });
    expect(spec().values).toEqual(["20", "30", "x", "45", "25"]);
    expect(errors().length).toBeGreaterThan(0);
    model.patch({ kind: "topic", key: "values", value: "20, 30, 0, 45, 25" });
    expect(errors().length).toBeGreaterThan(0);
    model.patch({ kind: "topic", key: "values", value: "20, 30, 15, 45, 25" });
    expect(errors()).toEqual([]);
    model.patch({ kind: "topic", key: "step", value: "5" });
    expect(spec().step).toBe(5);
    expect(errors()).toEqual([]); // every value is a multiple of 5 and 45 is under the cap of 50
    expect(model.working.lesson.steps[0].answer).toBe("5");
    model.patch({ kind: "topic", key: "step", value: "2" });
    expect(
      errors()
        .map((e) => e.message)
        .join(" "),
    ).toMatch(/from 1 to 20/); // 45 is over the cap of 20
  });

  it("changes of step, labels and asked bars rewrite answers and wording", () => {
    const model = createAuthorModel(template("p4-read-bar-chart"));
    model.patch({ kind: "topic", key: "step", value: "20" });
    expect(
      model.issues.filter((i) => i.severity === "error").length,
    ).toBeGreaterThan(0); // 35 is not a multiple of the grain 10
    expect(model.working.lesson.steps[0].answer).toBe("10"); // answers wait for a valid chart
    model.patch({ kind: "topic", key: "values", value: "40, 60, 20, 80, 30" });
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(model.working.lesson.steps[0].answer).toBe("20");
    model.patch({
      kind: "topic",
      key: "labels",
      value: "Ant, Bee, Cat, Dog, Elk",
    });
    model.applyWording();
    expect(model.working.lesson.steps[1].prompt).toContain("Bee bar");
    expect(model.working.lesson.steps[1].answer).toBe("60");
    model.patch({ kind: "topic", key: "b", value: "4" });
    model.applyWording();
    expect(model.working.lesson.steps[2].answer).toBe("90");
    model.patch({ kind: "topic", key: "b", value: "1" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    model.patch({ kind: "topic", key: "quantity", value: "Bugs <b>" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);

    const double = createAuthorModel(template("p4-double-bar-chart"));
    double.patch({ kind: "topic", key: "values2", value: "25, 5, 40, 30" });
    expect(double.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(double.working.lesson.steps[0].answer).toBe("40");
    double.patch({ kind: "topic", key: "series", value: "Reds, Blues" });
    double.applyWording();
    expect(double.working.lesson.steps[0].prompt).toContain("Blues bar");
    double.patch({ kind: "topic", key: "series", value: "Reds" });
    expect(double.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("rewrite keeps the authored reflection and restores wording and answers", () => {
    const lesson = template("p4-double-bar-chart").lesson;
    const reflection = lesson.steps.at(-1)!;
    const edited = structuredClone(lesson);
    edited.steps[0].prompt = "stale";
    edited.steps[1].answer = "1";
    edited.steps.at(-1)!.hints[0] = "My own hint";
    const fixed = barChartsAuthor.rewrite(edited);
    expect(fixed.steps[0].prompt).toBe(lesson.steps[0].prompt);
    expect(fixed.steps[1].answer).toBe("20");
    expect(fixed.steps.at(-1)!.hints[0]).toBe("My own hint");
    expect(fixed.steps.at(-1)!.answer).toBe(reflection.answer);
    expect(barChartsAuthor.derive(edited).steps[1].answer).toBe("20");
    // An invalid specification is left alone by rewrite and derive.
    const broken = structuredClone(lesson);
    broken.specification = { task: "double" };
    expect(barChartsAuthor.rewrite(broken).steps).toEqual(broken.steps);
  });
});
