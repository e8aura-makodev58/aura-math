import type { Lesson, Step } from "../core/types";
import {
  fractionCalculationsAnswer,
  validateFractionCalculationsSpec,
  type FractionCalculationsSpec,
} from "../topics/fraction-calculations";
import { formatFraction } from "../topics/exact";

const hints = (a: string, b: string, c: string, d: string): Step["hints"] => [
  a,
  b,
  c,
  d,
];
const exact = (
  id: string,
  title: string,
  prompt: string,
  h: Step["hints"],
): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "exact",
  answer: "0",
  hints: h,
});
// Distractor wording differs a little by task so that, across the family, the correct
// sentence is sometimes the longest, sometimes the shortest and sometimes in between.
const FRACTION_WRONG: Record<
  FractionCalculationsSpec["task"],
  [string, string]
> = {
  mixed: [
    "Parts can be counted together if wholes differ.",
    "The denominator tells how many objects are left.",
  ],
  "add-subtract": [
    "Parts can be counted together even if the wholes differ.",
    "The denominator says how many objects are left.",
  ],
  "of-quantity": [
    "Parts can be counted together even if the wholes differ.",
    "The denominator tells us how many objects are left.",
  ],
  practice: [
    "Parts can be counted together even if the wholes differ.",
    "The denominator tells us how many objects are left.",
  ],
};
const reflection = (task: FractionCalculationsSpec["task"]): Step => ({
  id: "reflection",
  goal: "reflection",
  title: "Explain the equal parts",
  prompt: "What makes the fraction calculation fair?",
  kind: "choice",
  choices: [
    { id: "r8", label: FRACTION_WRONG[task][0] },
    { id: "r3", label: "The wholes match and each part has the same size." },
    { id: "r6", label: FRACTION_WRONG[task][1] },
  ],
  answer: "r3",
  hints: hints(
    "Look at the whole first.",
    "Equal fractions need equal-size wholes.",
    "Count parts that have the same size.",
    "Choose: The wholes match and each part has the same size.",
  ),
});
export function fractionSteps(s: FractionCalculationsSpec): Step[] {
  const fraction = `${s.numerator}/${s.denominator}`;
  if (s.task === "mixed")
    return [
      exact(
        "whole-parts",
        "Count full-strip parts",
        `How many ${s.denominator}-sized parts are in ${s.whole} whole strips?`,
        hints(
          "Count one whole strip first.",
          `Each whole has ${s.denominator} equal parts.`,
          `Multiply ${s.whole} by ${s.denominator}.`,
          `${s.whole} × ${s.denominator} = ${s.whole * s.denominator} full-strip parts.`,
        ),
      ),
      exact(
        "improper",
        "Write an improper fraction",
        `Write ${s.whole} ${fraction} as one improper fraction.`,
        hints(
          "Keep the same equal-size parts.",
          "Count full strips and the extra part.",
          `${s.whole * s.denominator} + ${s.numerator} = ${s.whole * s.denominator + s.numerator} parts.`,
          `The equivalent fraction is ${s.whole * s.denominator + s.numerator}/${s.denominator}.`,
        ),
      ),
      reflection(s.task),
    ];
  if (s.task === "add-subtract") {
    const other = `${s.otherNumerator}/${s.otherDenominator}`;
    const result = formatFraction({
      numerator:
        s.numerator * s.otherDenominator +
        (s.operation === "add" ? 1 : -1) * s.otherNumerator * s.denominator,
      denominator: s.denominator * s.otherDenominator,
    });
    return [
      {
        id: "equal-units",
        goal: "equal-units",
        title: "Match equal parts",
        prompt: "What must match before adding or subtracting fractions?",
        kind: "choice",
        choices: [
          {
            id: "u2",
            label: "Only the numerators need to be the same.",
            meaning: "numerators",
          },
          {
            id: "u5",
            label: "Use one common partition of the same whole.",
            meaning: "common-partition",
          },
          {
            id: "u9",
            label: "Count large pieces as if they were small pieces.",
            meaning: "mixed-parts",
          },
        ],
        answer: "",
        hints: hints(
          "Look at the size of one part.",
          s.denominator === 6 && s.otherDenominator === 3
            ? "A third and a sixth are different-size parts."
            : `Parts of size 1/${s.denominator} and 1/${s.otherDenominator} are different sizes.`,
          "Rename one fraction using equal-size parts.",
          "Choose one common partition of the same whole.",
        ),
      },
      exact(
        "calculate",
        "Calculate the fraction",
        `Work out ${fraction} ${s.operation === "add" ? "+" : "−"} ${other}.`,
        hints(
          "Make equal-size parts first.",
          `Use a common partition of ${Math.max(s.denominator, s.otherDenominator)} parts.`,
          "Count the parts in the common partition.",
          `The result is ${result}.`,
        ),
      ),
      exact(
        "simplest",
        "Write the simplest form",
        `Write the result of ${fraction} ${s.operation === "add" ? "+" : "−"} ${other} in simplest form.`,
        hints(
          "Compare the numerator and denominator.",
          "Can both be divided by the same whole number?",
          "Divide both by their greatest common factor.",
          `The simplest form is ${result}.`,
        ),
      ),
      reflection(s.task),
    ];
  }
  if (s.task === "of-quantity")
    return [
      exact(
        "one-part",
        "Find one equal part",
        `What is 1/${s.denominator} of ${s.quantity} ${s.unit}?`,
        hints(
          "Split the full set into equal groups.",
          `There are ${s.denominator} equal parts.`,
          `Divide ${s.quantity} by ${s.denominator}.`,
          `One part has ${s.quantity / s.denominator} ${s.unit}.`,
        ),
      ),
      exact(
        "taken",
        "Find the named fraction",
        `What is ${fraction} of ${s.quantity} ${s.unit}?`,
        hints(
          "Use the one-part amount.",
          "Take the number of parts in the numerator.",
          `${s.quantity / s.denominator} × ${s.numerator}.`,
          `${fraction} of ${s.quantity} is ${(s.quantity / s.denominator) * s.numerator} ${s.unit}.`,
        ),
      ),
      reflection(s.task),
    ];
  const taken = (s.quantity / s.denominator) * s.numerator,
    left = s.quantity - taken;
  return [
    exact(
      "remaining",
      "Find what remains",
      `A box has ${s.quantity} ${s.unit}. ${fraction} are used. How many ${s.unit} remain?`,
      hints(
        "Find the used part first.",
        `Divide ${s.quantity} into ${s.denominator} equal parts.`,
        `${s.numerator} parts have ${taken} ${s.unit}.`,
        `${s.quantity} − ${taken} = ${left} ${s.unit} remain.`,
      ),
    ),
    reflection(s.task),
  ];
}
export function deriveFractionLesson(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateFractionCalculationsSpec(next.specification).length) return next;
  for (const step of next.steps)
    if (step.goal !== "reflection")
      step.answer = fractionCalculationsAnswer(
        next.specification as unknown as FractionCalculationsSpec,
        step,
      );
  return next;
}
export function rewriteFractionLesson(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateFractionCalculationsSpec(next.specification).length) return next;
  const s = next.specification as unknown as FractionCalculationsSpec;
  const oldReflection = next.steps.find((step) => step.goal === "reflection");
  next.steps = fractionSteps(s).map((step) =>
    step.goal === "reflection" && oldReflection ? oldReflection : step,
  );
  next.story =
    s.task === "practice"
      ? next.steps[0].prompt
      : s.task === "mixed"
        ? `Use equal strips to show ${s.whole} ${s.numerator}/${s.denominator}.`
        : s.task === "add-subtract"
          ? `Use the same whole to ${s.operation === "add" ? "add" : "subtract"} ${s.otherNumerator}/${s.otherDenominator} ${s.operation === "add" ? "to" : "from"} ${s.numerator}/${s.denominator}.`
          : `Share ${s.quantity} ${s.unit} into ${s.denominator} equal parts.`;
  return deriveFractionLesson(next);
}
