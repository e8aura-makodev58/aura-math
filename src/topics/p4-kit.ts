/**
 * Shared building blocks for the P4 topic families: step builders, deterministic choice ordering,
 * exact whole-number parsing, the adapter factory and the package/fixture builders. Pure and
 * dependency-free so both the runtime topics and the author tooling can use it.
 */
import type { LessonPackage } from "../content/package-validation";
import type { Adapter, Choice, Lesson, Step } from "../core/types";
import { assessExact, type Rational } from "./exact";
import { applyAnswer, assess, resetAnswer } from "./shared";

export const esc = (v: unknown): string =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const hints = (
  a: string,
  b: string,
  c: string,
  d: string,
): Step["hints"] => [a, b, c, d];

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const hasOnlyKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
export const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;

/** Whole numbers are shown with a no-break space between thousands, as in school texts. */
export const grouped = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");

/**
 * Whole-number input: plain digits, or digits grouped in threes by spaces or commas
 * ("12 345", "12,345"). Anything else (signs, decimals, exponents, words) is a syntax error,
 * which the runtime reports as unassessable without recording an attempt.
 */
export function parseWhole(value: unknown): Rational | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value)
    .trim()
    .replace(/\u00a0/g, " ");
  if (raw.length > 14) return null;
  let digits: string;
  if (/^\d+$/.test(raw)) digits = raw;
  else if (/^\d{1,3}(?:[ ,]\d{3})+$/.test(raw))
    digits = raw.replace(/[ ,]/g, "");
  else return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n <= 99_999_999
    ? { numerator: n, denominator: 1 }
    : null;
}

/**
 * Builds `Choice`s from labelled meanings in a stable order, rotated so the correct option is not
 * always first. Ids are opaque and derive from the meaning, never from the position.
 */
export function choices(
  items: { label: string; meaning: string }[],
  rotate = 0,
  /** Keep the given order (days of the week, lines A to D) while still varying the ids. */
  keepOrder = false,
): Choice[] {
  const withIds = items.map((item, i) => ({
    // Opaque and not tied to the position or the correctness: the offset varies with `rotate`.
    id: `k${10 + ((i * 7 + 3 + (((rotate % 13) + 13) % 13) * 5) % 80)}`,
    label: item.label,
    meaning: item.meaning,
  }));
  const shift = keepOrder
    ? 0
    : ((rotate % withIds.length) + withIds.length) % withIds.length;
  return [...withIds.slice(shift), ...withIds.slice(0, shift)];
}
/**
 * Author aid: a learner should not be able to find the answer from label length alone. Sentence
 * options (a label with a space and at least 20 characters) in one step should stay within a
 * longest/shortest ratio of 1.25, or within 8 characters. Returns readable issues; empty when
 * balanced. Short labels (numbers, single words, fractions) are not compared here.
 */
export function choiceBalanceIssues(
  options: Pick<Choice, "label">[],
): string[] {
  const sentences = options
    .map((o) => o.label.length)
    .filter((n, i) => n >= 20 && options[i].label.includes(" "));
  if (sentences.length < 2) return [];
  const longest = Math.max(...sentences),
    shortest = Math.min(...sentences);
  return longest / shortest <= 1.25 || longest - shortest <= 8
    ? []
    : [
        `Choice wording lengths range from ${shortest} to ${longest} characters; keep options of similar length.`,
      ];
}
export const choiceFor = (step: Step, meaning: string): string =>
  step.choices?.find((c) => c.meaning === meaning)?.id ?? "";

export const exactStep = (
  id: string,
  title: string,
  prompt: string,
  hs: Step["hints"],
): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "exact",
  answer: "0",
  hints: hs,
});
export const choiceStep = (
  id: string,
  title: string,
  prompt: string,
  options: Choice[],
  hs: Step["hints"],
): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "choice",
  choices: options,
  answer: "",
  hints: hs,
});
export const multiStep = (
  id: string,
  title: string,
  prompt: string,
  options: Choice[],
  hs: Step["hints"],
): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "multi",
  choices: options,
  answer: [],
  hints: hs,
});
/** Structured reflection: authored meaning, so it is reported as unverified by the validator. */
export function reflectionStep(
  prompt: string,
  correct: string,
  wrong: [string, string],
  hs: Step["hints"],
  rotate = 0,
): Step {
  const options = choices(
    [
      { label: correct, meaning: "reason" },
      { label: wrong[0], meaning: "wrong-a" },
      { label: wrong[1], meaning: "wrong-b" },
    ],
    rotate,
  ).map(({ id, label }) => ({ id, label }));
  const answer = options.find((o) => o.label === correct)!.id;
  return {
    id: "reflection",
    goal: "reflection",
    title: "Explain your thinking",
    prompt,
    kind: "choice",
    choices: options,
    answer,
    hints: hs,
  };
}

/** Sets every assessed step's answer from the model; reflection keeps its authored key. */
export function deriveAnswers(
  lesson: Lesson,
  specErrors: (spec: unknown) => string[],
  answerFor: (lesson: Lesson, step: Step) => Step["answer"],
): Lesson {
  const next = structuredClone(lesson);
  if (specErrors(next.specification).length) return next;
  for (const step of next.steps)
    if (step.goal !== "reflection") step.answer = answerFor(next, step);
  return next;
}

export function fixturesFor(lesson: Lesson): LessonPackage["fixtures"] {
  return lesson.steps.map((step) => {
    if (step.kind === "exact" || step.kind === "number") {
      const n = Number(String(step.answer).replace(/\s/g, ""));
      const wrong = Number.isFinite(n)
        ? [String(n + 1), String(n + 10)]
        : ["1", "2"];
      return {
        stepId: step.id,
        accepted: [step.answer as string],
        rejected: wrong,
      };
    }
    if (step.kind === "multi") {
      const right = step.answer as string[];
      const other = step.choices!.filter((c) => !right.includes(c.id));
      return {
        stepId: step.id,
        accepted: [right],
        rejected: [
          right.slice(0, -1).length ? right.slice(0, -1) : [other[0].id],
          other.length ? [...right, other[0].id] : right.slice(1),
        ],
      };
    }
    return {
      stepId: step.id,
      accepted: [step.answer as string],
      rejected: step
        .choices!.filter((c) => c.id !== step.answer)
        .map((c) => c.id)
        .slice(0, 2),
    };
  });
}

export interface PackageOptions {
  lesson: Lesson;
  form: string;
  family: string;
  author: string;
  taskLabel: string;
  specErrors: (spec: unknown) => string[];
  /** Replaces the default curriculum sources when given. */
  sources?: string[];
  /** Tags added after the default ones when given. */
  extraTags?: string[];
}
export function p4Package(o: PackageOptions): LessonPackage {
  return {
    schemaVersion: 3,
    locale: "en-SG",
    adapterVersion: 1,
    library: {
      level: "P4",
      skillId: o.form,
      tags: ["P4", o.family, "general revision", ...(o.extraTags ?? [])],
    },
    curriculum: {
      objectiveId: `candidate.p4.${o.family}.${o.taskLabel}`,
      sources: o.sources ?? [
        "https://practicle.sg/primary-4-math/",
        "https://sg.ixl.com/standards/maths/primary-4",
      ],
      evidenceStatus: "candidate",
    },
    authors: [o.author],
    provenance: { kind: "authored" },
    lesson: o.lesson,
    fixtures: fixturesFor(o.lesson),
  };
}

/** Adapter for a family whose answers all derive from `answerFor`. */
export function makeAdapter<S>(options: {
  id: Adapter["id"];
  answerFor: (spec: S, step: Step) => Step["answer"];
  describe: (spec: S) => string;
  parser?: (value: unknown) => Rational | null;
}): Adapter {
  const parser = options.parser ?? parseWhole;
  return {
    id: options.id,
    initialState: (lesson) => ({
      specification: structuredClone(lesson.specification),
    }),
    apply: applyAnswer,
    resetStep: resetAnswer,
    evaluate: (state, step) => {
      const spec = state.specification as unknown as S;
      const expected = options.answerFor(spec, step);
      return step.kind === "exact"
        ? assessExact(state, step, parser, expected)
        : assess(state, step, expected);
    },
    describe: (state) => options.describe(state.specification as unknown as S),
  };
}

/** Response kinds a goal must use, so a step cannot silently change how it is answered. */
export function checkKinds(
  lesson: Lesson,
  expected: Record<string, Step["kind"]>,
): string[] {
  const errors: string[] = [];
  for (const step of lesson.steps)
    if (expected[step.goal ?? ""] !== step.kind)
      errors.push(`Response kind contradicts goal ${step.goal}`);
  return errors;
}
export function checkMeanings(
  step: Step,
  required: string[],
  label: string,
): string[] {
  const got = (step.choices ?? []).map((c) => c.meaning ?? "").sort();
  return got.join(",") === [...required].sort().join(",")
    ? []
    : [`${label} choices must have each supported meaning exactly once`];
}
