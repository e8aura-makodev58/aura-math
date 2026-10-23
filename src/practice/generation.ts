import { canonicalJson } from "../content-release";
import { packages } from "../content/lessons";
import {
  validatePackage,
  type LessonPackage,
} from "../content/package-validation";
import { rewriteDecimalLesson } from "../content/p4-decimal-builder";
import { rewriteFractionLesson } from "../content/p4-fraction-builder";
import { decimalsTopic, type DecimalsSpec } from "../topics/decimals";
import {
  fractionCalculationsTopic,
  type FractionCalculationsSpec,
} from "../topics/fraction-calculations";
import {
  formatDecimal,
  gcd,
  parseDecimal,
  parseFraction,
} from "../topics/exact";
import { fixturesFor, grouped } from "../topics/p4-kit";
import {
  renderStory,
  selectStory,
  type StoryProfileId,
  type StorySelection,
} from "../content/story-frames";
import { approvedExtras, type ApprovedSlotSet } from "../content/story-slots";
import { FAMILY_PROFILES, type FamilyProfile } from "./family-domains";

/** Development-preview entry only. Never import from the approved learner entry. */
export const P4_GENERATOR_VERSION = "p4-bounded-v4";
export const MAX_VARIANT_DOMAIN = 10_000;
export interface VariantDescriptor {
  seed: number;
  sourceId: string;
  sourceVersion: number;
  profileId: string;
  generatorVersion: string;
  ordinal: number;
  fingerprint: string;
  instanceId: string;
  /** Opaque id of the adult-approved story slot set used, when one was (Phase B3). */
  approvedStoryId?: string;
}
export type VariantResult =
  | { status: "ready"; package: LessonPackage; descriptor: VariantDescriptor }
  | { status: "exhausted"; message: string }
  | { status: "invalid"; message: string };
export interface VariantRun {
  next(): VariantResult;
  restart(): void;
}
type Specification = DecimalsSpec | FractionCalculationsSpec;
const sourceIds = [
  "p4-decimal-places",
  "p4-decimal-add-subtract",
  "p4-decimal-multiply-divide",
  "p4-decimal-practice",
  "p4-mixed-and-improper",
  "p4-fraction-add-subtract",
  "p4-fraction-of-quantity",
  "p4-fraction-practice",
] as const;
// Capture the canonical starters before any preview editing can mutate a caller copy.
const starters = new Map(
  packages
    .filter(
      (p) =>
        sourceIds.some((id) => id === p.lesson.id) ||
        Object.hasOwn(FAMILY_PROFILES, p.lesson.id),
    )
    .map((p) => [p.lesson.id, canonicalJson(p)]),
);
let runNonce = 0;
function hash(text: string): number {
  let result = 2166136261;
  for (const char of text)
    result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function shuffle<T>(values: T[], seed: number): T[] {
  const draw = random(seed);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function parameters(s: Specification): unknown {
  if ("a" in s) {
    const units = (d: DecimalsSpec["a"]) => d.coefficient * 10 ** (3 - d.scale);
    if (s.task === "places") return [units(s.a), units(s.b), s.targetPlace];
    if (s.task === "multiply-divide")
      return [units(s.a), s.factor, s.operation];
    return [
      units(s.a),
      units(s.b),
      s.task === "practice" ? s.factor : s.operation,
    ];
  }
  if (s.task === "mixed") return [s.whole, s.numerator, s.denominator];
  if (s.task === "add-subtract")
    return [
      s.numerator,
      s.denominator,
      s.otherNumerator,
      s.otherDenominator,
      s.operation,
    ];
  return [s.numerator, s.denominator, s.quantity];
}
function fingerprint(profile: string, s: Specification): string {
  return canonicalJson([profile, parameters(s)]);
}
/** Catalogue recognition identifies the source, not a pedagogical approval.
 * Keep explicit signatures so a future saved starter cannot silently change skill.
 */
function matchesProfile(source: LessonPackage): boolean {
  const s = source.lesson.specification as unknown as Specification;
  if (source.lesson.topic === "decimals" && "a" in s) {
    const A = s.a.coefficient * 10 ** (2 - s.a.scale);
    const B = s.b.coefficient * 10 ** (2 - s.b.scale);
    switch (source.lesson.id) {
      case "p4-decimal-add-subtract": {
        const whole = Math.floor(A / 100),
          other = Math.floor(B / 100);
        return (
          s.task === "add-subtract" &&
          s.operation === "subtract" &&
          s.a.scale === 2 &&
          s.b.scale === 1 &&
          whole >= 2 &&
          whole <= 9 &&
          other >= 1 &&
          other <= Math.min(3, whole - 1) &&
          A % 10 >= 1 &&
          Math.floor(A / 10) % 10 < Math.floor(B / 10) % 10
        );
      }
      case "p4-decimal-places":
        return (
          s.task === "places" &&
          s.targetPlace === "thousandths" &&
          s.a.scale === 3 &&
          s.b.scale === 2 &&
          Math.floor(s.a.coefficient / 1000) >= 1 &&
          Math.floor(s.a.coefficient / 1000) <= 9 &&
          Math.floor(s.a.coefficient / 100) % 10 >= 1 &&
          Math.floor(s.a.coefficient / 10) % 10 === 0 &&
          s.a.coefficient % 10 >= 1 &&
          Math.floor(s.a.coefficient / 100) ===
            Math.floor(s.b.coefficient / 10) &&
          s.b.coefficient % 10 >= 1
        );
      case "p4-decimal-multiply-divide":
        return (
          s.task === "multiply-divide" &&
          s.operation === "divide" &&
          s.a.scale === 1 &&
          s.factor >= 2 &&
          s.factor <= 9 &&
          s.a.coefficient > 10 &&
          s.a.coefficient % 10 !== 0 &&
          s.a.coefficient % s.factor === 0 &&
          s.a.coefficient / s.factor >= 1 &&
          s.a.coefficient / s.factor <= 9
        );
      case "p4-decimal-practice":
        return (
          s.task === "practice" &&
          s.operation === "subtract" &&
          s.factor === 4 &&
          s.unit === "m" &&
          s.a.scale === 1 &&
          s.b.scale === 2 &&
          s.a.coefficient >= 11 &&
          s.a.coefficient <= 99 &&
          s.a.coefficient % 10 !== 0 &&
          [25, 75, 125, 175, 225].includes(s.b.coefficient) &&
          A > B * 4
        );
      default:
        return false;
    }
  }
  if (source.lesson.topic !== "fraction-calculations" || "a" in s) return false;
  switch (source.lesson.id) {
    case "p4-mixed-and-improper":
      return (
        s.task === "mixed" &&
        s.whole === 2 &&
        s.denominator >= 3 &&
        s.denominator <= 6 &&
        s.numerator > 0 &&
        s.numerator < s.denominator &&
        gcd(s.numerator, s.denominator) === 1
      );
    case "p4-fraction-add-subtract": {
      const remainder = s.numerator - 2 * s.otherNumerator;
      return (
        s.task === "add-subtract" &&
        s.operation === "subtract" &&
        [4, 6, 8, 10, 12].includes(s.denominator) &&
        s.denominator === 2 * s.otherDenominator &&
        s.numerator > 0 &&
        s.numerator < s.denominator &&
        s.otherNumerator > 0 &&
        s.otherNumerator < s.otherDenominator &&
        gcd(s.numerator, s.denominator) === 1 &&
        gcd(s.otherNumerator, s.otherDenominator) === 1 &&
        remainder > 0 &&
        remainder < s.denominator &&
        gcd(remainder, s.denominator) > 1
      );
    }
    case "p4-fraction-of-quantity":
    case "p4-fraction-practice":
      return (
        s.task ===
          (source.lesson.id === "p4-fraction-practice"
            ? "practice"
            : "of-quantity") &&
        s.numerator === 3 &&
        s.denominator === 4 &&
        s.quantity >= 16 &&
        s.quantity <= 40 &&
        s.quantity % 4 === 0 &&
        s.unit === (s.task === "practice" ? "stickers" : "counters")
      );
    default:
      return false;
  }
}
function domain(source: LessonPackage): Specification[] {
  const s = source.lesson.specification as unknown as Specification;
  const result: Specification[] = [];
  if ("a" in s) {
    if (s.task === "add-subtract") {
      for (let whole = 2; whole <= 9; whole++)
        for (let other = 1; other <= Math.min(3, whole - 1); other++)
          for (let tenths = 0; tenths <= 8; tenths++)
            for (let otherTenths = tenths + 1; otherTenths <= 9; otherTenths++)
              for (let hundredths = 1; hundredths <= 9; hundredths++)
                result.push({
                  ...s,
                  a: {
                    coefficient: whole * 100 + tenths * 10 + hundredths,
                    scale: 2,
                  },
                  b: { coefficient: other * 10 + otherTenths, scale: 1 },
                });
    } else if (s.task === "places") {
      for (let whole = 1; whole <= 9; whole++)
        for (let tenths = 1; tenths <= 9; tenths++)
          for (let thousandths = 1; thousandths <= 9; thousandths++)
            for (
              let otherHundredths = 1;
              otherHundredths <= 9;
              otherHundredths++
            )
              // Half the pairs (deterministically, by digit-sum parity) keep the shorter decimal
              // larger (3.407 < 3.47); the other half share the hundredths digit so the longer
              // decimal is larger (3.478 > 3.47). "Pick the shorter number" then stops working.
              // The starter tuple has an odd digit sum, so it stays in the first family and the
              // base exclusion is unchanged.
              result.push({
                ...s,
                a: {
                  coefficient:
                    whole * 1000 +
                    tenths * 100 +
                    ((whole + tenths + thousandths + otherHundredths) % 2
                      ? 0
                      : otherHundredths * 10) +
                    thousandths,
                  scale: 3,
                },
                b: {
                  coefficient: whole * 100 + tenths * 10 + otherHundredths,
                  scale: 2,
                },
              });
    } else if (s.task === "multiply-divide") {
      for (let factor = 2; factor <= 9; factor++)
        for (let quotient = 1; quotient <= 9; quotient++) {
          const coefficient = factor * quotient;
          if (coefficient > 10 && coefficient % 10)
            result.push({ ...s, factor, a: { coefficient, scale: 1 } });
        }
    } else {
      for (const coefficient of [25, 75, 125, 175, 225])
        for (let available = 11; available <= 99; available++)
          if (available % 10 && available * 10 > coefficient * 4)
            result.push({
              ...s,
              a: { coefficient: available, scale: 1 },
              b: { coefficient, scale: 2 },
            });
    }
  } else if (s.task === "mixed") {
    for (let denominator = 3; denominator <= 6; denominator++)
      for (let numerator = 1; numerator < denominator; numerator++)
        if (gcd(numerator, denominator) === 1)
          result.push({ ...s, denominator, numerator });
  } else if (s.task === "add-subtract") {
    for (const denominator of [4, 6, 8, 10, 12]) {
      const otherDenominator = denominator / 2;
      for (let numerator = 1; numerator < denominator; numerator++)
        for (
          let otherNumerator = 1;
          otherNumerator < otherDenominator;
          otherNumerator++
        ) {
          const remainder = numerator - 2 * otherNumerator;
          if (
            remainder > 0 &&
            remainder < denominator &&
            gcd(numerator, denominator) === 1 &&
            gcd(otherNumerator, otherDenominator) === 1 &&
            gcd(remainder, denominator) > 1
          )
            result.push({
              ...s,
              numerator,
              denominator,
              otherNumerator,
              otherDenominator,
            });
        }
    }
  } else if (s.task === "of-quantity") {
    // Widened (v3): non-unit proper fractions in simplest form, 3 to 10 equal groups.
    for (const [numerator, denominator] of OF_QUANTITY_FRACTIONS)
      for (let groups = 3; groups <= 10; groups++)
        result.push({
          ...s,
          numerator,
          denominator,
          quantity: groups * denominator,
        });
  } else {
    for (let parts = 4; parts <= 10; parts++)
      result.push({ ...s, quantity: parts * 4 });
  }
  return result;
}
/** Fractions of a set for the widened of-quantity profile: numerator at least 2, simplest form. */
export const OF_QUANTITY_FRACTIONS: readonly (readonly [number, number])[] = [
  [2, 3],
  [3, 4],
  [2, 5],
  [3, 5],
  [4, 5],
  [5, 6],
  [3, 8],
  [5, 8],
  [7, 8],
  [3, 10],
  [7, 10],
  [9, 10],
];
const STORY_OF: Record<string, StoryProfileId> = {
  "p4-fraction-of-quantity": "fraction-share",
  "p4-decimal-practice": "decimal-pieces-left",
};
/** Story context for one build: the approved snapshot in, the approved set used out. */
interface StoryContext {
  approved: readonly ApprovedSlotSet[];
  used?: string;
}
/**
 * The frame and slots for one variant. With no approved set for the profile this is exactly
 * `selectStory` (so outputs without approved sets are unchanged). Otherwise a separate hash of the
 * story key chooses among the approved sets (sorted by id) plus one built-in slot, so the choice is
 * deterministic given the seed and the approved snapshot. The frame and unit always stay built-in.
 */
function chooseStory(
  profile: StoryProfileId,
  storyKey: number,
  context: StoryContext,
): { selection: StorySelection; extra?: ReturnType<typeof approvedExtras> } {
  const selection = selectStory(profile, storyKey);
  const pool = context.approved
    .filter((set) => set.profile === profile)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!pool.length) return { selection };
  const index = hash(`${storyKey}:approved-slots`) % (pool.length + 1);
  if (index === pool.length) return { selection };
  const set = pool[index];
  context.used = set.id;
  const slots = { ...set.slots } as StorySelection["slots"];
  if (selection.slots.unit) slots.unit = selection.slots.unit;
  return {
    selection: { frame: selection.frame, slots },
    extra: approvedExtras(set.slots),
  };
}
/** Fills a draft story frame with the specification's own numbers; never changes a number. */
function storyNumbers(
  profile: StoryProfileId,
  s: Record<string, unknown>,
): Record<string, string> {
  if (profile === "whole-estimate-add")
    return {
      "{n}": grouped(s.n as number),
      "{m}": grouped(s.m as number),
      "{roundTo}": grouped(s.roundTo as number),
    };
  if (profile === "fraction-share")
    return {
      "{quantity}": String(s.quantity),
      "{denominator}": String(s.denominator),
    };
  return {
    "{a}": formatDecimal(s.a as DecimalsSpec["a"]),
    "{factor}": String(s.factor),
    "{b}": formatDecimal(s.b as DecimalsSpec["b"]),
  };
}
function build(
  source: LessonPackage,
  specification: Specification,
  seed: number,
  ordinal: number,
  id: string,
  storyKey: number,
  context: StoryContext,
): LessonPackage {
  const p = structuredClone(source);
  p.lesson.id = id;
  p.lesson.version = 1;
  p.lesson.reviewStatus = "draft";
  p.lesson.specification = structuredClone(specification) as unknown as Record<
    string,
    unknown
  >;
  p.provenance = {
    kind: "generated",
    generatorVersion: P4_GENERATOR_VERSION,
    seed,
  };
  const storyProfile = STORY_OF[source.lesson.id];
  const chosen = storyProfile
    ? chooseStory(storyProfile, storyKey, context)
    : null;
  const story = chosen?.selection ?? null;
  if (story?.slots.unit) p.lesson.specification.unit = story.slots.unit;
  else if (story?.slots.item) p.lesson.specification.unit = story.slots.item;
  p.lesson =
    "a" in specification
      ? rewriteDecimalLesson(p.lesson)
      : rewriteFractionLesson(p.lesson);
  if (story) {
    const text = renderStory(
      story,
      storyNumbers(storyProfile, p.lesson.specification),
      chosen?.extra,
    );
    p.lesson.story = text;
    if (storyProfile === "decimal-pieces-left") p.lesson.steps[0].prompt = text;
  }
  const choiceSeed = seed ^ hash(`${source.lesson.id}:choices:${ordinal}`);
  const draw = random(choiceSeed);
  for (const step of p.lesson.steps) {
    if (!step.choices) continue;
    const correct = step.choices.find((choice) => choice.id === step.answer);
    if (!correct) throw new Error("Choice answer is not represented");
    const remapped = step.choices.map((choice, index) => ({
      ...choice,
      id: `option-${ordinal}-${step.id}-${index}-${Math.floor(draw() * 4294967296).toString(36)}`,
    }));
    step.answer = remapped[step.choices.indexOf(correct)].id;
    step.choices = shuffle(remapped, Math.floor(draw() * 4294967296));
  }
  const topic =
    "a" in specification ? decimalsTopic : fractionCalculationsTopic;
  const interpretation = topic.interpretation?.(p.lesson);
  if (interpretation) p.interpretation = interpretation;
  else delete p.interpretation;
  p.fixtures = p.lesson.steps.map((step) => {
    if (step.kind === "choice")
      return {
        stepId: step.id,
        accepted: [step.answer],
        rejected: step
          .choices!.filter((c) => c.id !== step.answer)
          .map((c) => c.id),
      };
    const answer = String(step.answer);
    if ("a" in specification) {
      const d = parseDecimal(answer);
      if (!d) throw new Error("Invalid expected decimal");
      return {
        stepId: step.id,
        accepted: [answer],
        rejected: [
          formatDecimal({
            coefficient: d.coefficient + 10 ** d.scale,
            scale: d.scale,
          }),
        ],
      };
    }
    const value = parseFraction(answer);
    if (!value) throw new Error("Invalid expected fraction");
    const equivalent = `${value.numerator * 2}/${value.denominator * 2}`;
    return {
      stepId: step.id,
      accepted: step.goal === "simplest" ? [answer] : [answer, equivalent],
      rejected: [
        `${value.numerator + value.denominator}/${value.denominator}`,
        ...(step.goal === "simplest" ? [equivalent] : []),
      ],
    };
  });
  return p;
}

type AnySpec = Record<string, unknown>;
function familyFixtures(
  profile: FamilyProfile,
  lesson: LessonPackage["lesson"],
): LessonPackage["fixtures"] {
  if (profile.topic.id !== "area-perimeter") return fixturesFor(lesson);
  // Area and perimeter accept either valid method; mirror the author template's fixtures.
  const both: Record<string, string[]> = {
    method: ["subtract-cutout", "split-add"],
    "boundary-method": ["edge-sum", "outer-equivalent"],
  };
  return lesson.steps.map((step) => {
    const accepted = both[step.goal ?? ""]
      ? step
          .choices!.filter((c) => both[step.goal!].includes(c.meaning ?? ""))
          .map((c) => c.id)
      : [step.answer as string];
    return {
      stepId: step.id,
      accepted,
      rejected:
        step.kind === "exact"
          ? ["9999", "9998"]
          : step
              .choices!.filter((c) => !accepted.includes(c.id))
              .map((c) => c.id)
              .slice(0, 2),
    };
  });
}
function buildFamily(
  profile: FamilyProfile,
  source: LessonPackage,
  specification: AnySpec,
  seed: number,
  ordinal: number,
  id: string,
  storyKey: number,
  context: StoryContext,
): LessonPackage {
  const p = structuredClone(source);
  p.lesson.id = id;
  p.lesson.version = 1;
  p.lesson.reviewStatus = "draft";
  p.lesson.specification = structuredClone(specification);
  p.provenance = {
    kind: "generated",
    generatorVersion: P4_GENERATOR_VERSION,
    seed,
  };
  const chosen = profile.story
    ? chooseStory(profile.story, storyKey, context)
    : null;
  const story = chosen?.selection ?? null;
  if (story?.slots.item) p.lesson.specification.unit = story.slots.item;
  p.lesson = profile.author.rewrite(p.lesson);
  if (story && profile.story) {
    const text = renderStory(
      story,
      storyNumbers(profile.story, p.lesson.specification),
      chosen?.extra,
    );
    p.lesson.story = text;
    p.lesson.steps[0].prompt = text;
  }
  // Option order carries no answer: shuffle single-choice steps whose order has no meaning.
  // Ids stay as the builder made them, because some topics read them (area and perimeter).
  const draw = random(seed ^ hash(`${source.lesson.id}:choices:${ordinal}`));
  for (const step of p.lesson.steps) {
    if (
      step.kind !== "choice" ||
      !step.choices ||
      profile.ordered?.includes(step.goal ?? "")
    )
      continue;
    step.choices = shuffle(step.choices, Math.floor(draw() * 4294967296));
  }
  const interpretation = profile.topic.interpretation?.(p.lesson);
  if (interpretation) p.interpretation = interpretation;
  else delete p.interpretation;
  p.fixtures = familyFixtures(profile, p.lesson);
  return p;
}

interface Plan {
  profileId: string;
  candidates: AnySpec[];
  fingerprint(spec: AnySpec): string;
  build(
    spec: AnySpec,
    seed: number,
    ordinal: number,
    id: string,
    storyKey: number,
    context: StoryContext,
  ): LessonPackage;
}
function planFor(frozen: LessonPackage): Plan | null {
  const spec = frozen.lesson.specification;
  const family = FAMILY_PROFILES[frozen.lesson.id];
  if (family) {
    if (
      frozen.lesson.topic !== family.topic.id ||
      !family.signature(spec) ||
      family.topic.validateSpec(spec).length
    )
      return null;
    const profileId = `${frozen.lesson.id}:same-skill-v1`;
    const print = (s: AnySpec) =>
      canonicalJson([profileId, family.parameters(s)]);
    const base = print(spec);
    const seen = new Set<string>([base]);
    const tuples = family.domain(structuredClone(spec));
    if (!tuples.length || tuples.length > MAX_VARIANT_DOMAIN) return null;
    const candidates = tuples.filter((s) => {
      const key = print(s);
      if (seen.has(key) || family.topic.validateSpec(s).length) return false;
      seen.add(key);
      return true;
    });
    return {
      profileId,
      candidates,
      fingerprint: print,
      build: (s, seed, ordinal, id, storyKey, context) =>
        buildFamily(family, frozen, s, seed, ordinal, id, storyKey, context),
    };
  }
  if (!matchesProfile(frozen)) return null;
  const profileId = `${frozen.lesson.id}:same-skill-${frozen.lesson.id === "p4-fraction-of-quantity" ? "v2" : "v1"}`;
  const base = fingerprint(profileId, spec as unknown as Specification);
  const tuples = domain(frozen);
  if (!tuples.length || tuples.length > MAX_VARIANT_DOMAIN) return null;
  return {
    profileId,
    candidates: tuples.filter(
      (s) => fingerprint(profileId, s) !== base,
    ) as unknown as AnySpec[],
    fingerprint: (s) => fingerprint(profileId, s as unknown as Specification),
    build: (s, seed, ordinal, id, storyKey, context) =>
      build(
        frozen,
        s as unknown as Specification,
        seed,
        ordinal,
        id,
        storyKey,
        context,
      ),
  };
}

/**
 * Test and review hook: the complete candidate list a starter would serve (after the topic's
 * validateSpec guard and without the starter's own tuple), in enumeration order.
 */
export function variantCandidates(
  source: LessonPackage,
): { profileId: string; candidates: Record<string, unknown>[] } | null {
  try {
    if (starters.get(source.lesson.id) !== canonicalJson(source)) return null;
    const plan = planFor(structuredClone(source));
    return plan
      ? {
          profileId: plan.profileId,
          candidates: structuredClone(plan.candidates),
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * Exact starter payload recognition intentionally rejects even valid custom prose. `approved` is
 * the snapshot of adult-approved story slot sets (development preview only); it changes only the
 * noun slots of framed profiles, never a number or an answer.
 */
export function createVariantRun(
  source: LessonPackage,
  seed: number,
  approved: readonly ApprovedSlotSet[] = [],
): VariantRun | null {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) return null;
  try {
    if (starters.get(source.lesson.id) !== canonicalJson(source)) return null;
    const frozen = structuredClone(source);
    const plan = planFor(frozen);
    if (!plan) return null;
    const { profileId } = plan;
    const snapshot = structuredClone([...approved]);
    const candidates = [...plan.candidates];
    if (!candidates.length) return null;
    shuffle(candidates, seed ^ hash(profileId));
    const nonce = ++runNonce;
    let cursor = 0,
      epoch = 0;
    return {
      next() {
        if (cursor >= candidates.length)
          return {
            status: "exhausted",
            message:
              "You have tried every example in this set. Restart the set or choose another lesson.",
          };
        const ordinal = cursor + 1;
        const instanceId = `variant-${nonce}-${epoch}-${ordinal}`;
        try {
          const print = plan.fingerprint(candidates[cursor]);
          const context: StoryContext = { approved: snapshot };
          const candidate = plan.build(
            candidates[cursor],
            seed,
            ordinal,
            instanceId,
            hash(`${seed}:${print}`),
            context,
          );
          const checked = validatePackage(candidate);
          if (!checked.package)
            return {
              status: "invalid",
              message:
                "A fresh example could not be validated. Your current example is still available.",
            };
          const descriptor: VariantDescriptor = {
            seed,
            sourceId: frozen.lesson.id,
            sourceVersion: frozen.lesson.version,
            profileId,
            generatorVersion: P4_GENERATOR_VERSION,
            ordinal,
            fingerprint: print,
            instanceId,
            ...(context.used ? { approvedStoryId: context.used } : {}),
          };
          cursor++;
          return { status: "ready", package: checked.package, descriptor };
        } catch {
          return {
            status: "invalid",
            message:
              "A fresh example could not be built. Your current example is still available.",
          };
        }
      },
      restart() {
        cursor = 0;
        epoch++;
      },
    };
  } catch {
    return null;
  }
}
