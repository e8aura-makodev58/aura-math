import type { Evaluation, State, Step } from "../core/types";
export interface Decimal {
  coefficient: number;
  scale: number;
}
export interface Rational {
  numerator: number;
  denominator: number;
}
export function parseDecimal(value: unknown): Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (raw.length > 32 || !/^\d+(?:\.\d{1,3})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const coefficient = Number(whole + fraction);
  return Number.isSafeInteger(coefficient) && coefficient <= 999999999
    ? { coefficient, scale: fraction.length }
    : null;
}
export function formatDecimal(d: Decimal): string {
  const digits = String(d.coefficient).padStart(d.scale + 1, "0");
  return d.scale
    ? `${digits.slice(0, -d.scale)}.${digits.slice(-d.scale)}`
        .replace(/0+$/, "")
        .replace(/\.$/, "")
    : digits;
}
export function decimalUnits(d: Decimal, scale: number): number {
  return d.coefficient * 10 ** (scale - d.scale);
}
export function gcd(a: number, b: number): number {
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}
export function parseFraction(value: unknown): Rational | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (raw.length > 40) return null;
  let match = raw.match(/^(\d+)$/);
  if (match) {
    const n = Number(match[1]);
    return n <= 1000000 ? { numerator: n, denominator: 1 } : null;
  }
  match = raw.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const whole = Number(match[1] ?? 0),
    n = Number(match[2]),
    d = Number(match[3]);
  if (
    !Number.isSafeInteger(n) ||
    d < 1 ||
    d > 1000 ||
    whole > 1000 ||
    n > 1000000 ||
    (match[1] !== undefined && n >= d)
  )
    return null;
  return { numerator: whole * d + n, denominator: d };
}
export function formatFraction(r: Rational): string {
  const divisor = gcd(r.numerator, r.denominator);
  const n = r.numerator / divisor,
    d = r.denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}
function invalid(decimal = false): Evaluation {
  return {
    outcome: "unassessable",
    feedbackKey: "answer.syntax",
    matchedAlternative: null,
    feedback: decimal
      ? "Check the answer format. Use a decimal such as 2.35; do not include units or a calculation."
      : "Check the answer format. Use a fraction such as 3/4 or 2 3/5; do not include units or a calculation.",
  };
}
export function assessExact(
  state: State,
  step: Step,
  parser: (value: unknown) => Rational | null,
  expected: Step["answer"] = step.answer,
  requireSimplest = false,
): Evaluation {
  const actual = parser(state.answer),
    target = parser(expected);
  if (!actual || !target) return invalid(parser === decimalRational);
  const correct =
    actual.numerator * target.denominator ===
      target.numerator * actual.denominator &&
    (!requireSimplest || gcd(actual.numerator, actual.denominator) === 1);
  return {
    outcome: correct ? "correct" : "incorrect",
    feedbackKey: correct ? "answer.correct" : "answer.incorrect",
    matchedAlternative: correct ? "equivalent-exact" : null,
    feedback: correct
      ? "That fits. You can move to the next step."
      : requireSimplest
        ? "Check the quantity and write the fraction in its simplest form."
        : "Not quite yet. Check the equal units or relationship, then try again.",
  };
}
export const decimalRational = (value: unknown): Rational | null => {
  const d = parseDecimal(value);
  return d ? { numerator: d.coefficient, denominator: 10 ** d.scale } : null;
};
