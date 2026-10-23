/**
 * The draft story-frame bank (needs human review). These checks are mechanical: rendering,
 * blocked number words, placeholder use and a frame-maths agreement table. They are not a review
 * of child suitability or teaching quality.
 */
import { describe, expect, it } from "vitest";
import { packages } from "../src/content/lessons";
import {
  ITEMS,
  NAMES,
  NUMBER_WORDS,
  PLACES,
  renderStory,
  selectStory,
  slotValueIssues,
  STORY_FRAMES,
  STORY_PROFILES,
  type StoryProfileId,
} from "../src/content/story-frames";
import { createVariantRun } from "../src/practice/generation";

const tokens = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];
const sampleNumbers: Record<StoryProfileId, Record<string, string>> = {
  "whole-estimate-add": { "{n}": "2 486", "{m}": "1 329", "{roundTo}": "100" },
  "fraction-share": { "{quantity}": "28", "{denominator}": "4" },
  "decimal-pieces-left": { "{a}": "9.5", "{factor}": "4", "{b}": "1.25" },
};
/** Independent agreement table: the words that pin each profile's operation. */
const AGREEMENT: Record<StoryProfileId, { any: RegExp; never: RegExp }> = {
  "whole-estimate-add": {
    any: /\b(altogether|in all|total)\b/,
    never: /\b(left|remain|take away|used|share|shares)\b/,
  },
  "fraction-share": {
    any: /\bequal groups\b/,
    never: /\b(altogether|more|add|left|remain|used)\b/,
  },
  "decimal-pieces-left": {
    any: /\b(remain|left)\b/,
    never: /\b(altogether|in all|more|add|share)\b/,
  },
};

describe("draft story-frame bank", () => {
  it("has the curated lists the plan asks for, with no number words or digits", () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(55);
    expect(new Set(NAMES).size).toBe(NAMES.length);
    for (const name of NAMES)
      expect(slotValueIssues("name", name, NAMES)).toEqual([]);
    for (const [kind, list] of Object.entries(ITEMS))
      for (const item of list)
        expect(slotValueIssues("item", item, list), `${kind}: ${item}`).toEqual(
          [],
        );
    for (const place of PLACES)
      expect(slotValueIssues("place", place, PLACES)).toEqual([]);
  });

  it("blocks number words on whole words, digits, markup and names off the list", () => {
    for (const bad of [
      "half cups",
      "pair of socks",
      "dozen eggs",
      "twice",
      "both",
      "seven stars",
    ])
      expect(slotValueIssues("item", bad).join()).toContain("number words");
    expect(slotValueIssues("item", "someone often")).toEqual([]);
    expect(slotValueIssues("item", "beads 2")).not.toEqual([]);
    expect(slotValueIssues("place", "<b>hall</b>")).not.toEqual([]);
    expect(slotValueIssues("name", "Bob", NAMES)).not.toEqual([]);
    expect(slotValueIssues("name", "Bob")).not.toEqual([]);
    for (const word of [
      "half",
      "quarter",
      "pair",
      "twice",
      "dozen",
      "both",
      "single",
    ])
      expect(NUMBER_WORDS).toContain(word);
  });

  it("every frame agrees with its profile's maths and uses its numbers once, in order", () => {
    for (const id of Object.keys(STORY_PROFILES) as StoryProfileId[])
      expect(
        STORY_FRAMES.filter((f) => f.profile === id).length,
      ).toBeGreaterThanOrEqual(3);
    for (const frame of STORY_FRAMES) {
      const profile = STORY_PROFILES[frame.profile];
      const text = frame.text.toLowerCase();
      expect(text, frame.id).toMatch(AGREEMENT[frame.profile].any);
      expect(text, frame.id).not.toMatch(AGREEMENT[frame.profile].never);
      let at = -1;
      for (const key of profile.numbers) {
        expect(frame.text.split(key).length - 1, `${frame.id} ${key}`).toBe(1);
        expect(frame.text.indexOf(key), `${frame.id} order`).toBeGreaterThan(
          at,
        );
        at = frame.text.indexOf(key);
      }
      for (const slot of frame.text.match(/\{[a-zA-Z]+\}/g) ?? [])
        expect([
          ...profile.numbers,
          ...profile.slots.map((s) => `{${s}}`),
        ]).toContain(slot);
      expect(frame.text).toContain("{name}");
      expect(frame.text).toContain("{item}");
      // No pronouns: names never need one (R-126). No number words in the fixed wording either.
      const fixed = tokens(frame.text.replace(/\{[a-zA-Z]+\}/g, " "));
      for (const w of ["he", "she", "his", "her", "him", "they", "their"])
        expect(fixed, frame.id).not.toContain(w);
      expect(
        fixed.filter((w) => NUMBER_WORDS.includes(w)),
        frame.id,
      ).toEqual([]);
    }
  });

  it("renders every frame with sampled slot combinations and leaves no placeholder", () => {
    for (const frame of STORY_FRAMES) {
      const profile = STORY_PROFILES[frame.profile];
      const items = ITEMS[profile.item];
      for (let i = 0; i < NAMES.length; i++) {
        const slots = {
          name: NAMES[i],
          item: items[i % items.length],
          ...(profile.slots.includes("place")
            ? { place: PLACES[i % PLACES.length] }
            : {}),
          ...(profile.slots.includes("unit") ? { unit: profile.units[0] } : {}),
        };
        const text = renderStory(
          { frame, slots },
          sampleNumbers[frame.profile],
        );
        expect(text).not.toMatch(/[{}]/);
        expect(text).toContain(NAMES[i]);
        expect(text[0]).toBe(text[0].toUpperCase());
        // Digits only from the generator's numbers.
        let rest = text;
        for (const v of Object.values(sampleNumbers[frame.profile]))
          rest = rest.replace(v, "");
        expect(rest).not.toMatch(/\d/);
      }
    }
    const frame = STORY_FRAMES[0];
    expect(() =>
      renderStory(
        { frame, slots: { name: "Bob", item: "beads" } },
        sampleNumbers[frame.profile],
      ),
    ).toThrow();
    expect(() =>
      renderStory({ frame, slots: { name: NAMES[0], item: "beads" } }, {}),
    ).toThrow();
  });

  it("selection is deterministic by key and varies across keys", () => {
    for (const id of Object.keys(STORY_PROFILES) as StoryProfileId[]) {
      expect(selectStory(id, 12345)).toEqual(selectStory(id, 12345));
      const seen = new Set<string>();
      for (let key = 0; key < 200; key++) {
        const s = selectStory(id, key * 2654435761);
        seen.add(`${s.frame.id}|${s.slots.name}|${s.slots.item}`);
        expect(s.frame.profile).toBe(id);
      }
      expect(seen.size).toBeGreaterThan(100);
    }
  });

  it("variants change only wording: numbers and answers match the frame-free build", () => {
    for (const id of [
      "p4-estimate-by-rounding",
      "p4-fraction-of-quantity",
      "p4-decimal-practice",
    ]) {
      const source = packages.find((p) => p.lesson.id === id)!;
      const run = createVariantRun(source, 31337)!;
      const stories = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const next = run.next();
        if (next.status !== "ready") throw new Error(id);
        const l = next.package.lesson;
        stories.add(l.story.replace(/[\d\u00a0 .]+/g, "#"));
        // The story's numbers are exactly the specification's, so the model answers are unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- oracle reads spec fields
        const spec = l.specification as Record<string, any>;
        const shown = (l.story.match(/\d[\d\u00a0]*(?:\.\d+)?/g) ?? []).map(
          (n) => n.replace(/\u00a0/g, ""),
        );
        if (id === "p4-estimate-by-rounding")
          expect(shown).toEqual([spec.n, spec.m, spec.roundTo].map(String));
        else if (id === "p4-fraction-of-quantity")
          expect(shown).toEqual([spec.quantity, spec.denominator].map(String));
        else
          expect(shown.map(Number)).toEqual([
            spec.a.coefficient / 10 ** spec.a.scale,
            spec.factor,
            spec.b.coefficient / 10 ** spec.b.scale,
          ]);
      }
      expect(stories.size).toBeGreaterThan(3);
    }
  });
});
