import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  SLICE_COUNTS,
  pieChartsAnswer,
  sectorWord,
  validatePieChartsSpec,
  type PieChartsSpec,
} from "../topics/pie-charts";
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
  "p4-read-pie-chart",
  "p4-read-pie-sectors",
  "p4-pie-chart-count",
  "p4-pie-chart-total",
  "p4-pie-chart-practice",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], PieChartsSpec["task"]> = {
  "p4-read-pie-chart": "read",
  "p4-read-pie-sectors": "sectors",
  "p4-pie-chart-count": "count",
  "p4-pie-chart-total": "total",
  "p4-pie-chart-practice": "practice",
};
const list = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const SECTOR_LABEL: Record<string, string> = {
  half: "A half (1/2)",
  quarter: "A quarter (1/4)",
  eighth: "An eighth (1/8)",
};

function steps(s: PieChartsSpec): Step[] {
  const q = s.quantity;
  const C = s.categories;
  const P = s.parts;
  const N = s.slices;
  const A = C[s.a],
    B = C[s.b];
  const pa = P[s.a],
    pb = P[s.b];
  const u = s.unit;
  if (s.task === "read")
    return [
      exactStep(
        "slices",
        "Count the slices",
        "How many equal slices is the whole pie cut into?",
        hints(
          "Look at the faint lines inside the circle. The part between two lines is one slice.",
          "Count the slices one at a time, starting at the top and going round clockwise.",
          `Slices by label: ${C.map((c, i) => `${c} ${P[i]}`).join(", ")}. Add them up.`,
          `${P.join(" + ")} = ${N}. Enter ${N}.`,
        ),
      ),
      choiceStep(
        "fraction",
        "Name the fraction",
        `What fraction of the whole pie is ${A}?`,
        choices(
          [
            { label: `${pa}/${N}`, meaning: "share" },
            { label: `${N - pa}/${N}`, meaning: "rest" },
            { label: `${pa}/${N - pa}`, meaning: "ratio" },
          ],
          1 + 13 * s.a,
        ),
        hints(
          "A fraction of the whole compares the slices in one label with all the slices.",
          `Count the slices that ${A} covers. Then think about all the slices in the pie.`,
          `${A} covers ${pa} slices out of ${N}. Put the slices it covers on top and all the slices underneath.`,
          `Choose ${pa}/${N}.`,
        ),
      ),
      choiceStep(
        "larger",
        "Compare two groups",
        `Which group is bigger: ${A} or ${B}?`,
        choices(
          [
            { label: A, meaning: "left" },
            { label: B, meaning: "right" },
            { label: "Both the same size", meaning: "same" },
          ],
          5 + 13 * (s.a + s.b),
        ),
        hints(
          "A bigger group covers more of the equal slices.",
          "Count the slices for each group and compare the two numbers.",
          `${A} covers ${pa} slices and ${B} covers ${pb} slices.`,
          `Choose ${pa > pb ? A : B}.`,
        ),
      ),
      reflectionStep(
        "How does a pie chart show that one group is bigger than another?",
        "The bigger group takes more of the equal slices, so its sector is bigger.",
        [
          "Each group gets one sector, so all of the sectors are the same size.",
          "The bigger group is always drawn first, starting at the top of the pie.",
        ],
        hints(
          "Think about what the slices of a pie chart stand for.",
          "Every slice is the same size.",
          "A group with more slices takes up more of the pie.",
          "Choose the explanation about taking up more of the equal slices.",
        ),
        10 + 13 * s.slices,
      ),
    ];
  if (s.task === "sectors") {
    const word = sectorWord(pa);
    const wordB = sectorWord(pb);
    return [
      choiceStep(
        "sector-fraction",
        "Name the sector",
        `What fraction of the whole pie is the ${A} sector?`,
        choices(
          ["half", "quarter", "eighth"].map((m) => ({
            label: SECTOR_LABEL[m],
            meaning: m,
          })),
          2,
          true,
        ),
        hints(
          "Compare the sector with the whole circle.",
          "Imagine the circle cut into 8 equal parts, like a pizza. How many of those parts would the sector cover?",
          `${A} covers ${pa} of the 8 equal parts, and ${pa}/8 is ${word === "eighth" ? "an" : "a"} ${word}.`,
          `Choose ${SECTOR_LABEL[word]}.`,
        ),
      ),
      exactStep(
        "parts",
        "Count the parts",
        `The whole circle is 8 equal parts, but the cuts are not drawn. How many of the 8 parts does the ${B} sector cover?`,
        hints(
          "Think about how much of the whole circle the sector fills.",
          "Work out how many of the 8 parts make a half, a quarter or an eighth of the circle.",
          `The ${B} sector is ${wordB === "eighth" ? "an" : "a"} ${wordB}, and ${wordB === "eighth" ? "an" : "a"} ${wordB} of 8 parts is ${pb} part${pb === 1 ? "" : "s"}.`,
          `The ${B} sector covers ${pb} of the 8 parts. Enter ${pb}.`,
        ),
      ),
      choiceStep(
        "share",
        "What a sector shows",
        "What does a sector of a pie chart show?",
        choices(
          [
            {
              label: "How much of the whole pie the group takes up.",
              meaning: "share",
            },
            {
              label: "How many items are in the group, counted as a number.",
              meaning: "amount",
            },
            {
              label: "How wide the corner of the sector is at the centre.",
              meaning: "angle",
            },
          ],
          6,
        ),
        hints(
          "Think about what the whole circle stands for.",
          "Every sector is one part of that whole.",
          "A sector tells you the fraction of the whole that one group makes up.",
          "Choose the share of the whole.",
        ),
      ),
      reflectionStep(
        "Why can you name a sector as a half or a quarter when no cuts are drawn?",
        "Compare it with the whole circle: a half fills half, a quarter a quarter.",
        [
          "The biggest sector in any pie chart is always exactly one half of it.",
          "The colour of the sector tells you which fraction of the pie it shows.",
        ],
        hints(
          "Think about how much of the circle the sector fills.",
          "A half is as much as the other half left over.",
          "Compare the sector with the whole circle, not with its colour.",
          "Choose the explanation about comparing with the whole circle.",
        ),
        11 + 13 * s.a,
      ),
    ];
  }
  if (s.task === "count") {
    const W = N * u;
    return [
      exactStep(
        "one-slice",
        "Find one slice",
        `The pie has ${N} equal slices and shows ${W} ${q} in all. How many ${q} does one slice stand for?`,
        hints(
          "Every slice stands for the same number.",
          "Share the whole amount equally between all the slices.",
          `Work out ${W} ÷ ${N}.`,
          `${W} ÷ ${N} = ${u}. Enter ${u}.`,
        ),
      ),
      exactStep(
        "category",
        "Count a group",
        `How many ${q} are in the ${A} group?`,
        hints(
          `Count the slices that ${A} covers.`,
          `Each slice stands for the same number of ${q}, so multiply.`,
          `${A} covers ${pa} slices and each slice stands for ${u}: work out ${pa} × ${u}.`,
          `${pa} × ${u} = ${pa * u}. Enter ${pa * u}.`,
        ),
      ),
      exactStep(
        "more",
        "Find how many more",
        `How many more ${q} are in the ${A} group than in the ${B} group?`,
        hints(
          `Find how many more slices ${A} covers than ${B}.`,
          "Count the slices of each group and take the smaller number from the larger.",
          `${A} covers ${pa} slices and ${B} covers ${pb}, which is ${pa - pb} more. Each slice stands for ${u}.`,
          `${pa - pb} × ${u} = ${(pa - pb) * u}. Enter ${(pa - pb) * u}.`,
        ),
      ),
      reflectionStep(
        "Why do we find what one slice stands for first?",
        "Each slice stands for the same number, so count slices to find any group.",
        [
          "Every group stands for the same number, so the number of slices does not matter.",
          "One slice always stands for 1, so the number of slices is the amount in a group.",
        ],
        hints(
          "Think about the slices of the pie.",
          "All the slices are the same size.",
          "Knowing one slice lets you work out any group.",
          "Choose the explanation about counting slices.",
        ),
        s.a + s.b,
      ),
    ];
  }
  if (s.task === "total") {
    const known = pa * u;
    return [
      exactStep(
        "one-slice",
        "Find one slice",
        `The ${A} group has ${known} ${q}. How many ${q} does one slice stand for?`,
        hints(
          `Count the slices that ${A} covers.`,
          "Share the number in the group equally between its slices.",
          `${A} covers ${pa} slices and has ${known}: work out ${known} ÷ ${pa}.`,
          `${known} ÷ ${pa} = ${u}. Enter ${u}.`,
        ),
      ),
      exactStep(
        "total",
        "Find the whole",
        `How many ${q} are in the whole pie?`,
        hints(
          "Count every slice in the pie.",
          "Each slice stands for the same number, so multiply the number of slices by it.",
          `The pie has ${N} slices and each stands for ${u}: work out ${N} × ${u}.`,
          `${N} × ${u} = ${N * u}. Enter ${N * u}.`,
        ),
      ),
      exactStep(
        "other",
        "Find another group",
        `How many ${q} are in the ${B} group?`,
        hints(
          `Count the slices that ${B} covers.`,
          "Multiply by the number each slice stands for.",
          `${B} covers ${pb} slices of ${u} each: work out ${pb} × ${u}.`,
          `${pb} × ${u} = ${pb * u}. Enter ${pb * u}.`,
        ),
      ),
      reflectionStep(
        "How can one known group help you find the whole pie?",
        "Share its number between its slices, then multiply by all the slices.",
        [
          "Add 1 more to its number for every other group shown in the pie chart.",
          "The whole is always twice the known group, whatever its size.",
        ],
        hints(
          "Think about what one slice stands for.",
          "All the slices stand for the same number.",
          "Once you know one slice, you can find any amount.",
          "Choose the explanation about sharing and then multiplying.",
        ),
        s.a + s.b + 1,
      ),
    ];
  }
  const left = N - pa;
  return [
    exactStep(
      "rest",
      "Find what is left",
      `The pie shows ${N * u} ${q} in all. How many ${q} are not in the ${A} group?`,
      hints(
        "The whole pie is made of every group together.",
        `Work out how many slices are not ${A}, then use what one slice stands for. Or find the number in ${A} and take it away.`,
        `The pie has ${N} slices and ${A} covers ${pa}, so ${left} slices are left. Each slice stands for ${u}.`,
        `${left} × ${u} = ${left * u}. Enter ${left * u}.`,
      ),
    ),
    reflectionStep(
      "Why can you take away to find the rest of the pie?",
      "The whole is made of every group, so taking one away leaves the rest.",
      [
        "Taking away only works when the known group is half of the pie.",
        "The rest is always the biggest group, so find the largest sector.",
      ],
      hints(
        "Think about what the whole pie is made of.",
        "Every group is a part of the whole.",
        "Take one part away and the other parts are left.",
        "Choose the explanation about the whole being made of every group.",
      ),
      s.a,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validatePieChartsSpec, (lesson, step) =>
    pieChartsAnswer(lesson.specification as unknown as PieChartsSpec, step),
  );
function storyOf(s: PieChartsSpec): string {
  const names = list(s.categories);
  if (s.task === "read")
    return `The pie chart sorts the ${s.quantity} into ${s.categories.length} groups: ${names}.`;
  if (s.task === "sectors")
    return `The pie chart sorts the ${s.quantity} into groups: ${names}. The whole circle is 8 equal parts, but the cuts between them are not drawn.`;
  if (s.task === "count")
    return `The pie chart shows ${s.slices * s.unit} ${s.quantity} in all, sorted into ${names}. Every slice stands for the same number of ${s.quantity}.`;
  if (s.task === "total")
    return `The pie chart sorts ${s.quantity} into ${names}. Every slice stands for the same number of ${s.quantity}. Only the ${s.categories[s.a]} group has its number shown.`;
  return `The pie chart shows ${s.slices * s.unit} ${s.quantity} in all, sorted into ${names}.`;
}
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validatePieChartsSpec(next.specification).length) return next;
  const s = next.specification as unknown as PieChartsSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story = storyOf(s);
  return derive(next);
}

const DEFAULTS: Record<PieChartsSpec["task"], Omit<PieChartsSpec, "task">> = {
  read: {
    slices: 8,
    categories: ["Soccer", "Swim", "Chess", "Art"],
    parts: [3, 2, 1, 2],
    unit: 0,
    quantity: "pupils",
    a: 0,
    b: 1,
  },
  sectors: {
    slices: 8,
    categories: ["Rice", "Noodles", "Bread", "Soup"],
    parts: [4, 2, 1, 1],
    unit: 0,
    quantity: "pupils",
    a: 0,
    b: 1,
  },
  count: {
    slices: 10,
    categories: ["Apples", "Pears", "Grapes", "Plums"],
    parts: [4, 3, 2, 1],
    unit: 6,
    quantity: "pupils",
    a: 0,
    b: 2,
  },
  total: {
    slices: 6,
    categories: ["Rice", "Noodles", "Bread"],
    parts: [3, 2, 1],
    unit: 7,
    quantity: "pupils",
    a: 1,
    b: 0,
  },
  practice: {
    slices: 12,
    categories: ["Tea", "Milk", "Juice", "Water"],
    parts: [5, 3, 2, 2],
    unit: 5,
    quantity: "pupils",
    a: 0,
    b: 1,
  },
};
const TITLES: Record<PieChartsSpec["task"], string> = {
  read: "Slices of the whole",
  sectors: "Sectors of the whole",
  count: "How many in each slice?",
  total: "Find the whole",
  practice: "A fresh pie question",
};
const OBJECTIVES: Record<PieChartsSpec["task"], string> = {
  read: "Count the equal slices of a pie chart, name a group as a fraction of the whole and compare groups.",
  sectors:
    "Recognise sectors of a pie chart as a half, a quarter or an eighth of the whole, with no cuts drawn.",
  count:
    "Share the total of a pie chart between its equal slices, then find the number in a group.",
  total:
    "Start from one known group of a pie chart, find what one slice stands for and then the whole.",
  practice: "Find how many are not in one group of a pie chart.",
};
function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported pie-chart form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: PieChartsSpec = { task, ...structuredClone(DEFAULTS[task]) };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "pie-charts",
    title: TITLES[task],
    subtitle: "P4 pie-chart revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective: OBJECTIVES[task],
    story: storyOf(spec),
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  // No interpretation for the practice lesson: its model is a drawing, not a story to restate.
  return p4Package({
    lesson,
    form,
    family: "pie-charts",
    author: "claude-p4-pie-charts",
    taskLabel: task,
    specErrors: validatePieChartsSpec,
    sources: [
      "https://practicle.sg/primary-4-math/",
      "https://www.thelearninglab.com.sg/blog/tll-shares/new-changes-to-moe-primary-maths-syllabus",
    ],
    extraTags: ["level-unconfirmed"],
  });
}

const listText = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : String(v ?? "");
export const pieChartsAuthor: AuthorTopic = {
  id: "pie-charts",
  forms: [
    {
      id: "p4-read-pie-chart",
      label: "Slices of the whole",
      description:
        "Count the equal slices, name a group as a fraction and compare two groups.",
    },
    {
      id: "p4-read-pie-sectors",
      label: "Sectors of the whole",
      description:
        "A pie with no cuts drawn: recognise a half, a quarter and an eighth.",
    },
    {
      id: "p4-pie-chart-count",
      label: "How many in each slice?",
      description:
        "Share the total between the slices, then count a group and compare two groups.",
    },
    {
      id: "p4-pie-chart-total",
      label: "Find the whole",
      description:
        "Start from one known group and find one slice, the whole and another group.",
    },
    {
      id: "p4-pie-chart-practice",
      label: "Pie chart practice",
      description: "One fresh question on how many are not in one group.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as PieChartsSpec;
    const labelOptions = (Array.isArray(s.categories) ? s.categories : []).map(
      (name, i) => ({ value: String(i), label: String(name) }),
    );
    const fields: TopicField[] = [
      {
        key: "quantity",
        label: "What is counted",
        type: "text",
        value: s.quantity,
      },
      {
        key: "categories",
        label: "Labels (comma separated, 3–5, up to 8 characters each)",
        type: "text",
        value: listText(s.categories),
      },
      {
        key: "parts",
        label: "Slices per category (comma separated, adding up to the slices)",
        type: "text",
        value: listText(s.parts),
      },
    ];
    if (s.task !== "sectors")
      fields.push({
        key: "slices",
        label: "Number of slices",
        type: "select",
        value: String(s.slices),
        options: SLICE_COUNTS.map((v) => ({
          value: String(v),
          label: String(v),
        })),
      });
    if (s.task === "count" || s.task === "total" || s.task === "practice")
      fields.push({
        key: "total",
        label: "Items in the whole pie (shared equally by the slices)",
        type: "number",
        value:
          typeof s.unit === "number" && typeof s.slices === "number"
            ? Math.round(s.unit * s.slices * 1000) / 1000
            : "",
      });
    fields.push({
      key: "a",
      label:
        s.task === "practice"
          ? "Label asked about"
          : s.task === "sectors"
            ? "Label asked as a fraction"
            : "First label asked about",
      type: "select",
      value: String(s.a),
      options: labelOptions,
    });
    if (s.task !== "practice")
      fields.push({
        key: "b",
        label:
          s.task === "sectors"
            ? "Label asked as a number of parts"
            : "Second label asked about",
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
    if (key === "categories")
      spec.categories = text.split(",").map((x) => x.trim());
    else if (key === "parts") {
      const parts = text.split(",").map((x) => x.trim());
      spec.parts = parts.every((x) => /^\d+$/.test(x))
        ? parts.map(Number)
        : parts;
    } else if (key === "total") {
      const slices = Number(spec.slices);
      // A total the slices do not share equally keeps a fraction in `unit`, so the validator names it.
      spec.unit =
        /^\d+$/.test(text) && Number.isFinite(slices) && slices > 0
          ? Number(text) / slices
          : value;
    } else if (["slices", "a", "b"].includes(key))
      spec[key] = /^\d+$/.test(text) ? Number(text) : value;
    else if (key === "quantity") spec.quantity = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
