import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
import { assessExact, parseFraction } from "./exact";
import { validatePlan, type AnnotationPlan } from "../annotation/plan";
import {
  annotationCatalogue,
  defaultAnnotationPlan,
  renderFigureSvg,
} from "./area-perimeter-figure";

export interface AreaPerimeterSpec {
  task: "missing-side" | "composite-area" | "composite-perimeter" | "practice";
  width: number;
  height: number;
  cutWidth: number;
  cutHeight: number;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  unknownSide: "width" | "height";
  knownMeasure: "area" | "perimeter";
  requestedMeasure: "area" | "perimeter";
  unit: "cm";
  /** Optional reviewed choice of which dimensions the diagram shows; defaults are derived from the model. */
  annotations?: AnnotationPlan;
}
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const areaOf = (s: AreaPerimeterSpec) =>
  s.width * s.height - s.cutWidth * s.cutHeight;
export const perimeterOf = (s: AreaPerimeterSpec) => 2 * (s.width + s.height);
export const splitAreas = (s: AreaPerimeterSpec) =>
  [
    (s.width - s.cutWidth) * s.height,
    s.cutWidth * (s.height - s.cutHeight),
  ] as const;
export function validateAreaPerimeterSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Expected area-perimeter specification"];
  const s = input as AreaPerimeterSpec,
    errors: string[] = [];
  if (
    Object.keys(s).some(
      (key) =>
        ![
          "task",
          "width",
          "height",
          "cutWidth",
          "cutHeight",
          "corner",
          "unknownSide",
          "knownMeasure",
          "requestedMeasure",
          "unit",
          "annotations",
        ].includes(key),
    )
  )
    errors.push("Unknown area-perimeter field");
  if (
    ![
      "missing-side",
      "composite-area",
      "composite-perimeter",
      "practice",
    ].includes(s.task)
  )
    errors.push("Unsupported measurement task");
  for (const key of ["width", "height", "cutWidth", "cutHeight"] as const)
    if (!Number.isSafeInteger(s[key]))
      errors.push(`${key} must be a whole centimetre length`);
  if (errors.length) return errors;
  const minimum = s.task === "missing-side" ? 1 : 2;
  if (s.width < minimum || s.width > 30 || s.height < minimum || s.height > 30)
    errors.push(`Outer dimensions must be ${minimum}–30 cm`);
  if (s.task === "missing-side") {
    if (s.cutWidth !== 0 || s.cutHeight !== 0)
      errors.push("Rectangle task has no cutout");
  } else if (
    s.cutWidth < 1 ||
    s.cutHeight < 1 ||
    s.cutWidth >= s.width ||
    s.cutHeight >= s.height
  )
    errors.push(
      "Corner cutout must be strictly smaller than the outer rectangle",
    );
  if (
    !["top-left", "top-right", "bottom-left", "bottom-right"].includes(s.corner)
  )
    errors.push("Choose a supported corner");
  if (!["width", "height"].includes(s.unknownSide))
    errors.push("Choose one missing side");
  if (
    !["area", "perimeter"].includes(s.knownMeasure) ||
    !["area", "perimeter"].includes(s.requestedMeasure)
  )
    errors.push("Choose area or perimeter");
  if (s.unit !== "cm") errors.push("This batch uses centimetres");
  if (!errors.length && s.annotations !== undefined)
    errors.push(
      ...validatePlan(s.annotations, annotationCatalogue(s)).map(
        (message) => `annotations: ${message}`,
      ),
    );
  return errors;
}
export function areaPerimeterAnswer(
  s: AreaPerimeterSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "reflection") return step.answer;
  if (goal === "units")
    return (
      step.choices?.find(
        (choice) =>
          choice.meaning ===
          (s.knownMeasure === "area" ? "square-unit" : "length-unit"),
      )?.id ?? ""
    );
  if (goal === "relation")
    return (
      step.choices?.find(
        (choice) =>
          choice.meaning ===
          (s.knownMeasure === "area" ? "area-divide" : "perimeter-subtract"),
      )?.id ?? ""
    );
  if (goal === "method")
    return (
      step.choices?.find((choice) => choice.meaning === "subtract-cutout")
        ?.id ?? ""
    );
  if (goal === "boundary-method")
    return (
      step.choices?.find((choice) => choice.meaning === "outer-equivalent")
        ?.id ?? ""
    );
  if (goal === "missing-side")
    return String(s.unknownSide === "width" ? s.width : s.height);
  if (goal === "component") return String(s.cutWidth * s.cutHeight);
  if (goal === "missing-edge") return String(s.width - s.cutWidth);
  if (goal === "area") return String(areaOf(s));
  if (goal === "perimeter") return String(perimeterOf(s));
  if (goal === "final")
    return String(s.requestedMeasure === "area" ? areaOf(s) : perimeterOf(s));
  return "";
}
export function validateAreaPerimeterSteps(l: Lesson): string[] {
  const errors = validateAreaPerimeterSpec(l.specification);
  if (errors.length) return errors;
  const s = l.specification as unknown as AreaPerimeterSpec;
  const goals =
    s.task === "missing-side"
      ? ["units", "relation", "missing-side", "reflection"]
      : s.task === "composite-area"
        ? ["method", "component", "area", "reflection"]
        : s.task === "composite-perimeter"
          ? ["missing-edge", "boundary-method", "perimeter", "reflection"]
          : ["final", "reflection"];
  if (l.steps.map((step) => step.goal).join(",") !== goals.join(","))
    errors.push("Unsupported measurement goal sequence");
  for (const step of l.steps) {
    const choice = [
      "units",
      "relation",
      "method",
      "boundary-method",
      "reflection",
    ].includes(step.goal ?? "");
    if (step.kind !== (choice ? "choice" : "exact"))
      errors.push("Response kind contradicts measurement goal");
    if (
      step.goal !== "reflection" &&
      String(step.answer) !== String(areaPerimeterAnswer(s, step)) &&
      !(
        (step.goal === "method" || step.goal === "boundary-method") &&
        step.choices?.some(
          (option) =>
            option.id === step.answer &&
            ["split-add", "edge-sum"].includes(option.meaning ?? ""),
        )
      )
    )
      errors.push("Answer contradicts measurement model");
    const requiredMeanings: Record<string, string[]> = {
      units: ["square-unit", "length-unit", "volume-unit"],
      relation: ["area-divide", "perimeter-subtract", "unrelated"],
      method: ["subtract-cutout", "split-add", "add-cutout"],
      "boundary-method": ["outer-equivalent", "edge-sum", "internal-edge"],
    };
    if (
      step.goal &&
      requiredMeanings[step.goal] &&
      step.choices
        ?.map((option) => option.meaning)
        .sort()
        .join(",") !== requiredMeanings[step.goal].sort().join(",")
    )
      errors.push(
        "Measurement choices must have the supported model meanings exactly once",
      );
  }
  return errors;
}
const adapter: Adapter = {
  id: "area-perimeter",
  initialState: (lesson) => ({
    specification: structuredClone(lesson.specification),
  }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) => {
    const s = state.specification as unknown as AreaPerimeterSpec;
    if (step.kind === "exact")
      return assessExact(
        state,
        step,
        parseFraction,
        areaPerimeterAnswer(s, step),
      );
    if (step.goal === "method" || step.goal === "boundary-method") {
      const selected = step.choices?.find(
        (choice) => choice.id === state.answer,
      );
      const accepted =
        step.goal === "method"
          ? ["subtract-cutout", "split-add"]
          : ["outer-equivalent", "edge-sum"];
      if (selected && accepted.includes(selected.meaning ?? ""))
        return assess(state, step, selected.id);
    }
    return assess(state, step, areaPerimeterAnswer(s, step));
  },
  describe: (state) => {
    const s = state.specification as unknown as AreaPerimeterSpec;
    if (s.task === "missing-side") {
      const known =
        s.unknownSide === "width"
          ? `height ${s.height} cm`
          : `width ${s.width} cm`;
      return `Rectangle with ${known} and missing ${s.unknownSide}. ${s.knownMeasure === "area" ? `Area ${s.width * s.height} square centimetres` : `Perimeter ${perimeterOf(s)} centimetres`} is given.`;
    }
    return `L-shape made by removing a ${s.cutWidth} cm by ${s.cutHeight} cm rectangle from the ${s.corner.replace("-", " ")} corner of an outer ${s.width} cm by ${s.height} cm rectangle. Only outside edges form the perimeter.`;
  },
};
export const areaPerimeterTopic: RuntimeTopic = {
  id: "area-perimeter",
  label: "Area and perimeter",
  visualTitle: "Measured shapes",
  adapter,
  validateSpec: validateAreaPerimeterSpec,
  validateSteps: validateAreaPerimeterSteps,
  answer: (lesson, step) =>
    areaPerimeterAnswer(
      lesson.specification as unknown as AreaPerimeterSpec,
      step,
    ),
  render: (lesson) => {
    const s = lesson.specification as unknown as AreaPerimeterSpec;
    const plan = s.annotations ?? defaultAnnotationPlan(s);
    return `<div class="area-perimeter-model" role="img" aria-label="${escape(adapter.describe({ specification: s }))}">${renderFigureSvg(s, plan)}<p>${escape(adapter.describe({ specification: s }))}</p></div>`;
  },
  interpretation: (lesson) => {
    const s = lesson.specification as unknown as AreaPerimeterSpec;
    if (s.task !== "practice") return undefined;
    const shared = [
      {
        entity: "outer-width",
        value: s.width,
        unit: "cm",
        state: "given" as const,
      },
      {
        entity: "outer-height",
        value: s.height,
        unit: "cm",
        state: "given" as const,
      },
      {
        entity: "cut-width",
        value: s.cutWidth,
        unit: "cm",
        state: "given" as const,
      },
      {
        entity: "cut-height",
        value: s.cutHeight,
        unit: "cm",
        state: "given" as const,
      },
    ];
    const evidence = {
      unknown: "requested",
      sourceSpans: [{ start: 0, end: lesson.story.length, text: lesson.story }],
      assumptions: ["The cutout is a rectangle at one outer corner."],
      ambiguities: [],
    };
    if (s.requestedMeasure === "area")
      return {
        ...evidence,
        entities: [
          "outer-width",
          "outer-height",
          "cut-width",
          "cut-height",
          "outer-area",
          "cut-area",
          "requested",
        ],
        quantities: [
          ...shared,
          {
            entity: "outer-area",
            value: s.width * s.height,
            unit: "cm²",
            state: "derived" as const,
          },
          {
            entity: "cut-area",
            value: s.cutWidth * s.cutHeight,
            unit: "cm²",
            state: "derived" as const,
          },
          {
            entity: "requested",
            value: areaOf(s),
            unit: "cm²",
            state: "derived" as const,
          },
        ],
        relationships: [
          {
            kind: "operation" as const,
            id: "outer-area",
            operation: "multiply" as const,
            inputs: ["outer-width", "outer-height"],
            output: "outer-area",
          },
          {
            kind: "operation" as const,
            id: "cut-area",
            operation: "multiply" as const,
            inputs: ["cut-width", "cut-height"],
            output: "cut-area",
          },
          {
            kind: "operation" as const,
            id: "requested",
            operation: "subtract" as const,
            inputs: ["outer-area", "cut-area"],
            output: "requested",
          },
        ],
      };
    return {
      ...evidence,
      entities: [
        "outer-width",
        "outer-height",
        "cut-width",
        "cut-height",
        "factor",
        "half-boundary",
        "requested",
      ],
      quantities: [
        ...shared,
        { entity: "factor", value: 2, unit: "times", state: "given" as const },
        {
          entity: "half-boundary",
          value: s.width + s.height,
          unit: "cm",
          state: "derived" as const,
        },
        {
          entity: "requested",
          value: perimeterOf(s),
          unit: "cm",
          state: "derived" as const,
        },
      ],
      relationships: [
        {
          kind: "operation" as const,
          id: "half-boundary",
          operation: "add" as const,
          inputs: ["outer-width", "outer-height"],
          output: "half-boundary",
        },
        {
          kind: "operation" as const,
          id: "requested",
          operation: "multiply" as const,
          inputs: ["half-boundary", "factor"],
          output: "requested",
        },
      ],
    };
  },
};
