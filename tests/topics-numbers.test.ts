import { describe, expect, it } from "vitest";
import type { Lesson, Mode, Step } from "../src/core/types";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import {
  placeValueTopic,
  validatePlaceValueSpec,
  type PlaceValueSpec,
} from "../src/topics/place-value";
import {
  equalGroupsTopic,
  validateEqualGroupsSpec,
  type EqualGroupsSpec,
} from "../src/topics/equal-groups";
import { placeValueAuthor } from "../src/authoring/place-value";
import { equalGroupsAuthor } from "../src/authoring/equal-groups";
import type { RuntimeTopic } from "../src/topics/capability";
const lessons = [
  ...["read-model", "zero-place", "digit-value"].map((f) =>
    placeValueAuthor.template(f, f),
  ),
  ...["total", "each", "groups"].map((f) => equalGroupsAuthor.template(f, f)),
];
function oracle(l: Lesson, step: Step): Step["answer"] {
  if (step.goal === "reflection") return step.answer;
  const s = l.specification;
  if (step.goal === "recognise")
    return step.choices!.find(
      (c) => c.meaning === (l.topic === "place-value" ? s.targetPlace : s.task),
    )!.id;
  if (l.topic === "place-value") {
    const n = Number(s.value);
    const digits = String(n).padStart(3, "0");
    const index = ["hundreds", "tens", "ones"].indexOf(String(s.targetPlace));
    return s.task === "read-model"
      ? n
      : Number(digits[index]) * [100, 10, 1][index];
  }
  const repeated = Array.from({ length: Number(s.groupCount) }, () =>
    Number(s.perGroup),
  );
  return s.task === "total"
    ? repeated.reduce((a, b) => a + b, 0)
    : s.task === "each"
      ? repeated[0]
      : repeated.length;
}
describe("new number topics", () => {
  for (const p of lessons) {
    const l = p.lesson;
    const topic =
      l.topic === "place-value" ? placeValueTopic : equalGroupsTopic;
    it(`${l.id} derives every mathematical answer and rejects both fixture distractors`, () => {
      expect(topic.validateSpec(l.specification)).toEqual([]);
      expect(topic.validateSteps(l)).toEqual([]);
      for (const step of l.steps) {
        expect(step.answer).toEqual(oracle(l, step));
        expect(step.hints).toHaveLength(4);
        for (const wrong of p.fixtures!.find((f) => f.stepId === step.id)!
          .rejected) {
          const state = topic.adapter.apply(topic.adapter.initialState(l), {
            type: "answer",
            value: wrong,
          }).state;
          expect(topic.adapter.evaluate(state, step).outcome).toBe("incorrect");
        }
      }
    });
    for (const mode of ["independent", "guided"] as Mode[])
      it(`${l.id} completes in ${mode} with all hint rungs recorded`, () => {
        let session = createSession(l, topic.adapter, mode);
        for (const step of l.steps) {
          for (let h = 0; h < 4; h++) session = useHint(session);
          expect(session.hintRung).toBe(4);
          session = submit(session, l, topic.adapter, {
            type: "answer",
            value: oracle(l, step),
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, l, topic.adapter);
        }
        expect(session.completed).toBe(true);
        expect(session.events.filter((e) => e.type === "reveal")).toHaveLength(
          3,
        );
        expect(session.hadFacilitator).toBe(mode === "guided");
      });
  }
  it("covers independent place-value boundaries including zero and repeated digits", () => {
    for (const n of [0, 9, 10, 99, 100, 305, 999, 666])
      for (const place of ["hundreds", "tens", "ones"]) {
        const l = placeValueAuthor.template("digit-value", "boundary").lesson;
        l.specification = { value: n, task: "digit-value", targetPlace: place };
        const rewritten = placeValueAuthor.rewrite(l);
        expect(validatePlaceValueSpec(rewritten.specification)).toEqual([]);
        expect(placeValueTopic.answer(rewritten, rewritten.steps[1])).toBe(
          oracle(rewritten, rewritten.steps[1]),
        );
        expect(rewritten.steps[1].hints.every((x) => x.includes(place))).toBe(
          true,
        );
      }
  });
  it("rejects out-of-domain place specifications and digit-only ambiguous wording", () => {
    const s: PlaceValueSpec = {
      value: 305,
      task: "zero-place",
      targetPlace: "tens",
    };
    for (const change of [
      { value: 1000 },
      { value: -1 },
      { value: 2.5 },
      { value: "305" },
      { targetPlace: undefined },
      { targetPlace: "millions" },
      { targetPlace: "ones" },
      { task: "invented" },
      { extra: true },
    ])
      expect(
        validatePlaceValueSpec({ ...s, ...change }).length,
      ).toBeGreaterThan(0);
    const l = placeValueAuthor.template("digit-value", "ambiguous").lesson;
    l.steps[1].prompt = "What is the value of 6?";
    expect(placeValueTopic.validateSteps(l).join(" ")).toContain(
      "target place",
    );
  });
  it("covers equal-group product/division boundaries with a repeated-addition oracle", () => {
    for (const g of [2, 3, 10])
      for (const each of [2, 3, 4, 5, 10])
        for (const task of ["total", "each", "groups"]) {
          const s = {
            groupCount: g,
            perGroup: each,
            task,
            unit: "beads",
            groupLabel: "cups",
          };
          const errors = validateEqualGroupsSpec(s);
          if (g * each > 50) {
            expect(errors.length).toBeGreaterThan(0);
            continue;
          }
          expect(errors).toEqual([]);
          const l = equalGroupsAuthor.template(task, "boundary").lesson;
          l.specification = s;
          expect(equalGroupsTopic.answer(l, l.steps[1])).toBe(
            oracle(l, l.steps[1]),
          );
        }
  });
  it("rejects invalid group counts, remainder division, redundant totals and role swaps", () => {
    const s: EqualGroupsSpec = {
      groupCount: 3,
      perGroup: 4,
      task: "each",
      unit: "counters",
      groupLabel: "trays",
    };
    for (const change of [
      { groupCount: 0 },
      { groupCount: 1 },
      { groupCount: -2 },
      { groupCount: 2.5 },
      { groupCount: "3" },
      { perGroup: 0 },
      { perGroup: 1 },
      { perGroup: 2.5 },
      { perGroup: 6 },
      { groupCount: 10, perGroup: 10 },
      { total: 13 },
      { task: "unknown" },
      { unit: "" },
    ])
      expect(
        validateEqualGroupsSpec({ ...s, ...change }).length,
      ).toBeGreaterThan(0);
    const l = equalGroupsAuthor.template("each", "swapped").lesson;
    l.steps[1].answer = 3;
    expect(equalGroupsTopic.validateSteps(l).join(" ")).toContain(
      "contradicts",
    );
  });
  it("preserves state for unsupported and malformed actions and resets answers", () => {
    for (const topic of [placeValueTopic, equalGroupsTopic] as RuntimeTopic[]) {
      const l = lessons.find((p) => p.lesson.topic === topic.id)!.lesson;
      const state = topic.adapter.initialState(l);
      expect(
        topic.adapter.apply(state, { type: "mark-correct", value: true }),
      ).toEqual({ state, outcome: "unassessable" });
      for (const value of [true, null, { correct: true }, Infinity, NaN, [1]])
        expect(
          topic.adapter.apply(state, { type: "answer", value }).outcome,
        ).toBe("rejected");
      const answered = topic.adapter.apply(state, {
        type: "answer",
        value: "opaque",
      }).state;
      expect(state).not.toHaveProperty("answer");
      expect(
        topic.adapter.resetStep(answered, l.steps[0], l.steps[1]),
      ).not.toHaveProperty("answer");
      expect(topic.adapter.describe(state)).not.toMatch(/correct|answer key/i);
    }
  });
  it("renders bounded blocks, separate groups, useful descriptions and escaped author text", () => {
    const l = placeValueAuthor.template("read-model", "maximum").lesson;
    l.specification.value = 999;
    const svg = placeValueTopic.render(l);
    expect(svg.match(/<circle /g)).toHaveLength(9);
    expect(svg).toContain("Each represents 100");
    expect(svg).toContain("9 hundreds blocks");
    const group = equalGroupsAuthor.template("total", "safe").lesson;
    group.specification.unit = '<img onerror="x">';
    const output = equalGroupsTopic.render(group);
    expect(output).not.toContain("<img");
    expect(output).toContain("&lt;img");
    expect(output.match(/Group [0-9]/g)).toHaveLength(4);
  });
  it("author patches retain partial values, derive immutable answers and propose coherent wording", () => {
    for (const author of [placeValueAuthor, equalGroupsAuthor]) {
      const p = author.template(author.forms[0].id, "edit");
      const key = author.id === "place-value" ? "value" : "groupCount";
      const patched = author.patch(p.lesson, key, "");
      expect(patched.specification[key]).toBe("");
      expect(p.lesson.specification[key]).not.toBe("");
      const numeric = author.patch(p.lesson, key, "5");
      expect(numeric.specification[key]).toBe(5);
      const rewritten = author.rewrite(numeric);
      expect(rewritten.steps[1].answer).toBe(
        oracle(rewritten, rewritten.steps[1]),
      );
      expect(p.lesson.steps[1].answer).not.toBe(rewritten.steps[1].answer);
      expect(author.fields(rewritten).every((f) => f.label)).toBe(true);
    }
    const source = equalGroupsAuthor.template("each", "story");
    const revised = equalGroupsAuthor.rewrite(
      equalGroupsAuthor.patch(source.lesson, "groupCount", 4),
    );
    expect(revised.story).toContain("16 counters");
    expect(revised.story).toContain("among 4 trays");
    expect(revised.steps[1].hints[3]).toContain("16 ÷ 4 = 4");
  });
});
