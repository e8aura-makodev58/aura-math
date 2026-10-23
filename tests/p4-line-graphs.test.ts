import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { lineGraphsAuthor } from "../src/authoring/line-graphs";
import {
  grainOf,
  lineGraphsAnswer,
  lineGraphsTopic,
  validateLineGraphsSpec,
  validateLineGraphsSteps,
  type LineGraphsSpec,
} from "../src/topics/line-graphs";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";

const template = (form: string) => lineGraphsAuthor.template(form, `${form}-t`);
const expected: Record<string, Record<string, string>> = {
  "p4-read-line-graph": { scale: "10", read: "25" },
  "p4-line-graph-change": { read: "15", difference: "35" },
  "p4-line-graph-target": { total: "100" },
  "p4-line-graph-practice": { spread: "35" },
};
// A small seeded generator keeps the property sweep reproducible.
function rng(seed: number) {
  let x = seed;
  return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

describe("line-graph packages", () => {
  for (const form of lineGraphsAuthor.forms) {
    it(`${form.id}: validates, matches the oracle and completes in both modes`, () => {
      const p = template(form.id);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      for (const [id, value] of Object.entries(expected[form.id]))
        expect(p.lesson.steps.find((s) => s.id === id)!.answer).toBe(value);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, lineGraphsTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          expect(step.hints).toHaveLength(4);
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, lineGraphsTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, lineGraphsTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, lineGraphsTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });
  }

  it("matches independent oracles on randomly generated valid graphs", () => {
    const random = rng(7);
    let checked = 0;
    for (let round = 0; round < 400; round++) {
      const task = (["read", "change", "threshold", "practice"] as const)[
        round % 4
      ];
      const step = ([5, 10, 20] as const)[Math.floor(random() * 3)];
      const n = 4 + Math.floor(random() * 4);
      const grain = grainOf(step);
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(
        0,
        n,
      );
      const values = labels.map(
        () => grain * Math.floor(random() * (Math.floor(100 / grain) + 1)),
      );
      const spec: LineGraphsSpec = {
        task,
        labels,
        values,
        step,
        quantity: "things",
        a: Math.floor(random() * n),
        b: Math.floor(random() * n),
        target: grain * Math.floor(random() * 10),
      };
      if (validateLineGraphsSpec(spec).length) continue;
      const lesson = lineGraphsAuthor.rewrite({
        ...template(
          `p4-${task === "read" ? "read-line-graph" : task === "change" ? "line-graph-change" : task === "threshold" ? "line-graph-target" : "line-graph-practice"}`,
        ).lesson,
        specification: spec as unknown as Record<string, unknown>,
      });
      expect(validateLineGraphsSteps(lesson), JSON.stringify(spec)).toEqual([]);
      for (const stepDef of lesson.steps) {
        if (stepDef.goal === "reflection") continue;
        const answer = stepDef.answer;
        if (stepDef.goal === "read")
          expect(answer).toBe(String(values[spec.a]));
        if (stepDef.goal === "difference")
          expect(answer).toBe(
            String(Math.abs(values[spec.a] - values[spec.b])),
          );
        if (stepDef.goal === "scale") expect(answer).toBe(String(step));
        if (stepDef.goal === "spread")
          expect(answer).toBe(
            String(
              [...values].sort((x, y) => y - x)[0] -
                [...values].sort((x, y) => x - y)[0],
            ),
          );
        if (stepDef.goal === "total") {
          let sum = 0;
          for (const v of values) if (v > spec.target) sum += v;
          expect(answer).toBe(String(sum));
        }
        if (stepDef.goal === "biggest-rise") {
          let best = -Infinity,
            at = -1;
          for (let i = 0; i + 1 < n; i++)
            if (values[i + 1] - values[i] > best) {
              best = values[i + 1] - values[i];
              at = i;
            }
          const chosen = stepDef.choices!.find((c) => c.id === answer)!;
          expect(chosen.label).toBe(`${labels[at]} to ${labels[at + 1]}`);
        }
        if (stepDef.goal === "above") {
          const names = (answer as string[]).map(
            (id) => stepDef.choices!.find((c) => c.id === id)!.label,
          );
          // The options are shown in a rotated order, so compare as sets.
          expect([...names].sort()).toEqual(
            labels.filter((_, i) => values[i] > spec.target).sort(),
          );
        }
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("rejects malformed graphs", () => {
    const good = (over: Partial<LineGraphsSpec> = {}): LineGraphsSpec => ({
      ...(template("p4-read-line-graph").lesson
        .specification as unknown as LineGraphsSpec),
      ...over,
    });
    const cases: [Partial<LineGraphsSpec>, RegExp][] = [
      [{ values: [20, 35, 25] }, /one whole-number value/],
      [{ labels: ["A", "B", "C"] }, /four to seven/],
      [{ labels: ["Mon", "Mon", "Wed", "Thu", "Fri"] }, /different/],
      [{ labels: ["Mon", "<b>", "Wed", "Thu", "Fri"] }, /four to seven/],
      [{ values: [20, 35, 25, 45, 31] }, /multiples of 5/],
      [{ values: [20, 35, 25, 45, 101] }, /one whole-number/],
      [{ step: 7 as 5 }, /5, 10 or 20/],
      [{ a: 2, b: 2 }, /different points/],
      [{ a: 0, b: 9 }, /Points and target|exist/],
      [{ values: [20, 20, 25, 45, 30], a: 0, b: 1 }, /different values/],
      [{ step: 5, values: [20, 35, 25, 70, 30] }, /Too many gridlines/],
      [{ quantity: "" }, /plain words/],
    ];
    for (const [over, pattern] of cases)
      expect(
        validateLineGraphsSpec(good(over)).join(" "),
        JSON.stringify(over),
      ).toMatch(pattern);
    const change = (over: Partial<LineGraphsSpec>) => ({
      ...(template("p4-line-graph-change").lesson
        .specification as unknown as LineGraphsSpec),
      ...over,
    });
    expect(
      validateLineGraphsSpec(change({ values: [15, 30, 45, 50, 35] })).join(
        " ",
      ),
    ).toMatch(/clearly biggest rise/);
    expect(
      validateLineGraphsSpec(change({ values: [50, 40, 30, 20, 10] })).join(
        " ",
      ),
    ).toMatch(/clearly biggest rise/);
    const target = (over: Partial<LineGraphsSpec>) => ({
      ...(template("p4-line-graph-target").lesson
        .specification as unknown as LineGraphsSpec),
      ...over,
    });
    expect(validateLineGraphsSpec(target({ target: 100 })).join(" ")).toMatch(
      /Some, but not all/,
    );
    expect(validateLineGraphsSpec(target({ target: 0 })).join(" ")).toMatch(
      /Some, but not all/,
    );
    expect(
      validateLineGraphsSpec(target({ values: [25, 40, 55, 55, 45, 30] })).join(
        " ",
      ),
    ).toMatch(/one highest/);
    expect(validateLineGraphsSpec(null)).not.toEqual([]);
    expect(validateLineGraphsSpec({ ...good(), extra: 1 })).toContain(
      "Unknown line-graph field",
    );
  });

  it("draws gridlines, ticks and points; the scale task labels only the ends", () => {
    const read = lineGraphsTopic.render(template("p4-read-line-graph").lesson);
    expect(read).toContain("<polyline");
    expect((read.match(/<circle/g) ?? []).length).toBe(5);
    const yLabels = (html: string) =>
      [
        ...html.matchAll(
          /text-anchor="end" dominant-baseline="central"[^>]*>(\d+)</g,
        ),
      ].map((m) => m[1]);
    expect(yLabels(read)).toEqual(["0", "50"]);
    const change = lineGraphsTopic.render(
      template("p4-line-graph-change").lesson,
    );
    expect(yLabels(change).length).toBeGreaterThan(2);
    const target = lineGraphsTopic.render(
      template("p4-line-graph-target").lesson,
    );
    expect(target).toContain("stroke-dasharray");
  });

  it("keeps the readings in the text alternative only, not on screen", () => {
    const read = template("p4-read-line-graph");
    const html = lineGraphsTopic.render(read.lesson);
    const onScreen = html.replace(/aria-label="[^"]*"/, "");
    // The point values never appear as drawn text; only axis numbers and day labels do.
    for (const v of [25, 35, 45])
      expect(onScreen).not.toMatch(new RegExp(`>${v}<`));
    expect(html).toContain("Wed 25");
  });

  it("derives the practice interpretation and survives author edits", () => {
    const p = template("p4-line-graph-practice");
    expect(p.interpretation!.quantities.map((q) => q.value)).toEqual([
      60, 25, 35,
    ]);
    const model = createAuthorModel(p);
    model.patch({ kind: "topic", key: "values", value: "35, 70, 45, 20, 50" });
    expect(model.working.lesson.specification.values).toEqual([
      35, 70, 45, 20, 50,
    ]);
    expect(model.working.lesson.steps[0].answer).toBe("50");
    model.patch({ kind: "topic", key: "values", value: "35, 7x, 45, 20, 50" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    const read = createAuthorModel(template("p4-read-line-graph"));
    read.patch({ kind: "topic", key: "step", value: "20" });
    expect(
      lineGraphsAnswer(
        read.working.lesson.specification as unknown as LineGraphsSpec,
        read.working.lesson.steps[0],
      ),
    ).toBe("20");
  });
});
