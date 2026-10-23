import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  fractionsAnswer,
  validateFractionsSpec,
  type FractionsSpec,
  type FractionWhole,
} from "../topics/fractions";
const numeric = (v: string | number): string | number =>
  typeof v === "number" ? v : /^\d+$/.test(v.trim()) ? Number(v) : v;
const hints = (a: string, b: string, c: string, d: string): Step["hints"] => [
  a,
  b,
  c,
  d,
];
const numberStep = (id: string, title: string, prompt: string): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "number",
  answer: 0,
  hints: hints(
    "Look carefully at the whole picture.",
    "Count the parts in the picture.",
    "Separate the number of shaded parts from the number of all parts.",
    "Use the picture to check your count.",
  ),
});
const reflection = (): Step => ({
  id: "reflection",
  goal: "reflection",
  title: "Explain your thinking",
  prompt: "What must we check before naming or comparing these fractions?",
  kind: "choice",
  choices: [
    {
      id: "r8",
      label: "Count the shaded parts, even if the parts are different sizes.",
    },
    {
      id: "r3",
      label: "Check that the parts are equal and the wholes are the same size.",
    },
    {
      id: "r6",
      label: "A fraction with a bigger denominator is always the bigger one.",
    },
  ],
  answer: "r3",
  hints: hints(
    "Think about what a fraction describes.",
    "Each part must have the same area.",
    "Comparison also needs the same-sized whole.",
    "Check that the parts are equal and the wholes are the same size.",
  ),
});
function whole(
  id: string,
  label: string,
  denominator: number,
  numerator: number,
  unequal = false,
): FractionWhole {
  const widths = Array.from({ length: denominator }, () => 120 / denominator);
  if (unequal) {
    widths[0] -= 10;
    widths[1] += 10;
  }
  return {
    id,
    label,
    width: 120,
    height: 60,
    widths,
    shaded: Array.from({ length: numerator }, (_, i) => i),
  };
}
function modelSteps(s: FractionsSpec): Step[] {
  if (s.task === "equal-parts")
    return [
      {
        id: "partition",
        goal: "partition",
        title: "Find equal parts",
        prompt: "Which rectangle is divided into equal parts?",
        kind: "choice",
        choices: [
          {
            id: "p7",
            label: s.wholes[0].label,
            meaning: `partition:${s.wholes[0].id}`,
          },
          {
            id: "p2",
            label: s.wholes[1].label,
            meaning: `partition:${s.wholes[1].id}`,
          },
          {
            id: "p9",
            label: s.wholes[2].label,
            meaning: `partition:${s.wholes[2].id}`,
          },
        ],
        answer: "",
        hints: hints(
          "Look at how much of the whole each part covers.",
          "Compare the widths of the parts in each rectangle.",
          "With the same height, equal widths make equal areas.",
          "Choose the rectangle whose part widths are all the same.",
        ),
      },
      numberStep(
        "parts",
        "Count equal parts",
        "How many equal parts are in that rectangle?",
      ),
      numberStep(
        "shaded",
        "Count shaded parts",
        "How many of its equal parts are shaded?",
      ),
      reflection(),
    ];
  if (s.task === "name")
    return [
      numberStep(
        "parts",
        "Count all equal parts",
        "How many equal parts make the whole?",
      ),
      numberStep(
        "shaded",
        "Count shaded parts",
        "How many equal parts are shaded?",
      ),
      {
        id: "fraction",
        goal: "fraction",
        title: "Name the fraction",
        prompt: "Which fraction names the shaded part?",
        kind: "choice",
        choices: [],
        answer: "",
        hints: hints(
          "A fraction describes part of one whole.",
          "Use all equal parts for the bottom number.",
          "Use shaded equal parts for the top number.",
          "Match shaded parts over all equal parts.",
        ),
      },
      reflection(),
    ];
  return [
    numberStep(
      "shaded",
      "Look at the first whole",
      `How many parts of ${s.wholes[0].label} are shaded?`,
    ),
    numberStep(
      "other-shaded",
      "Look at the second whole",
      `How many parts of ${s.wholes[1].label} are shaded?`,
    ),
    {
      id: "compare",
      goal: "compare",
      title: "Compare the shaded amounts",
      prompt: "Which equal-sized whole has more shaded area?",
      kind: "choice",
      choices: [
        {
          id: "c5",
          label: "Same shaded area",
          meaning: "relation:same",
        },
        { id: "c8", label: s.wholes[1].label, meaning: "relation:right" },
        { id: "c2", label: s.wholes[0].label, meaning: "relation:left" },
      ],
      answer: "",
      hints: hints(
        "The two whole rectangles are the same size.",
        "Look at the shaded area in each whole.",
        "For equal-sized parts, count them. For unit fractions, compare the size of one part.",
        "Use the shaded pictures to choose the larger area, or the same area.",
      ),
    },
    reflection(),
  ];
}
function derive(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validateFractionsSpec(next.specification).length) return next;
  const s = next.specification as unknown as FractionsSpec;
  for (const step of next.steps)
    if (step.goal !== "reflection") step.answer = fractionsAnswer(s, step);
  return next;
}
function rewrite(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validateFractionsSpec(next.specification).length) return next;
  const s = next.specification as unknown as FractionsSpec;
  next.story =
    s.task === "equal-parts"
      ? "Three same-sized rectangles are divided in different ways. Study the size of each part."
      : s.task === "name"
        ? "A rectangle is one whole. Some of its equal parts are shaded."
        : "Both rectangles are equal-sized wholes. Compare the shaded area in the pictures.";
  const replacement = modelSteps(s);
  if (s.task === "name") {
    const a = s.wholes[0],
      n = a.shaded.length,
      d = a.widths.length;
    const alternatives = [
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4],
      [3, 4],
    ]
      .filter(([pn, pd]) => pn * d !== n * pd)
      .slice(0, 2);
    const step = replacement.find((st) => st.id === "fraction")!;
    step.choices = [
      ...alternatives.map(([pn, pd], index) => ({
        id: index === 0 ? "f6" : "f9",
        label: `${pn}/${pd}`,
        meaning: `fraction:${pn}/${pd}`,
      })),
      { id: "f2", label: `${n}/${d}`, meaning: `fraction:${n}/${d}` },
    ];
  }
  // Preserve authored reflection key/text while updating model-dependent steps coherently.
  next.steps = replacement.map((st) =>
    st.id === "reflection"
      ? (next.steps.find((old) => old.id === "reflection") ?? st)
      : st,
  );
  const result = derive(next);
  for (const st of result.steps) {
    if (st.id === "reflection") continue;
    const value =
      typeof st.answer === "number"
        ? String(st.answer)
        : st.choices?.find((c) => c.id === st.answer)?.label;
    st.hints[3] =
      st.kind === "number"
        ? `Count in the picture: there are ${value} ${st.id === "parts" ? "equal parts in the whole" : "shaded parts"}.`
        : `Using the whole picture, choose ${value}.`;
  }
  return result;
}
function template(form: string, id: string): LessonPackage {
  if (!fractionsAuthor.forms.some((f) => f.id === form))
    throw new Error("Unsupported fractions form.");
  const task: FractionsSpec["task"] =
    form === "equal-parts"
      ? "equal-parts"
      : form === "name-the-fraction"
        ? "name"
        : "compare";
  const wholes =
    task === "equal-parts"
      ? [
          whole("a", "Rectangle A", 2, 1, true),
          whole("b", "Rectangle B", 4, 1),
          whole("c", "Rectangle C", 3, 1, true),
        ]
      : task === "name"
        ? [whole("a", "Rectangle A", 4, 3)]
        : [whole("a", "Rectangle A", 2, 1), whole("b", "Rectangle B", 4, 1)];
  const lesson = rewrite({
    id,
    version: 1,
    topic: "fractions",
    title:
      form === "equal-parts"
        ? "Which parts are equal?"
        : form === "name-the-fraction"
          ? "Name the shaded fraction"
          : "Compare fractions of the same whole",
    subtitle: "Use equal-whole pictures",
    level: "P2 candidate",
    minutes: 7,
    story: "Explore fractions with rectangle pictures.",
    objective:
      form === "equal-parts"
        ? "Recognise equal-area parts of one whole."
        : form === "name-the-fraction"
          ? "Name a fraction using shaded and total equal parts."
          : "Compare unit or like fractions of equal-sized wholes.",
    specification: { task, wholes },
    steps: modelSteps({ task, wholes }),
    reviewStatus: "draft",
  });
  return {
    schemaVersion: 2,
    locale: "en-SG",
    adapterVersion: 1,
    library: { level: "P2", skillId: form, tags: ["fractions", "equal-parts"] },
    curriculum: {
      objectiveId: `candidate.p2.fractions.${form}`,
      sources: [
        "https://practicle.sg/primary-2-math/",
        "https://sg.ixl.com/standards/maths/primary-2",
      ],
      evidenceStatus: "candidate",
    },
    authors: ["codex-topics-visual"],
    provenance: { kind: "authored" },
    lesson,
    fixtures: lesson.steps.map((st) => ({
      stepId: st.id,
      accepted: [st.answer],
      rejected:
        st.kind === "number"
          ? [Number(st.answer) + 1, Number(st.answer) + 2]
          : (st.choices ?? [])
              .filter((c) => c.id !== st.answer)
              .map((c) => c.id)
              .slice(0, 2),
    })),
  };
}
export const fractionsAuthor: AuthorTopic = {
  id: "fractions",
  forms: [
    {
      id: "equal-parts",
      label: "Equal parts",
      description: "Find a rectangle divided into equal-area parts.",
    },
    {
      id: "name-the-fraction",
      label: "Name the fraction",
      description: "Name shaded parts of one whole.",
    },
    {
      id: "compare-same-whole",
      label: "Compare the same whole",
      description: "Compare unit or like fractions with equal-sized wholes.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as FractionsSpec;
    const fields: TopicField[] = [
      {
        key: "width",
        label: "Shared whole width (12–240, divisible by every part count)",
        type: "number",
        value: s.wholes[0].width,
      },
      {
        key: "height",
        label: "Shared whole height (12–120)",
        type: "number",
        value: s.wholes[0].height,
      },
    ];
    for (const w of s.wholes) {
      fields.push(
        {
          key: `${w.id}.label`,
          label: `${w.label} label`,
          type: "text",
          value: w.label,
        },
        {
          key: `${w.id}.denominator`,
          label: `${w.label}: number of parts (2, 3 or 4)`,
          type: "number",
          value: w.widths.length,
        },
        {
          key: `${w.id}.numerator`,
          label: `${w.label}: shaded parts`,
          type: "number",
          value: w.shaded.length,
        },
      );
      if (s.task === "equal-parts")
        fields.push({
          key: `${w.id}.partition`,
          label: `${w.label}: partition`,
          type: "select",
          value: w.widths.every((x) => x === w.widths[0]) ? "equal" : "unequal",
          options: [
            { value: "equal", label: "Equal widths" },
            { value: "unequal", label: "Unequal widths" },
          ],
        });
      // Partial numeric input is stored explicitly until it becomes valid.
      const raw = w as unknown as Record<string, unknown>;
      for (const name of ["denominator", "numerator"])
        if (raw[name] !== undefined)
          fields.find((f) => f.key === `${w.id}.${name}`)!.value = raw[name] as
            string | number;
    }
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const s = next.specification as unknown as FractionsSpec;
    if (key === "width" || key === "height") {
      const num = numeric(value);
      for (const w of s.wholes) {
        if (
          key === "width" &&
          typeof num === "number" &&
          Number.isSafeInteger(num) &&
          num >= 12 &&
          num <= 240
        ) {
          const previousWidth = w.widths.reduce((sum, part) => sum + part, 0);
          w.widths = w.widths.map((part) => (part * num) / previousWidth);
        }
        w[key] = num as number;
      }
      return next;
    }
    const [id, field] = key.split(".");
    const w = s.wholes.find((x) => x.id === id);
    if (!w) return next;
    if (field === "label") {
      w.label = String(value);
      return next;
    }
    if (
      field === "partition" &&
      s.task === "equal-parts" &&
      ["equal", "unequal"].includes(String(value))
    ) {
      w.widths = Array.from(
        { length: w.widths.length },
        () => w.width / w.widths.length,
      );
      if (value === "unequal") {
        const delta = Math.max(1, Math.floor(w.widths[0] / 4));
        w.widths[0] -= delta;
        w.widths[1] += delta;
      }
      return next;
    }
    if (field === "denominator" || field === "numerator") {
      const num = numeric(value);
      const record = w as unknown as Record<string, unknown>;
      const valid =
        typeof num === "number" &&
        Number.isInteger(num) &&
        (field === "denominator"
          ? [2, 3, 4].includes(num) && w.shaded.length < num
          : num >= 1 && num < w.widths.length);
      if (!valid) {
        record[field] = num;
        return next;
      }
      delete record[field];
      if (field === "denominator") {
        const unequal = !w.widths.every((x) => x === w.widths[0]);
        w.widths = Array.from({ length: num }, () => w.width / num);
        if (unequal) {
          const delta = Math.max(1, Math.floor(w.widths[0] / 4));
          w.widths[0] -= delta;
          w.widths[1] += delta;
        }
      } else w.shaded = Array.from({ length: num }, (_, i) => i);
    }
    return next;
  },
  derive,
  rewrite,
  template,
};
