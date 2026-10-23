import type { Lesson } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic } from "./topic-capability";
import {
  equalGroupsAnswer,
  type EqualGroupsSpec,
} from "../topics/equal-groups";
import total from "../../content/lessons/equal-groups-total.json";
import each from "../../content/lessons/sharing-equally.json";
import groups from "../../content/lessons/how-many-groups.json";
const templates = { total, each, groups };
const roleLabels = {
  total: "How many counters there are in all",
  each: "How many counters are in each group",
  groups: "How many equal groups there are",
};
function derive(input: Lesson): Lesson {
  const l = structuredClone(input),
    s = l.specification as unknown as EqualGroupsSpec;
  for (const step of l.steps)
    if (step.goal !== "reflection") step.answer = equalGroupsAnswer(s, step);
  return l;
}
function rewrite(input: Lesson): Lesson {
  const l = derive(input),
    s = l.specification as unknown as EqualGroupsSpec,
    g = s.groupCount,
    n = s.perGroup,
    t = g * n;
  l.story =
    s.task === "total"
      ? `There are ${g} ${s.groupLabel} with ${n} ${s.unit} in each. How many ${s.unit} are there altogether?`
      : s.task === "each"
        ? `${t} ${s.unit} are shared equally among ${g} ${s.groupLabel}. How many ${s.unit} are in each group?`
        : `${t} ${s.unit} are packed with ${n} ${s.unit} in each group. How many ${s.groupLabel} are needed?`;
  l.objective = {
    total: "Find the total in equal groups.",
    each: "Find the quantity in each equal group.",
    groups: "Find the number of equal groups.",
  }[s.task];
  const recognise = l.steps.find((x) => x.goal === "recognise")!,
    calculate = l.steps.find((x) => x.goal === "calculate")!;
  recognise.prompt = "What does the question ask you to find?";
  for (const c of recognise.choices ?? [])
    c.label =
      roleLabels[c.meaning as keyof typeof roleLabels]?.replace(
        "counters",
        s.unit,
      ) ?? c.label;
  recognise.hints = [
    "Read the question at the end of the story.",
    "Separate the number of groups from the number in each group.",
    "Decide whether the question asks for altogether, in each group, or how many groups.",
    `Choose: ${roleLabels[s.task].replace("counters", s.unit)}`,
  ];
  calculate.prompt = {
    total: `How many ${s.unit} are there altogether?`,
    each: `How many ${s.unit} are in each group?`,
    groups: `How many ${s.groupLabel} are needed?`,
  }[s.task];
  calculate.hints = [
    `Count the same number of ${s.unit} in every group.`,
    `Each group must contain the same number.`,
    `${g} equal groups with ${n} in each make ${t} altogether.`,
    {
      total: `${g} × ${n} = ${t}. There are ${t} ${s.unit} altogether.`,
      each: `${t} ÷ ${g} = ${n}. Each group has ${n} ${s.unit}.`,
      groups: `${t} ÷ ${n} = ${g}. There are ${g} ${s.groupLabel}.`,
    }[s.task],
  ];
  const reflection = l.steps.find((x) => x.goal === "reflection");
  if (reflection) {
    for (const c of reflection.choices ?? [])
      c.label = c.label.replace(/counters/g, s.unit);
    reflection.hints = reflection.hints.map((x) =>
      x.replace(/counters/g, s.unit),
    ) as typeof reflection.hints;
  }
  return l;
}
export const equalGroupsAuthor: AuthorTopic = {
  id: "equal-groups",
  forms: [
    {
      id: "total",
      label: "Equal groups total",
      description: "Combine equal groups.",
    },
    {
      id: "each",
      label: "Sharing equally",
      description: "Find the quantity in each group.",
    },
    {
      id: "groups",
      label: "How many groups",
      description: "Find the number of groups.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as EqualGroupsSpec;
    return [
      {
        key: "groupCount",
        label: "Number of groups (2–10)",
        type: "number",
        value: s.groupCount,
      },
      {
        key: "perGroup",
        label: "Objects in each group",
        type: "number",
        value: s.perGroup,
      },
      {
        key: "task",
        label: "Quantity to find",
        type: "select",
        value: s.task,
        options: [
          { value: "total", label: "Total" },
          { value: "each", label: "In each group" },
          { value: "groups", label: "Number of groups" },
        ],
      },
      {
        key: "unit",
        label: "Object name (plural)",
        type: "text",
        value: s.unit,
      },
      {
        key: "groupLabel",
        label: "Group name (plural)",
        type: "text",
        value: s.groupLabel,
      },
    ];
  },
  patch: (l, key, value) => {
    const copy = structuredClone(l);
    if (["groupCount", "perGroup", "task", "unit", "groupLabel"].includes(key))
      copy.specification[key] =
        ["groupCount", "perGroup"].includes(key) &&
        typeof value === "string" &&
        /^\d+$/.test(value)
          ? Number(value)
          : value;
    return copy;
  },
  derive,
  rewrite,
  template: (form, id) => {
    const source = templates[form as keyof typeof templates];
    if (!source) throw new Error("Unknown equal-groups form");
    const p = structuredClone(source) as unknown as LessonPackage;
    p.lesson.id = id;
    p.lesson.version = 1;
    return p;
  },
};
