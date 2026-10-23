import { afterEach, describe, expect, it, vi } from "vitest";
import { packages } from "../src/content/lessons";
import { canonicalJson } from "../src/content-release";
import {
  createVariantRun,
  P4_GENERATOR_VERSION,
  type VariantRun,
} from "../src/practice/generation";
import { decimalsTopic, type DecimalsSpec } from "../src/topics/decimals";
import type { FractionCalculationsSpec } from "../src/topics/fraction-calculations";
import { parseDecimal, parseFraction } from "../src/topics/exact";
import { validatePackage } from "../src/content/package-validation";

const ids = [
  "p4-decimal-add-subtract",
  "p4-decimal-places",
  "p4-decimal-multiply-divide",
  "p4-decimal-practice",
  "p4-mixed-and-improper",
  "p4-fraction-add-subtract",
  "p4-fraction-of-quantity",
  "p4-fraction-practice",
];
const source = (id: string) => packages.find((p) => p.lesson.id === id)!;
const ready = (run: VariantRun) => {
  const result = run.next();
  if (result.status !== "ready") throw new Error(result.message);
  return result;
};
const h = (s: DecimalsSpec["a"]) => s.coefficient * 10 ** (2 - s.scale);
function commonFactor(a: number, b: number): number {
  for (let i = Math.min(a, b); i >= 1; i--)
    if (a % i === 0 && b % i === 0) return i;
  return 1;
}
function rationalEquals(
  input: string | number | string[],
  numerator: number,
  denominator: number,
) {
  const actual = parseFraction(input);
  expect(actual).not.toBeNull();
  expect(actual!.numerator * denominator).toBe(numerator * actual!.denominator);
}
afterEach(() => vi.restoreAllMocks());
describe("deterministic draft P4 variants", () => {
  it("recognises only complete canonical starters and uint32 seeds", () => {
    for (const id of ids) {
      expect(createVariantRun(structuredClone(source(id)), 0)).not.toBeNull();
      const edited = structuredClone(source(id));
      edited.lesson.story += " An author's custom sentence.";
      expect(createVariantRun(edited, 0)).toBeNull();
      edited.lesson.story = source(id).lesson.story;
      edited.lesson.specification.unit = "different unit";
      expect(createVariantRun(edited, 0)).toBeNull();
    }
    // Hands-on workbench lessons are not served by the generator.
    for (const id of ["p4-mirror-line-bench", "p4-fold-a-cube-net"])
      expect(createVariantRun(source(id), 0)).toBeNull();
    for (const seed of [-1, 1.5, NaN, Infinity, 4294967296])
      expect(createVariantRun(source(ids[0]), seed)).toBeNull();
  });
  it("replays numeric fingerprints, teaching and choices while isolating instance identities", () => {
    for (const id of ids) {
      const first = createVariantRun(source(id), 4294967295)!;
      const second = createVariantRun(source(id), 4294967295)!;
      const before = canonicalJson(source(id));
      for (let i = 0; i < 3; i++) {
        const a = ready(first),
          b = ready(second);
        expect(a.descriptor.fingerprint).toBe(b.descriptor.fingerprint);
        expect(a.package.lesson.id).not.toBe(b.package.lesson.id);
        expect(a.package.lesson.steps).toEqual(b.package.lesson.steps);
        expect(a.package.lesson.story).toBe(b.package.lesson.story);
        expect(a.package.provenance).toEqual({
          kind: "generated",
          seed: 4294967295,
          generatorVersion: P4_GENERATOR_VERSION,
        });
        expect(a.package.lesson.reviewStatus).toBe("draft");
        expect(a.descriptor.ordinal).toBe(i + 1);
      }
      expect(canonicalJson(source(id))).toBe(before);
    }
  });
  for (const id of ids)
    it(`${id}: complete domain satisfies independent mathematical predicates, unique tuples and base exclusion`, () => {
      const p = source(id),
        run = createVariantRun(p, 18429)!;
      const seen = new Set<string>();
      const directions = [0, 0];
      let count = 0;
      for (;;) {
        const next = run.next();
        if (next.status === "exhausted") break;
        if (next.status === "invalid") throw new Error(next.message);
        expect(seen.has(next.descriptor.fingerprint)).toBe(false);
        seen.add(next.descriptor.fingerprint);
        expect(next.package.lesson.specification).not.toEqual(
          p.lesson.specification,
        );
        const l = next.package.lesson;
        if (l.topic === "decimals") {
          const s = l.specification as unknown as DecimalsSpec;
          const A = h(s.a),
            B = h(s.b);
          const answer = (goal: string) =>
            parseDecimal(l.steps.find((step) => step.goal === goal)!.answer)!;
          if (s.task === "places") {
            expect(s.targetPlace).toBe("thousandths");
            const aHundredths = Math.floor(s.a.coefficient / 10) % 10;
            // Two honest families: the shorter decimal is larger (hundredths 0 against a
            // non-zero hundredths), or the longer one is (same hundredths, extra thousandths).
            expect([0, s.b.coefficient % 10]).toContain(aHundredths);
            expect(s.b.coefficient % 10).toBeGreaterThan(0);
            expect(Math.floor(s.a.coefficient / 100)).toBe(
              Math.floor(s.b.coefficient / 10),
            );
            const longerLarger = aHundredths !== 0;
            if (longerLarger)
              expect(s.a.coefficient).toBeGreaterThan(s.b.coefficient * 10);
            else expect(s.a.coefficient).toBeLessThan(s.b.coefficient * 10);
            directions[longerLarger ? 1 : 0]++;
            expect(answer("digit-value")).toEqual({
              coefficient: s.a.coefficient % 10,
              scale: 3,
            });
            expect(
              l.steps
                .find((st) => st.goal === "compare")!
                .choices!.find(
                  (c) =>
                    c.id ===
                    l.steps.find((st) => st.goal === "compare")!.answer,
                )!.meaning,
            ).toBe(longerLarger ? "left" : "right");
          } else {
            let expected = 0;
            if (s.task === "add-subtract") {
              expect(s.operation).toBe("subtract");
              expect(A).toBeGreaterThan(B);
              expect(A % 10).toBeGreaterThanOrEqual(B % 10);
              expect(Math.floor(A / 10) % 10).toBeLessThan(
                Math.floor(B / 10) % 10,
              );
              expect(Math.floor(A / 100)).toBeLessThanOrEqual(9);
              expected = A - B;
            } else if (s.task === "multiply-divide") {
              expect(s.operation).toBe("divide");
              expect(s.factor).toBeGreaterThanOrEqual(2);
              expect(s.factor).toBeLessThanOrEqual(9);
              expect(A % s.factor).toBe(0);
              expect((A / s.factor) % 10).toBe(0);
              expect(A / s.factor).toBeGreaterThan(0);
              expect(A / s.factor).toBeLessThan(100);
              expect(A).toBeGreaterThan(100);
              expect(A % 100).not.toBe(0);
              expected = A / s.factor;
              const inverse = answer("inverse");
              expect(h(inverse)).toBe(A);
            } else {
              expect(s.factor).toBe(4);
              expect((B * s.factor) % 100).toBe(0);
              expect(A).toBeGreaterThan(B * s.factor);
              expect(A % 100).not.toBe(0);
              expected = A - B * s.factor;
              expect(l.story).toContain("4 equal pieces");
              expect(next.package.interpretation!.sourceSpans[0].text).toBe(
                l.story,
              );
            }
            expect(h(answer("calculate"))).toBe(expected);
            expect(
              l.steps.find((st) => st.goal === "calculate")!.hints[3],
            ).toContain(
              String(l.steps.find((st) => st.goal === "calculate")!.answer),
            );
          }
        } else {
          const s = l.specification as unknown as FractionCalculationsSpec;
          const answer = (goal: string) =>
            l.steps.find((st) => st.goal === goal)!.answer;
          if (s.task === "mixed") {
            expect(s.whole).toBe(2);
            expect(s.denominator).toBeGreaterThanOrEqual(3);
            expect(s.denominator).toBeLessThanOrEqual(6);
            expect(commonFactor(s.numerator, s.denominator)).toBe(1);
            rationalEquals(answer("whole-parts"), s.denominator * 2, 1);
            rationalEquals(
              answer("improper"),
              2 * s.denominator + s.numerator,
              s.denominator,
            );
          } else if (s.task === "add-subtract") {
            expect(s.operation).toBe("subtract");
            expect(s.denominator).toBe(s.otherDenominator * 2);
            const remainder = s.numerator - s.otherNumerator * 2;
            expect(
              l.steps.find((st) => st.goal === "equal-units")!.hints[1],
            ).toBe(
              s.denominator === 6 && s.otherDenominator === 3
                ? "A third and a sixth are different-size parts."
                : `Parts of size 1/${s.denominator} and 1/${s.otherDenominator} are different sizes.`,
            );
            expect(remainder).toBeGreaterThan(0);
            expect(commonFactor(s.numerator, s.denominator)).toBe(1);
            expect(commonFactor(s.otherNumerator, s.otherDenominator)).toBe(1);
            expect(commonFactor(remainder, s.denominator)).toBeGreaterThan(1);
            rationalEquals(answer("calculate"), remainder, s.denominator);
            rationalEquals(answer("simplest"), remainder, s.denominator);
            const simplest = parseFraction(answer("simplest"))!;
            expect(commonFactor(simplest.numerator, simplest.denominator)).toBe(
              1,
            );
          } else if (s.task === "of-quantity") {
            // Widened in p4-bounded-v3: a non-unit proper fraction in simplest form of 3 to 10
            // equal groups. Oracle: count the groups, then the selected groups, by repeated
            // addition rather than by the model's division.
            expect(s.numerator).toBeGreaterThanOrEqual(2);
            expect(s.numerator).toBeLessThan(s.denominator);
            expect(commonFactor(s.numerator, s.denominator)).toBe(1);
            let groupSize = 0;
            while ((groupSize + 1) * s.denominator <= s.quantity) groupSize++;
            expect(groupSize * s.denominator).toBe(s.quantity);
            expect(groupSize).toBeGreaterThanOrEqual(3);
            expect(groupSize).toBeLessThanOrEqual(10);
            let taken = 0;
            for (let i = 0; i < s.numerator; i++) taken += groupSize;
            rationalEquals(answer("one-part"), groupSize, 1);
            rationalEquals(answer("taken"), taken, 1);
            expect(l.story).toContain(String(s.quantity));
            expect(l.story).toContain(`${s.denominator} equal groups`);
            expect(l.steps[0].prompt).toContain(s.unit);
          } else {
            expect(s.numerator).toBe(3);
            expect(s.denominator).toBe(4);
            expect(s.quantity % 4).toBe(0);
            expect(s.quantity).toBeGreaterThanOrEqual(16);
            expect(s.quantity).toBeLessThanOrEqual(40);
            rationalEquals(answer("remaining"), s.quantity / 4, 1);
          }
        }
        count++;
        expect(count).toBeLessThanOrEqual(10_000);
      }
      expect(count).toBeGreaterThan(0);
      if (id === "p4-decimal-add-subtract") expect(count).toBe(8504);
      if (id === "p4-decimal-places") {
        expect(count).toBe(6560);
        // Both directions occur about equally often, so the shorter number is not a cue.
        expect(Math.abs(directions[0] - directions[1])).toBeLessThan(20);
      }
      if (id === "p4-fraction-practice") expect(count).toBe(6);
      if (id === "p4-fraction-of-quantity") expect(count).toBe(95);
      expect(run.next().status).toBe("exhausted");
      run.restart();
      expect(ready(run).descriptor.ordinal).toBe(1);
    }, 60_000);
  it("returns defensively owned packages and restart reproduces a tuple with a fresh ID", () => {
    const run = createVariantRun(source(ids[0]), 1)!;
    const first = ready(run);
    const firstSpec = structuredClone(first.package.lesson.specification);
    first.package.lesson.story = "Changed by caller";
    first.package.lesson.specification.a = { coefficient: 0, scale: 1 };
    run.restart();
    const restarted = ready(run);
    expect(restarted.descriptor.fingerprint).toBe(first.descriptor.fingerprint);
    expect(restarted.package.lesson.specification).toEqual(firstSpec);
    expect(restarted.package.lesson.id).not.toBe(first.package.lesson.id);
    expect(validatePackage(restarted.package).package).toBeDefined();
  });
  it("a validation failure does not consume a tuple or replace the completed example", () => {
    const p = source(ids[0]),
      before = canonicalJson(p);
    const control = createVariantRun(p, 4242)!;
    const run = createVariantRun(p, 4242)!;
    const check = vi
      .spyOn(decimalsTopic, "validateSteps")
      .mockReturnValue(["Forced broken candidate"]);
    expect(run.next().status).toBe("invalid");
    expect(run.next().status).toBe("invalid");
    check.mockRestore();
    const result = ready(run);
    expect(result.descriptor.ordinal).toBe(1);
    expect(result.descriptor.fingerprint).toBe(
      ready(control).descriptor.fingerprint,
    );
    expect(canonicalJson(p)).toBe(before);
  });
  it("rejects future catalogue starters whose IDs remain but skill signatures change", async () => {
    const edited = ids.map((id) => structuredClone(source(id)));
    edited[0].lesson.specification.operation = "add";
    edited[1].lesson.specification.targetPlace = "tenths";
    edited[2].lesson.specification.operation = "multiply";
    edited[3].lesson.specification.factor = 5;
    edited[4].lesson.specification.whole = 3;
    edited[5].lesson.specification.otherDenominator = 6;
    edited[6].lesson.specification.numerator = 1;
    edited[7].lesson.specification.quantity = 44;
    vi.resetModules();
    vi.doMock("../src/content/lessons", () => ({ packages: edited }));
    try {
      const future = await import("../src/practice/generation");
      for (const p of edited) expect(future.createVariantRun(p, 0)).toBeNull();
    } finally {
      vi.doUnmock("../src/content/lessons");
      vi.resetModules();
    }
  });
});
