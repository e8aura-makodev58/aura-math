import { describe, expect, it } from "vitest";
import {
  createSession,
  nextStep,
  submit,
  useHint,
  useWorkedSolution,
} from "../src/core/runtime";
import { decimalsAuthor } from "../src/authoring/decimals";
import {
  decimalResult,
  decimalsTopic,
  validateDecimalsSpec,
  type DecimalsSpec,
} from "../src/topics/decimals";
import {
  decimalUnits,
  formatDecimal,
  parseDecimal,
  parseFraction,
  assessExact,
} from "../src/topics/exact";
import {
  validatePackage,
  parsePackage,
} from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";
import { packages } from "../src/content/lessons";
import { digest } from "../src/content-release";
const expected: Record<string, (string | number)[]> = {
  "p4-decimal-places": ["p2", "0.007", "c4", "r3"],
  "p4-decimal-add-subtract": ["u5", "4.65", "r3"],
  "p4-decimal-multiply-divide": ["u5", "0.8", "2.4", "r3"],
  "p4-decimal-practice": ["4.5", "r3"],
};
describe("P4 decimal candidate contracts", () => {
  for (const form of decimalsAuthor.forms) {
    const p = decimalsAuthor.template(form.id, form.id);
    it(`${form.id}: package, independent results, fixtures and both-mode traces`, () => {
      expect(validatePackage(p).package).toEqual(p);
      expect(p.lesson.steps.map((s) => s.answer)).toEqual(expected[form.id]);
      expect(parsePackage(JSON.stringify(p)).package).toEqual(p);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, decimalsTopic.adapter, mode);
        for (const [i, st] of p.lesson.steps.entries()) {
          for (let h = 0; h < 4; h++) session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, decimalsTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, decimalsTopic.adapter, {
            type: "answer",
            value: expected[form.id][i],
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, decimalsTopic.adapter);
          expect(st.hints).toHaveLength(4);
        }
        expect(session.completed).toBe(true);
      }
    });
  }
  it("renders task-specific equal groups and both practice quantities without displaying derived answers", () => {
    const practice = decimalsAuthor.template("p4-decimal-practice", "diagram");
    const rendered = decimalsTopic.render(practice.lesson);
    expect(rendered).toContain("<svg");
    expect(rendered).toContain("Available: 9.5 m");
    expect(rendered).toContain("1.25 m");
    expect(rendered).toContain("4 equal pieces; remaining: ?");
    expect(rendered).not.toContain("4.5");
    const division = decimalsAuthor.template(
      "p4-decimal-multiply-divide",
      "division",
    );
    const divided = decimalsTopic.render(division.lesson);
    expect(divided).toContain("Whole amount: 2.4");
    expect(divided).toContain("3 equal groups");
    expect(divided).not.toContain("0.8");
    expect(divided).toContain("Diagram not to scale");
  });
  it("accepts equivalent decimal inputs but malformed syntax records no assessed attempt", () => {
    const p = decimalsAuthor.template("p4-decimal-practice", "syntax"),
      l = p.lesson;
    let session = createSession(l, decimalsTopic.adapter);
    for (const value of [
      "4.5e0",
      "4,5",
      "4.5 m",
      "4 .5",
      "Infinity",
      "",
      "4.5000",
    ]) {
      const before = session;
      session = submit(session, l, decimalsTopic.adapter, {
        type: "answer",
        value,
      });
      expect(session.feedback?.outcome).toBe("unassessable");
      expect(session.submissions).toBe(0);
      expect(session.history).toEqual(before.history);
      expect(session.events).toEqual(before.events);
      expect(session.state).toEqual(before.state);
    }
    session = submit(session, l, decimalsTopic.adapter, {
      type: "answer",
      value: " 4.500 ",
    });
    expect(session.feedback?.outcome).toBe("correct");
    expect(session.submissions).toBe(1);
  });
  it("computes carries, borrows, exact quotient bounds and0.1+0.2 by an integer oracle", () => {
    const base = decimalsAuthor.template("p4-decimal-add-subtract", "oracle")
      .lesson.specification as unknown as DecimalsSpec;
    for (const [aa, bb] of [
      [10, 20],
      [725, 260],
      [99999, 1],
      [100, 99],
      [0, 0],
    ])
      for (const operation of ["add", "subtract"] as const) {
        const s = {
          ...base,
          a: { coefficient: aa, scale: 2 },
          b: { coefficient: bb, scale: 2 },
          operation,
        };
        const valid = operation === "add" || aa >= bb;
        expect(validateDecimalsSpec(s).length === 0).toBe(valid);
        if (valid)
          expect(decimalResult(s).coefficient).toBe(
            operation === "add" ? aa + bb : aa - bb,
          );
      }
    const d = decimalsAuthor.template("p4-decimal-multiply-divide", "divide")
      .lesson.specification as unknown as DecimalsSpec;
    for (const factor of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const s = { ...d, factor };
      const cents = 240;
      expect(validateDecimalsSpec(s).length === 0).toBe(cents % factor === 0);
      if (cents % factor === 0)
        expect(decimalResult(s).coefficient).toBe(cents / factor);
    }
    expect(
      formatDecimal(
        decimalResult({
          ...base,
          a: { coefficient: 1, scale: 1 },
          b: { coefficient: 2, scale: 1 },
          operation: "add",
        }),
      ),
    ).toBe("0.3");
  });
  it("rejects malformed specs, zero division, negative results and numeric precision expansion", () => {
    const s = decimalsAuthor.template("p4-decimal-add-subtract", "bounds")
      .lesson.specification as unknown as DecimalsSpec;
    for (const change of [
      { factor: 0 },
      { factor: 10 },
      { a: { coefficient: -1, scale: 2 } },
      { a: { coefficient: 1.5, scale: 2 } },
      { a: { coefficient: 10, scale: 3 } },
      { b: null },
      { a: "1.2" },
      { targetPlace: "millions" },
      { operation: "divide" },
      { extra: true },
      { a: { coefficient: 1, scale: 2 }, b: { coefficient: 20, scale: 1 } },
    ])
      expect(validateDecimalsSpec({ ...s, ...change }).length).toBeGreaterThan(
        0,
      );
  });
  it("authors hundredths and cross-zero exchanges with task-specific relation wording", () => {
    for (const [a, b, hint] of [
      ["7.21", "2.06", "Exchange one tenth for ten hundredths"],
      [
        "7.01",
        "2.06",
        "Exchange one whole for ten tenths, then exchange one tenth",
      ],
    ]) {
      const p = decimalsAuthor.template("p4-decimal-add-subtract", "exchange");
      const model = createAuthorModel(p);
      model.patch({ kind: "topic", key: "a", value: a });
      model.patch({ kind: "topic", key: "b", value: b });
      model.applyWording();
      expect(model.working.lesson.steps[1].hints[2]).toContain(hint);
      expect(model.working.lesson.steps[0].choices![0].label).toContain(
        "decimal points",
      );
      expect(validatePackage(model.working).package).toEqual(model.working);
    }
  });
  it("retains incomplete author values and derives coherent operation/target wording atomically", () => {
    const p = decimalsAuthor.template(
        "p4-decimal-add-subtract",
        "author-decimal",
      ),
      m = createAuthorModel(p);
    expect(m.working.lesson.steps[1].hints[2]).toContain("Exchange one whole");
    const valid = m.lastValid;
    m.patch({ kind: "topic", key: "a", value: "" });
    expect(decimalsAuthor.fields(m.working.lesson)[0].value).toBe("");
    expect(m.lastValid).toEqual(valid);
    expect(m.canUseCandidate).toBe(false);
    m.patch({ kind: "topic", key: "a", value: "8.25" });
    m.applyWording();
    expect(m.working.lesson.steps[1].answer).toBe("5.65");
    expect(m.canUseCandidate).toBe(true);
    m.patch({ kind: "topic", key: "operation", value: "add" });
    expect(m.pending.some((f) => f.required)).toBe(true);
    m.applyWording();
    expect(m.working.lesson.steps[1].answer).toBe("10.85");
    expect(m.working.lesson.steps[1].prompt).toContain("+");
  });
  it("binds two-step interpretation, quantities, states, units, operation order and exact spans", () => {
    const p = decimalsAuthor.template("p4-decimal-practice", "context");
    for (const mutate of [
      (x: typeof p) => {
        x.interpretation!.quantities[3].value = "8";
      },
      (x: typeof p) => {
        x.interpretation!.quantities[4].unit = "kg";
      },
      (x: typeof p) => {
        x.interpretation!.relationships.reverse();
      },
      (x: typeof p) => {
        x.interpretation!.sourceSpans[0].end--;
      },
      (x: typeof p) => {
        delete x.interpretation;
      },
    ]) {
      const bad = structuredClone(p);
      mutate(bad);
      expect(validatePackage(bad).package).toBeUndefined();
    }
    const m = createAuthorModel(p);
    m.patch({ kind: "topic", key: "b", value: "1.5" });
    m.applyWording();
    expect(m.working.interpretation!.quantities[3].value).toBe("6");
    expect(m.working.interpretation!.quantities[4].value).toBe("3.5");
    expect(validatePackage(m.working).package).toEqual(m.working);
  });
  it("reads legacy schemas and promotes directly once to3 preserving exact origin and undo", async () => {
    for (const schema of [1, 2] as const) {
      const p = packages.find((p) => p.schemaVersion === schema)!,
        hash = await digest(p),
        m = createAuthorModel(p);
      expect(validatePackage(p).package).toEqual(p);
      m.beginEdit("title");
      m.patch({ kind: "text", field: "title", value: "One change" });
      m.patch({ kind: "text", field: "title", value: "Two changes" });
      m.endEdit();
      expect(m.working.schemaVersion).toBe(3);
      expect(m.working.lesson.version).toBe(p.lesson.version + 1);
      expect(await digest(m.origin)).toBe(hash);
      expect(validatePackage(m.working).package).toEqual(m.working);
      m.undo();
      expect(m.working).toEqual(p);
      m.redo();
      expect(m.working.schemaVersion).toBe(3);
    }
    const p = decimalsAuthor.template("p4-decimal-practice", "reject-old");
    expect(validatePackage({ ...p, schemaVersion: 2 }).package).toBeUndefined();
    expect(
      validatePackage({ ...p, schemaVersion: "3" }).package,
    ).toBeUndefined();
  });
  it("checks exact fixture outcomes by equivalence and marks adult solutions as support", () => {
    const p = decimalsAuthor.template(
      "p4-decimal-practice",
      "equivalent-fixture",
    );
    p.fixtures![0].accepted.push("4.50");
    expect(validatePackage(p).package).toEqual(p);
    p.fixtures![0].rejected.push("4.500");
    expect(validatePackage(p).package).toBeUndefined();
    const session = createSession(p.lesson, decimalsTopic.adapter);
    const supported = useWorkedSolution(session);
    expect(supported.hadSupport).toBe(true);
    expect(supported.events.at(-1)?.type).toBe("worked-solution");
    expect(session.hadSupport).toBe(false);
  });
  it("parses rational inputs for later topics without evaluating expressions or counting syntax as wrong", () => {
    expect(parseFraction("2  3/5")).toEqual({ numerator: 13, denominator: 5 });
    expect(parseFraction("2-3/5")).toBeNull();
    expect(parseFraction("1/0")).toBeNull();
    expect(parseFraction("1e3")).toBeNull();
    expect(parseDecimal("1.203")).toEqual({ coefficient: 1203, scale: 3 });
    const step = {
      ...decimalsAuthor.template("p4-decimal-practice", "fraction-synthetic")
        .lesson.steps[0],
      answer: "3/4",
    };
    expect(assessExact({ answer: "6/8" }, step, parseFraction).outcome).toBe(
      "correct",
    );
    expect(
      assessExact({ answer: "6/8" }, step, parseFraction, step.answer, true)
        .outcome,
    ).toBe("incorrect");
    expect(assessExact({ answer: "x/y" }, step, parseFraction).outcome).toBe(
      "unassessable",
    );
    expect(decimalUnits({ coefficient: 12, scale: 1 }, 3)).toBe(1200);
  });
});
