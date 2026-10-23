import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
import {
  assessExact,
  decimalRational,
  decimalUnits,
  formatDecimal,
  type Decimal,
} from "./exact";
export interface DecimalsSpec {
  task: "places" | "add-subtract" | "multiply-divide" | "practice";
  a: Decimal;
  b: Decimal;
  operation: "add" | "subtract" | "multiply" | "divide";
  factor: number;
  targetPlace: "tenths" | "hundredths" | "thousandths";
  unit: string;
}
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function decimalResult(s: DecimalsSpec): Decimal {
  const a = decimalUnits(s.a, 2),
    b = decimalUnits(s.b, 2);
  return {
    coefficient:
      s.task === "practice"
        ? a - b * s.factor
        : s.operation === "add"
          ? a + b
          : s.operation === "subtract"
            ? a - b
            : s.operation === "multiply"
              ? a * s.factor
              : a / s.factor,
    scale: 2,
  };
}
export function validateDecimalsSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Expected decimal specification"];
  const s = input as DecimalsSpec,
    errors: string[] = [];
  if (
    Object.keys(s).some(
      (k) =>
        ![
          "task",
          "a",
          "b",
          "operation",
          "factor",
          "targetPlace",
          "unit",
        ].includes(k),
    )
  )
    errors.push("Unknown decimal field");
  if (
    !["places", "add-subtract", "multiply-divide", "practice"].includes(s.task)
  )
    errors.push("Unsupported decimal task");
  for (const name of ["a", "b"] as const) {
    const d = s[name];
    if (
      !d ||
      typeof d !== "object" ||
      Array.isArray(d) ||
      Object.keys(d).some((k) => !["coefficient", "scale"].includes(k)) ||
      !Number.isSafeInteger(d.coefficient) ||
      d.coefficient < 0 ||
      !Number.isInteger(d.scale) ||
      d.scale < 0 ||
      d.scale > (s.task === "places" ? 3 : 2) ||
      d.coefficient > 999999
    )
      errors.push(
        `${name} needs a bounded nonnegative integer coefficient and scale`,
      );
    else if (
      d.coefficient >
      (s.task === "places" ? 999.999 : 999.99) * 10 ** d.scale
    )
      errors.push(`${name} exceeds the decimal value limit`);
  }
  if (!["add", "subtract", "multiply", "divide"].includes(s.operation))
    errors.push("Unsupported decimal operation");
  if (s.task === "add-subtract" && !["add", "subtract"].includes(s.operation))
    errors.push("Add/subtract task needs addition or subtraction");
  if (
    s.task === "multiply-divide" &&
    !["multiply", "divide"].includes(s.operation)
  )
    errors.push("Multiply/divide task needs multiplication or division");
  if (s.task === "practice" && s.operation !== "subtract")
    errors.push("Practice uses multiplication then subtraction");
  if (!Number.isInteger(s.factor) || s.factor < 1 || s.factor > 9)
    errors.push("Factor/divisor must be an integer1–9");
  if (!["tenths", "hundredths", "thousandths"].includes(s.targetPlace))
    errors.push("Name a supported target place");
  if (typeof s.unit !== "string" || !s.unit.trim() || s.unit.length > 60)
    errors.push("Unit needs a short plain label");
  if (!errors.length && s.task !== "places") {
    const r = decimalResult(s);
    if (
      !Number.isSafeInteger(r.coefficient) ||
      r.coefficient < 0 ||
      r.coefficient > 999999
    )
      errors.push(
        "Result must be nonnegative, exact and within9999.99 with at most two decimal places",
      );
  }
  return errors;
}
export function decimalsAnswer(s: DecimalsSpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  if (goal === "reflection") return step.answer;
  if (goal === "digit-value") {
    const scale = { tenths: 1, hundredths: 2, thousandths: 3 }[s.targetPlace];
    return formatDecimal({
      coefficient: Math.floor(decimalUnits(s.a, 3) / 10 ** (3 - scale)) % 10,
      scale,
    });
  }
  if (goal === "calculate") return formatDecimal(decimalResult(s));
  if (goal === "inverse") return formatDecimal(s.a);
  const meaning =
    goal === "place"
      ? s.targetPlace
      : goal === "relation"
        ? "equal-units"
        : goal === "compare"
          ? decimalUnits(s.a, 3) > decimalUnits(s.b, 3)
            ? "left"
            : decimalUnits(s.a, 3) < decimalUnits(s.b, 3)
              ? "right"
              : "same"
          : "";
  return step.choices?.find((c) => c.meaning === meaning)?.id ?? "";
}
export function validateDecimalsSteps(l: Lesson): string[] {
  const errors = validateDecimalsSpec(l.specification);
  if (errors.length) return errors;
  const s = l.specification as unknown as DecimalsSpec;
  const goals =
    s.task === "places"
      ? ["place", "digit-value", "compare", "reflection"]
      : s.task === "multiply-divide"
        ? ["relation", "calculate", "inverse", "reflection"]
        : s.task === "practice"
          ? ["calculate", "reflection"]
          : ["relation", "calculate", "reflection"];
  if (l.steps.map((s) => s.goal).join(",") !== goals.join(","))
    errors.push("Unsupported decimal goal sequence");
  for (const st of l.steps) {
    const exact = ["digit-value", "calculate", "inverse"].includes(
      st.goal ?? "",
    );
    if (st.kind !== (exact ? "exact" : "choice"))
      errors.push("Response kind contradicts decimal goal");
    if (
      st.goal !== "reflection" &&
      (st.answer === "" || st.answer !== decimalsAnswer(s, st))
    )
      errors.push("Answer contradicts decimal model");
    if (
      st.goal === "place" &&
      st.choices
        ?.map((c) => c.meaning)
        .sort()
        .join(",") !== "hundredths,tenths,thousandths"
    )
      errors.push("Place choices must name each supported place once");
    if (
      st.goal === "compare" &&
      st.choices
        ?.map((c) => c.meaning)
        .sort()
        .join(",") !== "left,right,same"
    )
      errors.push("Compare choices must cover both values and a tie");
    if (
      st.goal === "relation" &&
      (!st.choices ||
        st.choices.filter((c) => c.meaning === "equal-units").length !== 1 ||
        st.choices.some(
          (c) =>
            !["equal-units", "unaligned", "unequal-groups"].includes(
              c.meaning ?? "",
            ),
        ))
    )
      errors.push("Relation choices need validated unit meanings");
  }
  return errors;
}
const adapter: Adapter = {
  id: "decimals",
  initialState: (l) => ({ specification: structuredClone(l.specification) }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, st) =>
    st.kind === "exact"
      ? assessExact(
          state,
          st,
          decimalRational,
          decimalsAnswer(state.specification as unknown as DecimalsSpec, st),
        )
      : assess(
          state,
          st,
          decimalsAnswer(state.specification as unknown as DecimalsSpec, st),
        ),
  describe: (state) => {
    const s = state.specification as unknown as DecimalsSpec;
    return s.task === "places"
      ? `Decimal chart for ${formatDecimal(s.a)} and comparison value ${formatDecimal(s.b)}. Columns show the whole part, tenths, hundredths and thousandths.`
      : s.task === "practice"
        ? `Available length ${formatDecimal(s.a)} ${s.unit}; ${s.factor} equal pieces, each ${formatDecimal(s.b)} ${s.unit}. Find the length remaining.`
        : `First value ${formatDecimal(s.a)}; ${s.task === "add-subtract" ? `second value ${formatDecimal(s.b)}` : `whole-number factor or divisor ${s.factor}`}. Operation: ${s.operation}. Match equal place units.`;
  },
};
function decimalGroupsModel(s: DecimalsSpec): string {
  if (s.task !== "practice" && s.task !== "multiply-divide") return "";
  const practice = s.task === "practice";
  const divide = !practice && s.operation === "divide";
  const wholeLabel = practice
    ? `Available: ${formatDecimal(s.a)} ${s.unit}`
    : divide
      ? `Whole amount: ${formatDecimal(s.a)}`
      : "Total: ?";
  const pieceLabel = practice
    ? `${formatDecimal(s.b)} ${s.unit}`
    : divide
      ? "?"
      : formatDecimal(s.a);
  const count = s.factor;
  const width = (practice ? 380 : 520) / count;
  const groups = Array.from(
    { length: count },
    (_, i) =>
      `<rect x="${30 + i * width}" y="110" width="${width}" height="44" fill="#d9ecff" stroke="#254f70"/><text x="${30 + (i + 0.5) * width}" y="137" text-anchor="middle" fill="#18364b" font-size="${count > 6 ? 12 : 15}">${escape(pieceLabel)}</text>`,
  ).join("");
  return `<svg viewBox="0 0 580 218" role="img" aria-label="${escape(`${wholeLabel}. ${count} equal ${practice ? "pieces" : "groups"}, each ${pieceLabel}. ${practice ? "Remaining length is unknown." : divide ? "Each group is unknown." : "Total is unknown."} Diagram is not to scale.`)}"><text x="30" y="30" fill="#18364b">${escape(wholeLabel)}</text><rect x="30" y="44" width="520" height="36" rx="5" fill="#fff1c8" stroke="#254f70"/><text x="290" y="68" text-anchor="middle" fill="#18364b">${escape(divide ? formatDecimal(s.a) : practice ? "Available length" : "?")}</text>${groups}${practice ? `<rect x="410" y="110" width="140" height="44" fill="#fff1c8" stroke="#254f70"/><text x="480" y="137" text-anchor="middle" fill="#18364b">Remaining: ?</text>` : ""}<text x="30" y="180" fill="#18364b">${count} equal ${practice ? "pieces; remaining: ?" : "groups"}</text><text x="30" y="206" fill="#18364b" font-size="13">Diagram not to scale</text></svg>`;
}
export const decimalsTopic: RuntimeTopic = {
  id: "decimals",
  label: "Decimals",
  visualTitle: "Decimal place units",
  adapter,
  validateSpec: validateDecimalsSpec,
  validateSteps: validateDecimalsSteps,
  answer: (l, s) =>
    decimalsAnswer(l.specification as unknown as DecimalsSpec, s),
  render: (l) => {
    const s = l.specification as unknown as DecimalsSpec;
    const values =
      s.task === "places" || s.task === "add-subtract" ? [s.a, s.b] : [s.a];
    return `<div class="decimal-model"><div class="decimal-chart" tabindex="0" role="region" aria-label="Decimal place chart; scroll horizontally on small screens"><table><caption>Decimal place chart</caption><thead><tr>${["Value", "Whole part", "Tenths", "Hundredths", "Thousandths"].map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${values
      .map((d) => {
        const digits = String(decimalUnits(d, 3)).padStart(4, "0");
        return `<tr><th>${formatDecimal(d)}</th>${[digits.slice(0, -3), ...digits.slice(-3)].map((x) => `<td>${x}</td>`).join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="decimal-chart-note">Scroll the chart sideways to see all place columns.</p>${decimalGroupsModel(s)}<p>${escape(adapter.describe({ specification: s }))}</p></div>`;
  },
  interpretation: (l) => {
    const s = l.specification as unknown as DecimalsSpec;
    if (s.task !== "practice") return undefined;
    const used = { coefficient: decimalUnits(s.b, 2) * s.factor, scale: 2 };
    return {
      entities: ["available", "piece", "count", "used", "remaining"],
      quantities: [
        {
          entity: "available",
          value: formatDecimal(s.a),
          unit: s.unit,
          state: "given",
        },
        {
          entity: "piece",
          value: formatDecimal(s.b),
          unit: s.unit,
          state: "given",
        },
        { entity: "count", value: s.factor, unit: "pieces", state: "given" },
        {
          entity: "used",
          value: formatDecimal(used),
          unit: s.unit,
          state: "derived",
        },
        {
          entity: "remaining",
          value: formatDecimal(decimalResult(s)),
          unit: s.unit,
          state: "derived",
        },
      ],
      relationships: [
        {
          kind: "operation",
          id: "used",
          operation: "multiply",
          inputs: ["piece", "count"],
          output: "used",
        },
        {
          kind: "operation",
          id: "remaining",
          operation: "subtract",
          inputs: ["available", "used"],
          output: "remaining",
        },
      ],
      unknown: "remaining",
      sourceSpans: [{ start: 0, end: l.story.length, text: l.story }],
      assumptions: ["All pieces have the same length."],
      ambiguities: [],
    };
  },
};
