import { describe, expect, it } from "vitest";
import {
  fractionsTopic,
  fractionsAnswer,
  validateFractionsSpec,
  type FractionsSpec,
} from "../src/topics/fractions";
import {
  pictureGraphsTopic,
  pictureGraphsAnswer,
  validatePictureGraphsSpec,
  type PictureGraphsSpec,
} from "../src/topics/picture-graphs";
import { fractionsAuthor } from "../src/authoring/fractions";
import { pictureGraphsAuthor } from "../src/authoring/picture-graphs";
import { createSession, submit, nextStep, useHint } from "../src/core/runtime";
import type { Lesson, Step } from "../src/core/types";
import type { LessonPackage } from "../src/content/package-validation";
import equalParts from "../content/lessons/equal-parts.json";
import named from "../content/lessons/name-the-fraction.json";
import compared from "../content/lessons/compare-same-whole.json";
import read from "../content/lessons/read-the-key.json";
import categories from "../content/lessons/compare-categories.json";
import total from "../content/lessons/graph-total.json";
const packages = [
  equalParts,
  named,
  compared,
  read,
  categories,
  total,
] as unknown as LessonPackage[];
// Explicit expectations are independently authored, rather than returned by production derivation.
const expected: Record<string, (string | number)[]> = {
  "equal-parts": ["p2", 4, 1, "r3"],
  "name-the-fraction": [4, 3, "f2", "r3"],
  "compare-same-whole": [1, 1, "c2", "r3"],
  "read-the-key": [2, 4, 8, "q6"],
  "compare-categories": [5, "g4", 0, "q6"],
  "graph-total": [5, 15, 45, "q6"],
};
const topic = (l: Lesson) =>
  l.topic === "fractions" ? fractionsTopic : pictureGraphsTopic;
const author = (l: Lesson) =>
  l.topic === "fractions" ? fractionsAuthor : pictureGraphsAuthor;
describe("six original visual topic packages", () => {
  for (const p of packages) {
    it(`${p.lesson.id}: coherent model, original fields and independent answer fixtures`, () => {
      expect(topic(p.lesson).validateSpec(p.lesson.specification)).toEqual([]);
      expect(topic(p.lesson).validateSteps(p.lesson)).toEqual([]);
      expect(p.lesson.steps.map((st) => st.answer)).toEqual(
        expected[p.lesson.id],
      );
      expect(p.library?.skillId).toBe(p.lesson.id);
      expect(
        p.lesson.steps.every(
          (st) => st.hints.length === 4 && st.hints.every((h) => h.length > 5),
        ),
      ).toBe(true);
      expect(p.fixtures).toHaveLength(p.lesson.steps.length);
      expect(
        p.fixtures!.every(
          (f) => f.accepted.length === 1 && f.rejected.length === 2,
        ),
      ).toBe(true);
      expect(p.lesson.steps.flatMap((st) => st.hints).join(" ")).not.toMatch(
        /cross.?product/i,
      );
    });
    for (const mode of ["independent", "guided"] as const)
      it(`${p.lesson.id}: complete ${mode} trace, all hint rungs and two invalid answers per step`, () => {
        const adapter = topic(p.lesson).adapter;
        let session = createSession(p.lesson, adapter, mode);
        for (const [index, st] of p.lesson.steps.entries()) {
          expect(session.state.answer).toBeUndefined();
          for (let rung = 1; rung <= 4; rung++) {
            session = useHint(session);
            expect(session.hintRung).toBe(rung);
          }
          for (const bad of p.fixtures![index].rejected) {
            session = submit(session, p.lesson, adapter, {
              type: "answer",
              value: bad,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
            expect(nextStep(session, p.lesson, adapter).stepIndex).toBe(index);
          }
          session = submit(session, p.lesson, adapter, {
            type: "answer",
            value: expected[p.lesson.id][index],
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, adapter);
          expect(st.goal).toBe(st.id);
        }
        expect(session.completed).toBe(true);
        expect(session.events.filter((e) => e.type === "reveal")).toHaveLength(
          4,
        );
      });
    it(`${p.lesson.id}: unsupported and malformed actions preserve state`, () => {
      const adapter = topic(p.lesson).adapter;
      const state = adapter.initialState(p.lesson);
      const original = structuredClone(state);
      expect(
        adapter.apply(state, { type: "make-correct", value: true }),
      ).toEqual({ state, outcome: "unassessable" });
      for (const value of [null, {}, NaN, Infinity, [1]])
        expect(adapter.apply(state, { type: "answer", value }).outcome).toBe(
          "rejected",
        );
      expect(state).toEqual(original);
    });
    it(`${p.lesson.id}: ordinary author fields retain invalid partial input without changing original`, () => {
      const a = author(p.lesson),
        field = a.fields(p.lesson).find((f) => f.type === "number")!;
      const partial = a.patch(p.lesson, field.key, "-");
      expect(a.fields(partial).find((f) => f.key === field.key)?.value).toBe(
        "-",
      );
      expect(
        topic(p.lesson).validateSpec(partial.specification).length,
      ).toBeGreaterThan(0);
      expect(a.derive(partial).steps).toEqual(p.lesson.steps);
      const fixed = a.patch(partial, field.key, field.value);
      expect(topic(p.lesson).validateSpec(fixed.specification)).toEqual([]);
      expect(topic(p.lesson).validateSteps(a.rewrite(fixed))).toEqual([]);
      expect(p.lesson.steps.map((st) => st.answer)).toEqual(
        expected[p.lesson.id],
      );
    });
  }
});
function rect(id: string, d: number, n: number) {
  return {
    id,
    label: `Rectangle ${id}`,
    width: 120,
    height: 60,
    widths: Array.from({ length: d }, () => 120 / d),
    shaded: Array.from({ length: n }, (_, i) => i),
  };
}
function choice(goal: string): Step {
  return {
    id: goal,
    goal,
    title: "Test",
    prompt: "Test",
    kind: "choice",
    answer: "opaque-a",
    choices: [
      { id: "opaque-c", label: "same", meaning: "relation:same" },
      { id: "opaque-b", label: "right", meaning: "relation:right" },
      { id: "opaque-a", label: "left", meaning: "relation:left" },
    ],
    hints: ["one", "two", "three", "four"],
  };
}
describe("fractions exact geometry and independent area oracle", () => {
  it("recovers valid whole dimensions after partial or zero width input", () => {
    const l = fractionsAuthor.template(
      "name-the-fraction",
      "width-recovery",
    ).lesson;
    for (const bad of ["-", 0]) {
      const partial = fractionsAuthor.patch(l, "width", bad);
      expect(
        fractionsTopic.validateSpec(partial.specification).length,
      ).toBeGreaterThan(0);
      const repaired = fractionsAuthor.patch(partial, "width", 120);
      expect(fractionsTopic.validateSpec(repaired.specification)).toEqual([]);
    }
  });

  it("rewrites every proper half, third and quarter without equivalent or whole distractors", () => {
    for (const d of [2, 3, 4])
      for (let n = 1; n < d; n++) {
        const l = fractionsAuthor.template(
          "name-the-fraction",
          "fraction-boundary",
        ).lesson;
        l.specification = { task: "name", wholes: [rect("a", d, n)] };
        const rewritten = fractionsAuthor.rewrite(l);
        expect(fractionsTopic.validateSteps(rewritten)).toEqual([]);
        const options = rewritten.steps.find(
          (st) => st.goal === "fraction",
        )!.choices!;
        for (const c of options.filter((c) => c.id !== "f2")) {
          const [pn, pd] = c.meaning!.split(":")[1].split("/").map(Number);
          expect(pn).toBeLessThan(pd);
          expect(pn * d).not.toBe(n * pd);
        }
      }
  });
  it("preserves imported whole dimensions during denominator edits", () => {
    const l = fractionsAuthor.template(
      "name-the-fraction",
      "fraction-import",
    ).lesson;
    l.specification = {
      task: "name",
      wholes: [{ ...rect("a", 4, 1), width: 96, widths: [24, 24, 24, 24] }],
    };
    const patched = fractionsAuthor.patch(l, "a.denominator", 3);
    expect(fractionsTopic.validateSpec(patched.specification)).toEqual([]);
    expect(
      (patched.specification as unknown as FractionsSpec).wholes[0].widths,
    ).toEqual([32, 32, 32]);
  });

  it("supports every permitted like fraction and unit-fraction pair with exact whole area", () => {
    for (const da of [2, 3, 4])
      for (const db of [2, 3, 4])
        for (let na = 1; na < da; na++)
          for (let nb = 1; nb < db; nb++) {
            const s: FractionsSpec = {
              task: "compare",
              wholes: [rect("a", da, na), rect("b", db, nb)],
            };
            const permitted = da === db || (na === 1 && nb === 1);
            expect(validateFractionsSpec(s).length === 0).toBe(permitted);
            if (!permitted) continue;
            const [a, b] = s.wholes;
            const leftArea = a.shaded.reduce(
              (sum, i) => sum + a.widths[i] * a.height,
              0,
            );
            const rightArea = b.shaded.reduce(
              (sum, i) => sum + b.widths[i] * b.height,
              0,
            );
            expect(fractionsAnswer(s, choice("compare"))).toBe(
              leftArea > rightArea
                ? "opaque-a"
                : leftArea < rightArea
                  ? "opaque-b"
                  : "opaque-c",
            );
          }
  });
  it.each([
    [
      "missing coverage",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [20, 20];
      },
    ],
    [
      "negative partition",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [-20, 140];
      },
    ],
    [
      "zero partition",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [0, 120];
      },
    ],
    [
      "fractional partition",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [59.5, 60.5];
      },
    ],
    [
      "unsupported denominator",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [24, 24, 24, 24, 24];
      },
    ],
    [
      "unequal fractional parts",
      (s: FractionsSpec) => {
        s.wholes[0].widths = [50, 70];
      },
    ],
    [
      "duplicate shaded indices",
      (s: FractionsSpec) => {
        s.wholes[1].shaded = [0, 0];
      },
    ],
    [
      "out-of-range shaded index",
      (s: FractionsSpec) => {
        s.wholes[0].shaded = [2];
      },
    ],
    [
      "empty numerator",
      (s: FractionsSpec) => {
        s.wholes[0].shaded = [];
      },
    ],
    [
      "whole shaded",
      (s: FractionsSpec) => {
        s.wholes[0].shaded = [0, 1];
      },
    ],
    [
      "different whole size",
      (s: FractionsSpec) => {
        s.wholes[1].height = 50;
      },
    ],
    [
      "duplicate whole IDs",
      (s: FractionsSpec) => {
        s.wholes[1].id = "a";
      },
    ],
  ] as const)("rejects %s", (_name, change) => {
    const s: FractionsSpec = {
      task: "compare",
      wholes: [rect("a", 2, 1), rect("b", 4, 1)],
    };
    change(s);
    expect(validateFractionsSpec(s).length).toBeGreaterThan(0);
  });
  it("rejects equal-parts models with zero or multiple equal examples", () => {
    const l = fractionsAuthor.template("equal-parts", "draft-parts").lesson;
    const s = l.specification as unknown as FractionsSpec;
    s.wholes[0].widths = [60, 60];
    expect(validateFractionsSpec(s).length).toBeGreaterThan(0);
    s.wholes[0].widths = [50, 70];
    s.wholes[1].widths = [20, 30, 30, 40];
    expect(validateFractionsSpec(s).length).toBeGreaterThan(0);
  });
  it("describes measurements as a reasoning route without labelling an option correct", () => {
    const l = equalParts.lesson as unknown as Lesson;
    const description = fractionsTopic.adapter.describe(
      fractionsTopic.adapter.initialState(l),
    );
    expect(description).toContain("50, 70");
    expect(description).toContain("30, 30, 30, 30");
    expect(description).not.toMatch(/correct|incorrect|unequal|answer/i);
    expect(fractionsTopic.render(l)).toContain("aria-label=");
  });
  it("binds choices to validated models and rejects answer changes or missing goals", () => {
    const l = structuredClone(named.lesson) as unknown as Lesson;
    l.steps[2].answer = "f9";
    expect(fractionsTopic.validateSteps(l).length).toBeGreaterThan(0);
    l.steps[2].answer = "f2";
    l.steps[2].choices![0].meaning = "fraction:3/3";
    expect(fractionsTopic.validateSteps(l).length).toBeGreaterThan(0);
    l.steps.splice(0, 1);
    expect(fractionsTopic.validateSteps(l).length).toBeGreaterThan(0);
  });
  it("updates name/compare wording, hints and numeric answers as one coherent author rewrite", () => {
    const start = fractionsAuthor.template(
      "name-the-fraction",
      "draft-name",
    ).lesson;
    const updated = fractionsAuthor.rewrite(
      fractionsAuthor.patch(start, "a.numerator", 2),
    );
    expect(
      updated.steps
        .find((st) => st.id === "fraction")
        ?.choices?.find((c) => c.id === "f2")?.label,
    ).toBe("2/4");
    expect(fractionsTopic.validateSteps(updated)).toEqual([]);
    const compare = fractionsAuthor.template(
      "compare-same-whole",
      "draft-compare",
    ).lesson;
    const renamed = fractionsAuthor.rewrite(
      fractionsAuthor.patch(compare, "a.label", "Whole One"),
    );
    expect(renamed.steps[0].prompt).toContain("Whole One");
    expect(
      renamed.steps[2].choices?.find((c) => c.meaning === "relation:left")
        ?.label,
    ).toBe("Whole One");
  });
});
describe("picture graphs scale and independent repeated-addition oracle", () => {
  it("symbol hint names symbols while the quantity hint names scaled items", () => {
    const l = pictureGraphsAuthor.template(
      "read-the-key",
      "graph-hints",
    ).lesson;
    expect(l.steps.find((st) => st.goal === "symbols")!.hints[3]).toContain(
      "4 full symbols",
    );
    expect(l.steps.find((st) => st.goal === "symbols")!.hints[3]).not.toContain(
      "items",
    );
    expect(l.steps.find((st) => st.goal === "quantity")!.hints[3]).toContain(
      "8 items",
    );
  });

  it("includes every count, zero, tie and maximum for keys 2 and 5", () => {
    for (const key of [2, 5])
      for (let ca = 0; ca <= 6; ca++)
        for (let cb = 0; cb <= 6; cb++) {
          const s: PictureGraphsSpec = {
            task: "compare",
            key,
            categories: [
              { id: "a", label: "A", count: ca },
              { id: "b", label: "B", count: cb },
            ],
            target: "a",
            other: "b",
          };
          expect(validatePictureGraphsSpec(s)).toEqual([]);
          const a = Array.from({ length: ca }, () => key).reduce(
              (sum, x) => sum + x,
              0,
            ),
            b = Array.from({ length: cb }, () => key).reduce(
              (sum, x) => sum + x,
              0,
            );
          const st = choice("compare");
          st.choices!.forEach((c) => {
            c.meaning = c
              .meaning!.replace("left", "target")
              .replace("right", "other");
          });
          expect(pictureGraphsAnswer(s, st)).toBe(
            a > b ? "opaque-a" : a < b ? "opaque-b" : "opaque-c",
          );
          expect(
            pictureGraphsAnswer(s, {
              ...st,
              id: "difference",
              goal: "difference",
            }),
          ).toBe(Math.max(a, b) - Math.min(a, b));
          expect(
            pictureGraphsAnswer(s, { ...st, id: "quantity", goal: "quantity" }),
          ).toBe(a);
        }
  });
  it.each([
    [
      "fractional symbols",
      (s: PictureGraphsSpec) => {
        s.categories[0].count = 0.5;
      },
    ],
    [
      "negative symbols",
      (s: PictureGraphsSpec) => {
        s.categories[0].count = -1;
      },
    ],
    [
      "too many symbols",
      (s: PictureGraphsSpec) => {
        s.categories[0].count = 7;
      },
    ],
    [
      "duplicate category ID",
      (s: PictureGraphsSpec) => {
        s.categories[1].id = "apples";
      },
    ],
    [
      "duplicate label",
      (s: PictureGraphsSpec) => {
        s.categories[1].label = "Apples";
      },
    ],
    [
      "missing target",
      (s: PictureGraphsSpec) => {
        s.target = "missing";
      },
    ],
    [
      "same compared row",
      (s: PictureGraphsSpec) => {
        s.other = s.target;
      },
    ],
    [
      "unsupported scale",
      (s: PictureGraphsSpec) => {
        s.key = 3;
      },
    ],
    [
      "scale one comparison",
      (s: PictureGraphsSpec) => {
        s.key = 1;
        s.introductory = true;
      },
    ],
  ] as const)("rejects %s", (_name, change) => {
    const s = structuredClone(
      categories.lesson.specification,
    ) as unknown as PictureGraphsSpec;
    change(s);
    expect(validatePictureGraphsSpec(s).length).toBeGreaterThan(0);
  });
  it("allows key 1 only for explicit introductory reading", () => {
    const s = structuredClone(
      read.lesson.specification,
    ) as unknown as PictureGraphsSpec;
    s.key = 1;
    expect(validatePictureGraphsSpec(s).length).toBeGreaterThan(0);
    s.introductory = true;
    expect(validatePictureGraphsSpec(s)).toEqual([]);
  });
  it("includes zero rows and key in the description but never reveals a category quantity", () => {
    const l = total.lesson as unknown as Lesson;
    const text = pictureGraphsTopic.adapter.describe(
      pictureGraphsTopic.adapter.initialState(l),
    );
    expect(text).toContain("5 items");
    expect(text).toContain("Plums: 0 full symbols");
    expect(text).not.toContain("45");
  });
  it("keeps symbol counts distinct from scaled quantities", () => {
    const l = read.lesson as unknown as Lesson;
    const st = l.steps.find((st) => st.goal === "quantity")!;
    const state = pictureGraphsTopic.adapter.initialState(l);
    expect(
      pictureGraphsTopic.adapter.evaluate({ ...state, answer: 4 }, st).outcome,
    ).toBe("incorrect");
    expect(
      pictureGraphsTopic.adapter.evaluate({ ...state, answer: 8 }, st).outcome,
    ).toBe("correct");
  });
  it("updates key and category wording coherently, preserving reflection", () => {
    const original = pictureGraphsAuthor.template(
      "read-the-key",
      "draft-read",
    ).lesson;
    let next = pictureGraphsAuthor.patch(original, "key", 5);
    next = pictureGraphsAuthor.patch(next, "apples.label", "Books");
    next = pictureGraphsAuthor.rewrite(next);
    expect(pictureGraphsTopic.validateSteps(next)).toEqual([]);
    expect(next.steps.find((st) => st.goal === "quantity")?.answer).toBe(20);
    expect(next.steps.find((st) => st.goal === "quantity")?.prompt).toContain(
      "Books",
    );
    expect(next.steps.at(-1)).toEqual(original.steps.at(-1));
  });
  it("escapes model labels in renderers", () => {
    const g = structuredClone(read.lesson) as unknown as Lesson;
    (g.specification as unknown as PictureGraphsSpec).categories[0].label =
      '<img onerror="oops">';
    expect(pictureGraphsTopic.render(g)).not.toContain("<img");
    const f = structuredClone(named.lesson) as unknown as Lesson;
    (f.specification as unknown as FractionsSpec).wholes[0].label =
      "<script>oops</script>";
    expect(fractionsTopic.render(f)).not.toContain("<script>");
  });
});
