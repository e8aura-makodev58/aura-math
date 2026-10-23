import type { Lesson } from "../core/types";
import { answerFor, runtimeTopics } from "../topics/registry";
import type { AnglesSpec } from "../topics/angles";

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}
function record(
  value: unknown,
  path: string,
  keys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "expected an object");
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result))
    if (!keys.includes(key)) fail(`${path}.${key}`, "unknown field");
  return result;
}
function text(value: unknown, path: string): void {
  if (typeof value !== "string" || !value.trim())
    fail(path, "expected non-empty text");
}
function integer(value: unknown, path: string, minimum = 0): void {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    fail(path, `expected integer ≥ ${minimum}`);
}
function oneOf(value: unknown, path: string, choices: unknown[]): void {
  if (!choices.includes(value))
    fail(path, `expected one of ${choices.join(", ")}`);
}
function unique(values: unknown[], path: string): void {
  if (new Set(values).size !== values.length)
    fail(path, "duplicate identifiers");
}
function equalAnswers(a: unknown, b: unknown): boolean {
  return Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v) => b.includes(v))
    : a === b;
}

/** Draft preview schema. This does not validate human approval or semantic fidelity to a story. */
export function validateLesson(input: unknown): Lesson {
  const lesson = record(input, "lesson", [
    "id",
    "version",
    "topic",
    "title",
    "subtitle",
    "level",
    "minutes",
    "story",
    "objective",
    "specification",
    "steps",
    "reviewStatus",
  ]);
  for (const key of ["id", "title", "subtitle", "level", "story", "objective"])
    text(lesson[key], `lesson.${key}`);
  integer(lesson.version, "lesson.version", 1);
  integer(lesson.minutes, "lesson.minutes", 1);
  oneOf(lesson.topic, "lesson.topic", [
    "comparison",
    "angles",
    "place-value",
    "equal-groups",
    "fractions",
    "picture-graphs",
    "decimals",
    "fraction-calculations",
    "area-perimeter",
    "whole-numbers",
    "line-graphs",
    "symmetry",
    "nets",
    "pie-charts",
    "bar-charts",
    "angle-measure",
  ]);
  oneOf(lesson.reviewStatus, "lesson.reviewStatus", ["draft"]);
  let requiredSteps: string[];
  if (lesson.topic === "comparison") {
    const spec = record(lesson.specification, "specification", [
      "largerName",
      "smallerName",
      "larger",
      "smaller",
      "unknown",
      "unit",
    ]);
    for (const key of ["largerName", "smallerName", "unit"])
      text(spec[key], `specification.${key}`);
    integer(spec.larger, "specification.larger", 1);
    integer(spec.smaller, "specification.smaller", 1);
    if (Number(spec.larger) > 100 || Number(spec.smaller) > 100)
      fail("specification", "quantities must be at most 100");
    if ((spec.larger as number) <= (spec.smaller as number))
      fail("specification", "larger must exceed smaller");
    oneOf(spec.unknown, "specification.unknown", [
      "larger",
      "smaller",
      "difference",
    ]);
    requiredSteps = ["relation", "calculation", "reflection"];
  } else if (lesson.topic === "angles") {
    const spec = record(lesson.specification, "specification", [
      "angles",
      "task",
    ]);
    oneOf(spec.task, "specification.task", ["identify", "classify", "select"]);
    if (
      !Array.isArray(spec.angles) ||
      spec.angles.length < 1 ||
      spec.angles.length > 8
    )
      fail("specification.angles", "expected angle cards");
    spec.angles.forEach((value, index) => {
      const angle = record(value, `angles[${index}]`, [
        "id",
        "degrees",
        "rotation",
        "label",
      ]);
      text(angle.id, `angles[${index}].id`);
      text(angle.label, `angles[${index}].label`);
      integer(angle.degrees, `angles[${index}].degrees`, 1);
      if ((angle.degrees as number) >= 180)
        fail(`angles[${index}].degrees`, "must be less than 180");
      if (
        typeof angle.rotation !== "number" ||
        !Number.isFinite(angle.rotation) ||
        Math.abs(Number(angle.rotation)) > 180
      )
        fail(`angles[${index}].rotation`, "expected finite number");
    });
    const angles = spec.angles as AnglesSpec["angles"];
    unique(
      angles.map((angle) => angle.id),
      "specification.angles",
    );
    const rightCount = angles.filter((angle) => angle.degrees === 90).length;
    if (spec.task === "identify" && rightCount !== 1)
      fail("specification.angles", "identify requires exactly one right angle");
    if (spec.task === "classify" && angles.length !== 1)
      fail("specification.angles", "classify requires exactly one card");
    if (spec.task === "select" && !rightCount)
      fail("specification.angles", "select requires at least one right angle");
    requiredSteps = [
      spec.task === "identify" ? "recognise" : String(spec.task),
      "reflection",
    ];
  } else {
    const topic = runtimeTopics[lesson.topic as Lesson["topic"]];
    if (!topic) fail("lesson.topic", "unsupported topic");
    const errors = topic.validateSpec(lesson.specification);
    if (errors.length) fail("specification", errors.join("; "));
    if (
      !Array.isArray(lesson.steps) ||
      lesson.steps.length < 2 ||
      lesson.steps.length > 8
    )
      fail("lesson.steps", "expected 2–8 supported steps");
    requiredSteps = lesson.steps.map((s) => String(s?.id));
  }
  if (
    !Array.isArray(lesson.steps) ||
    lesson.steps.length !== requiredSteps.length
  )
    fail("lesson.steps", `expected steps ${requiredSteps.join(", ")}`);
  lesson.steps.forEach((value, index) => {
    const path = `steps[${index}]`;
    const step = record(value, path, [
      "id",
      "title",
      "prompt",
      "kind",
      "choices",
      "answer",
      "hints",
      "goal",
    ]);
    oneOf(step.id, `${path}.id`, [requiredSteps[index]]);
    text(step.title, `${path}.title`);
    text(step.prompt, `${path}.prompt`);
    const expectedKind =
      step.id === "calculation"
        ? "number"
        : step.id === "select"
          ? "multi"
          : "choice";
    oneOf(
      step.kind,
      `${path}.kind`,
      runtimeTopics[lesson.topic as Lesson["topic"]]
        ? ["choice", "number", "multi", "exact"]
        : [expectedKind],
    );
    if (!Array.isArray(step.hints) || step.hints.length !== 4)
      fail(`${path}.hints`, "expected four hint rungs");
    step.hints.forEach((hint, rung) => text(hint, `${path}.hints[${rung}]`));
    if (step.kind === "exact") {
      text(step.answer, `${path}.answer`);
      if (String(step.answer).length > 40 || step.choices !== undefined)
        fail(path, "Exact response needs short canonical text and no choices");
    } else if (step.kind === "number") {
      integer(step.answer, `${path}.answer`);
      if (step.choices !== undefined)
        fail(`${path}.choices`, "number step does not use choices");
    } else {
      if (!Array.isArray(step.choices) || step.choices.length < 2)
        fail(`${path}.choices`, "expected at least two choices");
      const ids = step.choices.map((value, choiceIndex) => {
        const choice = record(value, `${path}.choices[${choiceIndex}]`, [
          "id",
          "label",
          "meaning",
        ]);
        text(choice.id, `${path}.choices[${choiceIndex}].id`);
        text(choice.label, `${path}.choices[${choiceIndex}].label`);
        return choice.id;
      });
      unique(ids, `${path}.choices`);
      if (step.kind === "multi") {
        if (!Array.isArray(step.answer) || !step.answer.length)
          fail(`${path}.answer`, "expected non-empty answer array");
        unique(step.answer, `${path}.answer`);
        step.answer.forEach((answer) => oneOf(answer, `${path}.answer`, ids));
      } else oneOf(step.answer, `${path}.answer`, ids);
      if (
        lesson.topic === "angles" &&
        ["recognise", "select"].includes(String(step.id))
      ) {
        const cardIds = (
          lesson.specification as unknown as AnglesSpec
        ).angles.map((angle) => angle.id);
        if (!equalAnswers(ids, cardIds))
          fail(`${path}.choices`, "choices must match all angle cards");
      }
    }
  });
  const result = structuredClone(input) as Lesson;
  const topic = runtimeTopics[result.topic];
  if (topic) {
    const errors = topic.validateSteps(result);
    if (errors.length) fail("lesson.steps", errors.join("; "));
  }
  for (const step of result.steps) {
    const expected = answerFor(result, step);
    if (!equalAnswers(step.answer, expected))
      fail(
        `steps.${step.id}.answer`,
        "answer contradicts the mathematical specification",
      );
  }
  return result;
}

export function loadLesson(
  input: unknown,
  mode: "preview" | "learner" = "preview",
): Lesson {
  if (mode !== "preview")
    throw new Error(
      "Learner publication is disabled. Draft content is available only in development preview.",
    );
  return validateLesson(input);
}
