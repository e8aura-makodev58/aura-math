import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  pictureGraphsAnswer,
  validatePictureGraphsSpec,
  type PictureGraphsSpec,
} from "../topics/picture-graphs";
const numeric = (v: string | number): string | number =>
  typeof v === "number" ? v : /^\d+$/.test(v.trim()) ? Number(v) : v;
const hints = (...values: [string, string, string, string]): Step["hints"] =>
  values;
const num = (
  id: string,
  title: string,
  prompt: string,
  h: Step["hints"],
): Step => ({
  id,
  goal: id,
  title,
  prompt,
  kind: "number",
  answer: 0,
  hints: h,
});
function steps(s: PictureGraphsSpec): Step[] {
  const a = s.categories.find((c) => c.id === s.target)!;
  const b = s.categories.find((c) => c.id === s.other);
  const key = num(
    "key",
    "Read the key",
    "How many items does one full symbol represent?",
    hints(
      "Find the key above the rows.",
      "Look beside the single symbol in the key.",
      "The key applies to every full symbol.",
      "Read the number of items next to one symbol.",
    ),
  );
  const quantity = num(
    "quantity",
    "Read a category",
    `How many items does ${a.label} represent?`,
    hints(
      `Look at the ${a.label} row.`,
      `Count its ${a.count} full symbols.`,
      `Each full symbol represents ${s.key} items.`,
      `Use ${a.count} groups of ${s.key} items.`,
    ),
  );
  const total = num(
    "total",
    "Find the graph total",
    "How many items are represented in the whole graph?",
    hints(
      "Include every category.",
      "Add the full-symbol counts in all rows.",
      "Use the key for every full symbol.",
      "Add the row quantities, including any zero row.",
    ),
  );
  const difference = num(
    "difference",
    "Compare quantities",
    `How many more items does the larger of ${a.label} and ${b?.label} represent than the smaller?`,
    hints(
      "Compare the two named rows.",
      "Find the difference in full-symbol counts.",
      `Every extra symbol represents ${s.key} items.`,
      "Use the extra full symbols and the key to find the difference.",
    ),
  );
  const comparison: Step = {
    id: "compare",
    goal: "compare",
    title: "Compare two categories",
    prompt: `Which row represents more items: ${a.label} or ${b?.label}?`,
    kind: "choice",
    choices: [
      { id: "g7", label: a.label, meaning: "relation:target" },
      {
        id: "g4",
        label: "Both the same",
        meaning: "relation:same",
      },
      { id: "g9", label: b?.label ?? "", meaning: "relation:other" },
    ],
    answer: "",
    hints: hints(
      "Compare the named rows only.",
      "Both rows use the same key.",
      "More full symbols represent more items; equal counts give a tie.",
      "Choose the row with more full symbols, or choose the same quantity.",
    ),
  };
  const reflection: Step = {
    id: "reflection",
    goal: "reflection",
    title: "Explain your thinking",
    prompt: "Why must we use the key?",
    kind: "choice",
    choices: [
      {
        id: "q6",
        label: "The key tells us how many items each symbol stands for.",
      },
      {
        id: "q3",
        label: "Each symbol stands for just one item, whatever the key says.",
      },
      {
        id: "q9",
        label: "A half symbol can always be counted as one whole item too.",
      },
    ],
    answer: "q6",
    hints: hints(
      "Think about one full symbol.",
      "One symbol can represent more than one item.",
      "Every row uses the same key.",
      "The key tells us how many items each symbol stands for.",
    ),
  };
  const symbols = num(
    "symbols",
    "Count full symbols",
    `How many full symbols are in the ${a.label} row?`,
    hints(
      "Find the named row.",
      "Count only its full symbols.",
      "The key tells items, but here we count symbols.",
      `There are ${a.count} full symbols in the ${a.label} row.`,
    ),
  );
  return s.task === "compare"
    ? [key, comparison, difference, reflection]
    : s.task === "read"
      ? [key, symbols, quantity, reflection]
      : [key, quantity, total, reflection];
}
function derive(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validatePictureGraphsSpec(next.specification).length) return next;
  const s = next.specification as unknown as PictureGraphsSpec;
  for (const st of next.steps)
    if (st.goal !== "reflection") st.answer = pictureGraphsAnswer(s, st);
  return next;
}
function rewrite(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validatePictureGraphsSpec(next.specification).length) return next;
  const s = next.specification as unknown as PictureGraphsSpec;
  next.story = `This picture graph shows items in pretend collections. Each full symbol represents ${s.key} items. These are example data, not a class survey.`;
  next.steps = steps(s).map((st) =>
    st.id === "reflection"
      ? (next.steps.find((old) => old.id === "reflection") ?? st)
      : st,
  );
  const result = derive(next);
  for (const st of result.steps)
    if (st.id !== "reflection") {
      const value =
        st.kind === "number"
          ? st.answer
          : st.choices?.find((c) => c.id === st.answer)?.label;
      st.hints[3] =
        st.id === "symbols"
          ? `There are ${value} full symbols in the named row.`
          : st.id === "key"
            ? `The key says one full symbol represents ${s.key} items.`
            : st.kind === "number"
              ? `Using the full symbols and the key gives ${value} items.`
              : `Both rows use the same key: choose ${value}.`;
    }
  return result;
}
function template(form: string, id: string): LessonPackage {
  if (!pictureGraphsAuthor.forms.some((f) => f.id === form))
    throw new Error("Unsupported picture-graph form.");
  const task: PictureGraphsSpec["task"] =
    form === "read-the-key"
      ? "read"
      : form === "compare-categories"
        ? "compare"
        : "total";
  const specification: PictureGraphsSpec = {
    task,
    key: form === "read-the-key" ? 2 : 5,
    categories: [
      { id: "apples", label: "Apples", count: 4 },
      { id: "pears", label: "Pears", count: task === "compare" ? 4 : 2 },
      { id: "plums", label: "Plums", count: 0 },
      { id: "oranges", label: "Oranges", count: 3 },
    ],
    target: task === "total" ? "oranges" : "apples",
    ...(task === "compare" ? { other: "pears" } : {}),
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "picture-graphs",
    title:
      form === "read-the-key"
        ? "Read the picture-graph key"
        : form === "compare-categories"
          ? "Compare two picture-graph rows"
          : "Find the picture-graph total",
    subtitle: "Full symbols and a shared key",
    level: "P2 candidate",
    minutes: 7,
    story: "Read example collections.",
    objective:
      form === "read-the-key"
        ? "Use a picture-graph key to find a category quantity."
        : form === "compare-categories"
          ? "Compare categories using a shared picture-graph scale, including ties."
          : "Add quantities represented by a scaled picture graph.",
    specification: specification as unknown as Record<string, unknown>,
    steps: steps(specification),
    reviewStatus: "draft",
  });
  return {
    schemaVersion: 2,
    locale: "en-SG",
    adapterVersion: 1,
    library: { level: "P2", skillId: form, tags: ["picture-graphs", "data"] },
    curriculum: {
      objectiveId: `candidate.p2.picture-graphs.${form}`,
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
export const pictureGraphsAuthor: AuthorTopic = {
  id: "picture-graphs",
  forms: [
    {
      id: "read-the-key",
      label: "Read the key",
      description: "Use a scaled graph key to read a row.",
    },
    {
      id: "compare-categories",
      label: "Compare categories",
      description: "Compare two rows, including a tie.",
    },
    {
      id: "graph-total",
      label: "Graph total",
      description: "Combine quantities across a graph.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as PictureGraphsSpec;
    const fields: TopicField[] = [
      {
        key: "key",
        label: "Items represented by one full symbol (2 or 5)",
        type: "number",
        value: s.key,
      },
      {
        key: "target",
        label: "Target category",
        type: "select",
        value: s.target,
        options: s.categories.map((c) => ({ value: c.id, label: c.label })),
      },
    ];
    if (s.task === "compare")
      fields.push({
        key: "other",
        label: "Other category",
        type: "select",
        value: s.other ?? "",
        options: s.categories.map((c) => ({ value: c.id, label: c.label })),
      });
    for (const c of s.categories)
      fields.push(
        {
          key: `${c.id}.label`,
          label: `${c.label} label`,
          type: "text",
          value: c.label,
        },
        {
          key: `${c.id}.count`,
          label: `${c.label}: full symbols (0–6)`,
          type: "number",
          value: c.count,
        },
      );
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const s = next.specification as unknown as PictureGraphsSpec;
    if (key === "key") {
      s.key = numeric(value) as number;
    } else if (key === "target" || key === "other") {
      s[key] = String(value);
    } else {
      const [id, field] = key.split(".");
      const c = s.categories.find((c) => c.id === id);
      if (c) {
        if (field === "label") c.label = String(value);
        if (field === "count") c.count = numeric(value) as number;
      }
    }
    return next;
  },
  derive,
  rewrite,
  template,
};
