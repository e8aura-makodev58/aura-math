import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import { validatePlan } from "../annotation/plan";
import { annotationCatalogue } from "../topics/area-perimeter-figure";
import {
  areaOf,
  areaPerimeterAnswer,
  areaPerimeterTopic,
  perimeterOf,
  splitAreas,
  validateAreaPerimeterSpec,
  type AreaPerimeterSpec,
} from "../topics/area-perimeter";

const forms = [
  "p4-rectangle-missing-side",
  "p4-composite-area",
  "p4-composite-perimeter",
  "p4-measurement-practice",
];
const h = (a: string, b: string, c: string, d: string): Step["hints"] => [
  a,
  b,
  c,
  d,
];
const exact = (
  id: string,
  title: string,
  prompt: string,
  hints: Step["hints"],
): Step => ({ id, goal: id, title, prompt, kind: "exact", answer: "0", hints });
const reflection = (): Step => ({
  id: "reflection",
  goal: "reflection",
  title: "Explain the measure",
  prompt: "Which explanation matches the shape?",
  kind: "choice",
  choices: [
    {
      id: "r7",
      label: "An inside split line also counts as part of the perimeter.",
    },
    {
      id: "r3",
      label: "Area counts square units; perimeter is only the outside edge.",
    },
    {
      id: "r8",
      label: "Area and perimeter are both measured in the same units.",
    },
  ],
  answer: "r3",
  hints: h(
    "Look at what is being measured.",
    "Area covers a surface; perimeter goes around its boundary.",
    "An inside teaching split is not an outside edge.",
    "Choose the explanation that separates square units from boundary length.",
  ),
});
function steps(s: AreaPerimeterSpec): Step[] {
  const area = areaOf(s),
    perimeter = perimeterOf(s),
    cut = s.cutWidth * s.cutHeight;
  if (s.task === "missing-side") {
    const known =
      s.unknownSide === "width"
        ? `height ${s.height} cm`
        : `width ${s.width} cm`;
    const measure =
      s.knownMeasure === "area"
        ? `area ${s.width * s.height} cm²`
        : `perimeter ${perimeter} cm`;
    const answer = s.unknownSide === "width" ? s.width : s.height;
    return [
      {
        id: "units",
        goal: "units",
        title: "Choose the measure's unit",
        prompt: `The rectangle has ${measure}. Which unit names this given measure?`,
        kind: "choice",
        choices: [
          { id: "u7", label: "Square centimetres", meaning: "square-unit" },
          { id: "u2", label: "Centimetres", meaning: "length-unit" },
          { id: "u9", label: "Cubic centimetres", meaning: "volume-unit" },
        ],
        answer: "",
        hints: h(
          "Think about what the measure describes.",
          "Area covers squares; perimeter follows a line.",
          "Length uses cm, area uses cm².",
          `Choose ${s.knownMeasure === "area" ? "square centimetres" : "centimetres"}.`,
        ),
      },
      {
        id: "relation",
        goal: "relation",
        title: "Choose a relationship",
        prompt: `A rectangle has ${known} and ${measure}. How can you find the missing ${s.unknownSide}?`,
        kind: "choice",
        choices: [
          {
            id: "m4",
            label: "Divide the area by the length of the side you know.",
            meaning: "area-divide",
          },
          {
            id: "m8",
            label: "Subtract the known side from half the perimeter.",
            meaning: "perimeter-subtract",
          },
          {
            id: "m1",
            label: "Add the area and the known side together.",
            meaning: "unrelated",
          },
        ],
        answer: "",
        hints: h(
          "Use the given measure.",
          "Area is width × height; perimeter is twice width plus twice height.",
          "Is the measure area or perimeter?",
          `Use ${s.knownMeasure === "area" ? "area ÷ known side" : "half the perimeter − known side"}.`,
        ),
      },
      exact(
        "missing-side",
        "Find the missing side",
        `Find the missing ${s.unknownSide} when a rectangle has ${known} and ${measure}. Give your answer in centimetres.`,
        h(
          "Write the relationship for the given measure.",
          "Keep lengths in centimetres.",
          "Use the known side in the relationship.",
          `The missing ${s.unknownSide} is ${answer} cm.`,
        ),
      ),
      reflection(),
    ];
  }
  if (s.task === "composite-area") {
    const [left, right] = splitAreas(s);
    return [
      {
        id: "method",
        goal: "method",
        title: "Choose a valid area method",
        prompt: "Choose one valid method to find the L-shape's area.",
        kind: "choice",
        choices: [
          {
            id: "a1",
            label:
              "Find the outer rectangle, then take away the removed corner.",
            meaning: "subtract-cutout",
          },
          {
            id: "a2",
            label:
              "Split into two rectangles that do not overlap, then add them.",
            meaning: "split-add",
          },
          {
            id: "a3",
            label:
              "Find the outer rectangle, then add on the removed corner too.",
            meaning: "add-cutout",
          },
        ],
        answer: "",
        hints: h(
          "The missing corner does not cover the L-shape.",
          "You may subtract it from the outer rectangle.",
          "You may also split the L-shape into two rectangles.",
          "Both subtracting the corner and adding two non-overlapping parts work.",
        ),
      },
      exact(
        "component",
        "Find the removed corner",
        `What is the area of the ${s.cutWidth} cm by ${s.cutHeight} cm corner? Answer in cm².`,
        h(
          "The corner is a rectangle.",
          "Area of a rectangle is width × height.",
          `${s.cutWidth} × ${s.cutHeight}.`,
          `The removed corner covers ${cut} cm².`,
        ),
      ),
      exact(
        "area",
        "Find the L-shape's area",
        `An outer ${s.width} cm by ${s.height} cm rectangle has a ${s.cutWidth} cm by ${s.cutHeight} cm corner removed. Find its area in cm².`,
        h(
          "Choose either valid area method.",
          `Outer area is ${s.width * s.height} cm²; removed area is ${cut} cm².`,
          `A split gives ${left} cm² + ${right} cm².`,
          `Both methods give ${area} cm².`,
        ),
      ),
      reflection(),
    ];
  }
  if (s.task === "composite-perimeter") {
    const edge = s.width - s.cutWidth;
    return [
      exact(
        "missing-edge",
        "Find an outside segment",
        `The ${s.cutWidth} cm corner length is removed from ${s.width} cm across. Find the remaining horizontal outside segment in centimetres.`,
        h(
          "Look along the full width.",
          "Subtract the removed corner width from the outer width.",
          `${s.width} − ${s.cutWidth}.`,
          `The remaining segment is ${s.width - s.cutWidth} cm.`,
        ),
      ),
      {
        id: "boundary-method",
        goal: "boundary-method",
        title: "Choose an outside-edge path",
        prompt: "Which paths count this corner-cutout's outside boundary?",
        kind: "choice",
        choices: [
          {
            id: "b3",
            label:
              "Add each outside edge in turn, leaving out any inside split lines.",
            meaning: "edge-sum",
          },
          {
            id: "b7",
            label:
              "Use 2 × (outer width + outer height); new edges replace equal lengths.",
            meaning: "outer-equivalent",
          },
          {
            id: "b1",
            label:
              "Add every drawn line, including the inside split line, all the way round.",
            meaning: "internal-edge",
          },
        ],
        answer: "",
        hints: h(
          "Only the outline is perimeter.",
          "An inside split is not on the outline.",
          "For this corner cutout only, new edge lengths replace the removed outer lengths.",
          "Outside-edge sum and 2 × (outer width + outer height) agree for this shape.",
        ),
      },
      exact(
        "perimeter",
        "Find the outside boundary",
        `Find the perimeter of this ${s.width} cm by ${s.height} cm outer rectangle with one ${s.cutWidth} cm by ${s.cutHeight} cm corner removed. Answer in centimetres.`,
        h(
          "Follow the outside edge only.",
          `One remaining horizontal segment is ${edge} cm.`,
          "The two new corner edges replace equal removed outer lengths.",
          `For this corner cutout, 2 × (${s.width} + ${s.height}) = ${perimeter} cm.`,
        ),
      ),
      reflection(),
    ];
  }
  const unit = s.requestedMeasure === "area" ? "cm²" : "cm";
  return [
    exact(
      "final",
      "Try a fresh measured shape",
      `A ${s.width} cm by ${s.height} cm rectangle has a ${s.cutWidth} cm by ${s.cutHeight} cm corner removed. Find its ${s.requestedMeasure} in ${unit}.`,
      h(
        "Read the requested measure and unit.",
        "Area covers squares; perimeter follows the outside edge.",
        s.requestedMeasure === "area"
          ? `Outer area ${s.width * s.height} cm², removed area ${cut} cm².`
          : "This corner's new edges replace equal outer edge lengths.",
        `The ${s.requestedMeasure} is ${s.requestedMeasure === "area" ? area : perimeter} ${unit}.`,
      ),
    ),
    reflection(),
  ];
}
function derive(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateAreaPerimeterSpec(next.specification).length) return next;
  for (const step of next.steps)
    if (step.goal !== "reflection")
      step.answer = areaPerimeterAnswer(
        next.specification as unknown as AreaPerimeterSpec,
        step,
      );
  return next;
}
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateAreaPerimeterSpec(next.specification).length) return next;
  const s = next.specification as unknown as AreaPerimeterSpec;
  const oldReflection = next.steps.find((step) => step.goal === "reflection");
  next.steps = steps(s).map((step) =>
    step.goal === "reflection" && oldReflection ? oldReflection : step,
  );
  next.story =
    s.task === "practice"
      ? next.steps[0].prompt
      : s.task === "missing-side"
        ? `Use the given ${s.knownMeasure} and one known side to find the missing ${s.unknownSide}.`
        : `An outer ${s.width} cm by ${s.height} cm rectangle has a ${s.cutWidth} cm by ${s.cutHeight} cm corner removed.`;
  return derive(next);
}
function template(form: string, id: string): LessonPackage {
  if (!forms.includes(form)) throw new Error("Unsupported P4 measurement form");
  const task: AreaPerimeterSpec["task"] =
    form === forms[0]
      ? "missing-side"
      : form === forms[1]
        ? "composite-area"
        : form === forms[2]
          ? "composite-perimeter"
          : "practice";
  const s: AreaPerimeterSpec = {
    task,
    width: task === "missing-side" ? 12 : task === "practice" ? 11 : 12,
    height: task === "missing-side" ? 7 : task === "practice" ? 10 : 8,
    cutWidth: task === "missing-side" ? 0 : task === "practice" ? 3 : 4,
    cutHeight: task === "missing-side" ? 0 : task === "practice" ? 2 : 3,
    corner: task === "practice" ? "bottom-right" : "top-right",
    unknownSide: "width",
    knownMeasure: "area",
    requestedMeasure: task === "practice" ? "perimeter" : "area",
    unit: "cm",
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "area-perimeter",
    title: {
      "missing-side": "Find a missing rectangle side",
      "composite-area": "Find an L-shape's area",
      "composite-perimeter": "Follow the outside edge",
      practice: "A fresh shape question",
    }[task],
    subtitle: "P4 measurement revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective: {
      "missing-side": "Find a missing length from area or perimeter.",
      "composite-area": "Find an L-shape's area by two valid methods.",
      "composite-perimeter":
        "Find the outside boundary of a corner-cutout shape.",
      practice: "Choose and calculate area or perimeter of a measured shape.",
    }[task],
    story: "Measure the shape.",
    reviewStatus: "draft",
    specification: s as unknown as Record<string, unknown>,
    steps: steps(s),
  });
  const p: LessonPackage = {
    schemaVersion: 3,
    locale: "en-SG",
    adapterVersion: 1,
    library: {
      level: "P4",
      skillId: form,
      tags: ["P4", "area", "perimeter", "general revision"],
    },
    curriculum: {
      objectiveId: `candidate.p4.measurement.${task}`,
      sources: [
        "https://practicle.sg/primary-4-math/",
        "https://sg.ixl.com/standards/maths/primary-4",
      ],
      evidenceStatus: "candidate",
    },
    authors: ["codex-p4-measurement"],
    provenance: { kind: "authored" },
    lesson,
    fixtures: lesson.steps.map((step) => ({
      stepId: step.id,
      accepted:
        step.goal === "method"
          ? ["a1", "a2"]
          : step.goal === "boundary-method"
            ? ["b3", "b7"]
            : [step.answer],
      rejected:
        step.kind === "exact"
          ? ["9999", "9998"]
          : step
              .choices!.filter(
                (choice) =>
                  !["a1", "a2", "b3", "b7", step.answer].includes(choice.id),
              )
              .map((choice) => choice.id)
              .slice(0, 2),
    })),
  };
  const context = areaPerimeterTopic.interpretation!(lesson);
  if (context) p.interpretation = context;
  return p;
}
export const areaPerimeterAuthor: AuthorTopic = {
  id: "area-perimeter",
  forms: forms.map((id, index) => ({
    id,
    label: [
      "Missing rectangle side",
      "Composite area",
      "Composite perimeter",
      "Fresh measurement practice",
    ][index],
    description: "Original P4 candidate with measured rectangles.",
  })),
  fields: (lesson) => {
    const s = lesson.specification as unknown as AreaPerimeterSpec;
    const fields: TopicField[] = [
      {
        key: "width",
        label: "Outer width in cm (2–30)",
        type: "number",
        value: s.width,
      },
      {
        key: "height",
        label: "Outer height in cm (2–30)",
        type: "number",
        value: s.height,
      },
    ];
    if (s.task !== "missing-side")
      fields.push(
        {
          key: "cutWidth",
          label: "Removed corner width in cm",
          type: "number",
          value: s.cutWidth,
        },
        {
          key: "cutHeight",
          label: "Removed corner height in cm",
          type: "number",
          value: s.cutHeight,
        },
        {
          key: "corner",
          label: "Corner removed",
          type: "select",
          value: s.corner,
          options: ["top-left", "top-right", "bottom-left", "bottom-right"].map(
            (value) => ({ value, label: value.replace("-", " ") }),
          ),
        },
      );
    if (s.task === "missing-side")
      fields.push(
        {
          key: "unknownSide",
          label: "Missing side",
          type: "select",
          value: s.unknownSide,
          options: ["width", "height"].map((value) => ({
            value,
            label: value,
          })),
        },
        {
          key: "knownMeasure",
          label: "Given measure",
          type: "select",
          value: s.knownMeasure,
          options: ["area", "perimeter"].map((value) => ({
            value,
            label: value,
          })),
        },
      );
    if (s.task === "practice")
      fields.push({
        key: "requestedMeasure",
        label: "Requested measure",
        type: "select",
        value: s.requestedMeasure,
        options: ["area", "perimeter"].map((value) => ({
          value,
          label: value,
        })),
      });
    return fields;
  },
  patch: (lesson, key, value) => {
    const next = structuredClone(lesson);
    if (key === "annotations") {
      // "" returns to the automatic layout; anything else must pass the deterministic gate.
      if (value === "") delete next.specification.annotations;
      else {
        let plan: unknown;
        try {
          plan = JSON.parse(String(value));
        } catch {
          return lesson;
        }
        const { annotations: _old, ...rest } = next.specification;
        void _old;
        if (
          validateAreaPerimeterSpec(rest).length ||
          validatePlan(
            plan,
            annotationCatalogue(rest as unknown as AreaPerimeterSpec),
          ).length
        )
          return lesson;
        next.specification.annotations = plan;
      }
      return next;
    }
    if (["width", "height", "cutWidth", "cutHeight"].includes(key))
      next.specification[key] = /^\d+$/.test(String(value))
        ? Number(value)
        : value;
    else if (
      ["corner", "unknownSide", "knownMeasure", "requestedMeasure"].includes(
        key,
      )
    )
      next.specification[key] = value;
    // A custom layout that no longer fits the changed model returns to automatic.
    if (next.specification.annotations !== undefined) {
      const { annotations, ...rest } = next.specification;
      if (
        !validateAreaPerimeterSpec(rest).length &&
        validatePlan(
          annotations,
          annotationCatalogue(rest as unknown as AreaPerimeterSpec),
        ).length
      )
        delete next.specification.annotations;
    }
    return next;
  },
  derive,
  rewrite,
  template,
};
