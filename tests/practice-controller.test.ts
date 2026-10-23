import { describe, expect, it } from "vitest";
import { createPracticeJournal } from "../src/practice/controller";
import { createSession, useHint, switchMode } from "../src/core/runtime";
import { lessons } from "../src/content/lessons";
import { adapters } from "../src/topics/registry";

const source = lessons.find(
  (lesson) => lesson.id === "p4-decimal-add-subtract",
)!;
const session = () => createSession(source, adapters.decimals);

describe("temporary practice evidence", () => {
  it("upserts completion and later support without double counting", () => {
    const journal = createPracticeJournal();
    journal.begin({ sourceId: source.id, lessonId: source.id });
    const complete = { ...session(), completed: true };
    journal.record(complete, "completed");
    journal.record(complete, "completed");
    journal.record({ ...complete, hadSupport: true }, "exit");
    expect(journal.getSummaries()).toHaveLength(1);
    expect(journal.getSummaries()[0]).toMatchObject({
      label: "Completed with support",
      reason: "exit",
    });
    expect(journal.getSummaries()[0].variant).toBeUndefined();
  });

  it("retains supported attempts while a new variant starts clean", () => {
    const journal = createPracticeJournal();
    journal.begin({ sourceId: source.id, lessonId: source.id });
    const supported = switchMode(useHint(session()), "guided");
    journal.record({ ...supported, completed: true }, "completed");
    journal.begin({
      sourceId: source.id,
      lessonId: "fresh-instance",
      variant: {
        seed: 17,
        profileId: "subtraction",
        generatorVersion: "test-v1",
        ordinal: 1,
        fingerprint: "814:370",
      },
    });
    journal.record(
      { ...session(), lessonId: "fresh-instance", completed: true },
      "next",
    );
    const summaries = journal.getSummaries();
    expect(summaries.map((item) => item.label)).toEqual([
      "Completed with facilitator",
      "Completed without app support",
    ]);
    expect(summaries[0].hintsUsed).toBe(1);
    expect(summaries[1].hintsUsed).toBe(0);
    expect(summaries[1].variant?.fingerprint).toBe("814:370");
  });

  it("rejects stale sessions and marks explicit same-example restarts", () => {
    const journal = createPracticeJournal();
    expect(journal.record(session(), "exit")).toBeNull();
    journal.begin({ sourceId: source.id, lessonId: source.id });
    journal.record(useHint(session()), "restart");
    journal.begin({ sourceId: source.id, lessonId: source.id }, true);
    expect(
      journal.record({ ...session(), lessonId: "discarded" }, "completed"),
    ).toBeNull();
    journal.record(session(), "exit");
    expect(journal.getSummaries().map((item) => item.repeatedExample)).toEqual([
      false,
      true,
    ]);
    expect(journal.getSummaries()[0].hadSupport).toBe(true);
  });

  it("bounds evidence and returns defensive copies", () => {
    const journal = createPracticeJournal();
    for (let index = 0; index < 25; index++) {
      journal.begin({ sourceId: source.id, lessonId: source.id });
      journal.record(session(), "exit");
    }
    const snapshots = journal.getSummaries();
    expect(snapshots).toHaveLength(20);
    expect(snapshots[0].attemptId).toBe(6);
    snapshots[0].hadSupport = true;
    expect(journal.getSummaries()[0].hadSupport).toBe(false);
    const active = journal.getActive()!;
    active.sourceId = "altered";
    expect(journal.getActive()?.sourceId).toBe(source.id);
  });
});
