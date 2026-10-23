/**
 * Adult-approved story slot sets (Phase B, R-113/R-114/R-126). DRAFT: the checks here are
 * mechanical and cannot judge child suitability; an adult approves every set before a child sees it.
 *
 * A slot set fills the noun slots of the existing story frames for one profile: a name from the
 * curated list, plus an item (and a place where the profile has one) that a model may suggest. Sets
 * never carry numbers, verbs, options, hints, worked steps or answers, and the unit stays the
 * profile's fixed unit. This pure module is shared by the development-server queue and the
 * development preview, which re-checks every approved set before using it. Never imported by the
 * learner entry.
 */
import {
  ITEMS,
  NAMES,
  STORY_FRAMES,
  STORY_PROFILES,
  renderStory,
  slotValueIssues,
  type StoryProfileId,
  type StorySelection,
} from "./story-frames";

export const STORY_SLOTS_PROMPT_VERSION = "story-slots-v1";
export const STORY_SLOT_PROFILES: readonly StoryProfileId[] = [
  "whole-estimate-add",
  "fraction-share",
  "decimal-pieces-left",
];
export const isStorySlotProfile = (value: unknown): value is StoryProfileId =>
  typeof value === "string" &&
  (STORY_SLOT_PROFILES as readonly string[]).includes(value);

/** The slot names a model fills for each profile, in a fixed order. Units are never model-filled. */
export const MODEL_SLOTS: Record<
  StoryProfileId,
  readonly ("name" | "item" | "place")[]
> = {
  "whole-estimate-add": ["name", "item", "place"],
  "fraction-share": ["name", "item", "place"],
  "decimal-pieces-left": ["name", "item"],
};

/** What each profile's item must be, in words for the prompt and the admin page. */
export const ITEM_KIND_TEXT: Record<StoryProfileId, string> = {
  "whole-estimate-add":
    "a plural noun for small countable things a school might have hundreds or thousands of (like stickers or paper cups)",
  "fraction-share":
    "a plural noun for small countable things a child could share into equal groups (like marbles or crayons)",
  "decimal-pieces-left":
    "a singular noun for a material measured in metres that can be cut into pieces (like ribbon or rope)",
};
export const PROFILE_LABELS: Record<StoryProfileId, string> = {
  "whole-estimate-add": "Estimate a total (whole numbers)",
  "fraction-share": "Share into equal groups (fraction of a set)",
  "decimal-pieces-left": "Length left after cutting pieces (decimals)",
};

export type StorySlots = Partial<Record<"name" | "item" | "place", string>>;
export interface ApprovedSlotSet {
  /** Opaque id. */
  id: string;
  profile: StoryProfileId;
  slots: StorySlots;
}

/**
 * Child-safety and prompt-injection word list (whole words, lower case). Mechanical only: it cannot
 * prove a value is suitable, which is why an adult approves every set.
 */
export const BLOCKED_WORDS: readonly string[] = [
  // Prompt-like or instruction text.
  "ignore",
  "ignored",
  "instruction",
  "instructions",
  "prompt",
  "prompts",
  "system",
  "assistant",
  "model",
  "ai",
  "chatgpt",
  "claude",
  "openai",
  "anthropic",
  "json",
  "script",
  "javascript",
  "http",
  "https",
  "www",
  "com",
  "click",
  "link",
  "password",
  "token",
  "admin",
  "delete",
  "override",
  "previous",
  // Violence, weapons and harm.
  "gun",
  "guns",
  "knife",
  "knives",
  "sword",
  "swords",
  "bomb",
  "bombs",
  "bullet",
  "bullets",
  "weapon",
  "weapons",
  "kill",
  "killer",
  "blood",
  "dead",
  "death",
  "war",
  "fight",
  "poison",
  "grenade",
  "rifle",
  // Alcohol, smoking, drugs, gambling, dating.
  "beer",
  "wine",
  "vodka",
  "whisky",
  "whiskey",
  "alcohol",
  "cigarette",
  "cigarettes",
  "cigar",
  "cigars",
  "vape",
  "vapes",
  "tobacco",
  "drug",
  "drugs",
  "pill",
  "pills",
  "casino",
  "bet",
  "bets",
  "gamble",
  "gambling",
  "lottery",
  "dating",
  "kiss",
  "sexy",
  // Brands (a short, illustrative list).
  "lego",
  "coca",
  "cola",
  "pepsi",
  "mcdonald's",
  "mcdonalds",
  "nike",
  "adidas",
  "disney",
  "pokemon",
  "barbie",
  "iphone",
  "apple",
  "samsung",
  "nintendo",
  "starbucks",
];

const words = (text: string) => text.toLowerCase().match(/[a-z']+/g) ?? [];

/** Sample numbers used to prove that a slot set renders in every frame of its profile. */
export const SAMPLE_NUMBERS: Record<StoryProfileId, Record<string, string>> = {
  "whole-estimate-add": { "{n}": "2 486", "{m}": "1 329", "{roundTo}": "100" },
  "fraction-share": { "{quantity}": "24", "{denominator}": "4" },
  "decimal-pieces-left": { "{a}": "9.5", "{factor}": "4", "{b}": "1.25" },
};

const unitOf = (profile: StoryProfileId) => STORY_PROFILES[profile].units[0];

/** The full selection (frame plus slots, with the profile's fixed unit) for one frame. */
export function slotSelection(
  profile: StoryProfileId,
  frameIndex: number,
  slots: StorySlots,
): StorySelection {
  const frames = STORY_FRAMES.filter((frame) => frame.profile === profile);
  const frame = frames[Math.abs(frameIndex) % frames.length];
  const unit = unitOf(profile);
  return { frame, slots: unit ? { ...slots, unit } : { ...slots } };
}

/** Renders one example story with the sample numbers. Throws when the set does not render. */
export function exampleStory(
  profile: StoryProfileId,
  slots: StorySlots,
  frameIndex = 0,
): string {
  return renderStory(
    slotSelection(profile, frameIndex, slots),
    SAMPLE_NUMBERS[profile],
    approvedExtras(slots),
  );
}

/** The extra item and place values `renderStory` may accept for one approved set. */
export const approvedExtras = (slots: StorySlots) => ({
  item: slots.item ? [slots.item] : [],
  place: slots.place ? [slots.place] : [],
});

/**
 * Issues with one candidate slot set; empty when it may enter the pending queue (or, in the
 * preview, be used). The value is untrusted data: it is only type-checked, never interpreted.
 */
export function storySlotIssues(
  profile: StoryProfileId,
  value: unknown,
): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return ["not-object"];
  const record = value as Record<string, unknown>;
  const expected = MODEL_SLOTS[profile];
  const keys = Object.keys(record);
  if (
    keys.length !== expected.length ||
    !expected.every((slot) => keys.includes(slot))
  )
    return ["fields"];
  const issues: string[] = [];
  for (const slot of expected) {
    const text = record[slot];
    const found = slotValueIssues(
      slot,
      text,
      slot === "name" ? NAMES : undefined,
    );
    if (found.length) {
      issues.push(`${slot}: ${found[0]}`);
      continue;
    }
    const value = text as string;
    if (/\s{2,}|^\s|\s$|--|''/.test(value))
      issues.push(`${slot}: spacing or punctuation`);
    else if (value.split(" ").length > 4)
      issues.push(`${slot}: too many words`);
    const blocked = words(value).find((word) => BLOCKED_WORDS.includes(word));
    if (blocked) issues.push(`${slot}: blocked word`);
  }
  if (issues.length) return issues;
  // The set must render in every frame of the profile.
  try {
    const frames = STORY_FRAMES.filter((frame) => frame.profile === profile);
    for (let index = 0; index < frames.length; index++)
      exampleStory(profile, record as StorySlots, index);
  } catch {
    return ["does-not-render"];
  }
  return [];
}

/** Canonical key of a slot set, for de-duplication. */
export const slotKey = (profile: StoryProfileId, slots: StorySlots) =>
  JSON.stringify([
    profile,
    ...MODEL_SLOTS[profile].map((slot) => (slots[slot] ?? "").toLowerCase()),
  ]);

/** Re-checks a public approved-sets reply; keeps only well-formed, valid sets (at most 200). */
export function parseApprovedSets(value: unknown): ApprovedSlotSet[] {
  if (typeof value !== "object" || value === null) return [];
  const sets = (value as { sets?: unknown }).sets;
  if (!Array.isArray(sets)) return [];
  const kept: ApprovedSlotSet[] = [];
  for (const entry of sets.slice(0, 200)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, profile, slots, status } = entry as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !/^[a-f0-9]{8,64}$/.test(id) ||
      status !== "approved" ||
      !isStorySlotProfile(profile) ||
      storySlotIssues(profile, slots).length
    )
      continue;
    kept.push({ id, profile, slots: { ...(slots as StorySlots) } });
  }
  return kept;
}

/** Items of the curated list for a profile (for prompts). */
export const curatedItems = (profile: StoryProfileId) =>
  ITEMS[STORY_PROFILES[profile].item];
