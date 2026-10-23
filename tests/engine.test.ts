import { describe, expect, it } from "vitest";
import { lessons, validateLesson } from "../src/content/lessons";
import { loadLesson } from "../src/content/validation";
import { comparisonAdapter } from "../src/topics/comparison";
import { adapters } from "../src/topics/registry";
import { anglesAdapter } from "../src/topics/angles";
import {
  completionLabel,
  createSession,
  nextStep,
  submit,
  switchMode,
  useHint,
} from "../src/core/runtime";
import type { Lesson, Session } from "../src/core/types";

const adapterFor = (lesson: Lesson) => adapters[lesson.topic];
function finish(
  lesson: Lesson,
  initial = createSession(lesson, adapterFor(lesson)),
): Session {
  return lesson.steps.slice(initial.stepIndex).reduce(
    (session, step) =>
      nextStep(
        submit(session, lesson, adapterFor(lesson), {
          type: "answer",
          value: step.answer,
        }),
        lesson,
        adapterFor(lesson),
      ),
    initial,
  );
}

describe("shared runtime contract", () => {
  for (const lesson of lessons) {
    it(`${lesson.id} completes only after every goal including reflection`, () => {
      const initial = createSession(lesson, adapterFor(lesson));
      expect(nextStep(initial, lesson, adapterFor(lesson))).toBe(initial);
      const complete = finish(lesson, initial);
      expect(complete.completed).toBe(true);
      expect(complete.history).toHaveLength(lesson.steps.length);
      expect(completionLabel(complete)).toBe("Completed without app support");
      expect(initial.submissions).toBe(0);
      expect(
        submit(complete, lesson, adapterFor(lesson), {
          type: "answer",
          value: "wrong",
        }),
      ).toBe(complete);
      expect(nextStep(complete, lesson, adapterFor(lesson))).toBe(complete);
      expect(
        finish(lesson, createSession(lesson, adapterFor(lesson), "guided"))
          .hadFacilitator,
      ).toBe(true);
    });
    it(`${lesson.id} rejects two invalid responses`, () => {
      const invalidResponses =
        lesson.steps[0].kind === "exact"
          ? ["9999", "9998"]
          : ["not-a-choice", -900];
      for (const value of invalidResponses) {
        const state = submit(
          createSession(lesson, adapterFor(lesson)),
          lesson,
          adapterFor(lesson),
          { type: "answer", value },
        );
        expect(state.feedback?.outcome).toBe("incorrect");
        expect(nextStep(state, lesson, adapterFor(lesson))).toBe(state);
      }
    });
  }
  it("keeps unsupported and malformed actions out of assessed history", () => {
    const lesson = lessons[0];
    const initial = createSession(lesson, comparisonAdapter);
    for (const action of [
      { type: "drag", value: 42 },
      { type: "answer", value: { correct: true } },
      { type: "answer", value: NaN },
    ]) {
      const result = submit(initial, lesson, comparisonAdapter, action);
      expect(result.feedback?.outcome).toBe("unassessable");
      expect(result.state).toBe(initial.state);
      expect(result.history).toHaveLength(0);
      expect(result.submissions).toBe(0);
    }
  });
  it("caps hints at four, requires submission after reveal, and records support across steps", () => {
    const lesson = lessons[0];
    let session = createSession(lesson, comparisonAdapter);
    for (let i = 0; i < 6; i++) session = useHint(session);
    expect(session.hintRung).toBe(4);
    expect(session.hintsUsed).toBe(4);
    expect(nextStep(session, lesson, comparisonAdapter)).toBe(session);
    session = nextStep(
      submit(session, lesson, comparisonAdapter, {
        type: "answer",
        value: lesson.steps[0].answer,
      }),
      lesson,
      comparisonAdapter,
    );
    expect(session.hintRung).toBe(0);
    expect(session.hintsUsed).toBe(4);
    expect(completionLabel(finish(lesson, session))).toBe(
      "Completed with support",
    );
  });
  it("retains mathematical state, assessed history and facilitator assistance across mode switches", () => {
    const lesson = lessons[0];
    const before = submit(
      createSession(lesson, comparisonAdapter),
      lesson,
      comparisonAdapter,
      { type: "answer", value: "wrong" },
    );
    const after = switchMode(switchMode(before, "guided"), "independent");
    expect(after.state).toBe(before.state);
    expect(after.history).toBe(before.history);
    expect(completionLabel(finish(lesson, after))).toBe(
      "Completed with facilitator",
    );
  });
  it("accepts selection order alternatives and rejects duplicates and distractors", () => {
    const lesson = lessons[5];
    for (const answer of [
      ["A", "C"],
      ["C", "A"],
    ])
      expect(
        submit(createSession(lesson, anglesAdapter), lesson, anglesAdapter, {
          type: "answer",
          value: answer,
        }).feedback?.outcome,
      ).toBe("correct");
    for (const answer of [["A", "A", "C"], ["A"], ["A", "B"]])
      expect(
        submit(createSession(lesson, anglesAdapter), lesson, anglesAdapter, {
          type: "answer",
          value: answer,
        }).feedback?.outcome,
      ).toBe("incorrect");
  });
  it("derives numeric and angle goals from the model, ignoring a tampered answer key", () => {
    const comparison = lessons[0];
    const state = { ...comparisonAdapter.initialState(comparison), answer: 18 };
    expect(
      comparisonAdapter.evaluate(state, { ...comparison.steps[1], answer: 99 })
        .outcome,
    ).toBe("correct");
    const angle = lessons[3];
    expect(
      anglesAdapter.evaluate(
        { ...anglesAdapter.initialState(angle), answer: "B" },
        { ...angle.steps[0], answer: "C" },
      ).outcome,
    ).toBe("correct");
  });
  it("does not disclose hidden comparison numbers in descriptions", () => {
    expect(
      comparisonAdapter.describe(comparisonAdapter.initialState(lessons[0])),
    ).not.toContain("18");
    expect(
      comparisonAdapter.describe(comparisonAdapter.initialState(lessons[1])),
    ).not.toContain("16");
    expect(
      comparisonAdapter.describe(comparisonAdapter.initialState(lessons[2])),
    ).not.toContain("8");
  });
});

describe("draft lesson validation and publication boundary", () => {
  it("accepts all original drafts but prohibits learner loading", () => {
    for (const lesson of lessons) {
      expect(validateLesson(lesson)).toEqual(lesson);
      expect(() => loadLesson(lesson, "learner")).toThrow("disabled");
    }
  });
  it("rejects unknown fields at each payload level", () => {
    const mutations = [
      (lesson: Lesson) => Object.assign(lesson, { surprise: true }),
      (lesson: Lesson) =>
        Object.assign(lesson.specification, { surprise: true }),
      (lesson: Lesson) => Object.assign(lesson.steps[0], { surprise: true }),
      (lesson: Lesson) =>
        Object.assign(lesson.steps[0].choices![0], { surprise: true }),
    ];
    for (const mutate of mutations) {
      const lesson = structuredClone(lessons[0]);
      mutate(lesson);
      expect(() => validateLesson(lesson)).toThrow("unknown field");
    }
  });
  it("rejects contradictory model answers and malformed teaching steps", () => {
    const wrong = structuredClone(lessons[0]);
    wrong.steps[1].answer = 999;
    expect(() => validateLesson(wrong)).toThrow("contradicts");
    const badHints = structuredClone(lessons[0]);
    badHints.steps[0].hints.pop();
    expect(() => validateLesson(badHints)).toThrow("four hint");
    const badSpec = structuredClone(lessons[0]);
    badSpec.specification.smaller = 100;
    expect(() => validateLesson(badSpec)).toThrow("larger must exceed");
    const badAngle = structuredClone(lessons[3]);
    (badAngle.specification.angles as { degrees: number }[])[0].degrees = 90;
    expect(() => validateLesson(badAngle)).toThrow("exactly one right angle");
  });
});
