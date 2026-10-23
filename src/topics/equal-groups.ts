import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
export interface EqualGroupsSpec {
  groupCount: number;
  perGroup: number;
  task: "total" | "each" | "groups";
  unit: string;
  groupLabel: string;
}
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function equalGroupsAnswer(
  s: EqualGroupsSpec,
  step: Step,
): Step["answer"] {
  if (step.goal === "recognise")
    return step.choices?.find((c) => c.meaning === s.task)?.id ?? "";
  if (step.goal === "calculate")
    return s.task === "total"
      ? s.groupCount * s.perGroup
      : s.task === "each"
        ? s.perGroup
        : s.groupCount;
  return step.answer;
}
export function validateEqualGroupsSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Expected equal-groups specification"];
  const s = input as Record<string, unknown>;
  const errors: string[] = [];
  if (
    Object.keys(s).some(
      (k) =>
        !["groupCount", "perGroup", "task", "unit", "groupLabel"].includes(k),
    )
  )
    errors.push("Unknown equal-groups specification field");
  if (
    !Number.isSafeInteger(s.groupCount) ||
    Number(s.groupCount) < 2 ||
    Number(s.groupCount) > 10
  )
    errors.push("Group count must be an integer from 2 to 10");
  if (
    ![2, 3, 4, 5, 10].includes(Number(s.perGroup)) ||
    typeof s.perGroup !== "number"
  )
    errors.push("Each group must contain 2, 3, 4, 5 or 10 objects");
  if (Number(s.groupCount) * Number(s.perGroup) > 50)
    errors.push("Total must not exceed 50");
  if (!["total", "each", "groups"].includes(String(s.task)))
    errors.push("Unsupported equal-groups task");
  for (const k of ["unit", "groupLabel"])
    if (
      typeof s[k] !== "string" ||
      !String(s[k]).trim() ||
      String(s[k]).length > 80
    )
      errors.push(`${k} must be plain text of 1–80 characters`);
  return errors;
}
function validateSteps(l: Lesson): string[] {
  const errors: string[] = [];
  const s = l.specification as unknown as EqualGroupsSpec;
  if (l.steps.map((x) => x.goal).join(",") !== "recognise,calculate,reflection")
    errors.push("Expected recognise, calculate and reflection goals");
  for (const step of l.steps) {
    if (
      step.goal === "recognise" &&
      (step.kind !== "choice" ||
        step.choices?.length !== 3 ||
        new Set(step.choices.map((c) => c.meaning)).size !== 3 ||
        !step.choices.every((c) =>
          ["total", "each", "groups"].includes(c.meaning ?? ""),
        ))
    )
      errors.push("Recognise needs one choice for total, each and groups");
    if (step.goal === "calculate" && step.kind !== "number")
      errors.push("Calculate needs a number response");
    if (step.goal === "reflection" && step.kind !== "choice")
      errors.push("Reflection needs an authored choice");
    if (
      step.goal !== "reflection" &&
      step.answer !== equalGroupsAnswer(s, step)
    )
      errors.push("Answer contradicts equal-groups model");
  }
  return errors;
}
export const equalGroupsAdapter: Adapter = {
  id: "equal-groups",
  initialState: (l) => ({ specification: structuredClone(l.specification) }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      equalGroupsAnswer(
        state.specification as unknown as EqualGroupsSpec,
        step,
      ),
    ),
  describe: (state) => {
    const s = state.specification as unknown as EqualGroupsSpec;
    return `${s.groupCount} separate ${s.groupLabel}. Each contains ${s.perGroup} ${s.unit}. Every group has the same number of counters.`;
  },
};
function render(l: Lesson): string {
  const s = l.specification as unknown as EqualGroupsSpec;
  const rows = Math.ceil(s.groupCount / 2);
  return `<svg viewBox="0 0 600 ${rows * 125 + 40}" role="img" aria-label="${escape(equalGroupsAdapter.describe({ specification: s }))}">${Array.from({ length: s.groupCount }, (_, i) => `<g transform="translate(${(i % 2) * 300} ${Math.floor(i / 2) * 125})"><rect x="10" y="10" width="280" height="110" rx="14" fill="#f5f1e7" stroke="#315c46"/><text x="150" y="32" text-anchor="middle" font-size="15">Group ${i + 1}</text>${Array.from({ length: s.perGroup }, (_, j) => `<circle cx="${42 + (j % 5) * 52}" cy="${58 + Math.floor(j / 5) * 36}" r="11" fill="#b8d1bf" stroke="#315c46"/>`).join("")}</g>`).join("")}<text x="300" y="${rows * 125 + 24}" text-anchor="middle" font-size="16">Counters represent ${escape(s.unit)} · all groups are equal</text></svg>`;
}
export const equalGroupsTopic: RuntimeTopic = {
  id: "equal-groups",
  label: "Equal groups",
  visualTitle: "Equal-group counters",
  adapter: equalGroupsAdapter,
  validateSpec: validateEqualGroupsSpec,
  validateSteps,
  answer: (l, s) =>
    equalGroupsAnswer(l.specification as unknown as EqualGroupsSpec, s),
  render,
};
