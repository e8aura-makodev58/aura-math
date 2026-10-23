import type { Adapter, Step } from "../core/types";
import { applyAnswer, assess, resetAnswer } from "./shared";

export interface AnglesSpec {
  angles: { id: string; degrees: number; rotation: number; label: string }[];
  task: "identify" | "classify" | "select";
}
export function anglesAnswer(spec: AnglesSpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "recognise")
    return spec.angles.find((angle) => angle.degrees === 90)?.id ?? "";
  if (goal === "select")
    return spec.angles
      .filter((angle) => angle.degrees === 90)
      .map((angle) => angle.id);
  if (goal === "classify")
    return spec.angles[0].degrees < 90
      ? "smaller"
      : spec.angles[0].degrees > 90
        ? "larger"
        : "right";
  return step.answer;
}
export const anglesAdapter: Adapter = {
  id: "angles",
  initialState: (lesson) => ({
    specification: structuredClone(lesson.specification),
  }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      anglesAnswer(state.specification as unknown as AnglesSpec, step),
    ),
  describe: (state) => {
    const spec = state.specification as unknown as AnglesSpec;
    return `Angle cards ${spec.angles.map((angle) => angle.label).join(", ")}. Compare the opening between the arms with the reference corner. Turning a card does not change its opening.${state.answer ? ` Current answer: ${String(state.answer)}.` : ""}`;
  },
};
