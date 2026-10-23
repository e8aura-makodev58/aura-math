import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  aboveTarget,
  axisMaxOf,
  biggestRiseIndex,
  highestIndex,
  lineGraphsAnswer,
  lineGraphsTopic,
  risesOf,
  rowsOf,
  spreadOf,
  validateLineGraphsSpec,
  type LineGraphsSpec,
} from "../topics/line-graphs";
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
  "p4-read-line-graph",
  "p4-line-graph-change",
  "p4-line-graph-target",
  "p4-line-graph-practice",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], LineGraphsSpec["task"]> = {
  "p4-read-line-graph": "read",
  "p4-line-graph-change": "change",
  "p4-line-graph-target": "threshold",
  "p4-line-graph-practice": "practice",
};

function steps(s: LineGraphsSpec): Step[] {
  const q = s.quantity;
  const L = s.labels;
  const V = s.values;
  if (s.task === "read") {
    const rows = rowsOf(s),
      top = axisMaxOf(s);
    return [
      exactStep(
        "scale",
        "Read the scale",
        `Look at the scale up the side. How many ${q} does each gridline step stand for?`,
        hints(
          "Look at the numbers at the bottom and the top of the scale.",
          "Count how many equal steps there are from the bottom to the top.",
          `The scale reaches ${top} in ${rows} equal steps, so work out ${top} ÷ ${rows}.`,
          `Each step is ${s.step}. Enter ${s.step}.`,
        ),
      ),
      exactStep(
        "read",
        "Read a point",
        `How many ${q} does the graph show for ${L[s.a]}?`,
        hints(
          `Find ${L[s.a]} along the bottom and follow it up to the point.`,
          "From the point, read across to the scale. Use the step size you found.",
          `The point is ${Math.floor(V[s.a] / s.step)} whole steps${V[s.a] % s.step ? " and a half step" : ""} up the scale.`,
          `The point is at ${V[s.a]}. Enter ${V[s.a]}.`,
        ),
      ),
      choiceStep(
        "compare",
        "Compare two points",
        `Which shows more ${q}: ${L[s.a]} or ${L[s.b]}?`,
        choices(
          [
            { label: L[s.a], meaning: "left" },
            { label: L[s.b], meaning: "right" },
            { label: "Both the same", meaning: "same" },
          ],
          s.a + s.b,
        ),
        hints(
          "A higher point means a bigger number.",
          `Find both points and see which is higher on the graph.`,
          `${L[V[s.a] > V[s.b] ? s.a : s.b]} has the higher point.`,
          `Choose ${L[V[s.a] > V[s.b] ? s.a : s.b]}.`,
        ),
      ),
      reflectionStep(
        "Why should you check the scale before reading a line graph?",
        "A step on the scale can stand for more than 1, so check its size.",
        [
          "The scale is only there to decorate, so it does not change readings.",
          "Every line graph scale goes up in ones, so you just count the steps.",
        ],
        hints(
          "Think about the numbers up the side.",
          "Steps can stand for 5, 10 or 20, not always 1.",
          "The size of a step changes every reading.",
          "Choose the explanation about what each step stands for.",
        ),
        s.step,
      ),
    ];
  }
  if (s.task === "change") {
    const hi = V[s.a] > V[s.b] ? s.a : s.b,
      lo = hi === s.a ? s.b : s.a;
    const best = biggestRiseIndex(V);
    const rises = risesOf(V);
    const others = rises
      .map((r, i) => [r, i] as const)
      .filter(([, i]) => i !== best)
      .sort((x, y) => y[0] - x[0] || x[1] - y[1])
      .slice(0, 2)
      .map(([, i]) => i);
    const label = (i: number) => `${L[i]} to ${L[i + 1]}`;
    return [
      exactStep(
        "read",
        "Read a point",
        `How many ${q} does the graph show for ${L[s.a]}?`,
        hints(
          `Find ${L[s.a]} along the bottom and go up to its point.`,
          "Read across to the scale and use the size of each step.",
          `The point is ${Math.floor(V[s.a] / s.step)} whole steps${V[s.a] % s.step ? " and a half step" : ""} up.`,
          `The point is at ${V[s.a]}. Enter ${V[s.a]}.`,
        ),
      ),
      exactStep(
        "difference",
        "Find the difference",
        `How many more ${q} are shown for ${L[hi]} than for ${L[lo]}?`,
        hints(
          "Read both points from the scale first.",
          "To find how many more, take the smaller number from the larger.",
          `${L[hi]} shows ${V[hi]} and ${L[lo]} shows ${V[lo]}.`,
          `${V[hi]} − ${V[lo]} = ${V[hi] - V[lo]}. Enter ${V[hi] - V[lo]}.`,
        ),
      ),
      choiceStep(
        "biggest-rise",
        "Find the biggest climb",
        "Between which two neighbouring points did the line climb the most?",
        choices(
          [
            { label: label(best), meaning: "biggest" },
            { label: label(others[0]), meaning: "other-a" },
            { label: label(others[1]), meaning: "other-b" },
          ],
          best,
        ),
        hints(
          "A climb is where the line goes up from one point to the next.",
          "Work out how far the line goes up between each pair of neighbours.",
          `Between ${label(best)} the line climbs ${rises[best]}.`,
          `Choose ${label(best)}.`,
        ),
      ),
      reflectionStep(
        "How can you tell where a line graph climbs the most?",
        "Find the part of the line that climbs the most between two neighbours.",
        [
          "Find the highest point on the whole graph, because the biggest climb ends there.",
          "Compare the first and last points, since the climb is between them.",
        ],
        hints(
          "Think about how the line moves between points.",
          "A big climb means a big change from one point to the next.",
          "The highest point can come after a small climb.",
          "Choose the explanation about the furthest climb between neighbours.",
        ),
        best,
      ),
    ];
  }
  if (s.task === "threshold") {
    const above = aboveTarget(s);
    const top = highestIndex(V);
    const rest = L.map((_, i) => i)
      .filter((i) => i !== top)
      .sort((a, b) => V[b] - V[a] || a - b)
      .slice(0, 2);
    const sum = above.reduce((t, i) => t + V[i], 0);
    return [
      multiStep(
        "above",
        "Find the points above the line",
        `Which days show more than ${s.target} ${q}? Choose every day.`,
        choices(
          L.map((l, i) => ({ label: l, meaning: `label:${i}` })),
          s.target / 5,
          true,
        ),
        hints(
          `Find the dashed line at ${s.target}.`,
          "A point above the line is more than the target.",
          `Check each point: is it above ${s.target}?`,
          `Choose ${above.map((i) => L[i]).join(", ")}.`,
        ),
      ),
      exactStep(
        "total",
        "Add them up",
        `Add the ${q} for the days that were more than ${s.target}. What is the total?`,
        hints(
          "Read the value for each day that was above the line.",
          "Add those values together.",
          `The values are ${above.map((i) => V[i]).join(" and ")}.`,
          `${above.map((i) => V[i]).join(" + ")} = ${sum}. Enter ${sum}.`,
        ),
      ),
      choiceStep(
        "highest",
        "Find the highest",
        `Which day shows the most ${q}?`,
        choices(
          [
            { label: L[top], meaning: "highest" },
            { label: L[rest[0]], meaning: "other-a" },
            { label: L[rest[1]], meaning: "other-b" },
          ],
          top,
        ),
        hints(
          "The highest point is the furthest up the graph.",
          "Compare the tallest points.",
          `${L[top]} reaches the highest point.`,
          `Choose ${L[top]}.`,
        ),
      ),
      reflectionStep(
        "What does the dashed line help you do?",
        "It marks the target, so points above it are more than the target.",
        [
          "It joins all of the points together so that you can follow the line.",
          "It shows the total of all the days added up together on the graph.",
        ],
        hints(
          "Think about what the dashed line marks.",
          "It sits at the target number.",
          "Points above it are greater than the target.",
          "Choose the explanation about comparing with the target.",
        ),
        s.target,
      ),
    ];
  }
  const spread = spreadOf(V);
  return [
    exactStep(
      "spread",
      "Find the difference",
      `The graph shows ${q} on each day. How many more ${q} does the highest point show than the lowest point?`,
      hints(
        "Find the highest point and the lowest point first.",
        "Read each one from the scale.",
        `The highest is ${Math.max(...V)} and the lowest is ${Math.min(...V)}.`,
        `${Math.max(...V)} − ${Math.min(...V)} = ${spread}. Enter ${spread}.`,
      ),
    ),
    reflectionStep(
      "Why do we subtract to find how many more?",
      "Taking the smaller from the larger shows how much bigger it is.",
      [
        "Adding the two numbers tells us how many more one has than the other.",
        "Subtracting only works when the two numbers are very close together.",
      ],
      hints(
        "Think about comparing two amounts.",
        "How many more means how much bigger.",
        "Take away the smaller from the larger.",
        "Choose the explanation about taking the smaller from the larger.",
      ),
      spread / 5,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateLineGraphsSpec, (lesson, step) =>
    lineGraphsAnswer(lesson.specification as unknown as LineGraphsSpec, step),
  );
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateLineGraphsSpec(next.specification).length) return next;
  const s = next.specification as unknown as LineGraphsSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story =
    s.task === "practice"
      ? next.steps[0].prompt
      : `A line graph shows ${s.quantity} for ${s.labels.join(", ")}.`;
  return derive(next);
}

const DEFAULTS: Record<LineGraphsSpec["task"], Omit<LineGraphsSpec, "task">> = {
  read: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    values: [20, 35, 25, 45, 30],
    step: 10,
    quantity: "books borrowed",
    a: 2,
    b: 3,
    target: 0,
  },
  change: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    values: [15, 30, 20, 50, 35],
    step: 10,
    quantity: "visitors",
    a: 0,
    b: 3,
    target: 0,
  },
  threshold: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    values: [25, 40, 35, 55, 45, 30],
    step: 10,
    quantity: "cups sold",
    a: 0,
    b: 1,
    target: 40,
  },
  practice: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    values: [35, 60, 45, 25, 50],
    step: 10,
    quantity: "plants sold",
    a: 0,
    b: 1,
    target: 0,
  },
};
function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported line-graph form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: LineGraphsSpec = { task, ...structuredClone(DEFAULTS[task]) };
  const title = {
    read: "Read the scale and the line",
    change: "Ups and downs",
    threshold: "Above the dashed line",
    practice: "A fresh graph question",
  }[task];
  const objective = {
    read: "Read the scale of a line graph and read values from it.",
    change: "Find differences and the biggest change between points.",
    threshold: "Pick out the values above a target and add them.",
    practice: "Find the difference between the highest and lowest values.",
  }[task];
  const lesson = rewrite({
    id,
    version: 1,
    topic: "line-graphs",
    title,
    subtitle: "P4 line-graph revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective,
    story: "Read the line graph.",
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  const pkg = p4Package({
    lesson,
    form,
    family: "line-graphs",
    author: "claude-p4-line-graphs",
    taskLabel: task,
    specErrors: validateLineGraphsSpec,
  });
  const context = lineGraphsTopic.interpretation!(lesson);
  if (context) pkg.interpretation = context;
  return pkg;
}

const list = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : String(v ?? "");
export const lineGraphsAuthor: AuthorTopic = {
  id: "line-graphs",
  forms: [
    {
      id: "p4-read-line-graph",
      label: "Read a line graph",
      description: "Work out the scale, read a point and compare two points.",
    },
    {
      id: "p4-line-graph-change",
      label: "Changes on a line graph",
      description:
        "Find a difference and the biggest climb between neighbouring points.",
    },
    {
      id: "p4-line-graph-target",
      label: "Points above a target",
      description: "Find the points above a dashed target line and add them.",
    },
    {
      id: "p4-line-graph-practice",
      label: "Line graph practice",
      description: "One fresh question on the highest and lowest values.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as LineGraphsSpec;
    const labelOptions = (Array.isArray(s.labels) ? s.labels : []).map(
      (name, i) => ({
        value: String(i),
        label: String(name),
      }),
    );
    const fields: TopicField[] = [
      {
        key: "quantity",
        label: "What is counted",
        type: "text",
        value: s.quantity,
      },
      {
        key: "labels",
        label: "Labels along the bottom (comma separated, 4–7)",
        type: "text",
        value: list(s.labels),
      },
      {
        key: "values",
        label: "Values (comma separated, 0–100)",
        type: "text",
        value: list(s.values),
      },
      {
        key: "step",
        label: "Each gridline step stands for",
        type: "select",
        value: String(s.step),
        options: [5, 10, 20].map((v) => ({
          value: String(v),
          label: String(v),
        })),
      },
    ];
    if (s.task === "read" || s.task === "change")
      fields.push(
        {
          key: "a",
          label: "First point asked about",
          type: "select",
          value: String(s.a),
          options: labelOptions,
        },
        {
          key: "b",
          label: "Second point asked about",
          type: "select",
          value: String(s.b),
          options: labelOptions,
        },
      );
    if (s.task === "threshold")
      fields.push({
        key: "target",
        label: "Target (dashed line)",
        type: "number",
        value: s.target,
      });
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const text = String(value);
    if (key === "labels")
      next.specification.labels = text.split(",").map((x) => x.trim());
    else if (key === "values") {
      const parts = text.split(",").map((x) => x.trim());
      next.specification.values = parts.every((x) => /^\d+$/.test(x))
        ? parts.map(Number)
        : parts;
    } else if (["step", "a", "b", "target"].includes(key))
      next.specification[key] = /^\d+$/.test(text) ? Number(text) : value;
    else if (key === "quantity") next.specification.quantity = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
