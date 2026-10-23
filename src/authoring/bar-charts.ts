import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import { SCALE_STEPS } from "../topics/chart-scale";
import {
  barChartsAnswer,
  gapOrder,
  rowsOf,
  topValue,
  validateBarChartsSpec,
  type BarChartsSpec,
} from "../topics/bar-charts";
import {
  choiceStep,
  choices,
  deriveAnswers,
  exactStep,
  hints,
  p4Package,
  reflectionStep,
} from "../topics/p4-kit";

const FORMS = [
  "p4-read-bar-chart",
  "p4-double-bar-chart",
  "p4-bar-chart-practice",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], BarChartsSpec["task"]> = {
  "p4-read-bar-chart": "read",
  "p4-double-bar-chart": "double",
  "p4-bar-chart-practice": "practice",
};
const list = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** Where the top of a bar sits against the gridlines, in words, without naming a calculation. */
function position(v: number, step: number): string {
  if (v % step === 0) return `level with the gridline for ${v}`;
  const low = v - (v % step);
  return `halfway between the gridlines for ${low} and ${low + step}`;
}

function steps(s: BarChartsSpec): Step[] {
  const L = s.labels;
  const V = s.values;
  const A = L[s.a],
    B = L[s.b];
  if (s.task === "read") {
    const rows = rowsOf(s);
    const top = topValue(s);
    return [
      exactStep(
        "scale",
        "Work out the scale",
        "Only the bottom and top gridlines have numbers. What does each gap between two gridlines stand for?",
        hints(
          "Look at the numbers written beside the axis, then at the lines between them.",
          "Count the equal gaps between the bottom line and the top line.",
          `The top line is ${top} and there are ${rows} equal gaps. Share ${top} equally between the gaps.`,
          `${top} ÷ ${rows} = ${s.step}. Enter ${s.step}.`,
        ),
      ),
      exactStep(
        "read",
        "Read one bar",
        `How tall is the ${A} bar? Read its value from the scale.`,
        hints(
          `Find the ${A} bar and look at where its top edge ends.`,
          "Follow the top of the bar across to the axis. The gridlines help your eye.",
          `The top of the ${A} bar is ${position(V[s.a], s.step)}.`,
          `The ${A} bar shows ${V[s.a]}. Enter ${V[s.a]}.`,
        ),
      ),
      exactStep(
        "total",
        "Add two bars",
        `What is the total of the ${A} bar and the ${B} bar?`,
        hints(
          "Read each bar on its own first.",
          `Read the ${A} bar and the ${B} bar with the scale of ${s.step}.`,
          `${A} is ${V[s.a]} and ${B} is ${V[s.b]}. Add the two numbers.`,
          `${V[s.a]} + ${V[s.b]} = ${V[s.a] + V[s.b]}. Enter ${V[s.a] + V[s.b]}.`,
        ),
      ),
      reflectionStep(
        "Why do you work out the scale before you read a bar?",
        "Not every line has a number, so the gap size tells you each value.",
        [
          "The scale always goes up in ones, so you can just count the lines up.",
          "The tallest bar sets the scale, so you read every other bar from it.",
        ],
        hints(
          "Think about the numbers you could see beside the axis.",
          "Only the bottom and top lines had numbers.",
          "The size of a gap lets you name every line between them.",
          "Choose the explanation about the size of each gap.",
        ),
        4 + 13 * s.a,
      ),
    ];
  }
  if (s.task === "double") {
    const [S1, S2] = s.series;
    const v1 = V[s.a],
      v2 = s.values2[s.a];
    const order = gapOrder(s);
    const gaps = L.map((l, i) => `${l} ${Math.abs(V[i] - s.values2[i])}`);
    const big = L[order[0]];
    const d = Math.abs(v1 - v2);
    return [
      exactStep(
        "read-pair",
        "Read the second bar",
        `Look at the ${S2} bar for ${A}. What value does it show?`,
        hints(
          `Check the key at the top to see which pattern stands for ${S2}.`,
          `Find the pair of bars for ${A} and choose the striped one.`,
          `The top of the striped ${A} bar is ${position(v2, s.step)}.`,
          `${S2} for ${A} is ${v2}. Enter ${v2}.`,
        ),
      ),
      exactStep(
        "difference",
        "Find the difference",
        `How many more are in the taller bar than in the shorter bar for ${A}?`,
        hints(
          "To find how many more, take the smaller number away from the larger one.",
          `Read both bars for ${A}: ${S1} is the solid bar and ${S2} is the striped bar.`,
          `${S1} is ${v1} and ${S2} is ${v2}.`,
          `${Math.max(v1, v2)} − ${Math.min(v1, v2)} = ${d}. Enter ${d}.`,
        ),
      ),
      choiceStep(
        "gap",
        "Find the biggest gap",
        "For which label are the two bars furthest apart in height?",
        choices(
          [
            { label: big, meaning: "biggest" },
            { label: L[order[1]], meaning: "other-a" },
            { label: L[order[2]], meaning: "other-b" },
          ],
          3 + 13 * order[0],
        ),
        hints(
          "A gap is how far apart the two bars of one pair are.",
          "Look at each pair in turn and find the pair whose tops are furthest apart.",
          `The gaps are: ${gaps.join(", ")}.`,
          `${big} has the biggest gap. Choose ${big}.`,
        ),
      ),
      reflectionStep(
        "How does the striped pattern help you read a double bar chart?",
        "The pattern and the key show you which bar belongs to which group.",
        [
          "The striped bar is always the taller bar in each pair of bars.",
          "The stripes show how many each bar stands for, like a scale.",
        ],
        hints(
          "Think about the key at the top of the chart.",
          "Each pair has one solid bar and one striped bar.",
          "The key matches a pattern to a group.",
          "Choose the explanation about matching bars to groups.",
        ),
        5 + 13 * s.a,
      ),
    ];
  }
  const sorted = [...V]
    .map((v, i) => ({ v, i }))
    .sort((x, y) => y.v - x.v || x.i - y.i);
  const [t1, t2] = sorted;
  const total = t1.v + t2.v;
  return [
    exactStep(
      "top-two-total",
      "Add the two tallest bars",
      "Find the two tallest bars and add their values. What is the total?",
      hints(
        "First find the tallest bar, then the next tallest.",
        `Read every bar with the scale of ${s.step}, then put the values in order.`,
        `The two tallest bars are ${L[t1.i]} (${t1.v}) and ${L[t2.i]} (${t2.v}).`,
        `${t1.v} + ${t2.v} = ${total}. Enter ${total}.`,
      ),
    ),
    reflectionStep(
      "How do you pick the two bars to add?",
      "Compare all the heights, then take the two highest, wherever they are.",
      [
        "The two tallest bars always stand next to each other somewhere on the chart.",
        "Add the first two bars on the left, because those are the ones read first.",
      ],
      hints(
        "Think about which bars the question asked for.",
        "The tallest bars could be anywhere along the chart.",
        "Look at every bar before you choose.",
        "Choose the explanation about comparing all the heights.",
      ),
      7,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateBarChartsSpec, (lesson, step) =>
    barChartsAnswer(lesson.specification as unknown as BarChartsSpec, step),
  );
function storyOf(s: BarChartsSpec): string {
  const names = list(s.labels);
  if (s.task === "double")
    return `The double bar chart compares ${s.series[0]} and ${s.series[1]} for ${names}. The key at the top shows which bar belongs to which group.`;
  if (s.task === "practice")
    return `The bar chart shows ${s.quantity.toLowerCase()} for ${names}.`;
  return `The bar chart shows ${s.quantity.toLowerCase()}: ${names}. The scale goes up in equal steps.`;
}
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateBarChartsSpec(next.specification).length) return next;
  const s = next.specification as unknown as BarChartsSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story = storyOf(s);
  return derive(next);
}

const DEFAULTS: Record<BarChartsSpec["task"], Omit<BarChartsSpec, "task">> = {
  read: {
    labels: ["Cats", "Dogs", "Fish", "Birds", "Mice"],
    values: [20, 35, 15, 40, 25],
    values2: [],
    series: [],
    step: 10,
    quantity: "Pets chosen by pupils",
    a: 1,
    b: 3,
  },
  double: {
    labels: ["P4A", "P4B", "P4C", "P4D"],
    values: [20, 35, 15, 35],
    values2: [25, 10, 35, 30],
    series: ["Boys", "Girls"],
    step: 10,
    quantity: "Pupils in each class",
    a: 2,
    b: 0,
  },
  practice: {
    labels: ["Art", "Chess", "Swim", "Music", "Drama"],
    values: [30, 55, 40, 65, 20],
    values2: [],
    series: [],
    step: 10,
    quantity: "Club members",
    a: 0,
    b: 0,
  },
};
const TITLES: Record<BarChartsSpec["task"], string> = {
  read: "Read the bars",
  double: "Two bars side by side",
  practice: "A fresh bar question",
};
const OBJECTIVES: Record<BarChartsSpec["task"], string> = {
  read: "Work out the scale of a bar chart, read a bar and add two bars.",
  double:
    "Read the second series of a double bar chart, find a difference and spot the biggest gap.",
  practice: "Add the two tallest bars of a bar chart.",
};
function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported bar-chart form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: BarChartsSpec = { task, ...structuredClone(DEFAULTS[task]) };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "bar-charts",
    title: TITLES[task],
    subtitle: "P3 bridge and P4 bar-chart revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective: OBJECTIVES[task],
    story: storyOf(spec),
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  // No interpretation task: the lessons read and add values and never ask what the data means.
  return p4Package({
    lesson,
    form,
    family: "bar-charts",
    author: "claude-p4-bar-charts",
    taskLabel: task,
    specErrors: validateBarChartsSpec,
    sources: [
      "https://practicle.sg/primary-3-math/",
      "https://practicle.sg/primary-4-math/",
    ],
    extraTags: ["p3-bridge"],
  });
}

const listText = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : String(v ?? "");
const numeric = (text: string): unknown => {
  const parts = text.split(",").map((x) => x.trim());
  return parts.every((x) => /^\d+$/.test(x)) ? parts.map(Number) : parts;
};
export const barChartsAuthor: AuthorTopic = {
  id: "bar-charts",
  forms: [
    {
      id: "p4-read-bar-chart",
      label: "Read the bars",
      description: "Work out the scale, read a bar and add two bars.",
    },
    {
      id: "p4-double-bar-chart",
      label: "Two bars side by side",
      description:
        "Read the second series of a double bar chart, find a difference and the biggest gap.",
    },
    {
      id: "p4-bar-chart-practice",
      label: "Bar chart practice",
      description: "One fresh question: add the two tallest bars.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as BarChartsSpec;
    const labelOptions = (Array.isArray(s.labels) ? s.labels : []).map(
      (name, i) => ({ value: String(i), label: String(name) }),
    );
    const fields: TopicField[] = [
      {
        key: "quantity",
        label: "What the chart shows (its title)",
        type: "text",
        value: s.quantity,
      },
      {
        key: "labels",
        label: "Labels (comma separated, 3–6)",
        type: "text",
        value: listText(s.labels),
      },
      {
        key: "values",
        label: "Values, one per label (comma separated, whole numbers)",
        type: "text",
        value: listText(s.values),
      },
    ];
    if (s.task === "double")
      fields.push(
        {
          key: "values2",
          label: "Second series values (comma separated)",
          type: "text",
          value: listText(s.values2),
        },
        {
          key: "series",
          label: "Series names (two, comma separated)",
          type: "text",
          value: listText(s.series),
        },
      );
    fields.push({
      key: "step",
      label: "Gridline step",
      type: "select",
      value: String(s.step),
      options: SCALE_STEPS.map((v) => ({ value: String(v), label: String(v) })),
    });
    if (s.task !== "practice")
      fields.push({
        key: "a",
        label: "First label asked about",
        type: "select",
        value: String(s.a),
        options: labelOptions,
      });
    if (s.task === "read")
      fields.push({
        key: "b",
        label: "Second label asked about",
        type: "select",
        value: String(s.b),
        options: labelOptions,
      });
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const spec = next.specification as unknown as Record<string, unknown>;
    const text = String(value);
    if (key === "labels" || key === "series")
      spec[key] = text.split(",").map((x) => x.trim());
    else if (key === "values" || key === "values2") spec[key] = numeric(text);
    else if (["step", "a", "b"].includes(key))
      spec[key] = /^\d+$/.test(text) ? Number(text) : value;
    else if (key === "quantity") spec.quantity = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
