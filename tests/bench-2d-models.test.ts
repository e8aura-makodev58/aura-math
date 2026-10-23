import { describe, expect, it } from "vitest";
import {
  alignment,
  alignedPose,
  moveDial,
  wrap,
  type AngleFigure,
} from "../src/topics/protractor-model";
import { reflectPoint } from "../src/topics/symmetry-workbench";
import { validateAngleMeasureSpec } from "../src/topics/angle-measure";
import {
  validateSymmetrySpec,
  symmetryAnswer,
  mirrorCell,
  candidateLines,
  SHAPES,
} from "../src/topics/symmetry";
import { angleMeasureAuthor } from "../src/authoring/angle-measure";
import { symmetryAuthor } from "../src/authoring/symmetry";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";

describe("protractor geometry independent checks", () => {
  it("both-arm alignments read the same angle on the appropriate scale for every signed task angle", () => {
    for (let first = 0; first < 360; first += 15)
      for (let turn = -175; turn <= 175; turn += 5) {
        if (!turn) continue;
        const f: AngleFigure = { x: 200, y: 225, first, turn };
        for (const arm of ["first", "second"] as const) {
          const p = alignedPose(f, arm),
            a = alignment(f, p);
          expect(a?.arm).toBe(arm);
          // Independent vector angle relative to dial baseline; choose the zero at the aligned arm.
          const other = arm === "first" ? first + turn : first;
          const dot = Math.cos(((other - p.rot) * Math.PI) / 180);
          const theta =
            (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
          const reading = a!.scale === "outer" ? theta : 180 - theta;
          expect(reading).toBeCloseTo(Math.abs(turn), 8);
          expect(alignment(f, { ...p, x: p.x + 1 })).toBeNull();
        }
      }
  });
  it("refuses off-baseline and out-of-semicircle poses, bounds movement and wraps rotation", () => {
    const f = { x: 200, y: 225, first: 20, turn: 65 };
    expect(alignment(f, { x: 200, y: 225, rot: 0 })).toBeNull();
    expect(alignment(f, { x: 200, y: 225, rot: 200 })).toBeNull();
    expect(moveDial({ x: 200, y: 225, rot: 355 }, 500, -500, 10)).toEqual({
      x: 365,
      y: 70,
      rot: 5,
    });
    expect(wrap(-5)).toBe(355);
  });
});

describe("symmetry picture and answer agreement", () => {
  it("reflects each bounded line by a perpendicular-distance oracle", () => {
    for (const shape of Object.keys(SHAPES) as (keyof typeof SHAPES)[])
      for (const line of candidateLines(shape)) {
        const [ax, ay] = line.a,
          [bx, by] = line.b,
          nx = ay - by,
          ny = bx - ax;
        for (const p of SHAPES[shape].points) {
          const q = reflectPoint(p, line.a, line.b),
            dist = ((p[0] - ax) * nx + (p[1] - ay) * ny) / (nx * nx + ny * ny);
          expect(q[0]).toBeCloseTo(p[0] - 2 * dist * nx);
          expect(q[1]).toBeCloseTo(p[1] - 2 * dist * ny);
          expect(reflectPoint(q, line.a, line.b)[0]).toBeCloseTo(p[0]);
        }
        const match = SHAPES[shape].points.every((p) => {
          const q = reflectPoint(p, line.a, line.b);
          return SHAPES[shape].points.some(
            (v) => Math.hypot(v[0] - q[0], v[1] - q[1]) < 1e-8,
          );
        });
        expect(match).toBe(line.symmetric);
      }
    expect(() => reflectPoint([0, 0], [1, 1], [1, 1])).toThrow();
  });
  it("shade choices match independent row/column complement arithmetic in both directions", () => {
    for (const mirror of ["vertical", "horizontal"] as const) {
      let lesson = symmetryAuthor.template(
        "p4-shade-to-complete-bench",
        "shade",
      ).lesson;
      lesson = symmetryAuthor.patch(lesson, "mirror", mirror);
      lesson = symmetryAuthor.patch(
        lesson,
        "cells",
        mirror === "vertical" ? "0,0;1,1;2,2" : "0,0;0,2;1,1",
      );
      lesson = symmetryAuthor.patch(lesson, "probe", "0,0");
      lesson = symmetryAuthor.rewrite(lesson);
      const s = lesson.specification as unknown as Parameters<
          typeof mirrorCell
        >[0],
        step = lesson.steps[0];
      expect(validateSymmetrySpec(s)).toEqual([]);
      const chosen = step
        .choices!.filter((c) =>
          (symmetryAnswer(s, step) as string[]).includes(c.id),
        )
        .map((c) => c.meaning);
      const expected = s.cells.map((t) => {
        const [r, c] = t.split(",").map(Number);
        return `cell:${mirror === "vertical" ? r : s.rows - 1 - r},${mirror === "vertical" ? s.cols - 1 - c : c}`;
      });
      expect(chosen.sort()).toEqual(expected.sort());
    }
  });
});

describe("new packages and author transactions", () => {
  for (const [capability, forms] of [
    [
      angleMeasureAuthor,
      ["p4-protractor-bench-read", "p4-protractor-bench-draw"],
    ],
    [symmetryAuthor, ["p4-mirror-line-bench", "p4-shade-to-complete-bench"]],
  ] as const)
    for (const form of forms) {
      it(`${form} remains original draft and rebuilds validated author edits`, () => {
        const p = capability.template(form, form);
        expect(p.lesson.reviewStatus).toBe("draft");
        expect(p.library!.tags).toContain("workbench");
        expect(
          validatePackage(p).issues.filter((i) => i.severity === "error"),
        ).toEqual([]);
        const model = createAuthorModel(p);
        model.patch({
          kind: "topic",
          key: form.startsWith("p4-protractor")
            ? "degrees"
            : form.includes("mirror-line")
              ? "shape"
              : "cells",
          value: form.startsWith("p4-protractor")
            ? 85
            : form.includes("mirror-line")
              ? "isosceles-triangle"
              : "0,0;1,1;2,2",
        });
        if (form.includes("shade")) {
          expect(model.issues.some((i) => i.severity === "error")).toBe(true);
          model.patch({ kind: "topic", key: "probe", value: "0,0" });
        }
        expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
        expect(
          validatePackage(model.working).issues.filter(
            (i) => i.severity === "error",
          ),
        ).toEqual([]);
      });
    }
  it("construction checks a derived angle rather than the printed target", () => {
    const p = angleMeasureAuthor.template("p4-protractor-bench-draw", "draw");
    expect(p.lesson.steps[0].answer).toBe("65");
    expect(p.lesson.steps[0].prompt).toContain("115°");
  });
  it("rejects malformed dimensions, ambiguous mirror shapes and unknown fields", () => {
    const s = symmetryAuthor.template("p4-mirror-line-bench", "x").lesson
      .specification;
    expect(
      validateSymmetrySpec({ ...s, shape: "square" }).length,
    ).toBeGreaterThan(0);
    expect(validateSymmetrySpec({ ...s, cols: 7 }).length).toBeGreaterThan(0);
    const a = angleMeasureAuthor.template("p4-protractor-bench-read", "x")
      .lesson.specification;
    for (const over of [
      { degrees: 64 },
      { degrees: NaN },
      { task: "bench-x" },
      { extra: true },
    ])
      expect(
        validateAngleMeasureSpec({ ...a, ...over }).length,
      ).toBeGreaterThan(0);
  });
});
