import { symmetryBenchSteps } from "./symmetry-bench";
import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  SHAPES,
  SHAPE_IDS,
  axisCount,
  candidateLines,
  matchOptions,
  shadedCount,
  symmetryAnswer,
  validateSymmetrySpec,
  type ShapeId,
  type SymmetrySpec,
} from "../topics/symmetry";
import {
  choiceStep,
  choices,
  deriveAnswers,
  exactStep,
  hints,
  multiStep,
  p4Package,
  reflectionStep,
} from "../topics/p4-kit";

const FORMS = [
  "p4-mirror-line-bench",
  "p4-shade-to-complete-bench",
  "p4-lines-of-symmetry",
  "p4-symmetric-figure",
  "p4-symmetry-practice",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], SymmetrySpec["task"]> = {
  "p4-mirror-line-bench": "place",
  "p4-shade-to-complete-bench": "shade",
  "p4-lines-of-symmetry": "lines",
  "p4-symmetric-figure": "complete",
  "p4-symmetry-practice": "practice",
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function steps(s: SymmetrySpec): Step[] {
  if (s.task === "place" || s.task === "shade") return symmetryBenchSteps(s);
  if (s.task === "lines") {
    const lines = candidateLines(s.shape, s.rotation);
    const real = lines.filter((c) => c.symmetric);
    const count = axisCount(s.shape);
    const name = SHAPES[s.shape].name;
    return [
      multiStep(
        "axes",
        "Test the dashed lines",
        `Which of the dashed lines are lines of symmetry? Choose every line that works.`,
        choices(
          lines.map((c) => ({
            label: `Line ${c.id}`,
            meaning: `line:${c.id}`,
          })),
          SHAPE_IDS.indexOf(s.shape),
          true,
        ),
        hints(
          "A line of symmetry splits the shape into two halves that match exactly when folded.",
          "Imagine folding the shape along each line. Do the two sides land exactly on each other?",
          "Test one line at a time. A line that only looks balanced may not work.",
          `Choose ${real.map((c) => `line ${c.id}`).join(" and ")}.`,
        ),
      ),
      exactStep(
        "count",
        "Count all the lines",
        `How many lines of symmetry does a ${name} have in all?`,
        hints(
          "Look for every different way to fold the shape so the halves match.",
          "The dashed lines show only some of the ways. Think about other folds.",
          count === 1
            ? "There is only one way to fold it so the two halves match."
            : `Count each different fold that works. There are more than one.`,
          `A ${name} has ${plural(count, "line")} of symmetry. Enter ${count}.`,
        ),
      ),
      reflectionStep(
        "How can you tell if a line is a line of symmetry?",
        "Fold along it: the two halves must match exactly.",
        [
          "The line goes through the very middle of the whole shape.",
          "The line joins two of the opposite corners of the shape.",
        ],
        hints(
          "Think about folding the shape.",
          "A line through the middle does not always work.",
          "A line joining corners does not always work either.",
          "Choose the explanation about the halves matching when folded.",
        ),
        SHAPE_IDS.indexOf(s.shape) + 1,
      ),
    ];
  }
  if (s.task === "complete") {
    const options = matchOptions(s);
    const n = shadedCount(s);
    return [
      choiceStep(
        "match",
        "Match the marked square",
        "Fold along the dashed mirror line. Which labelled square matches the marked square X?",
        choices(
          options.map((o) => ({ label: `Square ${o.id}`, meaning: o.meaning })),
          n + s.cells.indexOf(s.probe),
        ),
        hints(
          "A mirror image is the same distance from the mirror line on the other side.",
          `Count how many squares X is from the mirror line, then count the same distance on the other side.`,
          s.mirror === "vertical"
            ? "It is in the same row, the same distance from the line."
            : "It is in the same column, the same distance from the line.",
          "Choose the square that is the same distance from the line, in the matching row or column.",
        ),
      ),
      exactStep(
        "to-shade",
        "Shade the other side",
        "How many more squares must be shaded on the other side to make the figure symmetrical?",
        hints(
          "Every shaded square needs a matching square on the other side.",
          "Count the shaded squares on the side that is already shaded.",
          `There are ${n} shaded squares, so the other side needs the same number.`,
          `${n} more squares. Enter ${n}.`,
        ),
      ),
      exactStep(
        "total",
        "Count them all",
        "How many squares will be shaded altogether when the figure is complete?",
        hints(
          "Add the squares on both sides of the mirror line.",
          "Both sides will have the same number of shaded squares.",
          `${n} on each side.`,
          `${n} + ${n} = ${2 * n}. Enter ${2 * n}.`,
        ),
      ),
      reflectionStep(
        "How do you complete a symmetrical figure?",
        "Give each shaded square a partner the same distance away on the other side.",
        [
          "Copy the shaded squares to the other side, keeping them in the same positions.",
          "Shade only the squares that touch the mirror line on the other side of it.",
        ],
        hints(
          "Think about a reflection in a mirror.",
          "A reflection reverses the figure across the line.",
          "Copying in the same positions makes a slide, not a reflection.",
          "Choose the explanation about the same distance from the mirror line.",
        ),
        n,
      ),
    ];
  }
  const count = axisCount(s.shape);
  const name = SHAPES[s.shape].name;
  return [
    exactStep(
      "count",
      "Count the lines of symmetry",
      `How many lines of symmetry does this ${name} have? If there are none, enter 0.`,
      hints(
        "Think about folding the shape so that the two halves match exactly.",
        "Try folding along the middle, along the corners, and in other directions.",
        count === 0
          ? "No fold makes the two halves match, even though it looks regular."
          : `Test each fold carefully. There ${count === 1 ? "is" : "are"} ${count}.`,
        `The ${name} has ${plural(count, "line")} of symmetry. Enter ${count}.`,
      ),
    ),
    reflectionStep(
      "Can a shape have no lines of symmetry?",
      "Yes. If no fold makes the halves match, it has no line of symmetry.",
      [
        "No. Every shape has at least one line of symmetry somewhere on it.",
        "Yes, but only shapes with four sides can have no line of symmetry.",
      ],
      hints(
        "Think about shapes that look tilted or uneven.",
        "A fold must make the halves match exactly.",
        "Some shapes cannot be folded to match.",
        "Choose the explanation that says a shape can have none.",
      ),
      count + 1,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateSymmetrySpec, (lesson, step) =>
    symmetryAnswer(lesson.specification as unknown as SymmetrySpec, step),
  );
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateSymmetrySpec(next.specification).length) return next;
  const s = next.specification as unknown as SymmetrySpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story =
    s.task === "complete"
      ? "Part of a figure is shaded on one side of a mirror line."
      : s.task === "lines"
        ? `Test four dashed lines on a ${SHAPES[s.shape].name}.`
        : next.steps[0].prompt;
  return derive(next);
}

function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported symmetry form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: SymmetrySpec = {
    task,
    shape:
      task === "place"
        ? "kite"
        : task === "practice"
          ? "parallelogram"
          : "rectangle",
    cols: task === "place" || task === "shade" ? 6 : 8,
    rows: 4,
    mirror: "vertical",
    cells:
      task === "shade"
        ? ["0,2", "1,1", "1,2", "2,0", "3,1"]
        : ["0,2", "1,1", "1,2", "2,0", "2,3", "3,1"],
    probe: "1,2",
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "symmetry",
    title: {
      place: "Place the mirror",
      shade: "Shade the other half",
      lines: "Which folds match?",
      complete: "Finish the mirror picture",
      practice: "A fresh symmetry question",
    }[task],
    subtitle: "P4 symmetry revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 3 : 7,
    objective: {
      place: "Choose a mirror line that reflects a shape onto itself.",
      shade: "Complete the reflected half and transfer to a new square.",
      lines: "Find the lines of symmetry of a shape.",
      complete: "Complete a figure so it is symmetrical about a mirror line.",
      practice: "Count the lines of symmetry of a shape.",
    }[task],
    story: "Look at the picture.",
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  return p4Package({
    lesson,
    form,
    family: "symmetry",
    author:
      task === "place" || task === "shade"
        ? "codex-p4-symmetry-bench"
        : "claude-p4-symmetry",
    taskLabel: task,
    specErrors: validateSymmetrySpec,
    extraTags:
      task === "place" || task === "shade"
        ? ["level-unconfirmed", "workbench"]
        : [],
  });
}

const select = (
  key: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
): TopicField => ({ key, label, type: "select", value, options });
export const symmetryAuthor: AuthorTopic = {
  id: "symmetry",
  forms: [
    {
      id: "p4-mirror-line-bench",
      label: "Place a mirror line",
      description: "Move a line and test a shape reflection.",
    },
    {
      id: "p4-shade-to-complete-bench",
      label: "Hands-on mirror shading",
      description: "Shade the far half of a six-column grid.",
    },
    {
      id: "p4-lines-of-symmetry",
      label: "Lines of symmetry",
      description:
        "Test dashed lines on a shape and count its lines of symmetry.",
    },
    {
      id: "p4-symmetric-figure",
      label: "Complete a symmetric figure",
      description: "Match squares across a mirror line and finish the figure.",
    },
    {
      id: "p4-symmetry-practice",
      label: "Symmetry practice",
      description: "One fresh question counting lines of symmetry.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as SymmetrySpec;
    const fields: TopicField[] = [];
    if (s.task !== "complete" && s.task !== "shade") {
      const options = SHAPE_IDS.filter((id) =>
        s.task === "place"
          ? candidateLines(id).filter((c) => c.symmetric).length === 1
          : s.task !== "lines" || axisCount(id) > 0,
      ).map((id) => ({ value: id, label: SHAPES[id as ShapeId].name }));
      fields.push(select("shape", "Shape", s.shape, options));
    } else {
      fields.push(
        select("mirror", "Mirror line", s.mirror, [
          { value: "vertical", label: "vertical" },
          { value: "horizontal", label: "horizontal" },
        ]),
        select(
          "cols",
          "Columns",
          String(s.cols),
          (s.task === "shade" ? [6] : [6, 8]).map((n) => ({
            value: String(n),
            label: String(n),
          })),
        ),
        select(
          "rows",
          "Rows",
          String(s.rows),
          [4, 6].map((n) => ({ value: String(n), label: String(n) })),
        ),
        {
          key: "cells",
          label:
            "Shaded squares as row,column pairs separated by semicolons (counting from 0)",
          type: "text",
          value: Array.isArray(s.cells) ? s.cells.join("; ") : String(s.cells),
        },
        {
          key: "probe",
          label: "Marked square (row,column)",
          type: "text",
          value: String(s.probe),
        },
      );
    }
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const text = String(value);
    if (key === "cells")
      next.specification.cells = text
        .split(/[;|]/)
        .map((x) => x.replace(/\s+/g, ""))
        .filter(Boolean);
    else if (key === "cols" || key === "rows")
      next.specification[key] = /^\d+$/.test(text) ? Number(text) : value;
    else if (key === "probe")
      next.specification.probe = text.replace(/\s+/g, "");
    else if (key === "shape" || key === "mirror")
      next.specification[key] = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
