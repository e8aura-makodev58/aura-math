import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { wholeNumbersAuthor } from "../src/authoring/whole-numbers";
import {
  digitAt,
  factorOptions,
  factorsOf,
  roundedTo,
  validateWholeNumbersSpec,
  wholeNumbersTopic,
  type WholeNumbersSpec,
} from "../src/topics/whole-numbers";
import { parseWhole } from "../src/topics/p4-kit";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";

const base = (over: Partial<WholeNumbersSpec> = {}): WholeNumbersSpec => ({
  task: "place-value",
  n: 47308,
  m: 47380,
  place: "ten-thousands",
  roundTo: 100,
  unit: "stickers",
  ...over,
});
const template = (form: string) =>
  wholeNumbersAuthor.template(form, `${form}-test`);

// Independent oracles: written separately from the production functions.
const roundOracle = (n: number, step: number) =>
  Math.floor(n / step + 0.5) * step;
const factorOracle = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((k) => n % k === 0);
const valueOracle = (n: number, placeIndexFromRight: number) =>
  Number(String(n)[String(n).length - 1 - placeIndexFromRight]) *
  10 ** placeIndexFromRight;

describe("whole-number packages", () => {
  const expected: Record<string, string[]> = {
    "p4-place-value-100k": ["digit-value=40000"],
    "p4-rounding": ["rounded=4600"],
    "p4-factors": ["count=9"],
    "p4-estimate-by-rounding": ["estimate=3800"],
  };
  for (const form of wholeNumbersAuthor.forms) {
    it(`${form.id}: validates, matches the oracle and completes in both modes`, () => {
      const p = template(form.id);
      const checked = validatePackage(JSON.parse(JSON.stringify(p)));
      expect(checked.issues.filter((i) => i.severity === "error")).toEqual([]);
      for (const want of expected[form.id]) {
        const [id, value] = want.split("=");
        expect(p.lesson.steps.find((s) => s.id === id)!.answer).toBe(value);
      }
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, wholeNumbersTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          expect(step.hints).toHaveLength(4);
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, wholeNumbersTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, wholeNumbersTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, wholeNumbersTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });
  }

  it("derives place values, rounding and factors from independent oracles over many numbers", () => {
    for (let n = 10000; n <= 99999; n += 331) {
      const places = [
        "ones",
        "tens",
        "hundreds",
        "thousands",
        "ten-thousands",
      ] as const;
      places.forEach((place, k) =>
        expect(digitAt(n, place) * 10 ** k).toBe(valueOracle(n, k)),
      );
    }
    for (const step of [10, 100, 1000])
      for (let n = step + 1; n < 20000; n += 37)
        expect(roundedTo(n, step)).toBe(roundOracle(n, step));
    // Halfway rounds up, and the boundaries on either side behave.
    expect(roundedTo(4650, 100)).toBe(4700);
    expect(roundedTo(4649, 100)).toBe(4600);
    expect(roundedTo(4651, 100)).toBe(4700);
    expect(roundedTo(15, 10)).toBe(20);
    expect(roundedTo(9995, 10)).toBe(10000);
    for (let n = 12; n <= 60; n++)
      expect(factorsOf(n)).toEqual(factorOracle(n));
  });

  it("offers three genuine factors and one non-factor for every allowed number", () => {
    for (let n = 12; n <= 60; n++) {
      if (factorOracle(n).length < 5) continue;
      const { factors, notFactor } = factorOptions(n);
      expect(factors).toHaveLength(3);
      for (const f of factors) expect(n % f).toBe(0);
      expect(n % notFactor).not.toBe(0);
    }
  });

  it("accepts grouped input but treats malformed syntax as unassessable without an attempt", () => {
    expect(parseWhole("4600")?.numerator).toBe(4600);
    expect(parseWhole("4 600")?.numerator).toBe(4600);
    expect(parseWhole("4,600")?.numerator).toBe(4600);
    expect(parseWhole("40\u00a0000")?.numerator).toBe(40000);
    for (const bad of [
      "",
      "4 60",
      "4,60",
      "46.0",
      "-5",
      "1e3",
      "4600 cm",
      "four",
      "4600+1",
      "0x10",
      "1,2345",
    ])
      expect(parseWhole(bad), bad).toBeNull();
    const p = template("p4-rounding");
    const l = p.lesson;
    let session = createSession(l, wholeNumbersTopic.adapter);
    for (const step of l.steps.slice(0, 2)) {
      session = submit(session, l, wholeNumbersTopic.adapter, {
        type: "answer",
        value: step.answer,
      });
      session = nextStep(session, l, wholeNumbersTopic.adapter);
    }
    const before = session.submissions;
    session = submit(session, l, wholeNumbersTopic.adapter, {
      type: "answer",
      value: "4,6o0",
    });
    expect(session.feedback?.outcome).toBe("unassessable");
    expect(session.submissions).toBe(before);
    session = submit(session, l, wholeNumbersTopic.adapter, {
      type: "answer",
      value: "4 600",
    });
    expect(session.feedback?.outcome).toBe("correct");
  });

  it("rejects malformed specifications", () => {
    const bad: [Partial<WholeNumbersSpec>, RegExp][] = [
      [{ n: 4730 }, /five digits/],
      [{ m: 47308 }, /differ/],
      [{ n: 47478, place: "ten-thousands" }, /once/],
      [{ n: 40308, place: "thousands" }, /non-zero/],
      [{ task: "rounding", n: 4600 }, /multiple/],
      [{ task: "rounding", n: 80 }, /above the step/],
      [{ task: "factors", n: 13 }, /five factors/],
      [{ task: "factors", n: 61 }, /five factors/],
      [{ task: "practice", n: 2500, m: 1329 }, /multiples/],
      [{ task: "practice", n: 2486, m: 2486 }, /differ/],
      [{ task: "rounding", roundTo: 50 as 100 }, /10, 100 or 1000/],
      [{ place: "millions" as "ones" }, /place/],
      [{ unit: "" }, /Unit/],
      [{ n: 1.5 }, /whole number/],
      [{ n: -1 }, /whole number/],
    ];
    for (const [over, pattern] of bad) {
      const errors = validateWholeNumbersSpec(
        over.task === "rounding" && over.roundTo === undefined
          ? base({ ...over, n: over.n ?? 4637 })
          : base(over),
      );
      expect(errors.join(" "), JSON.stringify(over)).toMatch(pattern);
    }
    expect(validateWholeNumbersSpec(null)).not.toEqual([]);
    expect(validateWholeNumbersSpec({ ...base(), extra: 1 })).toContain(
      "Unknown whole-number field",
    );
  });

  it("draws models without showing answers and escapes author text", () => {
    const rounding = wholeNumbersTopic.render(template("p4-rounding").lesson);
    expect(rounding).toContain("<svg");
    expect(rounding).toContain("halfway");
    // The neighbouring multiples are marked on the line; choosing between them is the task.
    for (const mark of ["4\u00a0500", "4\u00a0600", "4\u00a0700", "4\u00a0800"])
      expect(rounding).toContain(mark);
    const practice = wholeNumbersTopic.render(
      template("p4-estimate-by-rounding").lesson,
    );
    expect(practice).not.toContain("3\u00a0800");
    const place = template("p4-place-value-100k");
    place.lesson.specification.unit = "<img src=x onerror=1>";
    expect(wholeNumbersTopic.render(place.lesson)).not.toContain("<img");
    const prac = template("p4-estimate-by-rounding");
    prac.lesson.specification.unit = "<b>x</b>";
    expect(wholeNumbersTopic.render(prac.lesson)).not.toContain("<b>x");
  });

  it("derives the practice interpretation with units, states and exact spans", () => {
    const p = template("p4-estimate-by-rounding");
    const i = p.interpretation!;
    expect(i.unknown).toBe("estimate");
    expect(i.quantities.map((q) => [q.entity, q.value, q.state])).toEqual([
      ["first", 2486, "given"],
      ["second", 1329, "given"],
      ["first-rounded", 2500, "derived"],
      ["second-rounded", 1300, "derived"],
      ["estimate", 3800, "derived"],
    ]);
    expect(i.sourceSpans[0].text).toBe(p.lesson.story);
  });

  it("author edits keep the model, answers and wording coherent", () => {
    const model = createAuthorModel(template("p4-rounding"));
    model.patch({ kind: "topic", key: "n", value: "4 650" });
    expect(model.working.lesson.specification.n).toBe(4650);
    expect(
      model.working.lesson.steps.find((s) => s.id === "rounded")!.answer,
    ).toBe("4700");
    expect(model.pending.length).toBeGreaterThan(0);
    model.applyWording();
    const nearer = model.working.lesson.steps.find((s) => s.id === "nearer")!;
    const halfway = nearer.choices!.find((c) => c.meaning === "halfway")!.id;
    expect(nearer.answer).toBe(halfway);
    expect(
      validatePackage(model.working).issues.filter(
        (i) => i.severity === "error",
      ),
    ).toEqual([]);
    // Partial typing stays editable and does not replace the last valid canvas.
    model.patch({ kind: "topic", key: "n", value: "46x" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("uses opaque choice ids that do not reveal the answer by value or position", () => {
    const ids = new Set<string>();
    for (const form of wholeNumbersAuthor.forms) {
      const p = template(form.id);
      for (const step of p.lesson.steps.filter((s) => s.kind === "choice")) {
        expect(step.choices!.map((c) => c.id)).toHaveLength(
          new Set(step.choices!.map((c) => c.id)).size,
        );
        ids.add(String(step.answer));
      }
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});
