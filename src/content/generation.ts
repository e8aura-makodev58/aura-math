import { comparisonWording, angleReveal } from "./wording";
import type { AnglesSpec } from "../topics/angles";
import type { LessonPackage } from "./package-validation";
import { validatePackage } from "./package-validation";
import { packages } from "./lessons";

export const GENERATOR_VERSION = "bounded-v1";
export function comparisonParameters(
  smaller: number,
  difference: number,
): { smaller: number; larger: number; difference: number } {
  if (
    !Number.isSafeInteger(smaller) ||
    !Number.isSafeInteger(difference) ||
    smaller < 1 ||
    difference < 1 ||
    smaller + difference > 100
  )
    throw new Error(
      "Expected positive integers with larger amount at most 100.",
    );
  return { smaller, difference, larger: smaller + difference };
}
/** Explicit, reproducible six-package batch. No clock values or reviewer claims. */
export function generateBatch(seed: number): LessonPackage[] {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("Seed must be an unsigned 32-bit integer.");
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const usedIds = new Set<string>();
  const opaqueId = () => {
    let id: string;
    do {
      id = `option-${Math.floor(random() * 4294967296).toString(36)}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  return packages
    .filter(
      (p) => p.lesson.topic === "comparison" || p.lesson.topic === "angles",
    )
    .map((base, index) => {
      const p = structuredClone(base);
      const l = p.lesson;
      l.id = `generated-${seed}-${index + 1}`;
      l.version = 1;
      p.provenance = {
        kind: "generated",
        generatorVersion: GENERATOR_VERSION,
        seed,
      };
      if (l.topic === "comparison") {
        const sampledSmaller = 1 + Math.floor(random() * 99);
        const { smaller, larger, difference } = comparisonParameters(
          sampledSmaller,
          1 + Math.floor(random() * (100 - sampledSmaller)),
        );
        const spec = l.specification;
        spec.smaller = smaller;
        spec.larger = larger;
        const a = String(spec.largerName),
          b = String(spec.smallerName),
          unit = String(spec.unit),
          unknown = String(spec.unknown);
        const wording = comparisonWording(spec);
        const { answer, expression } = wording;
        l.story = wording.story;
        const relation = l.steps[0];
        relation.choices = shuffle(
          relation.choices!.map((choice) => ({
            ...choice,
            id: opaqueId(),
          })),
        );
        relation.answer = relation.choices.find(
          (c) => c.meaning === "larger-is-smaller-plus-difference",
        )!.id;
        const calc = l.steps[1];
        calc.answer = answer;
        calc.hints[2] = `Work out ${expression}.`;
        calc.hints[3] = `${expression} = ${answer}. Enter ${answer}.`;
        const reflection = l.steps[2];
        const correct = wording.correct;
        reflection.choices = shuffle([
          { id: opaqueId(), label: correct },
          { id: opaqueId(), label: `The two amounts must both be ${larger}.` },
        ]);
        reflection.answer = reflection.choices.find(
          (c) => c.label === correct,
        )!.id;
        reflection.hints[2] = `Read this explanation carefully: ${correct}`;
        reflection.hints[3] = `Choose: ${correct}`;
        p.interpretation = {
          entities: [a, b],
          quantities: [
            { entity: a, value: larger, unit, state: "initial" },
            { entity: b, value: smaller, unit, state: "initial" },
          ],
          relationships: [
            { kind: "additive-comparison", larger: a, smaller: b, difference },
          ],
          unknown,
          sourceSpans: [{ start: 0, end: l.story.length, text: l.story }],
          assumptions: [],
          ambiguities: [],
        };
      } else {
        const spec = l.specification as {
          task: string;
          angles: {
            id: string;
            degrees: number;
            rotation: number;
            label: string;
          }[];
        };
        const distractors = [45, 60, 120, 135];
        const targets =
          spec.task === "classify"
            ? new Set<string>()
            : new Set(
                shuffle(spec.angles.map((a) => a.id)).slice(
                  0,
                  spec.task === "identify" ? 1 : 2,
                ),
              );

        for (const angle of spec.angles) {
          angle.rotation = Math.floor(random() * 361) - 180;
          angle.degrees = targets.has(angle.id)
            ? 90
            : distractors[Math.floor(random() * distractors.length)];
        }
        const step = l.steps[0];
        if (spec.task === "identify") {
          const target = spec.angles.find((a) => a.degrees === 90)!;
          step.answer = target.id;
          step.hints[3] = angleReveal(spec as AnglesSpec);
          spec.angles = shuffle(spec.angles);
          step.choices = shuffle(step.choices!);
        }
        if (spec.task === "select") {
          spec.angles = shuffle(spec.angles);
          step.choices = shuffle(step.choices!);
          step.answer = spec.angles
            .filter((a) => a.degrees === 90)
            .map((a) => a.id);
          step.hints[2] =
            "Two cards fit the square corner. Compare openings even when the cards are turned.";
          step.hints[3] = angleReveal(spec as AnglesSpec);
        }
        if (spec.task === "classify") {
          const degrees = spec.angles[0].degrees;
          const answer = degrees < 90 ? "smaller" : "larger";
          step.answer = answer;
          step.hints[2] =
            degrees < 90
              ? "Angle A fits inside the square corner with space left over."
              : "A square corner fits inside angle A with space left over.";
          step.hints[3] = angleReveal(spec as AnglesSpec);
        }
        const reflection = l.steps[1];
        const correct = reflection.choices!.find(
          (c) => c.id === reflection.answer,
        )!;
        reflection.choices = shuffle(
          reflection.choices!.map((c) => ({ ...c, id: opaqueId() })),
        );
        reflection.answer = reflection.choices.find(
          (c) => c.label === correct.label,
        )!.id;
      }
      p.fixtures = l.steps.map((step) => ({
        stepId: step.id,
        accepted: [structuredClone(step.answer)],
        rejected:
          step.kind === "number"
            ? [Number(step.answer) + 1]
            : step.kind === "multi"
              ? [[]]
              : [step.choices!.find((c) => c.id !== step.answer)!.id],
      }));
      const result = validatePackage(p);
      if (!result.package)
        throw new Error(result.issues.map((i) => i.message).join("; "));
      return result.package;
    });
}
