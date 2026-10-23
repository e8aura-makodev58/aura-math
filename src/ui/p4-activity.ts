import type { Choice, Lesson } from "../core/types";
import { decimalUnits, formatDecimal, formatFraction } from "../topics/exact";
import {
  decimalResult,
  validateDecimalsSpec,
  type DecimalsSpec,
} from "../topics/decimals";
import {
  fractionValue,
  validateFractionCalculationsSpec,
  type FractionCalculationsSpec,
} from "../topics/fraction-calculations";

export interface ActivityContext {
  stepIndex: number;
  hintRung: number;
  solvedGoals: readonly string[];
  workedOpen: boolean;
}
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

/** Presentation eligibility only: assessment still belongs to the injected adapter. */
export function p4ActivityKind(lesson: Lesson): "decimal" | "fraction" | null {
  if (!/^P4\b/.test(lesson.level)) return null;
  if (
    lesson.topic === "decimals" &&
    !validateDecimalsSpec(lesson.specification).length &&
    lesson.specification.task === "add-subtract" &&
    lesson.steps.map((step) => step.goal).join(",") ===
      "relation,calculate,reflection"
  )
    return "decimal";
  if (
    lesson.topic === "fraction-calculations" &&
    !validateFractionCalculationsSpec(lesson.specification).length &&
    lesson.specification.task === "add-subtract" &&
    lesson.steps.map((step) => step.goal).join(",") ===
      "equal-units,calculate,simplest,reflection"
  )
    return "fraction";
  return null;
}

export function p4Expression(lesson: Lesson): string {
  const kind = p4ActivityKind(lesson);
  if (kind === "decimal") {
    const s = lesson.specification as unknown as DecimalsSpec;
    return `${formatDecimal(s.a)} ${s.operation === "subtract" ? "−" : "+"} ${formatDecimal(s.b)}`;
  }
  if (kind === "fraction") {
    const s = lesson.specification as unknown as FractionCalculationsSpec;
    return `${s.numerator}/${s.denominator} ${s.operation === "subtract" ? "−" : "+"} ${s.otherNumerator}/${s.otherDenominator}`;
  }
  return "";
}

function revealCalculation(lesson: Lesson, context: ActivityContext) {
  const goal = lesson.steps[context.stepIndex]?.goal;
  return (
    context.workedOpen ||
    context.solvedGoals.includes("calculate") ||
    (context.hintRung === 4 && (goal === "calculate" || goal === "simplest"))
  );
}

function decimalTable(s: DecimalsSpec): string {
  const columns = ["Whole part", "Tenths", "Hundredths"];
  const rows = [s.a, s.b]
    .map((decimal) => {
      const digits = String(decimalUnits(decimal, 2)).padStart(3, "0");
      return `<tr><th scope="row">${escape(formatDecimal(decimal))}</th><td>${digits.slice(0, -2)}</td><td>${digits.at(-2)}</td><td>${digits.at(-1)}</td></tr>`;
    })
    .join("");
  return `<table class="activity-place-table"><caption>Match equal place units</caption><thead><tr><th scope="col">Value</th>${columns.map((name) => `<th scope="col">${name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

function fractionStrip(numerator: number, denominator: number, label: string) {
  const parts = Array.from(
    { length: denominator },
    (_, i) =>
      `<rect x="${10 + (i * 280) / denominator}" y="8" width="${280 / denominator}" height="30" fill="${i < numerator ? "#eac796" : "#fffaf0"}" stroke="#775227"/>`,
  ).join("");
  return `<div class="activity-strip"><span>${escape(label)}</span><svg viewBox="0 0 300 46" role="img" aria-label="${escape(`${numerator} of ${denominator} equal parts of one whole`)}">${parts}</svg></div>`;
}

/** Given data, confirmed relationships and explicit reveals are separate layers. */
export function renderP4Activity(
  lesson: Lesson,
  context: ActivityContext,
): string {
  const kind = p4ActivityKind(lesson);
  if (!kind) return "";
  const step = lesson.steps[context.stepIndex];
  const reveal = revealCalculation(lesson, context);
  let model = "",
    overlay = "",
    answer = "";
  if (kind === "decimal") {
    const s = lesson.specification as unknown as DecimalsSpec;
    const aligned =
      context.solvedGoals.includes("relation") ||
      (step?.goal === "relation" &&
        context.hintRung >= 3 &&
        step.hints[2] ===
          "A missing decimal digit can be written as zero to match places.");
    model = aligned
      ? decimalTable(s)
      : `<div class="activity-givens"><span>First value <strong>${escape(formatDecimal(s.a))}</strong></span><span>Second value <strong>${escape(formatDecimal(s.b))}</strong></span></div><p class="activity-nudge">Choose how the places should line up.</p>`;
    const a = decimalUnits(s.a, 2),
      b = decimalUnits(s.b, 2);
    const ones = Math.floor(a / 100),
      tenths = Math.floor(a / 10) % 10;
    if (
      step?.goal === "calculate" &&
      context.hintRung >= 3 &&
      step.hints[2] ===
        "Exchange one whole for ten tenths so there are enough tenths to subtract. Then subtract matching places." &&
      s.operation === "subtract" &&
      ones >= 1 &&
      tenths < Math.floor(b / 10) % 10 &&
      a % 10 >= b % 10
    ) {
      overlay = `<div class="activity-overlay" data-testid="exchange-overlay"><strong>Same value, different units</strong><p>${ones} whole${ones === 1 ? "" : "s"} + ${tenths} tenths = ${ones - 1} whole${ones - 1 === 1 ? "" : "s"} + ${tenths + 10} tenths</p><span>The hundredths stay the same.</span></div>`;
    }
    if (reveal) answer = formatDecimal(decimalResult(s));
  } else {
    const s = lesson.specification as unknown as FractionCalculationsSpec;
    const common = Math.max(s.denominator, s.otherDenominator);
    const matched =
      context.solvedGoals.includes("equal-units") ||
      (step?.goal === "equal-units" &&
        context.hintRung >= 3 &&
        step.hints[2] === "Rename one fraction using equal-size parts.");
    model =
      fractionStrip(
        s.numerator,
        s.denominator,
        `${s.numerator}/${s.denominator}`,
      ) +
      fractionStrip(
        s.otherNumerator,
        s.otherDenominator,
        `${s.otherNumerator}/${s.otherDenominator}`,
      );
    if (matched) {
      const a = s.numerator * (common / s.denominator),
        b = s.otherNumerator * (common / s.otherDenominator);
      overlay = `<div class="activity-overlay" data-testid="equal-parts-overlay"><strong>Same whole. Equal-size parts.</strong>${fractionStrip(a, common, `${s.numerator}/${s.denominator} = ${a}/${common}`)}${fractionStrip(b, common, `${s.otherNumerator}/${s.otherDenominator} = ${b}/${common}`)}</div>`;
    }
    if (reveal) {
      const simplified =
        context.workedOpen ||
        context.solvedGoals.includes("simplest") ||
        (context.hintRung === 4 &&
          (step?.goal === "calculate" || step?.goal === "simplest"));
      const numerator =
        s.numerator * (common / s.denominator) +
        (s.operation === "add" ? 1 : -1) *
          s.otherNumerator *
          (common / s.otherDenominator);
      answer = simplified
        ? formatFraction(fractionValue(s))
        : `${numerator}/${common}`;
    }
  }
  return `<div class="p4-workbench" data-activity="${kind}"><div class="activity-expression" data-testid="activity-expression">${escape(p4Expression(lesson))} <span>= ${reveal ? escape(answer) : "?"}</span></div>${model}${overlay}${reveal ? `<p class="activity-result" data-testid="activity-result">${context.workedOpen || context.hintRung === 4 ? "Worked result" : "Checked result"}: ${escape(answer)}</p>` : ""}</div>`;
}

/** Candidate labels supplement prose; selection does not supply a correctness flag. */
export function activityChoiceDiagram(lesson: Lesson, choice: Choice): string {
  if (
    p4ActivityKind(lesson) !== "decimal" ||
    lesson.steps[0].choices?.every((item) => item.id !== choice.id)
  )
    return "";
  const s = lesson.specification as unknown as DecimalsSpec;
  const a = formatDecimal(s.a),
    b = formatDecimal(s.b);
  if (choice.meaning === "equal-units") {
    const display = (d: DecimalsSpec["a"]) =>
      `${Math.floor(decimalUnits(d, 2) / 100)}.${String(decimalUnits(d, 2) % 100).padStart(2, "0")}`;
    return `<span class="alignment-sample" aria-hidden="true">${display(s.a)}<br>${display(s.b)}</span>`;
  }
  if (choice.meaning === "unaligned")
    return `<span class="alignment-sample" aria-hidden="true">${a}<br>${b}</span>`;
  return `<span class="alignment-sample alignment-sample--note" aria-hidden="true">?<br>?</span>`;
}
