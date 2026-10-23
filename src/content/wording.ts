import { authorTopics } from "../authoring/registry";
import { runtimeTopics } from "../topics/registry";
import type { LessonPackage } from "./package-validation";
import { answerFor } from "../topics/registry";
import type { AnglesSpec } from "../topics/angles";

export function comparisonWording(spec: Record<string, unknown>): {
  story: string;
  expression: string;
  answer: number;
  correct: string;
} {
  const a = String(spec.largerName),
    b = String(spec.smallerName),
    unit = String(spec.unit),
    larger = Number(spec.larger),
    smaller = Number(spec.smaller),
    difference = larger - smaller,
    unknown = spec.unknown;
  return {
    story:
      unknown === "larger"
        ? `${b} has ${smaller} ${unit}. ${a} has ${difference} more ${unit} than ${b}. How many ${unit} does ${a} have?`
        : unknown === "smaller"
          ? `${a} has ${larger} ${unit}. ${a} has ${difference} more ${unit} than ${b}. How many ${unit} does ${b} have?`
          : `${a} has ${larger} ${unit}. ${b} has ${smaller} ${unit}. How many more ${unit} does ${a} have than ${b}?`,
    expression:
      unknown === "larger"
        ? `${smaller} + ${difference}`
        : unknown === "smaller"
          ? `${larger} − ${difference}`
          : `${larger} − ${smaller}`,
    answer:
      unknown === "larger"
        ? larger
        : unknown === "smaller"
          ? smaller
          : difference,
    correct: `The difference is ${difference}: ${smaller} + ${difference} = ${larger}.`,
  };
}
export function angleReveal(spec: AnglesSpec): string {
  const rights = spec.angles.filter((a) => a.degrees === 90),
    labels = rights.map((a) => a.label).sort();
  if (spec.task === "identify")
    return `Card ${labels[0] ?? "?"} is a right angle. Choose ${labels[0] ?? "?"}.`;
  if (spec.task === "select")
    return `Select ${labels.join(" and ")}, then check your answer.`;
  const d = spec.angles[0].degrees;
  return d === 90
    ? "Choose: Exactly a right angle."
    : `Choose: ${d < 90 ? "Smaller" : "Larger"} than a right angle.`;
}

/** Synchronise declared model consequences. Literal wording is deliberately separate. */
export function derivePackageModel(input: LessonPackage): LessonPackage {
  const p = structuredClone(input),
    l = p.lesson;
  const capability = authorTopics[l.topic];
  if (
    capability &&
    !runtimeTopics[l.topic]!.validateSpec(l.specification).length
  )
    p.lesson = capability.derive(l);
  const context = runtimeTopics[l.topic]?.interpretation?.(p.lesson);
  if (context) p.interpretation = context;
  if (
    l.topic === "equal-groups" &&
    !runtimeTopics[l.topic]!.validateSpec(l.specification).length
  ) {
    const s = l.specification,
      unit = String(s.unit);
    p.interpretation = {
      entities: ["groups", unit],
      quantities: [
        {
          entity: "groups",
          value: Number(s.groupCount),
          unit: "groups",
          state: s.task === "groups" ? "derived" : "given",
        },
        {
          entity: unit,
          value: Number(s.groupCount) * Number(s.perGroup),
          unit,
          state: s.task === "total" ? "derived" : "given",
        },
      ],
      relationships: [
        {
          kind: "equal-groups",
          groups: Number(s.groupCount),
          perGroup: Number(s.perGroup),
          total: Number(s.groupCount) * Number(s.perGroup),
          unit,
        },
      ],
      unknown: String(s.task),
      sourceSpans: [
        { start: 0, end: p.lesson.story.length, text: p.lesson.story },
      ],
      assumptions: p.interpretation?.assumptions ?? [],
      ambiguities: p.interpretation?.ambiguities ?? [],
    };
  }
  if (l.topic === "comparison") {
    const s = l.specification;
    if (typeof s.larger === "number" && typeof s.smaller === "number") {
      const a = String(s.largerName),
        b = String(s.smallerName),
        unit = String(s.unit);
      p.interpretation = {
        entities: [a, b],
        quantities: [
          { entity: a, value: s.larger, unit, state: "initial" },
          { entity: b, value: s.smaller, unit, state: "initial" },
        ],
        relationships: [
          {
            kind: "additive-comparison",
            larger: a,
            smaller: b,
            difference: s.larger - s.smaller,
          },
        ],
        unknown: String(s.unknown),
        sourceSpans: [{ start: 0, end: l.story.length, text: l.story }],
        assumptions: p.interpretation?.assumptions ?? [],
        ambiguities: p.interpretation?.ambiguities ?? [],
      };
    }
  }
  const ready =
    l.topic !== "comparison" ||
    (typeof l.specification.larger === "number" &&
      typeof l.specification.smaller === "number" &&
      ["larger", "smaller", "difference"].includes(
        String(l.specification.unknown),
      ));
  if (
    ready &&
    (!capability ||
      !runtimeTopics[l.topic]!.validateSpec(p.lesson.specification).length)
  )
    for (const step of p.lesson.steps) step.answer = answerFor(p.lesson, step);
  p.fixtures = p.lesson.steps.map((step) => {
    const topicAdapter = runtimeTopics[l.topic]?.adapter;
    const acceptedChoices =
      step.kind === "choice" && topicAdapter
        ? step
            .choices!.filter(
              (choice) =>
                topicAdapter.evaluate(
                  {
                    ...topicAdapter.initialState(p.lesson),
                    answer: choice.id,
                  },
                  step,
                ).outcome === "correct",
            )
            .map((choice) => choice.id)
        : [];
    const accepted =
      acceptedChoices.length > 0
        ? acceptedChoices
        : [structuredClone(step.answer)];
    if (Array.isArray(step.answer) && step.answer.length > 1)
      accepted.push([...step.answer].reverse());
    const rejected =
      step.kind === "exact"
        ? ["9999", "9998", "9997"]
            .filter(
              (value) =>
                runtimeTopics[l.topic]!.adapter.evaluate(
                  {
                    ...runtimeTopics[l.topic]!.adapter.initialState(p.lesson),
                    answer: value,
                  },
                  step,
                ).outcome !== "correct",
            )
            .slice(0, 2)
        : step.kind === "number"
          ? [Number(step.answer) + 1, Number(step.answer) + 2]
          : step.kind === "multi"
            ? [
                [],
                step
                  .choices!.filter(
                    (c) => !(step.answer as string[]).includes(c.id),
                  )
                  .map((c) => c.id),
              ]
            : step
                .choices!.filter(
                  (c) =>
                    !acceptedChoices.includes(c.id) && c.id !== step.answer,
                )
                .map((c) => c.id);
    return { stepId: step.id, accepted, rejected };
  });
  return p;
}

/** Explicit template replacement; never attempts to interpret or globally replace custom prose. */
export function rewritePackageWording(input: LessonPackage): LessonPackage {
  const p = structuredClone(input),
    l = p.lesson;
  const capability = authorTopics[l.topic];
  if (capability) {
    p.lesson = capability.rewrite(l);
    return derivePackageModel(p);
  }
  if (l.topic === "comparison") {
    const s = l.specification,
      a = String(s.largerName),
      b = String(s.smallerName),
      unit = String(s.unit),
      larger = Number(s.larger),
      smaller = Number(s.smaller),
      difference = larger - smaller,
      unknown = s.unknown;
    const wording = comparisonWording(s);
    l.story = wording.story;
    const relation = l.steps[0];
    relation.prompt = "Which relationship fits the story?";
    for (const c of relation.choices ?? [])
      c.label =
        c.meaning === "larger-is-smaller-plus-difference"
          ? `${a}’s amount = ${b}’s amount + the difference`
          : `${b}’s amount = ${a}’s amount + the difference`;
    relation.hints = [
      `Who has more ${unit}?`,
      `${a} has the larger amount.`,
      "The larger amount contains the smaller amount and an extra part.",
      `Choose: ${a}’s amount = ${b}’s amount + the difference.`,
    ];
    const calc = l.steps[1],
      answer =
        unknown === "larger"
          ? larger
          : unknown === "smaller"
            ? smaller
            : difference;
    const expression = wording.expression;
    calc.prompt =
      unknown === "difference"
        ? `How many more ${unit} does ${a} have?`
        : `How many ${unit} does ${unknown === "larger" ? a : b} have?`;
    calc.hints = [
      "Look for the missing part in the comparison.",
      unknown === "larger"
        ? "Join the smaller amount and the extra part."
        : "Take the known part away from the larger amount.",
      `Work out ${expression}.`,
      `${expression} = ${answer}. Enter ${answer}.`,
    ];
    const reflection = l.steps[2],
      correct = wording.correct;
    reflection.prompt = "Why does your answer fit?";
    for (const c of reflection.choices ?? [])
      c.label =
        c.id === reflection.answer
          ? correct
          : `The two amounts must both be ${larger}.`;
    reflection.hints = [
      "Think about what stayed the same.",
      "Use the relationship you just checked.",
      `Read this explanation carefully: ${correct}`,
      `Choose: ${correct}`,
    ];
  } else {
    const s = l.specification as unknown as AnglesSpec,
      step = l.steps[0],
      rights = s.angles.filter((a) => a.degrees === 90);
    if (s.task === "identify") {
      l.story =
        "A right angle has the same opening as a square corner. Compare each card with the reference corner.";
      step.prompt = "Which card shows a right angle?";
      step.hints = [
        "Look at the opening between the arms.",
        "Compare each opening with the square corner.",
        "One card fits a square corner even though it is turned.",
        angleReveal(s),
      ];
    } else if (s.task === "select") {
      l.story =
        "Right angles can point in different directions. Select every card with the same opening as the reference corner.";
      step.prompt = "Which cards show right angles? Choose every match.";
      step.hints = [
        "There may be more than one match.",
        "Test each opening against the reference corner.",
        `${rights.length === 2 ? "Two cards" : `${rights.length} cards`} fit the square corner. Compare openings even when the cards are turned.`,
        angleReveal(s),
      ];
    } else {
      const card = s.angles[0],
        label = card.label;
      l.story = `Imagine fitting the reference square corner inside angle ${label}. Compare the openings.`;
      step.prompt = `How does angle ${label} compare with a right angle?`;
      step.hints = [
        "Look at the space between the two arms.",
        "The reference corner shows a right angle.",
        card.degrees < 90
          ? `Angle ${label} fits inside the square corner with space left over.`
          : card.degrees > 90
            ? `A square corner fits inside angle ${label} with space left over.`
            : `Angle ${label} matches the square corner.`,
        angleReveal(s),
      ];
    }
    if (s.task !== "classify")
      for (const c of step.choices ?? []) {
        const card = s.angles.find((a) => a.id === c.id);
        if (card) c.label = `Card ${card.label}`;
      }
    const reflection = l.steps[1],
      correct =
        "The opening between the arms matters, even when the angle is turned.";
    reflection.prompt = "What matters when you compare angles?";
    for (const c of reflection.choices ?? [])
      c.label =
        c.id === reflection.answer
          ? correct
          : "Turning the whole card around makes the angle on it larger or smaller.";
    reflection.hints = [
      "Think about what stayed the same.",
      "Use the relationship you just checked.",
      `Read this explanation carefully: ${correct}`,
      `Choose: ${correct}`,
    ];
  }
  return derivePackageModel(p);
}
