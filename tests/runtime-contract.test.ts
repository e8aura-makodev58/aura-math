import { describe, expect, it } from "vitest";
import { lessons } from "../src/content/lessons";
import {
  createSession,
  nextStep,
  submit,
  switchMode,
  useHint,
} from "../src/core/runtime";
import type { Adapter } from "../src/core/types";
import { comparisonAdapter } from "../src/topics/comparison";

// Synthetic process-sensitive task: this demonstrates the contract, not a
// curriculum misconception detector or a teaching claim for the pilot lessons.
const processAdapter: Adapter = {
  ...comparisonAdapter,
  initialState: () => ({ response: null }),
  apply: (state, action) =>
    action.type === "process-answer"
      ? { state: { ...state, response: action.value }, outcome: "applied" }
      : { state, outcome: "rejected" },
  resetStep: (state) => ({ ...state, response: null }),
  evaluate: (state, _step, context) => {
    const supported =
      context?.events.some((event) => event.type === "hint") ?? false;
    return {
      outcome: state.response === "ready" ? "correct" : "incorrect",
      feedback: supported ? "Supported trace" : "Neutral trace",
      feedbackKey: supported ? "synthetic.supported" : "synthetic.neutral",
      matchedAlternative: state.response === "ready" ? "ready" : null,
    };
  },
};

describe("assessment context and ordered events", () => {
  it("distinguishes synthetic traces with the same final state and is neutral without history", () => {
    const lesson = lessons[0];
    const initial = createSession(lesson, processAdapter);
    const action = { type: "process-answer", value: "ready" };
    const independent = submit(initial, lesson, processAdapter, action);
    const supported = submit(useHint(initial), lesson, processAdapter, action);
    expect(independent.state).toEqual(supported.state);
    expect(independent.feedback?.feedbackKey).toBe("synthetic.neutral");
    expect(supported.feedback?.feedbackKey).toBe("synthetic.supported");
    expect(
      processAdapter.evaluate(independent.state, lesson.steps[0]).feedbackKey,
    ).toBe("synthetic.neutral");
    expect(supported.events.map((event) => event.type)).toEqual([
      "hint",
      "submission",
    ]);
  });

  it("passes prior state, current goal and submitted action without mutating session snapshots", () => {
    const lesson = lessons[0];
    const initial = createSession(lesson, processAdapter);
    const adapter: Adapter = {
      ...processAdapter,
      evaluate: (state, step, context) => {
        expect(context?.step).toBe(step);
        expect(context?.previousState).toEqual({ response: null });
        expect(context?.action).toEqual({
          type: "process-answer",
          value: "ready",
        });
        expect(context?.events).toEqual([]);
        return processAdapter.evaluate(state, step, context);
      },
    };
    submit(initial, lesson, adapter, {
      type: "process-answer",
      value: "ready",
    });
    expect(initial.state).toEqual({ response: null });
    expect(initial.events).toEqual([]);
  });

  it("records hints, reveal, mode changes and assessment in exact order", () => {
    const lesson = lessons[0];
    let session = createSession(lesson, processAdapter);
    session = switchMode(session, "guided");
    const switched = session;
    expect(switchMode(session, "guided")).toBe(switched);
    for (let rung = 1; rung <= 4; rung++) session = useHint(session);
    session = switchMode(session, "independent");
    session = submit(session, lesson, processAdapter, {
      type: "process-answer",
      value: "ready",
    });
    expect(session.events.map((event) => event.type)).toEqual([
      "mode",
      "hint",
      "hint",
      "hint",
      "hint",
      "reveal",
      "mode",
      "submission",
    ]);
    expect(session.events.at(-1)).toMatchObject({
      stepId: lesson.steps[0].id,
      matchedAlternative: "ready",
    });
    expect(session.hadFacilitator).toBe(true);
  });

  it("uses the adapter reset hook for its own response fields", () => {
    const lesson = lessons[0];
    const assessed = submit(
      createSession(lesson, processAdapter),
      lesson,
      processAdapter,
      { type: "process-answer", value: "ready" },
    );
    const next = nextStep(assessed, lesson, processAdapter);
    expect(next.state).toEqual({ response: null });
    expect(assessed.state).toEqual({ response: "ready" });
    expect(next.stepIndex).toBe(1);
    expect(next.events).toBe(assessed.events);
  });

  it("rejects an unsupported mutating adapter action without state or progress changes", () => {
    const lesson = lessons[0];
    const adapter: Adapter = {
      ...processAdapter,
      apply: (state) => {
        state.response = "mutated";
        return { state, outcome: "rejected" };
      },
    };
    const initial = createSession(lesson, adapter);
    const rejected = submit(initial, lesson, adapter, { type: "unsupported" });
    expect(rejected.state).toBe(initial.state);
    expect(rejected.state.response).toBe(null);
    expect(rejected.events).toBe(initial.events);
    expect(rejected.submissions).toBe(0);
    expect(nextStep(rejected, lesson, adapter)).toBe(rejected);
  });
});
