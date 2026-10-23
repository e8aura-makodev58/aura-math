import type { Lesson, Step } from "../core/types";
import {
  decimalsAnswer,
  decimalResult,
  validateDecimalsSpec,
  type DecimalsSpec,
} from "../topics/decimals";
import { formatDecimal, decimalUnits } from "../topics/exact";

const h = (a: string, b: string, c: string, d: string): Step["hints"] => [
  a,
  b,
  c,
  d,
];
const exact = (
  id: string,
  title: string,
  prompt: string,
  hints: Step["hints"],
): Step => ({ id, goal: id, title, prompt, kind: "exact", answer: "0", hints });
// Distractor wording differs a little by task so that, across the family, the correct
// sentence is sometimes the longest, sometimes the shortest and sometimes in between.
const DECIMAL_WRONG: Record<DecimalsSpec["task"], [string, string]> = {
  places: [
    "The number of written digits tells us the value.",
    "A decimal point means we can ignore zero places.",
  ],
  practice: [
    "The number of written digits tells us the value.",
    "A decimal point means we can ignore zero places.",
  ],
  "add-subtract": [
    "The number of written digits always tells us the value.",
    "A decimal point means we can ignore any zero places.",
  ],
  "multiply-divide": [
    "The number of written digits always tells us the value.",
    "A decimal point means we can ignore zero places.",
  ],
};
function reflection(task: DecimalsSpec["task"]): Step {
  return {
    id: "reflection",
    goal: "reflection",
    title: "Explain the equal units",
    prompt: "What helps us calculate with decimals?",
    kind: "choice",
    choices: [
      { id: "r8", label: DECIMAL_WRONG[task][0] },
      { id: "r3", label: "Use equal place units and check the relationship." },
      { id: "r6", label: DECIMAL_WRONG[task][1] },
    ],
    answer: "r3",
    hints: h(
      "Look at the place chart.",
      "Tenths and hundredths are different-sized units.",
      "A relationship only works when we use the matching units.",
      "Choose: Use equal place units and check the relationship.",
    ),
  };
}
export function decimalSteps(s: DecimalsSpec): Step[] {
  const a = formatDecimal(s.a),
    b = formatDecimal(s.b),
    r = s.task === "places" ? "" : formatDecimal(decimalResult(s));
  if (s.task === "places")
    return [
      {
        id: "place",
        goal: "place",
        title: "Name a place",
        prompt: `Which place does the ${{ tenths: "first", hundredths: "second", thousandths: "third" }[s.targetPlace]} digit to the right of the decimal point occupy?`,
        kind: "choice",
        choices: [
          { id: "p7", label: "Hundredths", meaning: "hundredths" },
          { id: "p2", label: "Thousandths", meaning: "thousandths" },
          { id: "p9", label: "Tenths", meaning: "tenths" },
        ],
        answer: "",
        hints: h(
          "Read the decimal column headings.",
          "Move right from ones to tenths, then hundredths, then thousandths.",
          `Find the ${s.targetPlace} column.`,
          `Choose ${s.targetPlace}.`,
        ),
      },
      exact(
        "digit-value",
        "Find a digit’s value",
        `What is the value of the digit in the ${s.targetPlace} place of ${a}?`,
        h(
          `Find the ${s.targetPlace} column.`,
          `One unit in the ${s.targetPlace} place has the value shown by its column.`,
          `Count the equal ${s.targetPlace} units.`,
          "",
        ),
      ),
      {
        id: "compare",
        goal: "compare",
        title: "Compare two decimals",
        prompt: `Which value is greater: ${a} or ${b}?`,
        kind: "choice",
        choices: [
          { id: "c4", label: b, meaning: "right" },
          { id: "c9", label: "Both are equal", meaning: "same" },
          { id: "c2", label: a, meaning: "left" },
        ],
        answer: "",
        hints: h(
          "Compare the ones first.",
          "If the ones match, compare tenths, then hundredths, then thousandths.",
          "An empty final decimal place can be written as zero.",
          "",
        ),
      },
      reflection(s.task),
    ];
  if (s.task === "practice")
    return [
      exact(
        "calculate",
        "Find the length left",
        `There are ${a} ${s.unit} of cord. ${s.factor} equal pieces each ${b} ${s.unit} long are cut off. How many ${s.unit} remain?`,
        h(
          "Find the length used before finding the length left.",
          "The pieces are equal, so multiply the length of one piece by their count.",
          `${b} × ${s.factor} = ${formatDecimal({ coefficient: decimalUnits(s.b, 2) * s.factor, scale: 2 })} ${s.unit} used.`,
          `Subtract the used length from ${a}: ${r} ${s.unit} remain.`,
        ),
      ),
      reflection(s.task),
    ];
  const relation: Step = {
    id: "relation",
    goal: "relation",
    title: "Choose equal units",
    prompt:
      s.task === "add-subtract"
        ? "How should the decimal places line up?"
        : "What does the calculation represent?",
    kind: "choice",
    choices: [
      {
        id: "u5",
        label:
          s.task === "add-subtract"
            ? "Line up decimal points so each place matches the same place."
            : "Use the whole number as the number of equal groups.",
        meaning: "equal-units",
      },
      {
        id: "u2",
        label: "Line up the last written digits even when their places differ.",
        meaning: "unaligned",
      },
      {
        id: "u9",
        label:
          s.task === "add-subtract"
            ? "Subtract digits without checking their place values."
            : "Let the groups have different sizes as long as they add up.",
        meaning: "unequal-groups",
      },
    ],
    answer: "",
    hints: h(
      s.task === "add-subtract"
        ? "Start with the meaning of the decimal places."
        : "Start with the number of groups.",
      s.task === "add-subtract"
        ? "Ones match ones, tenths match tenths and hundredths match hundredths."
        : "Each group contains the same amount.",
      s.task === "add-subtract"
        ? "A missing decimal digit can be written as zero to match places."
        : "Multiplying or dividing by a whole number uses equal groups.",
      s.task === "add-subtract"
        ? "Choose the explanation that lines up matching decimal places."
        : "Choose the explanation that uses the stated number of equal groups.",
    ),
  };
  const symbol = { add: "+", subtract: "−", multiply: "×", divide: "÷" }[
      s.operation
    ],
    right = s.task === "add-subtract" ? b : String(s.factor);
  let partial = `Use matching place units to work out ${a} ${symbol} ${right}.`;
  if (s.operation === "subtract" && Number(s.a.scale) <= 2) {
    const aa = decimalUnits(s.a, 2),
      bb = decimalUnits(s.b, 2);
    const hundredthsBorrow = aa % 10 < bb % 10;
    const tenths = Math.floor(aa / 10) % 10;
    if (hundredthsBorrow && tenths === 0)
      partial =
        "Exchange one whole for ten tenths, then exchange one tenth for ten hundredths. Subtract matching places.";
    else if (hundredthsBorrow)
      partial =
        "Exchange one tenth for ten hundredths. Then subtract matching places, exchanging one whole for ten tenths too if needed.";
    else if (tenths < Math.floor(bb / 10) % 10)
      partial =
        "Exchange one whole for ten tenths so there are enough tenths to subtract. Then subtract matching places.";
  }
  const result = [
    relation,
    exact(
      "calculate",
      "Calculate with decimals",
      `Work out ${a} ${symbol} ${right}.`,
      h(
        "Look at the units before calculating.",
        s.task === "add-subtract"
          ? "Line up the decimal points to match equal units."
          : "Use the stated number of equal groups.",
        partial,
        `${a} ${symbol} ${right} = ${r}.`,
      ),
    ),
  ];
  if (s.task === "multiply-divide")
    result.push(
      exact(
        "inverse",
        "Check by reversing",
        `Check your result: work out ${r} ${s.operation === "divide" ? "×" : "÷"} ${s.factor}.`,
        h(
          "Reverse the operation to check the original value.",
          "Multiplication and division undo each other.",
          "Use the same whole-number factor or divisor.",
          `The check gives ${a}, the original value.`,
        ),
      ),
    );
  return [...result, reflection(s.task)];
}
export function deriveDecimalLesson(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validateDecimalsSpec(next.specification).length) return next;
  for (const st of next.steps)
    if (st.goal !== "reflection")
      st.answer = decimalsAnswer(
        next.specification as unknown as DecimalsSpec,
        st,
      );
  return next;
}
export function rewriteDecimalLesson(l: Lesson): Lesson {
  const next = structuredClone(l);
  if (validateDecimalsSpec(next.specification).length) return next;
  const s = next.specification as unknown as DecimalsSpec;
  const oldReflection = next.steps.find((st) => st.goal === "reflection");
  next.steps = decimalSteps(s).map((st) =>
    st.goal === "reflection" && oldReflection ? oldReflection : st,
  );
  next.story =
    s.task === "practice"
      ? next.steps[0].prompt
      : s.task === "places"
        ? `Read ${formatDecimal(s.a)} in the place chart, then compare it with ${formatDecimal(s.b)}.`
        : `Calculate with equal place units and check the result.`;
  const result = deriveDecimalLesson(next);
  for (const st of result.steps)
    if (st.goal === "digit-value")
      st.hints[3] = `The ${s.targetPlace} digit represents ${st.answer}.`;
    else if (st.goal === "compare")
      st.hints[3] = `Choose ${st.choices?.find((c) => c.id === st.answer)?.label}.`;
  return result;
}
