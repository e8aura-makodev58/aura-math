import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { angleMeasureAuthor } from "../src/authoring/angle-measure";
import {
  HEADINGS,
  angleMeasureTopic,
  estimateOptions,
  headingAfter,
  kindOfAngle,
  parseDegrees,
  validateAngleMeasureSpec,
  validateAngleMeasureSteps,
  type AngleMeasureSpec,
} from "../src/topics/angle-measure";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";

const template = (form: string) =>
  angleMeasureAuthor.template(form, `${form}-t`);
const baseSpec = (over: Partial<AngleMeasureSpec> = {}): AngleMeasureSpec => ({
  ...(template("p4-read-protractor").lesson
    .specification as unknown as AngleMeasureSpec),
  ...over,
});
const renderOf = (spec: AngleMeasureSpec, form = "p4-read-protractor") => {
  const p = template(form);
  p.lesson.specification = spec as unknown as Record<string, unknown>;
  return angleMeasureTopic.render(p.lesson);
};

describe("angle-measure packages", () => {
  for (const form of angleMeasureAuthor.forms) {
    it(`${form.id}: validates and completes in both modes`, () => {
      const p = template(form.id);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, angleMeasureTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          expect(step.hints).toHaveLength(4);
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, angleMeasureTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, angleMeasureTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, angleMeasureTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });
  }

  it("draws the arms where the maths says: the drawn arm reads the angle on the right scale", () => {
    for (let degrees = 5; degrees <= 175; degrees += 5)
      for (const flip of [false, true]) {
        const html = renderOf(baseSpec({ degrees, flip }));
        const arms = [
          ...html.matchAll(
            /<line x1="220" y1="228" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#3f5aa8"/g,
          ),
        ].map((m) => ({ dx: Number(m[1]) - 220, dy: 228 - Number(m[2]) }));
        expect(arms).toHaveLength(2);
        // Angle of each arm measured anticlockwise from the right-hand end of the baseline.
        const theta = arms.map(
          (a) => ((Math.atan2(a.dy, a.dx) * 180) / Math.PI + 360) % 360,
        );
        const [base, arm] = theta;
        expect(Math.abs(base - (flip ? 180 : 0)) % 360).toBeLessThan(0.5);
        // Outer scale: 0 at the right. Inner scale: 0 at the left, so 180 minus the outer reading.
        const outer = arm,
          inner = 180 - arm;
        expect(
          Math.abs((flip ? inner : outer) - degrees),
          `${degrees} ${flip}`,
        ).toBeLessThan(0.5);
        // The other scale would give the supplementary reading, which is a different number unless 90.
        if (degrees !== 90)
          expect(Math.abs((flip ? outer : inner) - degrees)).toBeGreaterThan(1);
      }
  });

  it("draws turns whose arc ends at the heading the maths gives, with the right sweep and size", () => {
    for (const from of HEADINGS)
      for (const direction of ["clockwise", "anticlockwise"] as const)
        for (const quarters of [1, 2, 3]) {
          const spec = baseSpec({ task: "turns", from, direction, quarters });
          const html = renderOf(spec, "p4-turns");
          const m =
            /<path d="M ([\d.-]+) ([\d.-]+) A 58 58 0 (\d) (\d) ([\d.-]+) ([\d.-]+)"/.exec(
              html,
            )!;
          const bearing = (x: number, y: number) =>
            ((Math.atan2(x - 150, 150 - y) * 180) / Math.PI + 360) % 360;
          const start = bearing(Number(m[1]), Number(m[2]));
          const end = bearing(Number(m[5]), Number(m[6]));
          const phi0 = HEADINGS.indexOf(from) * 90;
          const sign = direction === "clockwise" ? 1 : -1;
          expect(Math.abs(start - phi0) % 360).toBeLessThan(0.5);
          const want = (((phi0 + sign * quarters * 90) % 360) + 360) % 360;
          expect(
            Math.abs(end - want) % 360,
            `${from} ${direction} ${quarters}`,
          ).toBeLessThan(0.5);
          expect(m[4]).toBe(direction === "clockwise" ? "1" : "0");
          expect(m[3]).toBe(quarters === 3 ? "1" : "0");
          // Heading from independent bearing arithmetic.
          expect(HEADINGS[want / 90]).toBe(headingAfter(spec));
        }
  });

  it("offers one close estimate and two far-off ones for every angle", () => {
    for (let d = 5; d <= 175; d += 5) {
      const o = estimateOptions(d);
      expect(Math.abs(o.close - d)).toBeLessThanOrEqual(5);
      for (const far of [o.low, o.high]) {
        expect(Math.abs(far - d)).toBeGreaterThanOrEqual(40);
        expect(far).toBeGreaterThan(0);
        expect(far).toBeLessThan(180);
      }
      expect(new Set([o.close, o.low, o.high]).size).toBe(3);
    }
  });

  it("classifies angles including the boundary", () => {
    expect([5, 85, 89].every((d) => kindOfAngle(d) === "acute")).toBe(true);
    expect(kindOfAngle(90)).toBe("right");
    expect([95, 175].every((d) => kindOfAngle(d) === "obtuse")).toBe(true);
  });

  it("accepts degrees with or without a unit and rejects everything else without an attempt", () => {
    for (const ok of [
      "70",
      "70°",
      "70 °",
      "70 deg",
      "70 degrees",
      "70 Degree",
      " 70 ",
    ])
      expect(parseDegrees(ok)?.numerator, ok).toBe(70);
    for (const bad of [
      "",
      "°",
      "seventy",
      "70.5",
      "-70",
      "70 cm",
      "7 0",
      "1e2",
      "70°°",
    ])
      expect(parseDegrees(bad), bad).toBeNull();
    const p = template("p4-angle-practice");
    let session = createSession(p.lesson, angleMeasureTopic.adapter);
    session = submit(session, p.lesson, angleMeasureTopic.adapter, {
      type: "answer",
      value: "12o",
    });
    expect(session.feedback?.outcome).toBe("unassessable");
    expect(session.submissions).toBe(0);
    session = submit(session, p.lesson, angleMeasureTopic.adapter, {
      type: "answer",
      value: "125°",
    });
    expect(session.feedback?.outcome).toBe("correct");
    // The two scales' other reading is a plausible wrong answer and is marked wrong.
    session = createSession(p.lesson, angleMeasureTopic.adapter);
    session = submit(session, p.lesson, angleMeasureTopic.adapter, {
      type: "answer",
      value: "55",
    });
    expect(session.feedback?.outcome).toBe("incorrect");
  });

  it("rejects malformed specifications and contradicted answers", () => {
    const bad: [Partial<AngleMeasureSpec>, RegExp][] = [
      [{ degrees: 72 }, /multiple of 5/],
      [{ degrees: 0 }, /multiple of 5/],
      [{ degrees: 180 }, /multiple of 5/],
      [{ degrees: 12.5 }, /multiple of 5/],
      [{ flip: "left" as unknown as boolean }, /base arm/],
      [{ from: "NE" as "N" }, /north, east/],
      [{ direction: "left" as "clockwise" }, /clockwise or anticlockwise/],
      [{ quarters: 4 }, /one, two or three/],
      [{ quarters: 0 }, /one, two or three/],
      [{ task: "spin" as "read" }, /Unsupported/],
    ];
    for (const [over, pattern] of bad)
      expect(
        validateAngleMeasureSpec(baseSpec(over)).join(" "),
        JSON.stringify(over),
      ).toMatch(pattern);
    expect(validateAngleMeasureSpec(null)).not.toEqual([]);
    expect(validateAngleMeasureSpec({ ...baseSpec(), extra: 1 })).toContain(
      "Unknown angle field",
    );
    const lesson = template("p4-read-protractor").lesson;
    lesson.steps[1].answer = "110";
    expect(validateAngleMeasureSteps(lesson).join(" ")).toMatch(/contradicts/);
  });

  it("keeps author edits coherent: flipping the base arm changes the scale answer", () => {
    const model = createAuthorModel(template("p4-read-protractor"));
    const scale = () =>
      model.working.lesson.steps.find((s) => s.id === "scale")!;
    const pickedOuter = scale().choices!.find(
      (c) => c.id === scale().answer,
    )!.meaning;
    expect(pickedOuter).toBe("outer");
    model.patch({ kind: "topic", key: "flip", value: "left" });
    expect(scale().choices!.find((c) => c.id === scale().answer)!.meaning).toBe(
      "inner",
    );
    model.patch({ kind: "topic", key: "degrees", value: "105" });
    expect(
      model.working.lesson.steps.find((s) => s.id === "read")!.answer,
    ).toBe("105");
    expect(
      model.working.lesson.steps
        .find((s) => s.id === "classify")!
        .choices!.find(
          (c) =>
            c.id ===
            model.working.lesson.steps.find((s) => s.id === "classify")!.answer,
        )!.meaning,
    ).toBe("obtuse");
    model.patch({ kind: "topic", key: "degrees", value: "7x" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    const turns = createAuthorModel(template("p4-turns"));
    turns.patch({ kind: "topic", key: "from", value: "E" });
    turns.patch({ kind: "topic", key: "direction", value: "anticlockwise" });
    turns.patch({ kind: "topic", key: "quarters", value: "1" });
    const facing = turns.working.lesson.steps.find((s) => s.id === "facing")!;
    expect(facing.choices!.find((c) => c.id === facing.answer)!.meaning).toBe(
      "heading:N",
    );
    expect(
      turns.working.lesson.steps.find((s) => s.id === "degrees")!.answer,
    ).toBe("90");
  });
});
