import type { Lesson, Step } from "../core/types";
import { authorTopics } from "../authoring/registry";
import { runtimeTopics } from "../topics/registry";
import { canonicalJson } from "../content-release";
import { fixturesFor } from "../topics/p4-kit";
import { FAMILY_PROFILES } from "../practice/family-domains";
import { parseDecimal, formatDecimal, parseFraction } from "../topics/exact";
import { validatePackage, type LessonPackage } from "./package-validation";
import { exampleCandidates } from "./example-domains";
export const EXAMPLE_GENERATOR_VERSION = "p4-examples-v1";
export function exampleSeed(parent: string, ordinal: number): number {
  let h = 2166136261;
  for (const char of `${parent}:${ordinal}`)
    h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function answerKey(lesson: Lesson): string {
  return canonicalJson(
    lesson.steps
      .filter((s) => s.goal !== "reflection")
      .map((step) => {
        const selected = (id: string) =>
          step.choices?.find((c) => c.id === id)?.meaning ??
          step.choices?.find((c) => c.id === id)?.label ??
          id;
        return [
          step.goal,
          Array.isArray(step.answer)
            ? step.answer.map(selected).sort()
            : step.choices
              ? selected(String(step.answer))
              : step.answer,
        ];
      }),
  );
}
function rewrite(
  parent: LessonPackage,
  specification: Record<string, unknown>,
): Lesson {
  const lesson = structuredClone(parent.lesson);
  lesson.specification = specification;
  return authorTopics[lesson.topic]!.rewrite(lesson);
}
/** Features are the exact specification leaves: numeric places/operands/data/angles,
 * categorical task/operation/scale/shape/net/floor/solid/orientation and grid cells.
 * Each numeric field is normalized over this parent's finite domain. Arrays retain
 * their indices so chart category order and grid shape affect distance. */
function features(spec: Record<string, unknown>): Map<string, string | number> {
  const out = new Map<string, string | number>();
  const visit = (value: unknown, path: string) => {
    if (value && typeof value === "object")
      Object.entries(value).forEach(([key, v]) => visit(v, `${path}.${key}`));
    else if (typeof value === "number") out.set(path, value);
    else out.set(path, String(value));
  };
  visit(spec, "");
  return out;
}
export function selectExamples(
  parent: LessonPackage,
  count = 5,
): Record<string, unknown>[] {
  const normalized = (spec: Record<string, unknown>) => {
    const copy = { ...spec };
    if (copy.rotation === 0) delete copy.rotation;
    return canonicalJson(copy);
  };
  const base = normalized(parent.lesson.specification);
  const domain = exampleCandidates(parent).filter(
    (s) => normalized(s) !== base,
  );
  if (domain.length < count)
    throw new Error(
      `${parent.lesson.id}: only ${domain.length} valid specifications for ${count} examples`,
    );
  const candidates = domain
    .map((spec) => ({
      spec,
      features: features(spec),
      answer: answerKey(rewrite(parent, spec)),
      tie: exampleSeed(canonicalJson(spec), 0),
    }))
    .sort(
      (a, b) =>
        a.tie - b.tie ||
        canonicalJson(a.spec).localeCompare(canonicalJson(b.spec)),
    );
  const scales = new Map<string, number[]>();
  for (const c of candidates)
    for (const [key, value] of c.features)
      if (typeof value === "number") {
        const bounds = scales.get(key) ?? [value, value];
        bounds[0] = Math.min(bounds[0], value);
        bounds[1] = Math.max(bounds[1], value);
        scales.set(key, bounds);
      }
  const distance = (
    a: Map<string, string | number>,
    b: Map<string, string | number>,
  ) => {
    let total = 0;
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(key),
        y = b.get(key),
        range = scales.get(key);
      total +=
        typeof x === "number" && typeof y === "number" && range
          ? Math.abs(x - y) / (range[1] - range[0] || 1)
          : x === y
            ? 0
            : 1;
    }
    return total;
  };
  const chosen: typeof candidates = [];
  const usedAnswers = new Set([answerKey(parent.lesson)]);
  const chosenFeatures = [features(parent.lesson.specification)];
  for (let i = 0; i < count; i++) {
    const available = candidates.filter((c) => !chosen.includes(c));
    const diverse = available.filter((c) => !usedAnswers.has(c.answer));
    let best = (diverse.length ? diverse : available)[0],
      score = -1;
    for (const c of diverse.length ? diverse : available) {
      const d = Math.min(...chosenFeatures.map((f) => distance(c.features, f)));
      if (d > score) {
        best = c;
        score = d;
      }
    }
    chosen.push(best);
    chosenFeatures.push(best.features);
    usedAnswers.add(best.answer);
  }
  return chosen.map((c) => structuredClone(c.spec));
}
function rotateChoices(step: Step, seed: number, index: number) {
  if (step.kind !== "choice" || !step.choices?.length) return;
  const offset = (seed + index) % step.choices.length;
  step.choices = [
    ...step.choices.slice(offset),
    ...step.choices.slice(0, offset),
  ];
}
export function buildExample(
  parent: LessonPackage,
  spec: Record<string, unknown>,
  ordinal: number,
): LessonPackage {
  const p = structuredClone(parent),
    seed = exampleSeed(parent.lesson.id, ordinal);
  p.schemaVersion = 3;
  p.lesson = rewrite(parent, structuredClone(spec));
  p.lesson.id = `${parent.lesson.id}-ex${ordinal}`;
  p.lesson.version = 1;
  p.lesson.reviewStatus = "draft";
  const ordered = FAMILY_PROFILES[parent.lesson.id]?.ordered ?? [];
  p.lesson.steps.forEach((step, i) => {
    if (!ordered.includes(step.goal ?? "")) rotateChoices(step, seed, i);
  });
  p.lesson = authorTopics[p.lesson.topic]!.derive(p.lesson);
  p.authors = ["Codex"];
  p.provenance = {
    kind: "generated",
    generatorVersion: EXAMPLE_GENERATOR_VERSION,
    seed,
  };
  p.library = {
    ...parent.library!,
    tags: [...new Set([...(parent.library?.tags ?? []), "example"])],
  };
  const interpretation = runtimeTopics[p.lesson.topic]!.interpretation?.(
    p.lesson,
  );
  if (interpretation) p.interpretation = interpretation;
  else delete p.interpretation;
  p.fixtures = fixturesFor(p.lesson);
  p.fixtures!.forEach((fixture, i) => {
    const step = p.lesson.steps[i];
    if (step.kind === "exact" && p.lesson.topic === "decimals") {
      const value = parseDecimal(step.answer)!;
      fixture.rejected = [
        formatDecimal({
          ...value,
          coefficient: value.coefficient + 10 ** value.scale,
        }),
      ];
    }
    if (step.kind === "exact" && p.lesson.topic === "fraction-calculations") {
      const value = parseFraction(step.answer)!;
      fixture.rejected = [
        `${value.numerator + value.denominator}/${value.denominator}`,
      ];
    }
    if (p.lesson.topic === "area-perimeter") {
      const alternatives: Record<string, string[]> = {
        method: ["subtract-cutout", "split-add"],
        "boundary-method": ["edge-sum", "outer-equivalent"],
      };
      const meanings = alternatives[step.goal ?? ""];
      if (meanings) {
        fixture.accepted = step
          .choices!.filter((c) => meanings.includes(c.meaning ?? c.id))
          .map((c) => c.id);
        fixture.rejected = step
          .choices!.filter((c) => !fixture.accepted.includes(c.id))
          .map((c) => c.id);
      }
    }
  });
  const result = validatePackage(p);
  if (!result.package)
    throw new Error(
      `${p.lesson.id}: ${JSON.stringify(result.issues.filter((i) => i.severity === "error"))}`,
    );
  return p;
}
