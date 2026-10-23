/**
 * Phase B3: adult-approved story slot sets mixed into "Try another" for the three framed profiles.
 * Mechanical checks only: determinism, fallback, and that numbers and answers never change.
 */
import { describe, expect, it } from "vitest";
import { packages } from "../src/content/lessons";
import { createVariantRun } from "../src/practice/generation";
import {
  parseApprovedSets,
  type ApprovedSlotSet,
} from "../src/content/story-slots";

const APPROVED: ApprovedSlotSet[] = [
  {
    id: "aaaaaaaaaaaaaaaa",
    profile: "fraction-share",
    slots: { name: "Siti", item: "toy cars", place: "sports hall" },
  },
  {
    id: "bbbbbbbbbbbbbbbb",
    profile: "fraction-share",
    slots: { name: "Arjun", item: "paper boats", place: "school garden" },
  },
  {
    id: "cccccccccccccccc",
    profile: "decimal-pieces-left",
    slots: { name: "Grace", item: "yarn" },
  },
  {
    id: "dddddddddddddddd",
    profile: "whole-estimate-add",
    slots: { name: "Ravi", item: "postcards", place: "void deck" },
  },
];
const SOURCES = {
  "p4-fraction-of-quantity": "fraction-share",
  "p4-decimal-practice": "decimal-pieces-left",
  "p4-estimate-by-rounding": "whole-estimate-add",
} as const;

function take(
  id: string,
  seed: number,
  approved?: readonly ApprovedSlotSet[],
  count = 30,
) {
  const source = packages.find((p) => p.lesson.id === id)!;
  const run = createVariantRun(source, seed, approved)!;
  const out = [];
  for (let i = 0; i < count; i++) {
    const next = run.next();
    if (next.status !== "ready") break;
    const lesson = next.package.lesson;
    out.push({
      story: lesson.story,
      prompt: lesson.steps[0].prompt,
      fingerprint: next.descriptor.fingerprint,
      approvedStoryId: next.descriptor.approvedStoryId,
      // Every specification field except the unit, which carries the story's item.
      numbers: Object.fromEntries(
        Object.entries(lesson.specification).filter(([key]) => key !== "unit"),
      ),
      answers: lesson.steps.map((step) =>
        step.kind === "choice"
          ? step.choices!.find((c) => c.id === step.answer)?.label
          : step.answer,
      ),
    });
  }
  return out;
}

describe("approved story slot sets in variants", () => {
  it("without approved sets for a profile the output is exactly the built-in output", () => {
    for (const id of Object.keys(SOURCES)) {
      const plain = take(id, 4242);
      expect(take(id, 4242, [])).toEqual(plain);
      // Sets for other profiles only: unchanged.
      const others = APPROVED.filter(
        (set) => set.profile !== SOURCES[id as keyof typeof SOURCES],
      );
      expect(take(id, 4242, others)).toEqual(plain);
      expect(plain.every((v) => v.approvedStoryId === undefined)).toBe(true);
      // A failed or malformed fetch falls back to the same built-in output.
      expect(take(id, 4242, parseApprovedSets({ sets: "x" }))).toEqual(plain);
    }
  });

  it("uses approved sets deterministically given the seed and the approved snapshot, in any order", () => {
    for (const id of Object.keys(SOURCES)) {
      const first = take(id, 99, APPROVED);
      expect(take(id, 99, APPROVED)).toEqual(first);
      expect(take(id, 99, [...APPROVED].reverse())).toEqual(first);
      const used = first.filter((v) => v.approvedStoryId);
      expect(used.length, id).toBeGreaterThan(0);
      expect(used.length, id).toBeLessThan(first.length);
      for (const variant of used) {
        const set = APPROVED.find((s) => s.id === variant.approvedStoryId)!;
        expect(set.profile).toBe(SOURCES[id as keyof typeof SOURCES]);
        expect(variant.story).toContain(set.slots.name!);
        expect(variant.story).toContain(set.slots.item!);
        if (set.slots.place) expect(variant.story).toContain(set.slots.place);
      }
    }
  });

  it("never changes a number, an answer or the order of examples", () => {
    for (const id of Object.keys(SOURCES)) {
      const plain = take(id, 2026);
      const mixed = take(id, 2026, APPROVED);
      expect(mixed.map((v) => v.fingerprint)).toEqual(
        plain.map((v) => v.fingerprint),
      );
      expect(mixed.map((v) => v.numbers)).toEqual(plain.map((v) => v.numbers));
      expect(mixed.map((v) => v.answers)).toEqual(plain.map((v) => v.answers));
      // Digits in the story come only from the specification.
      for (let i = 0; i < mixed.length; i++)
        expect(mixed[i].story.match(/\d+/g)).toEqual(
          plain[i].story.match(/\d+/g),
        );
      // Variants that did not use an approved set are byte-identical.
      for (let i = 0; i < mixed.length; i++)
        if (!mixed[i].approvedStoryId) expect(mixed[i]).toEqual(plain[i]);
    }
  });

  it("an approved decimal set keeps the fixed unit and fills the first prompt too", () => {
    const mixed = take("p4-decimal-practice", 7, APPROVED);
    const used = mixed.find((v) => v.approvedStoryId);
    expect(used).toBeDefined();
    expect(used!.story).toContain(" m of yarn");
    expect(used!.prompt).toBe(used!.story);
  });
});

describe("story frames with approved extras", () => {
  it("accept extra items and places for one render, never extra names", async () => {
    const { renderStory, STORY_FRAMES } =
      await import("../src/content/story-frames");
    const frame = STORY_FRAMES.find((f) => f.profile === "fraction-share")!;
    const numbers = { "{quantity}": "24", "{denominator}": "4" };
    const slots = { name: "Siti", item: "toy cars", place: "void deck" };
    expect(() => renderStory({ frame, slots }, numbers)).toThrow();
    expect(
      renderStory({ frame, slots }, numbers, {
        item: ["toy cars"],
        place: ["void deck"],
      }),
    ).toContain("toy cars");
    expect(() =>
      renderStory(
        { frame, slots: { ...slots, name: "Bob" } },
        numbers,
        // Names are not an accepted extra.
        { item: ["toy cars"], place: ["void deck"] },
      ),
    ).toThrow();
  });
});
