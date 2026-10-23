import { describe, expect, it } from "vitest";
import { lessons } from "../src/content/lessons";
import {
  p4ActivityKind,
  p4Expression,
  renderP4Activity,
} from "../src/ui/p4-activity";

const decimal = lessons.find(
  (lesson) => lesson.id === "p4-decimal-add-subtract",
)!;
const fraction = lessons.find(
  (lesson) => lesson.id === "p4-fraction-add-subtract",
)!;
const initial = {
  stepIndex: 0,
  hintRung: 0,
  solvedGoals: [],
  workedOpen: false,
};

describe("mathematical workbench disclosure", () => {
  it("uses given values without exposing a decimal answer or exchange", () => {
    expect(p4ActivityKind(decimal)).toBe("decimal");
    expect(p4Expression(decimal)).toBe("7.25 − 2.6");
    const html = renderP4Activity(decimal, initial);
    expect(html).toContain("7.25 − 2.6");
    expect(html).not.toContain("4.65");
    expect(html).not.toContain("exchange-overlay");
    expect(html).not.toContain("activity-place-table");
  });

  it("adds aligned units after assessed relation success without revealing the result", () => {
    const html = renderP4Activity(decimal, {
      ...initial,
      stepIndex: 1,
      solvedGoals: ["relation"],
    });
    expect(html).toContain("activity-place-table");
    expect(html).not.toContain("4.65");
    expect(html).not.toContain("exchange-overlay");
  });

  it("limits the exchange overlay to an explicit matching partial demonstration", () => {
    const context = {
      ...initial,
      stepIndex: 1,
      hintRung: 3,
      solvedGoals: ["relation"],
    };
    expect(renderP4Activity(decimal, context)).toContain(
      "7 wholes + 2 tenths = 6 wholes + 12 tenths",
    );
    expect(renderP4Activity(decimal, context)).not.toContain("4.65");
    const edited = structuredClone(decimal);
    edited.steps[1].hints[2] = "Try another way.";
    expect(renderP4Activity(edited, context)).not.toContain("exchange-overlay");
    expect(
      renderP4Activity(decimal, { ...context, hintRung: 2 }),
    ).not.toContain("exchange-overlay");
  });

  it("does not invent an exchange when the operand requires a different method", () => {
    const edited = structuredClone(decimal);
    edited.specification.a = { coefficient: 721, scale: 2 };
    edited.specification.b = { coefficient: 269, scale: 2 };
    expect(
      renderP4Activity(edited, { ...initial, stepIndex: 1, hintRung: 3 }),
    ).not.toContain("exchange-overlay");
  });

  it("reveals an answer only for assessed calculation or explicit worked disclosure", () => {
    expect(
      renderP4Activity(decimal, { ...initial, hintRung: 4 }),
    ).not.toContain("4.65");
    expect(
      renderP4Activity(decimal, { ...initial, stepIndex: 1, hintRung: 4 }),
    ).toContain("4.65");
    expect(
      renderP4Activity(decimal, { ...initial, solvedGoals: ["calculate"] }),
    ).toContain("4.65");
    expect(
      renderP4Activity(decimal, { ...initial, workedOpen: true }),
    ).toContain("4.65");
    expect(
      renderP4Activity(decimal, { ...initial, stepIndex: 2 }),
    ).not.toContain("4.65");
  });

  it("keeps fraction givens distinct from the derived common partition", () => {
    expect(p4Expression(fraction)).toBe("5/6 − 1/3");
    const html = renderP4Activity(fraction, initial);
    expect(html).toContain("5 of 6 equal parts");
    expect(html).toContain("1 of 3 equal parts");
    expect(html).not.toContain("equal-parts-overlay");
    expect(html).not.toContain("1/2");
    const matched = renderP4Activity(fraction, {
      ...initial,
      stepIndex: 1,
      solvedGoals: ["equal-units"],
    });
    expect(matched).toContain("1/3 = 2/6");
    expect(matched).not.toContain("1/2");
    expect(
      renderP4Activity(fraction, { ...initial, stepIndex: 1, hintRung: 4 }),
    ).toContain("1/2");
  });

  it("falls back for other topics, malformed specifications and unsupported goals", () => {
    expect(p4ActivityKind(lessons[0])).toBeNull();
    const edited = structuredClone(decimal);
    edited.specification.a = { coefficient: -1, scale: 2 };
    expect(renderP4Activity(edited, initial)).toBe("");
    edited.specification = structuredClone(decimal.specification);
    edited.steps[0].goal = "unknown";
    expect(p4ActivityKind(edited)).toBeNull();
  });

  it("does not solve the next simplest-form goal after a calculation success", () => {
    const html = renderP4Activity(fraction, {
      ...initial,
      stepIndex: 2,
      solvedGoals: ["equal-units", "calculate"],
    });
    expect(html).toContain("3/6");
    expect(html).not.toContain("1/2");
    expect(
      renderP4Activity(fraction, {
        ...initial,
        stepIndex: 2,
        hintRung: 4,
        solvedGoals: ["calculate"],
      }),
    ).toContain("1/2");
    expect(
      renderP4Activity(fraction, {
        ...initial,
        stepIndex: 3,
        solvedGoals: ["calculate", "simplest"],
      }),
    ).toContain("1/2");
  });
});
