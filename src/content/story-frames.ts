/**
 * STORY-FRAME BANK. DRAFT CONTENT: NEEDS HUMAN REVIEW. Nothing here has been checked by a teacher,
 * a parent or a curriculum reviewer. The names, items, places and sentence frames are original
 * drafts written for development preview only.
 *
 * Pure data plus a pure, deterministic selector. A frame is a fixed sentence whose verbs belong to
 * one mathematical profile (an "add" profile never says "left"; a "pieces cut off" profile never
 * says "altogether"). Frames carry two kinds of placeholder:
 *  - number placeholders (`{n}`, `{m}`, ...), filled only by the deterministic generator from the
 *    validated specification, each exactly once and in the order the profile fixes;
 *  - noun slots (`{name}`, `{item}`, `{place}`, `{unit}`), filled from the curated lists below.
 * Frames never contain pronouns, so a name never needs one (R-126). Slot values never contain digits
 * or number words (R-113). The same typed slot schema is what a later, adult-approved model pass
 * may fill; it may never write numbers, verbs, options, hints or answers.
 */

export type NounSlot = "name" | "item" | "place" | "unit";
export type StoryProfileId =
  "whole-estimate-add" | "fraction-share" | "decimal-pieces-left";
export type ItemKind = "count-large" | "count-share" | "length-material";

export interface StoryProfile {
  id: StoryProfileId;
  /** The single operation every frame of the profile must describe. */
  operation: "add-two-amounts" | "share-equally" | "subtract-equal-pieces";
  /** Number placeholders, each used exactly once, in this order. */
  numbers: readonly string[];
  /** Noun slots a frame of this profile may use. `name` and `item` are required. */
  slots: readonly NounSlot[];
  item: ItemKind;
  /** Allowed `{unit}` values (measures only). */
  units: readonly string[];
  /** Where the rendered frame goes: the story only, or the story and the first prompt. */
  target: "story" | "story-and-prompt";
  /** Frame-maths agreement: each frame contains at least one of `required` and none of `forbidden`. */
  required: readonly string[];
  forbidden: readonly string[];
}
export interface StoryFrame {
  id: string;
  profile: StoryProfileId;
  text: string;
}

/** Typed schema of a noun slot, for checking any value before it is rendered. */
export interface SlotRule {
  /** The curated list a value must come from (names are list-only; R-126). */
  listOnly: boolean;
  maxLength: number;
  /** Letters, spaces, hyphens and apostrophes only. */
  pattern: RegExp;
}
export const SLOT_SCHEMA: Record<NounSlot, SlotRule> = {
  name: { listOnly: true, maxLength: 16, pattern: /^[A-Z][A-Za-z' -]*$/ },
  item: { listOnly: false, maxLength: 24, pattern: /^[a-z][a-z' -]*$/ },
  place: { listOnly: false, maxLength: 24, pattern: /^[a-z][a-z' -]*$/ },
  unit: { listOnly: true, maxLength: 4, pattern: /^[a-zℓ]+$/ },
};

export const STORY_PROFILES: Record<StoryProfileId, StoryProfile> = {
  "whole-estimate-add": {
    id: "whole-estimate-add",
    operation: "add-two-amounts",
    numbers: ["{n}", "{m}", "{roundTo}"],
    slots: ["name", "item", "place"],
    item: "count-large",
    units: [],
    target: "story-and-prompt",
    required: ["altogether", "in all", "total"],
    forbidden: ["left", "remain", "take away", "gives away", "used", "share"],
  },
  "fraction-share": {
    id: "fraction-share",
    operation: "share-equally",
    numbers: ["{quantity}", "{denominator}"],
    slots: ["name", "item", "place"],
    item: "count-share",
    units: [],
    target: "story",
    required: ["equal"],
    forbidden: ["altogether", "more", "add", "left", "remain", "used"],
  },
  "decimal-pieces-left": {
    id: "decimal-pieces-left",
    operation: "subtract-equal-pieces",
    numbers: ["{a}", "{factor}", "{b}"],
    slots: ["name", "item", "unit"],
    item: "length-material",
    units: ["m"],
    target: "story-and-prompt",
    required: ["remain", "left"],
    forbidden: ["altogether", "in all", "more", "add", "share"],
  },
};

export const STORY_FRAMES: readonly StoryFrame[] = [
  // Add two amounts, then estimate the total by rounding each first.
  {
    id: "est-1",
    profile: "whole-estimate-add",
    text: "{name} counts {n} {item} at the {place} on Monday and {m} {item} on Tuesday. Round each number to the nearest {roundTo}, then add to estimate how many {item} there are altogether.",
  },
  {
    id: "est-2",
    profile: "whole-estimate-add",
    text: "The {place} has {n} {item} on a top shelf and {m} {item} on a lower shelf. {name} rounds each number to the nearest {roundTo}. Add the rounded numbers to estimate the total number of {item}.",
  },
  {
    id: "est-3",
    profile: "whole-estimate-add",
    text: "For a school fair, {name} packs {n} {item} in the morning and {m} {item} in the afternoon at the {place}. Round each number to the nearest {roundTo}, then add to estimate how many {item} are packed in all.",
  },
  {
    id: "est-4",
    profile: "whole-estimate-add",
    text: "{name} sorts {item} at the {place}. A red box holds {n} {item} and a blue box holds {m} {item}. Round each number to the nearest {roundTo}, then add to estimate how many {item} there are altogether.",
  },
  // Share a set equally (fraction of a quantity). The prompts keep the fraction wording.
  {
    id: "share-1",
    profile: "fraction-share",
    text: "{name} shares {quantity} {item} into {denominator} equal groups at the {place}.",
  },
  {
    id: "share-2",
    profile: "fraction-share",
    text: "At the {place}, {name} puts {quantity} {item} into {denominator} equal groups.",
  },
  {
    id: "share-3",
    profile: "fraction-share",
    text: "{name} has {quantity} {item} at the {place} and sorts them into {denominator} equal groups.",
  },
  // Cut equal pieces off a length and find the length that remains. The numbers keep the order
  // available length, number of pieces, length of one piece.
  {
    id: "cut-1",
    profile: "decimal-pieces-left",
    text: "{name} has {a} {unit} of {item}. {factor} equal pieces, each {b} {unit} long, are cut off. How many {unit} of {item} remain?",
  },
  {
    id: "cut-2",
    profile: "decimal-pieces-left",
    text: "A roll holds {a} {unit} of {item}. {name} cuts off {factor} equal pieces, each {b} {unit} long. How many {unit} of {item} are left?",
  },
  {
    id: "cut-3",
    profile: "decimal-pieces-left",
    text: "There are {a} {unit} of {item} for a class project. {name} cuts {factor} equal pieces from it, each {b} {unit} long. How many {unit} remain?",
  },
];

/** About sixty given names from Singapore's communities, used with no pronouns. */
export const NAMES: readonly string[] = [
  "Wei Ling",
  "Jun Hao",
  "Mei Xin",
  "Zhi Hao",
  "Hui Min",
  "Kai Wen",
  "Xin Yi",
  "Jia Hui",
  "Yu Xuan",
  "Rui En",
  "Jun Jie",
  "Shu Fen",
  "Wen Jie",
  "Li Ting",
  "Ming Hui",
  "Siti",
  "Nurul",
  "Aisyah",
  "Hakim",
  "Farhan",
  "Amirah",
  "Irfan",
  "Danial",
  "Hidayah",
  "Syafiq",
  "Nadia",
  "Haziq",
  "Iman",
  "Zara",
  "Rizwan",
  "Priya",
  "Arjun",
  "Kavya",
  "Ravi",
  "Divya",
  "Karthik",
  "Meera",
  "Vikram",
  "Anjali",
  "Sanjay",
  "Nisha",
  "Rahul",
  "Lakshmi",
  "Devi",
  "Arun",
  "Sarah",
  "Daniel",
  "Chloe",
  "Ethan",
  "Rachel",
  "Lucas",
  "Natalie",
  "Ryan",
  "Isaac",
  "Hannah",
  "Gabriel",
  "Megan",
  "Joshua",
  "Aiden",
  "Grace",
];

/** Plural count nouns. `count-large` suits hundreds or thousands; `count-share` suits a few dozen. */
export const ITEMS: Record<ItemKind, readonly string[]> = {
  "count-large": [
    "stickers",
    "beads",
    "paper clips",
    "stamps",
    "buttons",
    "seeds",
    "tickets",
    "leaflets",
    "rubber bands",
    "ice cream sticks",
    "paper cups",
    "bottle caps",
  ],
  "count-share": [
    "counters",
    "marbles",
    "stickers",
    "beads",
    "pencils",
    "erasers",
    "buttons",
    "shells",
    "cards",
    "crayons",
    "stamps",
    "paper stars",
  ],
  "length-material": [
    "ribbon",
    "rope",
    "cord",
    "wire",
    "string",
    "cloth",
    "tape",
    "lace",
  ],
};
export const PLACES: readonly string[] = [
  "school hall",
  "library",
  "art room",
  "music room",
  "canteen",
  "community centre",
  "bookshop",
  "science room",
  "craft corner",
  "classroom",
];

/**
 * Words that name or imply a number. Checked on whole words (so "someone" or "often" never match).
 */
export const NUMBER_WORDS: readonly string[] = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "hundreds",
  "thousand",
  "thousands",
  "million",
  "first",
  "second",
  "third",
  "thirds",
  "fourth",
  "fifth",
  "tenth",
  "half",
  "halves",
  "quarter",
  "quarters",
  "pair",
  "pairs",
  "couple",
  "twice",
  "double",
  "triple",
  "dozen",
  "dozens",
  "score",
  "both",
  "single",
  "once",
  "twin",
  "twins",
  "trio",
  "several",
  "few",
  "none",
];

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];
/** Issues with one slot value; empty when it may be rendered. */
export function slotValueIssues(
  slot: NounSlot,
  value: unknown,
  allowed?: readonly string[],
): string[] {
  const rule = SLOT_SCHEMA[slot];
  if (typeof value !== "string") return [`${slot} must be text`];
  const issues: string[] = [];
  if (!value.trim() || value.length > rule.maxLength)
    issues.push(`${slot} must be 1–${rule.maxLength} characters`);
  if (!rule.pattern.test(value))
    issues.push(`${slot} may use only letters, spaces and hyphens`);
  if (/\d/.test(value)) issues.push(`${slot} must not contain digits`);
  const blocked = words(value).filter((w) => NUMBER_WORDS.includes(w));
  if (blocked.length)
    issues.push(`${slot} must not contain number words (${blocked[0]})`);
  if ((rule.listOnly || allowed) && !(allowed ?? []).includes(value))
    issues.push(`${slot} must come from the curated list`);
  return issues;
}

export interface StorySelection {
  frame: StoryFrame;
  slots: Partial<Record<NounSlot, string>>;
}
function draw(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const pick = <T>(list: readonly T[], next: () => number): T =>
  list[Math.floor(next() * list.length)];

/** Deterministic choice of a frame and its noun slot values for one uint32 key. */
export function selectStory(
  profileId: StoryProfileId,
  key: number,
): StorySelection {
  const profile = STORY_PROFILES[profileId];
  const frames = STORY_FRAMES.filter((f) => f.profile === profileId);
  const next = draw(key ^ 0x5bd1e995);
  const frame = pick(frames, next);
  const slots: Partial<Record<NounSlot, string>> = {
    name: pick(NAMES, next),
    item: pick(ITEMS[profile.item], next),
  };
  if (profile.slots.includes("place")) slots.place = pick(PLACES, next);
  if (profile.slots.includes("unit")) slots.unit = pick(profile.units, next);
  return { frame, slots };
}

/**
 * Renders a frame. Throws on a slot value that breaks the schema, a missing number, or any
 * placeholder left unfilled, so a broken frame can never reach a learner.
 *
 * `extra` adds adult-approved item or place values (Phase B) to the curated lists for this one
 * render. Names and units never take extra values (R-126).
 */
export function renderStory(
  selection: StorySelection,
  numbers: Record<string, string>,
  extra: Partial<Record<"item" | "place", readonly string[]>> = {},
): string {
  const profile = STORY_PROFILES[selection.frame.profile];
  for (const [slot, value] of Object.entries(selection.slots) as [
    NounSlot,
    string,
  ][]) {
    const allowed =
      slot === "name"
        ? NAMES
        : slot === "item"
          ? [...ITEMS[profile.item], ...(extra.item ?? [])]
          : slot === "place"
            ? [...PLACES, ...(extra.place ?? [])]
            : profile.units;
    const issues = slotValueIssues(slot, value, allowed);
    if (issues.length) throw new Error(issues[0]);
  }
  let text = selection.frame.text;
  for (const key of profile.numbers) {
    const value = numbers[key];
    if (value === undefined) throw new Error(`Missing number ${key}`);
    text = text.split(key).join(value);
  }
  for (const [slot, value] of Object.entries(selection.slots))
    text = text.split(`{${slot}}`).join(value);
  if (/[{}]/.test(text)) throw new Error("A story placeholder was not filled");
  // A sentence may start with a slot; names are capitalised already, other slots are not.
  return text.charAt(0).toUpperCase() + text.slice(1);
}
