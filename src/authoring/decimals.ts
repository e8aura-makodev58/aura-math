import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import { decimalsTopic, type DecimalsSpec } from "../topics/decimals";
import { parseDecimal, formatDecimal } from "../topics/exact";
import {
  decimalSteps as steps,
  deriveDecimalLesson as derive,
  rewriteDecimalLesson as rewrite,
} from "../content/p4-decimal-builder";
const forms = [
  "p4-decimal-places",
  "p4-decimal-add-subtract",
  "p4-decimal-multiply-divide",
  "p4-decimal-practice",
];
function template(form: string, id: string): LessonPackage {
  if (!forms.includes(form)) throw new Error("Unsupported decimal form");
  const task: DecimalsSpec["task"] =
    form === "p4-decimal-places"
      ? "places"
      : form === "p4-decimal-add-subtract"
        ? "add-subtract"
        : form === "p4-decimal-multiply-divide"
          ? "multiply-divide"
          : "practice";
  const s: DecimalsSpec = {
    task,
    a:
      task === "places"
        ? { coefficient: 3407, scale: 3 }
        : task === "add-subtract"
          ? { coefficient: 725, scale: 2 }
          : task === "multiply-divide"
            ? { coefficient: 24, scale: 1 }
            : { coefficient: 95, scale: 1 },
    b:
      task === "places"
        ? { coefficient: 347, scale: 2 }
        : task === "add-subtract"
          ? { coefficient: 26, scale: 1 }
          : { coefficient: 125, scale: 2 },
    operation: task === "multiply-divide" ? "divide" : "subtract",
    factor: task === "practice" ? 4 : 3,
    targetPlace: "thousandths",
    unit: "m",
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "decimals",
    title: {
      places: "Look closely at decimal places",
      "add-subtract": "Line up decimal units",
      "multiply-divide": "Share a decimal equally",
      practice: "A fresh decimal question",
    }[task],
    subtitle: "P4 decimal revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective: {
      places: "Read and compare decimal place values.",
      "add-subtract": "Add or subtract decimals using equal place units.",
      "multiply-divide":
        "Multiply or divide a decimal by a one-digit whole number.",
      practice: "Combine multiplication and subtraction in a decimal context.",
    }[task],
    story: "Read the decimal model.",
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
      tags: ["P4", "decimals", "general revision"],
    },
    curriculum: {
      objectiveId: `candidate.p4.decimals.${task}`,
      sources: [
        "https://practicle.sg/primary-4-math/",
        "https://sg.ixl.com/standards/maths/primary-4",
      ],
      evidenceStatus: "candidate",
    },
    authors: ["codex-p4-decimals"],
    provenance: { kind: "authored" },
    lesson,
    fixtures: lesson.steps.map((st) => ({
      stepId: st.id,
      accepted: [st.answer],
      rejected:
        st.kind === "exact"
          ? ["9999", "9998"]
          : st
              .choices!.filter((c) => c.id !== st.answer)
              .map((c) => c.id)
              .slice(0, 2),
    })),
  };
  const context = decimalsTopic.interpretation!(lesson);
  if (context) p.interpretation = context;
  return p;
}
export const decimalsAuthor: AuthorTopic = {
  id: "decimals",
  forms: forms.map((id, i) => ({
    id,
    label: [
      "Decimal places",
      "Decimal addition and subtraction",
      "Decimal multiplication and division",
      "Fresh decimal practice",
    ][i],
    description: "Original P4 candidate task using exact decimal units.",
  })),
  fields: (l) => {
    const s = l.specification as unknown as DecimalsSpec;
    const fields: TopicField[] = [
      {
        key: "a",
        label: "First / available value",
        type: "text",
        value: typeof s.a === "object" ? formatDecimal(s.a) : String(s.a),
      },
      {
        key: "b",
        label: "Second / piece value",
        type: "text",
        value: typeof s.b === "object" ? formatDecimal(s.b) : String(s.b),
      },
    ];
    if (s.task === "multiply-divide") fields.pop();
    if (s.task === "places")
      fields.push({
        key: "targetPlace",
        label: "Target place",
        type: "select",
        value: s.targetPlace,
        options: ["tenths", "hundredths", "thousandths"].map((value) => ({
          value,
          label: value,
        })),
      });
    if (s.task === "add-subtract" || s.task === "multiply-divide")
      fields.push({
        key: "operation",
        label: "Operation",
        type: "select",
        value: s.operation,
        options: (s.task === "add-subtract"
          ? ["add", "subtract"]
          : ["multiply", "divide"]
        ).map((value) => ({ value, label: value })),
      });
    if (s.task === "multiply-divide" || s.task === "practice")
      fields.push({
        key: "factor",
        label: "Whole-number factor / number of pieces (1–9)",
        type: "number",
        value: s.factor,
      });
    if (s.task === "practice")
      fields.push({
        key: "unit",
        label: "Length unit",
        type: "text",
        value: s.unit,
      });
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    if (key === "a" || key === "b")
      next.specification[key] = parseDecimal(value) ?? String(value);
    else if (key === "factor")
      next.specification.factor = /^\d+$/.test(String(value))
        ? Number(value)
        : value;
    else if (["operation", "targetPlace", "unit"].includes(key))
      next.specification[key] = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
