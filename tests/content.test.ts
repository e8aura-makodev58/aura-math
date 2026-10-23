import { describe, it, expect } from "vitest";
import { packages } from "../src/content/lessons";
import {
  parsePackage,
  validatePackage,
  MAX_PACKAGE_BYTES,
} from "../src/content/package-validation";
import { generateBatch, comparisonParameters } from "../src/content/generation";

describe("versioned content authoring", () => {
  it("migrates six original IDs and answers without approval claims", () => {
    expect(packages.slice(0, 6).map((p) => p.lesson.id)).toEqual([
      "ribbon-collection",
      "garden-pots",
      "shell-discovery",
      "corner-detective",
      "angle-opening",
      "right-angle-hunt",
    ]);
    expect(packages.slice(0, 3).map((p) => p.lesson.steps[1].answer)).toEqual([
      18, 16, 8,
    ]);
    for (const p of packages)
      expect(parsePackage(JSON.stringify(p)).package).toEqual(p);
  });
  it("reports independent errors and rejects unsafe/oversized inputs", () => {
    const p = structuredClone(packages[0]);
    p.schemaVersion = 4 as 1;
    p.locale = "other" as "en-SG";
    p.lesson.title = "";
    p.lesson.objective = "";
    const result = validatePackage(p);
    expect(result.package).toBeUndefined();
    expect(
      result.issues.filter((i) => i.severity === "error").length,
    ).toBeGreaterThanOrEqual(4);
    expect(parsePackage('{"__proto__":{}}').package).toBeUndefined();
    expect(
      parsePackage("x".repeat(MAX_PACKAGE_BYTES + 1)).issues[0].message,
    ).toContain("bytes");
  });
  it("rejects stale source spans, contradictory interpretation and fixture responses", () => {
    const p = structuredClone(packages[0]);
    p.lesson.story = "Changed wording";
    p.interpretation!.quantities[0].value = 99;
    p.fixtures = [{ stepId: "calculation", accepted: [0], rejected: [18] }];
    const r = validatePackage(p);
    expect(r.package).toBeUndefined();
    expect(r.issues.some((i) => i.path.includes("sourceSpans"))).toBe(true);
    expect(r.issues.some((i) => i.path.includes("fixtures"))).toBe(true);
  });
  it("rejects duplicate JSON object keys including escaped spellings", () => {
    expect(
      parsePackage('{"schemaVersion":1,"schemaVersion":2}').issues[0].message,
    ).toContain("Duplicate");
    expect(parsePackage('{"id":1,"\\u0069d":2}').issues[0].message).toContain(
      "Duplicate",
    );
    expect(parsePackage(JSON.stringify(packages[0])).package).toBeDefined();
  });
  it("requires comparison interpretation while allowing geometry without a story model", () => {
    const p = structuredClone(packages[0]);
    delete p.interpretation;
    expect(validatePackage(p).package).toBeUndefined();
    expect(validatePackage(packages[3]).package).toBeDefined();
  });
  it("bounds quantities, angle rotations and generated parameters", () => {
    expect(comparisonParameters(1, 99)).toEqual({
      smaller: 1,
      difference: 99,
      larger: 100,
    });
    for (const pair of [
      [0, 1],
      [1, 0],
      [100, 1],
      [1.5, 1],
    ])
      expect(() =>
        comparisonParameters(...(pair as [number, number])),
      ).toThrow();
    const p = structuredClone(packages[3]);
    (p.lesson.specification.angles as { rotation: number }[])[0].rotation = 181;
    expect(validatePackage(p).package).toBeUndefined();
  });
  it("generates coherent reproducible separate drafts over many seeds with opaque choice IDs", () => {
    expect(generateBatch(4)).toEqual(generateBatch(4));
    expect(() => generateBatch(-1)).toThrow();
    for (let seed = 0; seed < 100; seed++)
      for (const p of generateBatch(seed)) {
        expect(p.provenance.kind).toBe("generated");
        expect(validatePackage(p).package).toBeDefined();
        const l = p.lesson,
          s = l.specification;
        if (l.topic === "comparison") {
          const a = Number(s.larger),
            b = Number(s.smaller),
            d = a - b;
          expect(a).toBeLessThanOrEqual(100);
          expect(d).toBeGreaterThan(0);
          const expected =
            s.unknown === "larger" ? a : s.unknown === "smaller" ? b : d;
          expect(l.steps[1].answer).toBe(expected);
          expect(l.steps[1].hints[3]).toContain(`Enter ${expected}.`);
          expect(l.steps[0].answer).not.toContain("larger");
          expect(l.steps[2].answer).not.toContain("reason");
        } else {
          const angles = s.angles as {
            id: string;
            degrees: number;
            rotation: number;
          }[];
          for (const a of angles)
            expect(Math.abs(a.rotation)).toBeLessThanOrEqual(180);
          const rights = angles
            .filter((a) => a.degrees === 90)
            .map((a) => a.id);
          if (s.task === "identify") expect(l.steps[0].answer).toBe(rights[0]);
          if (s.task === "select")
            expect(new Set(l.steps[0].answer as string[])).toEqual(
              new Set(rights),
            );
        }
      }
  });
});

describe("generation coverage", () => {
  it("exhausts positive integer comparison domain", () => {
    let count = 0;
    for (let smaller = 1; smaller < 100; smaller++)
      for (let difference = 1; smaller + difference <= 100; difference++) {
        expect(comparisonParameters(smaller, difference).larger).toBe(
          smaller + difference,
        );
        count++;
      }
    expect(count).toBe(4950);
  });
  it("varies correct positions and independently checks classify goals", () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 100; seed++)
      for (const p of generateBatch(seed)) {
        const reflection = p.lesson.steps.at(-1)!;
        positions.add(
          reflection.choices!.findIndex((c) => c.id === reflection.answer),
        );
        expect(String(reflection.answer)).toMatch(/^option-[a-z0-9]+$/);
        if (
          p.lesson.topic === "angles" &&
          p.lesson.specification.task === "classify"
        ) {
          const a = (p.lesson.specification.angles as { degrees: number }[])[0];
          expect(p.lesson.steps[0].answer).toBe(
            a.degrees < 90 ? "smaller" : a.degrees > 90 ? "larger" : "right",
          );
        }
      }
    expect([...positions].sort()).toEqual([0, 1]);
  });
  it("reproduces canonical package digests", async () => {
    const { digest } = await import("../src/content-release");
    expect(await digest(generateBatch(1))).toBe(await digest(generateBatch(1)));
  });
});

describe("generated preview masking", () => {
  it("keeps each unknown quantity out of semantic descriptions before reveal", async () => {
    const { comparisonAdapter } = await import("../src/topics/comparison");
    for (const p of generateBatch(1).filter(
      (p) => p.lesson.topic === "comparison",
    )) {
      const spec = p.lesson.specification;
      const description = comparisonAdapter.describe(
        comparisonAdapter.initialState(p.lesson),
      );
      if (spec.unknown === "larger")
        expect(description).toContain(
          `${spec.largerName} has an unknown number of`,
        );
      if (spec.unknown === "smaller")
        expect(description).toContain(
          `${spec.smallerName} has an unknown number of`,
        );
      if (spec.unknown === "difference")
        expect(description).toContain("has an unknown number of");
    }
  });
});

describe("generated angle target variation", () => {
  it("varies labeled targets and derives reveal text from their exact model", () => {
    const identifyTargets = new Set<string>(),
      selectTargets = new Set<string>();
    for (let seed = 0; seed < 100; seed++)
      for (const p of generateBatch(seed).filter(
        (p) => p.lesson.topic === "angles",
      )) {
        const spec = p.lesson.specification;
        const step = p.lesson.steps[0];
        const cards = spec.angles as {
          id: string;
          label: string;
          degrees: number;
        }[];
        const right = cards.filter((a) => a.degrees === 90);
        if (spec.task === "identify") {
          expect(right).toHaveLength(1);
          expect(step.answer).toBe(right[0].id);
          identifyTargets.add(right[0].id);
          expect(step.hints[3]).toBe(
            `Card ${right[0].label} is a right angle. Choose ${right[0].label}.`,
          );
        }
        if (spec.task === "select") {
          expect(right).toHaveLength(2);
          expect(new Set(step.answer as string[])).toEqual(
            new Set(right.map((a) => a.id)),
          );
          selectTargets.add(
            right
              .map((a) => a.id)
              .sort()
              .join(","),
          );
          expect(step.hints[3]).toBe(
            `Select ${right
              .map((a) => a.label)
              .sort()
              .join(" and ")}, then check your answer.`,
          );
          expect(step.hints[2]).not.toContain("A and");
        }
      }
    expect(identifyTargets.size).toBe(3);
    expect(selectTargets.size).toBe(6);
  });
});

describe("P4 release and legacy package compatibility", () => {
  it("reads versions1/2/3 and rejects unsupported4 without altering legacy packages", () => {
    for (const p of packages)
      expect(parsePackage(JSON.stringify(p)).package).toEqual(p);
    expect(new Set(packages.map((p) => p.schemaVersion))).toEqual(
      new Set([1, 2, 3]),
    );
    for (const p of packages)
      expect(
        validatePackage({ ...p, schemaVersion: 4 }).package,
      ).toBeUndefined();
  });
  it("loads a digest-bound exact P4 package and rejects an edited hint or identity", async () => {
    const { loadReleasedContent } = await import("../src/released-content");
    const { digest } = await import("../src/content-release");
    const payload = packages.find(
      (p) => p.lesson.id === "p4-decimal-practice",
    )!;
    const entry = {
      id: payload.lesson.id,
      version: payload.lesson.version,
      digest: await digest(payload),
      payload,
    };
    await expect(loadReleasedContent([entry])).resolves.toEqual([
      payload.lesson,
    ]);
    const altered = structuredClone(entry);
    altered.payload.lesson.steps[0].hints[0] = "Changed hint";
    await expect(loadReleasedContent([altered])).rejects.toThrow(/digest/);
    await expect(
      loadReleasedContent([{ ...entry, id: "wrong-id" }]),
    ).rejects.toThrow(/identity/);
  });
});
