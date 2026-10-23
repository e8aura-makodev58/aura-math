import { describe, it, expect } from "vitest";
import { createAuthorModel, createTemplate } from "../src/authoring/model";
import { packages } from "../src/content/lessons";
import { generateBatch } from "../src/content/generation";
import { validatePackage } from "../src/content/package-validation";

describe("visual author model", () => {
  it("updates comparison maths, interpretation and fixtures atomically without rewriting custom text", () => {
    const model = createAuthorModel(packages[0]);
    const story = model.working.lesson.story;
    model.patch({ kind: "comparison", field: "smaller", value: 12 });
    expect(model.working.lesson.specification.larger).toBe(19);
    expect(model.working.lesson.steps[1].answer).toBe(19);
    expect(
      model.working.interpretation!.quantities.map((q) => q.value),
    ).toEqual([19, 12]);
    expect(model.working.fixtures![1].accepted).toEqual([19]);
    expect(model.working.lesson.story).toBe(story);
    expect(model.pending.length).toBeGreaterThan(0);
    expect(model.canUseCandidate).toBe(false);
    expect(
      model
        .proposeWording()
        .some(
          (c) => c.path === "$.lesson.story" && c.after.includes("12 ribbons"),
        ),
    ).toBe(true);
    model.applyWording();
    expect(model.working.lesson.story).toContain("12 ribbons");
    expect(model.working.lesson.steps[1].hints[3]).toContain("Enter 19.");
    expect(model.canUseCandidate).toBe(true);
    model.undo();
    expect(model.working.lesson.story).toBe(story);
    expect(model.pending.length).toBeGreaterThan(0);
    model.undo();
    expect(model.working).toEqual(packages[0]);
    expect(model.pending).toEqual([]);
    expect(model.dirty).toBe(false);
  });
  it("stages unknown-position changes until explicit coherent wording application", () => {
    const model = createAuthorModel(packages[0]);
    model.patch({ kind: "comparison", field: "unknown", value: "smaller" });
    expect(model.lastValid.lesson.specification.unknown).toBe("larger");
    expect(model.working.lesson.specification.unknown).toBe("smaller");
    expect(() => model.acknowledge("$.lesson.specification.unknown")).toThrow();
    model.applyWording();
    expect(model.lastValid.lesson.specification.unknown).toBe("smaller");
    expect(model.lastValid.lesson.story).toBe(
      "Maya has 18 ribbons. Maya has 7 more ribbons than Zac. How many ribbons does Zac have?",
    );
    expect(model.lastValid.lesson.steps[1].answer).toBe(11);
    expect(model.lastValid.lesson.steps[1].hints[1]).toContain(
      "Take the known part",
    );
  });
  it("retains invalid partial input and last valid canvas then recovers without caret coercion", async () => {
    const model = createAuthorModel(packages[0]);
    model.patch({ kind: "comparison", field: "difference", value: "-" });
    expect(model.comparisonDifference).toBe("-");
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    expect(model.lastValid).toEqual(packages[0]);
    expect(model.canUseCandidate).toBe(false);
    expect(await model.report()).toHaveProperty("validation");
    model.patch({ kind: "comparison", field: "difference", value: "8" });
    expect(model.working.lesson.specification.larger).toBe(19);
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    model.patch({ kind: "comparison", field: "difference", value: 100 });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    expect(model.lastValid.lesson.specification.larger).toBe(19);
  });
  it("retains invalid angle count and derives classify answers/reveals from edited model", () => {
    const model = createAuthorModel(packages[3]);
    model.patch({ kind: "angle", cardId: "B", field: "degrees", value: 80 });
    expect(
      (model.working.lesson.specification.angles as { degrees: number }[])[1]
        .degrees,
    ).toBe(80);
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    expect(model.lastValid.lesson.steps[0].answer).toBe("B");
    model.patch({ kind: "angle", cardId: "A", field: "degrees", value: 90 });
    expect(model.working.lesson.steps[0].answer).toBe("A");
    expect(model.working.lesson.steps[0].hints[3]).toBe(
      "Card A is a right angle. Choose A.",
    );
    const classify = createAuthorModel(packages[4]);
    classify.patch({ kind: "angle", cardId: "A", field: "degrees", value: 90 });
    expect(classify.working.lesson.steps[0].answer).toBe("right");
    expect(classify.working.lesson.steps[0].hints[3]).toBe(
      "Choose: Exactly a right angle.",
    );
    classify.applyWording();
    expect(classify.canUseCandidate).toBe(true);
  });
  it("coalesces focused typing and atomically restores version authors provenance and checklist", () => {
    const original = generateBatch(1)[0],
      model = createAuthorModel(original);
    model.setContributor("teacher-lee");
    model.beginEdit("story");
    model.patch({ kind: "text", field: "story", value: "My" });
    model.patch({ kind: "text", field: "story", value: "My own wording." });
    model.endEdit();
    expect(model.working.provenance).toEqual({ kind: "authored" });
    expect(model.working.authors).toContain("Codex");
    expect(model.working.authors).toContain("teacher-lee");
    expect(model.working.lesson.version).toBe(2);
    expect(model.origin).toEqual(original);
    model.undo();
    expect(model.working).toEqual(original);
    model.redo();
    expect(model.working.lesson.story).toBe("My own wording.");
    expect(model.working.lesson.version).toBe(2);
    model.patch({ kind: "text", field: "title", value: "Again" });
    expect(model.working.lesson.version).toBe(2);
    expect(() => model.setContributor("Codex")).toThrow();
  });
  it("retains original provenance and reports author assertions rather than review approval", async () => {
    const original = generateBatch(3)[0],
      model = createAuthorModel(original);
    model.patch({ kind: "comparison", field: "unit", value: "beads" });
    for (const f of model.pending) model.acknowledge(f.path);
    const report = (await model.report()) as {
      originDigest: string;
      workingDigest: string;
      changedBlocks: string[];
      assertions: { acknowledgedAt?: string }[];
      assertionMeaning: string;
    };
    expect(report.originDigest).not.toBe(report.workingDigest);
    expect(report.changedBlocks).toContain("$.lesson.version");
    expect(report.assertions.every((f) => !!f.acknowledgedAt)).toBe(true);
    expect(report.assertionMeaning).toContain(
      "not independent review approval",
    );
  });
  it("supports all text regions reflection keys stable choice order and new forms without JSON", () => {
    const model = createAuthorModel(packages[0]);
    model.patch({
      kind: "text",
      field: "stepTitle",
      stepIndex: 1,
      value: "Calculate",
    });
    model.patch({
      kind: "text",
      field: "prompt",
      stepIndex: 1,
      value: "What amount?",
    });
    model.patch({
      kind: "text",
      field: "choice",
      stepIndex: 2,
      choiceId: "reason",
      value: "My explanation",
    });
    for (let rung = 0; rung < 4; rung++)
      model.patch({
        kind: "text",
        field: "hint",
        stepIndex: 1,
        hintIndex: rung,
        value: `Hint ${rung}`,
      });
    model.patch({
      kind: "reorder",
      stepIndex: 2,
      choiceId: "reason",
      direction: 1,
    });
    expect(model.working.lesson.steps[2].choices![1].id).toBe("reason");
    model.patch({ kind: "reflectionAnswer", choiceId: "distractor" });
    expect(model.working.lesson.steps[2].answer).toBe("distractor");
    for (const [topic, form] of [
      ["comparison", "difference"],
      ["angles", "select"],
    ] as const) {
      const p = createTemplate(topic, form, `new-${form}`);
      expect(validatePackage(p).package).toBeDefined();
      const fresh = createAuthorModel(p, undefined, { isNew: true });
      fresh.patch({ kind: "text", field: "title", value: "New title" });
      expect(fresh.working.lesson.version).toBe(1);
    }
  });
  it("bounds undo history at thirty snapshots", () => {
    const model = createAuthorModel(packages[0]);
    for (let i = 0; i < 35; i++)
      model.patch({ kind: "text", field: "title", value: `Title ${i}` });
    let count = 0;
    while (model.canUndo) {
      model.undo();
      count++;
    }
    expect(count).toBe(30);
  });
});

describe("author report safety and template compatibility", () => {
  it("reports incomplete noncanonical input with no candidate digest", async () => {
    const model = createAuthorModel(packages[0]);
    model.patch({
      kind: "text",
      field: "title",
      value: undefined as unknown as string,
    });
    const report = (await model.report()) as {
      workingDigest: null;
      digestErrors: string[];
    };
    expect(report.workingDigest).toBeNull();
    expect(report.digestErrors.length).toBeGreaterThan(0);
    expect(model.dirty).toBe(true);
    model.undo();
    expect(model.working).toEqual(packages[0]);
  });
  it("warns about stale model numbers without rejecting coincident known values", () => {
    const model = createAuthorModel(packages[0]);
    model.patch({ kind: "comparison", field: "smaller", value: 12 });
    expect(
      model.issues.some((i) => i.message.includes("outside the current model")),
    ).toBe(true);
    model.applyWording();
    expect(
      model.issues.some((i) => i.message.includes("outside the current model")),
    ).toBe(false);
    model.patch({ kind: "comparison", field: "smaller", value: 7 });
    model.patch({ kind: "comparison", field: "unknown", value: "difference" });
    model.applyWording();
    expect(model.lastValid.lesson.story).toContain("7 ribbons");
    expect(
      model.issues.some((i) => i.message.includes("outside the current model")),
    ).toBe(false);
  });
  it("retains generator deterministic payloads while sharing wording utilities", () => {
    const raw = import.meta.glob("../content/generated/generated-1-*.json", {
      eager: true,
      import: "default",
    });
    const byId = new Map(
      Object.values(raw).map((value) => {
        const p = value as (typeof packages)[number];
        return [p.lesson.id, p];
      }),
    );
    for (const p of generateBatch(1)) expect(p).toEqual(byId.get(p.lesson.id));
  });
  it("keeps loaded baseline version separate from historical origin", async () => {
    const first = createAuthorModel(packages[0]);
    first.patch({ kind: "text", field: "title", value: "First revision" });
    const next = createAuthorModel(first.working, first.origin);
    next.patch({ kind: "text", field: "title", value: "Second revision" });
    expect(next.working.lesson.version).toBe(3);
    expect(next.origin).toEqual(packages[0]);
    next.undo();
    expect(next.working.lesson.version).toBe(2);
  });
});
