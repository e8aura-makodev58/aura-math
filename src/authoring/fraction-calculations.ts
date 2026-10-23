import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  fractionCalculationsTopic,
  type FractionCalculationsSpec,
} from "../topics/fraction-calculations";
import {
  fractionSteps as steps,
  deriveFractionLesson as derive,
  rewriteFractionLesson as rewrite,
} from "../content/p4-fraction-builder";
const forms = [
  "p4-mixed-and-improper",
  "p4-fraction-add-subtract",
  "p4-fraction-of-quantity",
  "p4-fraction-practice",
];
function template(form: string, id: string): LessonPackage {
  if (!forms.includes(form)) throw new Error("Unsupported P4 fraction form");
  const task: FractionCalculationsSpec["task"] =
    form === forms[0]
      ? "mixed"
      : form === forms[1]
        ? "add-subtract"
        : form === forms[2]
          ? "of-quantity"
          : "practice";
  const s: FractionCalculationsSpec = {
    task,
    whole: 2,
    numerator: task === "add-subtract" ? 5 : 3,
    denominator: task === "add-subtract" ? 6 : task === "mixed" ? 5 : 4,
    otherNumerator: 1,
    otherDenominator: 3,
    operation: "subtract",
    quantity: task === "practice" ? 32 : 28,
    unit: task === "practice" ? "stickers" : "counters",
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "fraction-calculations",
    title: {
      mixed: "Turn a mixed number into a fraction",
      "add-subtract": "Combine equal fraction parts",
      "of-quantity": "Find a fraction of a set",
      practice: "A fresh fraction question",
    }[task],
    subtitle: "P4 fraction revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective: {
      mixed: "Connect mixed and improper fractions.",
      "add-subtract": "Add or subtract fractions with related denominators.",
      "of-quantity": "Find a fraction of an integer set.",
      practice: "Find a fraction of a set and what remains.",
    }[task],
    story: "Look at the fraction model.",
    reviewStatus: "draft",
    specification: s as unknown as Record<string, unknown>,
    steps: steps(s),
  });
  const p: LessonPackage = {
    schemaVersion: 3,
    locale: "en-SG",
    adapterVersion: 1,
    library: {
      level: "P4",
      skillId: form,
      tags: ["P4", "fractions", "general revision"],
    },
    curriculum: {
      objectiveId: `candidate.p4.fractions.${task}`,
      sources: [
        "https://practicle.sg/primary-4-math/",
        "https://sg.ixl.com/standards/maths/primary-4",
      ],
      evidenceStatus: "candidate",
    },
    authors: ["codex-p4-fractions"],
    provenance: { kind: "authored" },
    lesson,
    fixtures: lesson.steps.map((step) => ({
      stepId: step.id,
      accepted: [step.answer],
      rejected:
        step.kind === "exact"
          ? ["9999", "9998"]
          : step
              .choices!.filter((choice) => choice.id !== step.answer)
              .map((choice) => choice.id)
              .slice(0, 2),
    })),
  };
  const context = fractionCalculationsTopic.interpretation!(lesson);
  if (context) p.interpretation = context;
  return p;
}
export const fractionCalculationsAuthor: AuthorTopic = {
  id: "fraction-calculations",
  forms: forms.map((id, index) => ({
    id,
    label: [
      "Mixed and improper fractions",
      "Add or subtract fractions",
      "Fraction of a quantity",
      "Fresh fraction practice",
    ][index],
    description: "Original P4 candidate using equal whole parts.",
  })),
  fields: (lesson) => {
    const s = lesson.specification as unknown as FractionCalculationsSpec;
    const fields: TopicField[] = [
      {
        key: "numerator",
        label: "First numerator",
        type: "number",
        value: s.numerator,
      },
      {
        key: "denominator",
        label: "Equal parts in each whole (2–12)",
        type: "number",
        value: s.denominator,
      },
    ];
    if (s.task === "mixed")
      fields.unshift({
        key: "whole",
        label: "Number of whole strips",
        type: "number",
        value: s.whole,
      });
    if (s.task === "add-subtract")
      fields.push(
        {
          key: "otherNumerator",
          label: "Second numerator",
          type: "number",
          value: s.otherNumerator,
        },
        {
          key: "otherDenominator",
          label: "Second denominator",
          type: "number",
          value: s.otherDenominator,
        },
        {
          key: "operation",
          label: "Fraction operation",
          type: "select",
          value: s.operation,
          options: ["add", "subtract"].map((value) => ({
            value,
            label: value,
          })),
        },
      );
    if (s.task === "of-quantity" || s.task === "practice")
      fields.push(
        {
          key: "quantity",
          label: "Whole set quantity (1–120)",
          type: "number",
          value: s.quantity,
        },
        {
          key: "unit",
          label: "Objects in the set",
          type: "text",
          value: s.unit,
        },
      );
    return fields;
  },
  patch: (lesson, key, value) => {
    const next = structuredClone(lesson);
    if (
      [
        "whole",
        "numerator",
        "denominator",
        "otherNumerator",
        "otherDenominator",
        "quantity",
      ].includes(key)
    )
      next.specification[key] = /^\d+$/.test(String(value))
        ? Number(value)
        : value;
    else if (["operation", "unit"].includes(key))
      next.specification[key] = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
