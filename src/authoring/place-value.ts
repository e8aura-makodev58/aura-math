import type { Lesson } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic } from "./topic-capability";
import {
  digitAt,
  placeUnits,
  placeValueAnswer,
  type PlaceValueSpec,
} from "../topics/place-value";
import read from "../../content/lessons/hundreds-tens-ones.json";
import zero from "../../content/lessons/zero-in-a-place.json";
import digit from "../../content/lessons/digit-value.json";
const templates = {
  "read-model": read,
  "zero-place": zero,
  "digit-value": digit,
};
function derive(input: Lesson): Lesson {
  const l = structuredClone(input),
    s = l.specification as unknown as PlaceValueSpec;
  for (const step of l.steps)
    if (step.goal !== "reflection") step.answer = placeValueAnswer(s, step);
  return l;
}
function rewrite(input: Lesson): Lesson {
  const l = derive(input),
    s = l.specification as unknown as PlaceValueSpec,
    p = s.targetPlace,
    u = placeUnits[p],
    d = digitAt(s);
  l.story =
    "Each column groups blocks by value. A hundreds block represents 100, a tens rod represents 10 and a ones counter represents 1. An empty column represents zero in that place.";
  l.objective = `Read base-ten models and reason about the ${p} place.`;
  const recognise = l.steps.find((x) => x.goal === "recognise")!,
    calculate = l.steps.find((x) => x.goal === "calculate")!;
  recognise.prompt = `Which column represents groups of ${u}?`;
  for (const c of recognise.choices ?? [])
    c.label = String(c.meaning).replace(/^./, (x) => x.toUpperCase());
  recognise.hints = [
    "Look at the column headings.",
    `Each block in the ${p} column represents ${u}.`,
    `Find the column named ${p}.`,
    `Choose ${p}.`,
  ];
  calculate.title =
    s.task === "read-model" ? "Read the model" : "Find the place value";
  calculate.prompt =
    s.task === "read-model"
      ? "What number do all the blocks represent?"
      : `What is the value of the digit in the ${p} place?`;
  calculate.hints = [
    s.task === "read-model"
      ? `Look at the ${p} place, then the other columns.`
      : `Count the blocks in the ${p} column.`,
    `The ${p} place uses groups of ${u}.`,
    `There are ${d} blocks in the ${p} column; each represents ${u}.`,
    s.task === "read-model"
      ? `The full model represents ${s.value}.`
      : `The digit in the ${p} place has value ${d} × ${u} = ${d * u}.`,
  ];
  return l;
}
export const placeValueAuthor: AuthorTopic = {
  id: "place-value",
  forms: [
    {
      id: "read-model",
      label: "Hundreds, tens and ones",
      description: "Read a grouped base-ten model.",
    },
    {
      id: "zero-place",
      label: "Zero in a place",
      description: "Understand an empty column.",
    },
    {
      id: "digit-value",
      label: "Digit value",
      description: "Name a digit’s value in a specific place.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as PlaceValueSpec;
    return [
      { key: "value", label: "Number (0–999)", type: "number", value: s.value },
      {
        key: "targetPlace",
        label: "Target place",
        type: "select",
        value: s.targetPlace,
        options: ["hundreds", "tens", "ones"].map((value) => ({
          value,
          label: value,
        })),
      },
      {
        key: "task",
        label: "Task",
        type: "select",
        value: s.task,
        options: [
          { value: "read-model", label: "Read the full model" },
          { value: "zero-place", label: "Understand a zero place" },
          { value: "digit-value", label: "Find a digit’s value" },
        ],
      },
    ];
  },
  patch: (l, key, value) => {
    const copy = structuredClone(l);
    if (["value", "targetPlace", "task"].includes(key))
      copy.specification[key] =
        key === "value" && typeof value === "string" && /^\d+$/.test(value)
          ? Number(value)
          : value;
    return copy;
  },
  derive,
  rewrite,
  template: (form, id) => {
    const source = templates[form as keyof typeof templates];
    if (!source) throw new Error("Unknown place-value form");
    const p = structuredClone(source) as unknown as LessonPackage;
    p.lesson.id = id;
    p.lesson.version = 1;
    return p;
  },
};
