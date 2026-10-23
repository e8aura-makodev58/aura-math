export type Mode = "independent" | "guided";
export type TopicId =
  | "comparison"
  | "angles"
  | "place-value"
  | "equal-groups"
  | "fractions"
  | "picture-graphs"
  | "decimals"
  | "fraction-calculations"
  | "area-perimeter"
  | "whole-numbers"
  | "line-graphs"
  | "symmetry"
  | "nets"
  | "pie-charts"
  | "bar-charts"
  | "angle-measure";
export type State = Record<string, unknown>;
export interface Action {
  type: string;
  value?: unknown;
}
export interface Evaluation {
  outcome: "correct" | "incorrect" | "incomplete" | "unassessable";
  feedback: string;
  feedbackKey?: string;
  matchedAlternative?: string | null;
}
export interface Choice {
  id: string;
  label: string;
  meaning?: string;
}
export interface Step {
  id: string;
  goal?: string;
  title: string;
  prompt: string;
  kind: "choice" | "number" | "multi" | "exact";
  choices?: Choice[];
  answer: string | number | string[];
  hints: [string, string, string, string];
}
export interface Lesson {
  id: string;
  version: number;
  topic: TopicId;
  title: string;
  subtitle: string;
  level: string;
  minutes: number;
  story: string;
  objective: string;
  specification: Record<string, unknown>;
  steps: Step[];
  reviewStatus: "draft";
}
export type AssessmentEvent =
  | { type: "worked-solution"; stepIndex: number }
  | { type: "hint"; stepIndex: number; rung: number }
  | { type: "reveal"; stepIndex: number; rung: 4 }
  | { type: "mode"; stepIndex: number; from: Mode; to: Mode }
  | {
      type: "submission";
      stepIndex: number;
      stepId: string;
      action: Action;
      outcome: Evaluation["outcome"];
      feedbackKey: string;
      matchedAlternative: string | null;
    };
export interface AssessmentContext {
  step: Step;
  previousState: State;
  action: Action;
  events: readonly AssessmentEvent[];
}
export interface Adapter {
  id: TopicId;
  initialState(lesson: Lesson): State;
  apply(
    state: State,
    action: Action,
  ): { state: State; outcome: "applied" | "rejected" | "unassessable" };
  evaluate(state: State, step: Step, context?: AssessmentContext): Evaluation;
  resetStep(state: State, previous: Step, next: Step): State;
  describe(state: State): string;
}
export interface Session {
  lessonId: string;
  mode: Mode;
  state: State;
  stepIndex: number;
  hintsUsed: number;
  hintRung: number;
  submissions: number;
  hadSupport: boolean;
  hadFacilitator: boolean;
  completed: boolean;
  feedback: Evaluation | null;
  events: AssessmentEvent[];
  history: { stepId: string; action: Action; outcome: Evaluation["outcome"] }[];
}
