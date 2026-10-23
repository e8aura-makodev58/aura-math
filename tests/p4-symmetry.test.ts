import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { symmetryAuthor } from "../src/authoring/symmetry";
import {
  SHAPES,
  SHAPE_IDS,
  axisCount,
  candidateLines,
  matchOptions,
  mirrorCell,
  symmetryTopic,
  validateSymmetrySpec,
  validateSymmetrySteps,
  type ShapeId,
  type SymmetrySpec,
} from "../src/topics/symmetry";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel } from "../src/authoring/model";

const template = (form: string) => symmetryAuthor.template(form, `${form}-t`);
const base = (over: Partial<SymmetrySpec> = {}): SymmetrySpec => ({
  ...(template("p4-symmetric-figure").lesson
    .specification as unknown as SymmetrySpec),
  ...over,
});
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

// Independent oracle: reflect with the line equation ax + by = c and compare exactly, written
// differently from the production vector formulation. Lines come from every pair of lattice points.
function reflectsOracle(
  points: [number, number][],
  p: [number, number],
  q: [number, number],
) {
  const a = -(q[1] - p[1]),
    b = q[0] - p[0];
  const c = a * p[0] + b * p[1];
  const D = a * a + b * b;
  return points.every(([x, y]) => {
    const N = a * x + b * y - c;
    const rx = x * D - 2 * a * N,
      ry = y * D - 2 * b * N;
    return points.some(([px, py]) => px * D === rx && py * D === ry);
  });
}
function bruteForceAxes(points: [number, number][]): number {
  const lattice: [number, number][] = [];
  for (let x = -4; x <= 18; x++)
    for (let y = -4; y <= 16; y++) lattice.push([x, y]);
  const found = new Set<string>();
  for (let i = 0; i < lattice.length; i++)
    for (let j = i + 1; j < lattice.length; j++) {
      const p = lattice[i],
        q = lattice[j];
      if (!reflectsOracle(points, p, q)) continue;
      let a = -(q[1] - p[1]),
        b = q[0] - p[0];
      let c = a * p[0] + b * p[1];
      const g = gcd(gcd(a, b), c) || 1;
      a /= g;
      b /= g;
      c /= g;
      if (a < 0 || (a === 0 && b < 0)) [a, b, c] = [-a, -b, -c];
      found.add(`${a},${b},${c}`);
    }
  return found.size;
}

describe("symmetry packages", () => {
  for (const form of symmetryAuthor.forms) {
    it(`${form.id}: validates and completes in both modes`, () => {
      const p = template(form.id);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, symmetryTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          expect(step.hints).toHaveLength(4);
          session = useHint(session);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, symmetryTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, symmetryTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, symmetryTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });
  }

  it("counts lines of symmetry exactly: production matches a brute-force oracle and the known values", () => {
    const known: Record<ShapeId, number> = {
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
    for (const id of SHAPE_IDS) {
      expect(bruteForceAxes(SHAPES[id].points), id).toBe(known[id]);
      expect(axisCount(id), id).toBe(known[id]);
    }
  });

  it("judges every candidate line by exact reflection and offers true and false lines except the square's four real axes", () => {
    for (const id of SHAPE_IDS) {
      const lines = candidateLines(id);
      expect(lines.map((c) => c.id)).toEqual(["A", "B", "C", "D"]);
      for (const c of lines)
        expect(c.symmetric, `${id} ${c.id}`).toBe(
          reflectsOracle(SHAPES[id].points, c.a, c.b),
        );
      expect(lines.some((c) => c.symmetric) || axisCount(id) === 0).toBe(true);
      if (id === "square")
        expect(lines.filter((c) => c.symmetric)).toHaveLength(4);
      else expect(lines.some((c) => !c.symmetric)).toBe(true);
    }
    // The classic traps: a rectangle's diagonals and a parallelogram's midlines are not lines of symmetry.
    const rect = candidateLines("rectangle");
    expect(
      rect.filter((c) => /corner/.test(c.words)).every((c) => !c.symmetric),
    ).toBe(true);
    expect(candidateLines("square").some((c) => c.symmetric)).toBe(true);
  });

  it("finds the mirror image across both mirror directions by an independent formula", () => {
    const mirrorLetters = new Set<string>();
    for (const mirror of ["vertical", "horizontal"] as const)
      for (const [cols, rows] of [
        [6, 4],
        [8, 4],
        [8, 6],
        [6, 6],
      ]) {
        const cells: string[] = [];
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const first = mirror === "vertical" ? c < cols / 2 : r < rows / 2;
            if (first && cells.length < 5) cells.push(`${r},${c}`);
          }
        for (const probe of cells) {
          const s = base({ cols, rows, mirror, cells, probe });
          expect(
            validateSymmetrySpec(s),
            `${mirror} ${cols}x${rows} ${probe}`,
          ).toEqual([]);
          const [r, c] = probe.split(",").map(Number);
          const want: [number, number] =
            mirror === "vertical" ? [r, cols - 1 - c] : [rows - 1 - r, c];
          expect(mirrorCell(s, r, c)).toEqual(want);
          const options = matchOptions(s);
          expect(options.map((o) => o.id)).toEqual(["A", "B", "C"]);
          mirrorLetters.add(options.find((o) => o.meaning === "mirror")!.id);
          expect(options.find((o) => o.meaning === "mirror")!.cell).toEqual(
            want,
          );
          const keys = options.map((o) => o.cell.join(","));
          expect(new Set(keys).size).toBe(3);
          for (const o of options) {
            const far =
              mirror === "vertical"
                ? o.cell[1] >= cols / 2
                : o.cell[0] >= rows / 2;
            expect(far).toBe(true);
            expect(o.cell[0]).toBeGreaterThanOrEqual(0);
            expect(o.cell[1]).toBeGreaterThanOrEqual(0);
            expect(o.cell[0]).toBeLessThan(rows);
            expect(o.cell[1]).toBeLessThan(cols);
          }
        }
      }
    // The matching square is not always labelled A.
    expect([...mirrorLetters].sort()).toEqual(["A", "B", "C"]);
  });

  it("rejects malformed specifications", () => {
    const bad: [Partial<SymmetrySpec>, RegExp][] = [
      [{ cols: 7 }, /6 or 8 columns/],
      [{ rows: 5 }, /6 or 8 columns/],
      [{ mirror: "diagonal" as "vertical" }, /vertical or horizontal/],
      [{ cells: ["0,5", "1,1", "1,2", "2,0"] }, /not on the shaded side/],
      [{ cells: ["9,1", "1,1", "1,2", "2,0"] }, /not on the grid/],
      [{ cells: ["x", "1,1", "1,2", "2,0"] }, /not on the grid/],
      [{ cells: ["0,2", "0,2", "1,2", "2,0"] }, /twice/],
      [{ cells: ["0,2", "1,1"] }, /between 3 squares/],
      [{ probe: "3,3" }, /one of the shaded squares/],
      [{ shape: "cube" as "kite" }, /supported shape/],
    ];
    for (const [over, pattern] of bad)
      expect(
        validateSymmetrySpec(base(over)).join(" "),
        JSON.stringify(over),
      ).toMatch(pattern);
    expect(
      validateSymmetrySpec({
        ...base(),
        task: "lines",
        shape: "parallelogram",
      }).join(" "),
    ).toMatch(/at least one line/);
    expect(validateSymmetrySpec(null)).not.toEqual([]);
    expect(validateSymmetrySpec({ ...base(), extra: 1 })).toContain(
      "Unknown symmetry field",
    );
    const lesson = template("p4-symmetric-figure").lesson;
    lesson.steps[1].answer = "5";
    expect(validateSymmetrySteps(lesson).join(" ")).toMatch(/contradicts/);
  });

  it("draws the models without revealing answers", () => {
    const lines = symmetryTopic.render(template("p4-lines-of-symmetry").lesson);
    for (const letter of ["A", "B", "C", "D"])
      expect(lines).toContain(`>${letter}</text>`);
    expect(lines).toContain("stroke-dasharray");
    expect(lines).not.toMatch(/symmetric(al)? line/i);
    const grid = symmetryTopic.render(template("p4-symmetric-figure").lesson);
    expect(grid).toContain(">X</text>");
    for (const letter of ["A", "B", "C"])
      expect(grid).toContain(`>${letter}</text>`);
    // The number of shaded squares is the answer to "how many more", so it is not stated.
    expect(grid).not.toMatch(/\b6 (squares|shaded)/);
  });

  it("keeps author edits coherent and malformed text editable", () => {
    const model = createAuthorModel(template("p4-symmetric-figure"));
    model.patch({
      kind: "topic",
      key: "cells",
      value: "0,2; 1,1; 1,2; 2,0; 2,3; 3,1; 3,2",
    });
    expect(
      model.working.lesson.steps.find((s) => s.id === "to-shade")!.answer,
    ).toBe("7");
    expect(
      model.working.lesson.steps.find((s) => s.id === "total")!.answer,
    ).toBe("14");
    model.patch({ kind: "topic", key: "mirror", value: "horizontal" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    model.patch({ kind: "topic", key: "cells", value: "0,1; 0,2; 1,0; 1,3" });
    model.patch({ kind: "topic", key: "probe", value: "0,1" });
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(
      model.working.lesson.steps.find((s) => s.id === "to-shade")!.answer,
    ).toBe("4");
    model.patch({ kind: "topic", key: "cells", value: "garbage" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    const lines = createAuthorModel(template("p4-lines-of-symmetry"));
    lines.patch({ kind: "topic", key: "shape", value: "square" });
    expect(
      lines.working.lesson.steps.find((s) => s.id === "count")!.answer,
    ).toBe("4");
  });
});
