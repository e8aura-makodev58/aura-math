import { describe, it, expect } from "vitest";
import indexData from "../content/library.json";
import { packages } from "../src/content/lessons";
import { validatePackage } from "../src/content/package-validation";
import { canonicalJson } from "../src/content-release";
import {
  buildLibraryRecords,
  validateLibraryIndex,
  pruneLibraryIndex,
} from "../src/library/catalogue";
import { buildExample, selectExamples } from "../src/content/example-builder";
import { catalogueNet, checkCatalogueNet, SOLID_IDS } from "../src/topics/nets";
import { shapePoints, candidateLines } from "../src/topics/symmetry";
import {
  ORACLES,
  goal,
  chosen,
  chosenMany,
  rollCube,
  cellsOf,
  type S,
} from "./helpers/p4-example-oracles";
import type { Lesson } from "../src/core/types";

function rational(value: unknown): number {
  const parts = String(value).split("/");
  return Number(parts[0]) / (parts[1] ? Number(parts[1]) : 1);
}
function extraOracle(s: S, l: Lesson) {
  const value = (g: string) => rational(goal(l, g).answer);
  if (l.topic === "decimals") {
    const a = s.a.coefficient / 10 ** s.a.scale,
      b = s.b.coefficient / 10 ** s.b.scale;
    if (s.task === "places") {
      const place = { tenths: 1, hundredths: 2, thousandths: 3 }[
        s.targetPlace as "tenths"
      ];
      const digit = Number(
        String(s.a.coefficient)
          .padStart(s.a.scale + 1, "0")
          .at(-(s.a.scale - place + 1)),
      );
      expect(value("digit-value")).toBeCloseTo(digit / 10 ** place, 8);
      expect(chosen(goal(l, "compare")).meaning).toBe(a > b ? "left" : "right");
    } else {
      const result =
        s.task === "practice"
          ? a - b * s.factor
          : s.task === "multiply-divide"
            ? s.operation === "divide"
              ? a / s.factor
              : a * s.factor
            : s.operation === "subtract"
              ? a - b
              : a + b;
      expect(value("calculate")).toBeCloseTo(result, 8);
      if (l.steps.some((st) => st.goal === "inverse"))
        expect(value("inverse")).toBeCloseTo(a, 8);
    }
  } else if (l.topic === "fraction-calculations") {
    const n = s.numerator,
      d = s.denominator;
    if (s.task === "mixed") {
      expect(value("whole-parts")).toBe(s.whole * d);
      expect(value("improper")).toBeCloseTo(s.whole + n / d, 8);
    } else if (s.task === "add-subtract") {
      const result =
        n / d +
        ((s.operation === "subtract" ? -1 : 1) * s.otherNumerator) /
          s.otherDenominator;
      expect(value("calculate")).toBeCloseTo(result, 8);
      if (l.steps.some((st) => st.goal === "simplest"))
        expect(value("simplest")).toBeCloseTo(result, 8);
    } else {
      if (s.task !== "practice") expect(value("one-part")).toBe(s.quantity / d);
      expect(value(s.task === "practice" ? "remaining" : "taken")).toBe(
        s.task === "practice"
          ? s.quantity - (s.quantity * n) / d
          : (s.quantity * n) / d,
      );
    }
  } else if (s.task === "bench-read" || s.task === "bench-draw") {
    expect(value(s.task === "bench-read" ? "read" : "supplement")).toBe(
      s.task === "bench-read" ? s.degrees : 180 - s.degrees,
    );
    expect(chosen(goal(l, "classify")).meaning).toBe(
      s.degrees === 90 ? "right" : s.degrees < 90 ? "acute" : "obtuse",
    );
  } else if (s.task === "fold-solid") {
    expect(chosen(goal(l, "fold-name")).meaning).toBe(s.solid);
    expect(s.demoSolid).not.toBe(s.solid);
  } else if (s.task === "fold" || s.task === "collide") {
    const cells = cellsOf(s.nets[0], (c) => c !== "."),
      stamps = rollCube(cells);
    const byLetter = new Map(
      cells.map(([x, y]) => [
        s.nets[0].split("/")[y][x],
        stamps.get(`${x},${y}`)!,
      ]),
    );
    if (s.task === "fold")
      for (const [g, letter] of [
        ["fold-top", s.face],
        ["fold-opposite", s.second],
      ]) {
        const opposite = [...byLetter].find(
          ([, face]) => face === (byLetter.get(letter)! ^ 1),
        )![0];
        expect(chosen(goal(l, g)).meaning).toBe(`face:${opposite}`);
      }
    else {
      const pair = chosen(goal(l, "collide"))
        .meaning!.replace("pair:", "")
        .split("");
      expect(byLetter.get(pair[0])).toBe(byLetter.get(pair[1]));
      const missing = chosen(goal(l, "missing")).meaning!.replace("opp:", "");
      expect([...byLetter.values()]).not.toContain(byLetter.get(missing)! ^ 1);
    }
  } else if (s.task === "shade") {
    const reflected = s.cells
      .map((text: string) => {
        const [r, c] = text.split(",").map(Number);
        return s.mirror === "vertical"
          ? `${r},${s.cols - 1 - c}`
          : `${s.rows - 1 - r},${c}`;
      })
      .sort();
    expect(
      chosenMany(goal(l, "shade"))
        .map((c) => c.meaning!.replace("cell:", ""))
        .sort(),
    ).toEqual(reflected);
    expect(chosen(goal(l, "transfer")).meaning).toBe("mirror");
  } else if (s.task === "place") {
    const id = chosen(goal(l, "place")).meaning!.replace("line:", "");
    const line = candidateLines(s.shape, s.rotation).find((c) => c.id === id)!;
    const points = shapePoints(s.shape, s.rotation),
      [ax, ay] = line.a,
      dx = line.b[0] - ax,
      dy = line.b[1] - ay;
    for (const [x, y] of points) {
      const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
      const rx = 2 * (ax + t * dx) - x,
        ry = 2 * (ay + t * dy) - y;
      expect(
        points.some(
          ([px, py]) => Math.abs(px - rx) < 1e-8 && Math.abs(py - ry) < 1e-8,
        ),
      ).toBe(true);
    }
  } else throw new Error(`Missing independent oracle for ${l.id}`);
}
describe("saved P4 example sets", () => {
  const index = validateLibraryIndex(indexData);
  it("keeps the 64 parent tiles and validates every one of the 230 examples", () => {
    expect(buildLibraryRecords(packages, index)).toHaveLength(64);
    expect(packages).toHaveLength(294);
    for (const parent of index.lessons.filter((l) => l.level === "P4")) {
      expect(parent.examples).toHaveLength(5);
      const original = packages.find((p) => p.lesson.id === parent.lessonId)!;
      const specs = new Set([canonicalJson(original.lesson.specification)]);
      for (const id of parent.examples!) {
        const example = packages.find((p) => p.lesson.id === id)!;
        expect(validatePackage(example).package, id).toBeDefined();
        expect(example.lesson.reviewStatus).toBe("draft");
        expect(example.authors).toEqual(["Codex"]);
        expect(example.lesson.steps.map((s) => s.kind)).toEqual(
          original.lesson.steps.map((s) => s.kind),
        );
        const key = canonicalJson(example.lesson.specification);
        expect(specs.has(key), id).toBe(false);
        specs.add(key);
        const oracle = ORACLES[parent.lessonId];
        if (oracle) oracle(example.lesson.specification, example.lesson);
        else extraOracle(example.lesson.specification, example.lesson);
      }
    }
  });
  it("reproduces spread selection and complete packages without mutating the parent", () => {
    const parent = packages.find(
        (p) => p.lesson.id === "p4-protractor-bench-read",
      )!,
      before = canonicalJson(parent);
    const specs = selectExamples(parent);
    expect(selectExamples(parent)).toEqual(specs);
    for (const [i, spec] of specs.entries())
      expect(buildExample(parent, spec, i + 1)).toEqual(
        packages.find((p) => p.lesson.id === `${parent.lesson.id}-ex${i + 1}`),
      );
    expect(canonicalJson(parent)).toBe(before);
  });
  it("prunes unapproved instances and rejects duplicate, self and contradictory links", () => {
    const parent = index.lessons.find((l) => l.examples?.length)!,
      base = packages.find((p) => p.lesson.id === parent.lessonId)!,
      ex = packages.find((p) => p.lesson.id === parent.examples![0])!;
    const pruned = pruneLibraryIndex(index, [base, ex]);
    expect(pruned.lessons[0].examples).toEqual([ex.lesson.id]);
    expect(buildLibraryRecords([base, ex], pruned)).toHaveLength(1);
    for (const ids of [[base.lesson.id], [ex.lesson.id, ex.lesson.id]]) {
      const bad = structuredClone(index);
      bad.lessons.find((l) => l.lessonId === base.lesson.id)!.examples = ids;
      expect(() => validateLibraryIndex(bad)).toThrow();
    }
    const bad = structuredClone(ex);
    bad.library!.skillId = "other-skill";
    expect(() => buildLibraryRecords([base, bad], index)).toThrow(
      /contradicts parent/,
    );
  });
  it("preserves catalogue edge gluing under every quarter turn and shows all square axes", () => {
    for (const solid of SOLID_IDS)
      for (let r = 0; r < 4; r++)
        expect(checkCatalogueNet(catalogueNet(solid, r))).toEqual([]);
    expect(candidateLines("square").filter((c) => c.symmetric)).toHaveLength(4);
  });
});
