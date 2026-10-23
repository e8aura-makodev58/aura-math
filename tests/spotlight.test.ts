import { describe, expect, it } from "vitest";
import { dayNumber, pickSpotlight } from "../src/library/spotlight";
import type { LibraryRecord } from "../src/library/catalogue";

function record(topic: string, sequence: number, level = "P4"): LibraryRecord {
  return {
    lesson: { id: `${topic}-${sequence}` } as LibraryRecord["lesson"],
    level: level as LibraryRecord["level"],
    strand: "Numbers and operations",
    topic: topic as LibraryRecord["topic"],
    topicLabel: topic,
    skillId: `${topic}-${sequence}`,
    skillLabel: `${topic} ${sequence}`,
    sequence,
    prerequisites: [],
    tags: [],
  };
}
const catalogue = (topics: string[], perTopic = 3) =>
  topics.flatMap((t) =>
    Array.from({ length: perTopic }, (_, i) => record(t, i + 1)),
  );
const on = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h, 30);

describe("daily spotlight", () => {
  it("gives the same lesson for the same date, whatever the time of day or input order", () => {
    const records = catalogue(["b", "a", "c"]);
    const reversed = [...records].reverse();
    const first = pickSpotlight(records, on(2026, 10, 6, 0));
    expect(pickSpotlight(records, on(2026, 10, 6, 23))?.lesson.id).toBe(
      first?.lesson.id,
    );
    expect(pickSpotlight(reversed, on(2026, 10, 6, 9))?.lesson.id).toBe(
      first?.lesson.id,
    );
  });

  it("changes topic every day and eventually shows every lesson", () => {
    const records = catalogue(["a", "b", "c", "d"], 3);
    const seen = new Set<string>();
    let previous = "";
    for (let i = 0; i < 4 * 3 * 2; i++) {
      const pick = pickSpotlight(records, on(2026, 3, 1 + i))!;
      expect(pick.topic).not.toBe(previous);
      previous = pick.topic;
      seen.add(pick.lesson.id);
    }
    expect(seen.size).toBe(records.length);
  });

  it("advances on the local calendar date, so midnight in the learner's own timezone changes it", () => {
    const a = new Date(2026, 5, 10, 23, 59, 59);
    const b = new Date(2026, 5, 11, 0, 0, 1);
    expect(dayNumber(b) - dayNumber(a)).toBe(1);
    expect(dayNumber(new Date(2026, 5, 10, 0, 0, 0))).toBe(dayNumber(a));
  });

  it("handles one lesson, one topic, no lessons, and dates before 1970", () => {
    expect(pickSpotlight([], on(2026, 1, 1))).toBeUndefined();
    const single = catalogue(["only"], 1);
    expect(pickSpotlight(single, on(2026, 1, 1))?.lesson.id).toBe("only-1");
    expect(pickSpotlight(single, on(1969, 12, 31))?.lesson.id).toBe("only-1");
    const oneTopic = catalogue(["t"], 3);
    expect(
      new Set(
        [0, 1, 2, 3].map(
          (i) => pickSpotlight(oneTopic, on(1969, 12, 28 + i))?.lesson.id,
        ),
      ).size,
    ).toBe(3);
  });

  it("only ever picks from the lessons it is given", () => {
    const subset = [record("x", 1), record("y", 2)];
    for (let i = 0; i < 20; i++)
      expect(["x-1", "y-2"]).toContain(
        pickSpotlight(subset, on(2026, 4, 1 + i))!.lesson.id,
      );
  });
});
