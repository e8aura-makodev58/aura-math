import type { Adapter, Lesson, Step } from "../core/types";
import { applyAnswer, assess, resetAnswer } from "./shared";

export interface ComparisonSpec {
  largerName: string;
  smallerName: string;
  larger: number;
  smaller: number;
  unknown: "larger" | "smaller" | "difference";
  unit: string;
}
export function comparisonAnswer(
  spec: ComparisonSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "relation")
    return step.goal
      ? (step.choices?.find(
          (choice) => choice.meaning === "larger-is-smaller-plus-difference",
        )?.id ?? "")
      : "larger-is-smaller-plus-difference";
  if (goal === "calculation")
    return spec.unknown === "difference"
      ? spec.larger - spec.smaller
      : spec[spec.unknown];
  return step.answer;
}
export const comparisonAdapter: Adapter = {
  id: "comparison",
  initialState: (lesson: Lesson) => ({
    specification: structuredClone(lesson.specification),
  }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      comparisonAnswer(state.specification as unknown as ComparisonSpec, step),
    ),
  describe: (state) => {
    const spec = state.specification as unknown as ComparisonSpec;
    const larger =
      spec.unknown === "larger" ? "an unknown number of" : String(spec.larger);
    const smaller =
      spec.unknown === "smaller"
        ? "an unknown number of"
        : String(spec.smaller);
    const difference =
      spec.unknown === "difference"
        ? "an unknown number of"
        : String(spec.larger - spec.smaller);
    return `${spec.largerName} has ${larger} ${spec.unit}. ${spec.smallerName} has ${smaller} ${spec.unit}. ${spec.largerName} has ${difference} more ${spec.unit} than ${spec.smallerName}.`;
  },
};
