import { describe, expect, it } from "vitest";
import { validatePackage } from "../src/content/package-validation";
import { rewritePackageWording } from "../src/content/wording";
import { fractionCalculationsAuthor } from "../src/authoring/fraction-calculations";
import { areaPerimeterAuthor } from "../src/authoring/area-perimeter";
import {
  fractionCalculationsTopic,
  validateFractionCalculationsSpec,
  type FractionCalculationsSpec,
} from "../src/topics/fraction-calculations";
import {
  areaOf,
  perimeterOf,
  areaPerimeterTopic,
  validateAreaPerimeterSpec,
  validateAreaPerimeterSteps,
  type AreaPerimeterSpec,
} from "../src/topics/area-perimeter";

const fractionForms = [
  "p4-mixed-and-improper",
  "p4-fraction-add-subtract",
  "p4-fraction-of-quantity",
  "p4-fraction-practice",
];
const measurementForms = [
  "p4-rectangle-missing-side",
  "p4-composite-area",
  "p4-composite-perimeter",
  "p4-measurement-practice",
];

function boundaryByCells(s: AreaPerimeterSpec) {
  const occupied = new Set<string>();
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const withinX = s.corner.endsWith("left")
        ? x < s.cutWidth
        : x >= s.width - s.cutWidth;
      const withinY = s.corner.startsWith("top")
        ? y < s.cutHeight
        : y >= s.height - s.cutHeight;
      if (!(withinX && withinY)) occupied.add(`${x},${y}`);
    }
  let boundary = 0;
  for (const cell of occupied) {
    const [x, y] = cell.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (!occupied.has(`${x + dx},${y + dy}`)) boundary++;
  }
  return { cells: occupied.size, boundary };
}

describe("P4 fraction calculations", () => {
  it("validates four original packages, exact answers and coherent practice interpretation", () => {
    for (const form of fractionForms) {
      const payload = fractionCalculationsAuthor.template(form, form);
      expect(
        validatePackage(payload).issues.filter(
          (issue) => issue.severity === "error",
        ),
      ).toEqual([]);
      expect(
        payload.lesson.steps.every((step) => step.hints.length === 4),
      ).toBe(true);
      if (form === "p4-fraction-practice") {
        expect(
          payload.interpretation?.relationships
            .filter((r) => r.kind === "operation")
            .map((r) => r.operation),
        ).toEqual(["fraction-of", "subtract"]);
        expect(payload.interpretation?.sourceSpans[0].text).toBe(
          payload.lesson.story,
        );
      }
      if (form === "p4-fraction-add-subtract")
        expect(payload.lesson.story).toContain("subtract 1/3 from 5/6");
    }
  });
  it("uses integer rational arithmetic and accepts equivalent unsimplified quantities", () => {
    const lesson = fractionCalculationsAuthor.template(
      "p4-fraction-add-subtract",
      "p4-fraction-add-subtract",
    ).lesson;
    const calculate = lesson.steps.find((step) => step.goal === "calculate")!;
    const simplest = lesson.steps.find((step) => step.goal === "simplest")!;
    // Independent oracle: 5/6 - 1/3 = (5 - 2)/6 = 1/2.
    expect(calculate.answer).toBe("1/2");
    const state = { specification: lesson.specification, answer: "3/6" };
    expect(
      fractionCalculationsTopic.adapter.evaluate(state, calculate).outcome,
    ).toBe("correct");
    expect(
      fractionCalculationsTopic.adapter.evaluate(state, simplest).outcome,
    ).toBe("incorrect");
    expect(
      fractionCalculationsTopic.adapter.evaluate(
        { ...state, answer: "1/2" },
        simplest,
      ).outcome,
    ).toBe("correct");
    expect(
      fractionCalculationsTopic.adapter.evaluate(
        { ...state, answer: "1/0" },
        calculate,
      ).outcome,
    ).toBe("unassessable");
  });
  it("rejects unrelated denominators, negative results and nonintegral set partitions", () => {
    const base = fractionCalculationsAuthor.template(
      "p4-fraction-add-subtract",
      "candidate",
    ).lesson.specification as unknown as FractionCalculationsSpec;
    expect(
      validateFractionCalculationsSpec({ ...base, otherDenominator: 5 }),
    ).toContain("Denominators must be equal or one must divide the other");
    expect(
      validateFractionCalculationsSpec({
        ...base,
        numerator: 1,
        denominator: 6,
        otherNumerator: 2,
        otherDenominator: 3,
      }),
    ).toContain("Fraction result must be nonnegative and at most ten wholes");
    expect(
      validateFractionCalculationsSpec({
        ...base,
        task: "of-quantity",
        quantity: 25,
        numerator: 3,
        denominator: 4,
      }),
    ).toContain("Quantity must divide into exact equal parts");
  });
  it("keeps partial author edits and rewrites a valid quantity coherently", () => {
    const lesson = fractionCalculationsAuthor.template(
      "p4-fraction-of-quantity",
      "candidate",
    ).lesson;
    const partial = fractionCalculationsAuthor.patch(lesson, "quantity", "");
    expect(partial.specification.quantity).toBe("");
    expect(
      validateFractionCalculationsSpec(partial.specification).length,
    ).toBeGreaterThan(0);
    const edited = fractionCalculationsAuthor.rewrite(
      fractionCalculationsAuthor.patch(lesson, "quantity", "36"),
    );
    expect(edited.steps.find((step) => step.goal === "one-part")?.answer).toBe(
      "9",
    );
    expect(edited.steps.find((step) => step.goal === "taken")?.answer).toBe(
      "27",
    );
    expect(
      edited.steps.find((step) => step.goal === "taken")?.prompt,
    ).toContain("36");
  });
});

describe("P4 area and perimeter", () => {
  it("validates four original packages, both area methods and perimeter equivalence", () => {
    for (const form of measurementForms) {
      const payload = areaPerimeterAuthor.template(form, form);
      expect(
        validatePackage(payload).issues.filter(
          (issue) => issue.severity === "error",
        ),
      ).toEqual([]);
      expect(
        payload.lesson.steps.every((step) => step.hints.length === 4),
      ).toBe(true);
    }
    const areaLesson = areaPerimeterAuthor.template(
      "p4-composite-area",
      "area",
    ).lesson;
    const method = areaLesson.steps[0];
    expect(method.prompt).toBe(
      "Choose one valid method to find the L-shape's area.",
    );
    for (const answer of ["a1", "a2"])
      expect(
        areaPerimeterTopic.adapter.evaluate(
          { specification: areaLesson.specification, answer },
          method,
        ).outcome,
      ).toBe("correct");
    const perimeterLesson = areaPerimeterAuthor.template(
      "p4-composite-perimeter",
      "perimeter",
    ).lesson;
    const boundaryMethod = perimeterLesson.steps.find(
      (step) => step.goal === "boundary-method",
    )!;
    for (const answer of ["b3", "b7"])
      expect(
        areaPerimeterTopic.adapter.evaluate(
          { specification: perimeterLesson.specification, answer },
          boundaryMethod,
        ).outcome,
      ).toBe("correct");
  });
  it("matches independent cell-area and outside-edge enumeration for every corner", () => {
    const original = areaPerimeterAuthor.template(
      "p4-composite-area",
      "candidate",
    ).lesson.specification as unknown as AreaPerimeterSpec;
    for (const corner of [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ] as const) {
      const spec = { ...original, corner };
      const oracle = boundaryByCells(spec);
      expect(areaOf(spec)).toBe(oracle.cells);
      expect(perimeterOf(spec)).toBe(oracle.boundary);
      const lesson = areaPerimeterAuthor.template(
        "p4-composite-area",
        "candidate",
      ).lesson;
      lesson.specification = spec as unknown as Record<string, unknown>;
      const rendered = areaPerimeterTopic.render(lesson);
      expect(rendered).toContain("L-shape");
      expect(rendered).not.toContain("<rect");
    }
  });
  it("rejects disconnected or zero cutouts and preserves hidden side in text alternative", () => {
    const base = areaPerimeterAuthor.template("p4-composite-area", "candidate")
      .lesson.specification as unknown as AreaPerimeterSpec;
    expect(
      validateAreaPerimeterSpec({ ...base, cutWidth: 0 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateAreaPerimeterSpec({ ...base, cutHeight: base.height }).length,
    ).toBeGreaterThan(0);
    const missing = areaPerimeterAuthor.template(
      "p4-rectangle-missing-side",
      "candidate",
    ).lesson;
    const description = areaPerimeterTopic.adapter.describe({
      specification: missing.specification,
    });
    expect(description).toContain("missing width");
    expect(description).not.toContain("width 12");
  });
  it("rejects a duplicated valid area method disguised as another choice", () => {
    const lesson = areaPerimeterAuthor.template(
      "p4-composite-area",
      "candidate",
    ).lesson;
    lesson.steps[0].choices![2].meaning = "split-add";
    expect(validateAreaPerimeterSteps(lesson)).toContain(
      "Measurement choices must have the supported model meanings exactly once",
    );
  });
  it("uses true operation relationships for area and perimeter practice", () => {
    const area = areaPerimeterAuthor.template(
      "p4-measurement-practice",
      "candidate",
    );
    const areaSpec = area.lesson.specification as unknown as AreaPerimeterSpec;
    const changed = areaPerimeterAuthor.rewrite({
      ...area.lesson,
      specification: { ...areaSpec, requestedMeasure: "area" },
    });
    expect(
      areaPerimeterTopic.interpretation!(changed)
        ?.relationships.filter((r) => r.kind === "operation")
        .map((r) => r.operation),
    ).toEqual(["multiply", "multiply", "subtract"]);
    expect(
      area.interpretation?.relationships
        .filter((r) => r.kind === "operation")
        .map((r) => r.operation),
    ).toEqual(["add", "multiply"]);
  });
  it("keeps both valid methods when author wording is regenerated", () => {
    for (const [form, goal, valid] of [
      ["p4-composite-area", "method", ["a1", "a2"]],
      ["p4-composite-perimeter", "boundary-method", ["b3", "b7"]],
    ] as const) {
      const payload = areaPerimeterAuthor.template(form, form);
      const edited = rewritePackageWording({
        ...payload,
        lesson: areaPerimeterAuthor.patch(payload.lesson, "width", "14"),
      });
      const fixture = edited.fixtures!.find((entry) => entry.stepId === goal)!;
      expect(fixture.accepted).toEqual(expect.arrayContaining([...valid]));
      for (const option of valid)
        expect(fixture.rejected).not.toContain(option);
      expect(
        validatePackage(edited).issues.filter(
          (issue) => issue.severity === "error",
        ),
      ).toEqual([]);
    }
  });
});
