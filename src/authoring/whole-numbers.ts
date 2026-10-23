import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  PLACE_LABEL,
  PLACE_UNIT,
  digitAt,
  factorOptions,
  factorsOf,
  firstFactor,
  lowerMultiple,
  roundedTo,
  validateWholeNumbersSpec,
  wholeNumbersAnswer,
  wholeNumbersTopic,
  type WholePlace,
  type WholeNumbersSpec,
} from "../topics/whole-numbers";
import {
  choiceStep,
  choices,
  deriveAnswers,
  exactStep,
  grouped,
  hints,
  p4Package,
  reflectionStep,
} from "../topics/p4-kit";

const FORMS = [
  "p4-place-value-100k",
  "p4-rounding",
  "p4-factors",
  "p4-estimate-by-rounding",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], WholeNumbersSpec["task"]> = {
  "p4-place-value-100k": "place-value",
  "p4-rounding": "rounding",
  "p4-factors": "factors",
  "p4-estimate-by-rounding": "practice",
};
const PLACES = Object.keys(PLACE_UNIT) as WholePlace[];
const stepWord = (n: number) => grouped(n);

function steps(s: WholeNumbersSpec): Step[] {
  if (s.task === "place-value") {
    const digit = digitAt(s.n, s.place);
    const others = PLACES.filter((p) => p !== s.place);
    const offered = [
      s.place,
      others[s.n % others.length],
      others[(s.n + 2) % others.length],
    ];
    const unique = [...new Set(offered)];
    for (const p of others)
      if (unique.length < 3 && !unique.includes(p)) unique.push(p);
    return [
      choiceStep(
        "place",
        "Name the place",
        `In ${grouped(s.n)}, which place does the digit ${digit} hold?`,
        choices(
          unique
            .slice(0, 3)
            .map((p) => ({ label: `The ${PLACE_LABEL[p]} place`, meaning: p })),
          s.n,
        ),
        hints(
          "Read the place chart from the right: ones, tens, hundreds, thousands, ten thousands.",
          `Find the column that holds the digit ${digit}.`,
          `The digit ${digit} sits in the ${PLACE_LABEL[s.place]} column.`,
          `Choose the ${PLACE_LABEL[s.place]} place.`,
        ),
      ),
      exactStep(
        "digit-value",
        "Find the value",
        `What is the value of the digit ${digit} in ${grouped(s.n)}?`,
        hints(
          "A digit's value depends on the place it holds.",
          `Count how many ${PLACE_LABEL[s.place]} the digit stands for.`,
          `${digit} ${PLACE_LABEL[s.place]} is ${digit} × ${grouped(PLACE_UNIT[s.place])}.`,
          `${digit} × ${grouped(PLACE_UNIT[s.place])} = ${grouped(digit * PLACE_UNIT[s.place])}. Enter ${digit * PLACE_UNIT[s.place]}.`,
        ),
      ),
      choiceStep(
        "compare",
        "Compare two numbers",
        `Which number is greater: ${grouped(s.n)} or ${grouped(s.m)}?`,
        choices(
          [
            { label: grouped(s.n), meaning: "left" },
            { label: grouped(s.m), meaning: "right" },
            { label: "Both are equal", meaning: "same" },
          ],
          s.m,
        ),
        hints(
          "Compare the digits starting from the greatest place.",
          "Look at the ten thousands first, then the thousands, then the hundreds.",
          "Stop at the first place where the digits differ. The larger digit wins.",
          `Choose ${grouped(Math.max(s.n, s.m))}.`,
        ),
      ),
      reflectionStep(
        "Why does the same digit stand for different values?",
        "A digit's value depends on its place; each place is ten times the next.",
        [
          "The digit changes its shape when it moves to a different place in the number.",
          "The value of a digit is always just the digit itself, wherever it is.",
        ],
        hints(
          "Think about the place chart.",
          "Compare the value of 4 in the tens place with 4 in the hundreds place.",
          "Each place is worth ten times the place to its right.",
          "Choose the explanation about places being ten times each other.",
        ),
        s.n + 1,
      ),
    ];
  }
  if (s.task === "rounding") {
    const lower = lowerMultiple(s.n, s.roundTo),
      upper = lower + s.roundTo;
    const target = grouped(s.roundTo);
    const rounded = roundedTo(s.n, s.roundTo);
    return [
      choiceStep(
        "between",
        "Find the neighbours",
        `Between which two multiples of ${target} does ${grouped(s.n)} lie?`,
        choices(
          [
            {
              label: `${stepWord(lower)} and ${stepWord(upper)}`,
              meaning: "between",
            },
            {
              label: `${stepWord(lower - s.roundTo)} and ${stepWord(lower)}`,
              meaning: "below",
            },
            {
              label: `${stepWord(upper)} and ${stepWord(upper + s.roundTo)}`,
              meaning: "above",
            },
          ],
          s.n,
        ),
        hints(
          "Look at the marks on the number line.",
          `Find the multiple of ${target} just below ${grouped(s.n)} and the one just above.`,
          `${stepWord(lower)} is below ${grouped(s.n)} and ${stepWord(upper)} is above it.`,
          `Choose ${stepWord(lower)} and ${stepWord(upper)}.`,
        ),
      ),
      choiceStep(
        "nearer",
        "Closer to which?",
        `Is ${grouped(s.n)} closer to ${stepWord(lower)}, closer to ${stepWord(upper)}, or exactly halfway?`,
        choices(
          [
            { label: `Closer to ${stepWord(lower)}`, meaning: "lower" },
            { label: `Closer to ${stepWord(upper)}`, meaning: "upper" },
            { label: "Exactly halfway", meaning: "halfway" },
          ],
          s.n + 1,
        ),
        hints(
          "Find the halfway notch between the two marks.",
          "Is the dot before the halfway notch, after it, or on it?",
          `Halfway is ${stepWord(lower + s.roundTo / 2)}. Compare ${grouped(s.n)} with that.`,
          s.n * 2 === lower * 2 + s.roundTo
            ? "It is exactly halfway."
            : `${grouped(s.n)} is closer to ${stepWord(s.n - lower < s.roundTo - (s.n - lower) ? lower : upper)}.`,
        ),
      ),
      exactStep(
        "rounded",
        "Round the number",
        `Round ${grouped(s.n)} to the nearest ${target}.`,
        hints(
          "Use what you found about the neighbours and the halfway point.",
          "Round to the closer multiple. When exactly halfway, round up.",
          `The closer multiple is ${stepWord(rounded)}${s.n * 2 === lower * 2 + s.roundTo ? " (halfway rounds up)" : ""}.`,
          `${grouped(s.n)} rounded to the nearest ${target} is ${stepWord(rounded)}. Enter ${rounded}.`,
        ),
      ),
      reflectionStep(
        "How do you decide which way to round?",
        "Find the halfway point between the two multiples; from halfway, round up.",
        [
          "Always round up to the next multiple, even when it is further away.",
          "Always drop the last digits, so you keep the lower of the two multiples.",
        ],
        hints(
          "Think about the number line.",
          "A number can be nearer to either neighbour.",
          "The halfway point is where the choice changes.",
          "Choose the explanation that compares with the halfway point.",
        ),
        s.n + 2,
      ),
    ];
  }
  if (s.task === "factors") {
    const f = firstFactor(s.n),
      g = s.n / f;
    const { factors, notFactor } = factorOptions(s.n);
    const all = factorsOf(s.n);
    return [
      choiceStep(
        "pair",
        "Find a factor pair",
        `Which pair of numbers multiplies to make ${s.n}?`,
        choices(
          [
            { label: `${f} and ${g}`, meaning: "product-matches" },
            { label: `${f} and ${g + 1}`, meaning: "wrong-product" },
            { label: `${f} and ${s.n - f}`, meaning: "sum-matches" },
          ],
          s.n,
        ),
        hints(
          "A factor pair multiplies to make the number.",
          `Check each pair: does the product equal ${s.n}?`,
          `${f} × ${g} = ${s.n}.`,
          `Choose ${f} and ${g}.`,
        ),
      ),
      exactStep(
        "count",
        "Count the factors",
        `How many factors does ${s.n} have, counting 1 and ${s.n}?`,
        hints(
          "List the factor pairs in order, starting with 1.",
          `Try 1, 2, 3, 4 and so on, and keep the numbers that divide ${s.n} exactly.`,
          `The factors are ${all.slice(0, -1).join(", ")} and ${s.n}.`,
          `There are ${all.length} factors. Enter ${all.length}.`,
        ),
      ),
      choiceStep(
        "not-factor",
        "Spot the odd one out",
        `Three of these numbers are factors of ${s.n}. Which one is not?`,
        choices(
          [...factors, notFactor]
            .sort((a, b) => a - b)
            .map((k) => ({
              label: String(k),
              meaning: k === notFactor ? "not-factor" : "factor",
            })),
          0,
        ).sort((a, b) => Number(a.label) - Number(b.label)),
        hints(
          "A factor divides the number exactly, with nothing left over.",
          `Divide ${s.n} by each number and look for a remainder.`,
          `${s.n} ÷ ${notFactor} leaves a remainder.`,
          `Choose ${notFactor}.`,
        ),
      ),
      reflectionStep(
        "What makes a number a factor of another number?",
        "It divides the number exactly, with nothing left over.",
        [
          "It is smaller than the number, so it has to fit into it.",
          "It always ends in the same digit as the number it divides.",
        ],
        hints(
          "Think about sharing equally with no leftovers.",
          "A factor pair multiplies to make the number.",
          "Dividing by a factor leaves nothing over.",
          "Choose the explanation about dividing exactly.",
        ),
        s.n + 1,
      ),
    ];
  }
  const a = roundedTo(s.n, s.roundTo),
    b = roundedTo(s.m, s.roundTo);
  return [
    exactStep(
      "estimate",
      "Estimate the total",
      `A school has ${grouped(s.n)} ${s.unit} in one hall and ${grouped(s.m)} ${s.unit} in another. Round each number to the nearest ${grouped(s.roundTo)}, then add to estimate how many ${s.unit} there are.`,
      hints(
        "Round each number first, then add the rounded numbers.",
        `Round ${grouped(s.n)} and ${grouped(s.m)} to the nearest ${grouped(s.roundTo)}.`,
        `${grouped(s.n)} rounds to ${stepWord(a)} and ${grouped(s.m)} rounds to ${stepWord(b)}.`,
        `${stepWord(a)} + ${stepWord(b)} = ${stepWord(a + b)}. Enter ${a + b}.`,
      ),
    ),
    reflectionStep(
      "Why is it useful to round before adding?",
      "Rounded numbers are easy to add, and the total is close to the real one.",
      [
        "Rounding first makes the total come out exactly right, with no change.",
        "Rounding means the exact numbers in the question no longer matter.",
      ],
      hints(
        "Think about why we estimate.",
        "Round numbers are quicker to add in your head.",
        "An estimate is close to the real total, not exactly equal.",
        "Choose the explanation about a quick, rough total.",
      ),
      s.n,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateWholeNumbersSpec, (lesson, step) =>
    wholeNumbersAnswer(
      lesson.specification as unknown as WholeNumbersSpec,
      step,
    ),
  );
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateWholeNumbersSpec(next.specification).length) return next;
  const s = next.specification as unknown as WholeNumbersSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story =
    s.task === "practice"
      ? next.steps[0].prompt
      : s.task === "place-value"
        ? `Read ${grouped(s.n)} and ${grouped(s.m)} in the place chart.`
        : s.task === "rounding"
          ? `Find where ${grouped(s.n)} sits on the number line.`
          : `Look at ${s.n} counters in equal rows and find its factors.`;
  return derive(next);
}

function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported whole-number form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: WholeNumbersSpec = {
    task,
    n: { "place-value": 47308, rounding: 4637, factors: 36, practice: 2486 }[
      task
    ],
    m: { "place-value": 47380, rounding: 0, factors: 0, practice: 1329 }[task],
    place: "ten-thousands",
    roundTo: 100,
    unit: "stickers",
  };
  const title = {
    "place-value": "Read numbers to 100 000",
    rounding: "Round on the number line",
    factors: "Find all the factors",
    practice: "Estimate by rounding",
  }[task];
  const objective = {
    "place-value": "Read the place and value of digits in a five-digit number.",
    rounding: "Round a whole number to the nearest 10, 100 or 1 000.",
    factors: "Find factor pairs and count all the factors of a number.",
    practice: "Estimate a total by rounding each number first.",
  }[task];
  const lesson = rewrite({
    id,
    version: 1,
    topic: "whole-numbers",
    title,
    subtitle: "P4 whole-number revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 4 : 7,
    objective,
    story: "Read the number model.",
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  const pkg = p4Package({
    lesson,
    form,
    family: "whole-numbers",
    author: "claude-p4-whole-numbers",
    taskLabel: task,
    specErrors: validateWholeNumbersSpec,
  });
  const context = wholeNumbersTopic.interpretation!(lesson);
  if (context) pkg.interpretation = context;
  return pkg;
}

const sel = (
  key: string,
  label: string,
  value: string | number,
  options: (string | number)[],
  names?: (v: string | number) => string,
): TopicField => ({
  key,
  label,
  type: "select",
  value,
  options: options.map((v) => ({
    value: String(v),
    label: names ? names(v) : String(v),
  })),
});
export const wholeNumbersAuthor: AuthorTopic = {
  id: "whole-numbers",
  forms: [
    {
      id: "p4-place-value-100k",
      label: "Place value to 100 000",
      description: "Read the place and value of digits in a five-digit number.",
    },
    {
      id: "p4-rounding",
      label: "Rounding on a number line",
      description:
        "Round to the nearest 10, 100 or 1 000 using neighbouring multiples.",
    },
    {
      id: "p4-factors",
      label: "Factors",
      description: "Find factor pairs and count all the factors of a number.",
    },
    {
      id: "p4-estimate-by-rounding",
      label: "Estimate by rounding",
      description: "Round two numbers, then add to estimate a total.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as WholeNumbersSpec;
    const fields: TopicField[] = [
      {
        key: "n",
        label: s.task === "factors" ? "Number (12–60)" : "Number",
        type: "text",
        value: String(s.n),
      },
    ];
    if (s.task === "place-value" || s.task === "practice")
      fields.push({
        key: "m",
        label:
          s.task === "practice" ? "Second number" : "Number to compare with",
        type: "text",
        value: String(s.m),
      });
    if (s.task === "place-value")
      fields.push(
        sel(
          "place",
          "Place to ask about",
          s.place,
          PLACES,
          (v) => PLACE_LABEL[v as WholePlace],
        ),
      );
    if (s.task === "rounding" || s.task === "practice")
      fields.push(
        sel(
          "roundTo",
          "Round to the nearest",
          s.roundTo,
          [10, 100, 1000],
          (v) => grouped(Number(v)),
        ),
      );
    if (s.task === "practice")
      fields.push({
        key: "unit",
        label: "Things being counted",
        type: "text",
        value: s.unit,
      });
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    if (key === "n" || key === "m")
      next.specification[key] = /^\d+$/.test(
        String(value).replace(/[\s,]/g, ""),
      )
        ? Number(String(value).replace(/[\s,]/g, ""))
        : value;
    else if (key === "roundTo")
      next.specification.roundTo = /^\d+$/.test(String(value))
        ? Number(value)
        : value;
    else if (key === "place" || key === "unit") next.specification[key] = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
