import type { Adapter, Evaluation, State, Step } from "../core/types";

export const applyAnswer: Adapter["apply"] = (state, action) => {
  if (action.type !== "answer") return { state, outcome: "unassessable" };
  const value = action.value;
  if (!(
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  )) {
    return { state, outcome: "rejected" };
  }
  return {
    state: { ...state, answer: Array.isArray(value) ? [...value] : value },
    outcome: "applied",
  };
};

export function assess(
  state: State,
  step: Step,
  expected: Step["answer"],
): Evaluation {
  const answer = state.answer;
  if (
    answer === undefined ||
    answer === "" ||
    (Array.isArray(answer) && answer.length === 0)
  ) {
    return {
      outcome: "incomplete",
      feedbackKey: "answer.incomplete",
      matchedAlternative: null,
      feedback: "Choose or enter an answer first.",
    };
  }
  let correct = false;
  if (step.kind === "number") {
    const number =
      typeof answer === "number"
        ? answer
        : typeof answer === "string" && /^\d+$/.test(answer.trim())
          ? Number(answer)
          : NaN;
    correct = Number.isSafeInteger(number) && number === expected;
  } else if (step.kind === "multi") {
    correct =
      Array.isArray(answer) &&
      Array.isArray(expected) &&
      new Set(answer).size === answer.length &&
      answer.length === expected.length &&
      expected.every((item) => answer.includes(item));
  } else correct = answer === expected;
  return correct
    ? {
        outcome: "correct",
        feedbackKey: "answer.correct",
        matchedAlternative: "expected",
        feedback: "That fits. You can move to the next step.",
      }
    : {
        outcome: "incorrect",
        feedbackKey: "answer.incorrect",
        matchedAlternative: null,
        feedback:
          "Not quite yet. Look again at the relationship or shape, then try again.",
      };
}

export const resetAnswer: Adapter["resetStep"] = (state) => {
  const next = { ...state };
  delete next.answer;
  return next;
};
