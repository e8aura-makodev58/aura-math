import { describe, expect, it } from "vitest";
import rawIndex from "../content/library.json";
import releaseManifest from "../release/manifest.json";
import { packages } from "../src/content/lessons";
import { validatePackage } from "../src/content/package-validation";
import { createAuthorModel, createTemplate } from "../src/authoring/model";
import { allTopicForms } from "../src/authoring/registry";
import {
  buildLibraryRecords,
  pruneLibraryIndex,
  validateLibraryIndex,
} from "../src/library/catalogue";
import { digest } from "../src/content-release";
import {
  verifyReleasedLibrary,
  type ReleasedPackage,
} from "../src/released-content";
const index = validateLibraryIndex(rawIndex);
async function entry(id: string): Promise<ReleasedPackage> {
  const payload = packages.find((p) => p.lesson.id === id)!;
  return {
    id,
    version: payload.lesson.version,
    digest: await digest(payload),
    payload,
  };
}
describe("library/topic integration and legacy compatibility", () => {
  it("binds distinct learner copy, rejects unsafe blurbs and prunes unavailable copy", async () => {
    const records = buildLibraryRecords(packages, index);
    expect(releaseManifest.library.digest).toBe(await digest(index));
    expect(records).toHaveLength(index.lessons.length);
    expect(new Set(index.topics.map((t) => t.description)).size).toBe(
      index.topics.length,
    );
    expect(new Set(records.map((r) => r.blurb)).size).toBe(
      index.lessons.length,
    );
    expect(records.every((r) => r.blurb && r.topicDescription)).toBe(true);
    const revised = structuredClone(index);
    revised.lessons[0].blurb = "See how these collections fit together.";
    expect(await digest(revised)).not.toBe(await digest(index));
    expect(
      buildLibraryRecords(packages, revised).find(
        (r) => r.lesson.id === revised.lessons[0].lessonId,
      )?.blurb,
    ).toBe(revised.lessons[0].blurb);
    for (const blurb of ["", " ", "x".repeat(301), "<img onerror=alert(1)>"]) {
      const invalid = structuredClone(index);
      invalid.lessons[0].blurb = blurb;
      expect(() => validateLibraryIndex(invalid)).toThrow(/label/);
    }
    const subset = pruneLibraryIndex(index, [packages[0]]);
    expect(subset.lessons[0].blurb).toBe(
      index.lessons.find((l) => l.lessonId === packages[0].lesson.id)?.blurb,
    );
    expect(JSON.stringify(subset)).not.toContain("including a possible tie");
    const legacyIndex = structuredClone(index);
    for (const l of legacyIndex.lessons) delete l.blurb;
    expect(() => validateLibraryIndex(legacyIndex)).not.toThrow();
    expect(
      buildLibraryRecords([packages[0]], legacyIndex)[0].blurb,
    ).toBeUndefined();
  });

  it("keeps all starter forms valid through import and gives each intrinsic metadata", () => {
    for (const [i, form] of allTopicForms().entries()) {
      const p = createTemplate(form.topic, form.id, `contract-${i}`);
      expect(
        validatePackage(p).issues.filter((i) => i.severity === "error"),
      ).toEqual([]);
      expect(p.schemaVersion).toBe(3);
      expect(p.library?.level).toBe(p.lesson.level.slice(0, 2));
    }
  });
  it("promotes a v1 edit once, preserves origin and restores exact v1 on undo", async () => {
    const source = packages[0],
      hash = await digest(source),
      m = createAuthorModel(source);
    expect(m.working).toEqual(source);
    m.beginEdit("title");
    m.patch({ kind: "text", field: "title", value: "Changed" });
    m.patch({ kind: "text", field: "title", value: "Changed twice" });
    m.endEdit();
    expect(m.working.schemaVersion).toBe(3);
    expect(m.working.lesson.version).toBe(source.lesson.version + 1);
    expect(m.working.library?.skillId).toBe("comparison-larger");
    expect(await digest(m.origin)).toBe(hash);
    expect(validatePackage(m.working).package).toEqual(m.working);
    m.undo();
    expect(m.working).toEqual(source);
    m.redo();
    expect(m.working.schemaVersion).toBe(3);
  });
  it("repairs model-valid fraction choice dependencies atomically, retaining invalid input until repaired", () => {
    const m = createAuthorModel(
      createTemplate("fractions", "name-the-fraction", "fraction-contract"),
    );
    m.patch({ kind: "topic", key: "a.numerator", value: "2" });
    m.applyWording();
    expect(m.canUseCandidate).toBe(true);
    const valid = m.lastValid;
    m.patch({ kind: "topic", key: "a.denominator", value: "" });
    expect(m.canUseCandidate).toBe(false);
    expect(m.lastValid).toEqual(valid);
    expect(() => m.applyWording()).toThrow();
    m.patch({ kind: "topic", key: "a.denominator", value: "3" });
    m.applyWording();
    expect(validatePackage(m.working).package).toEqual(m.working);
    expect(m.canUseCandidate).toBe(true);
  });
  it("rejects mixed level metadata, v1 extension fields and unsupported schemas", () => {
    const p = createTemplate("place-value", "read-model", "level-contract");
    p.lesson.level = "P3 candidate";
    expect(validatePackage(p).package).toBeUndefined();
    const legacy = structuredClone(packages[0]);
    legacy.library = { level: "P2", skillId: "comparison-larger", tags: [] };
    expect(validatePackage(legacy).package).toBeUndefined();
    expect(validatePackage({ ...p, schemaVersion: 4 }).package).toBeUndefined();
  });
  it("rejects duplicated groups, wrong units and wrong given/derived states after model edits", () => {
    for (const form of ["total", "each", "groups"]) {
      const m = createAuthorModel(
        createTemplate("equal-groups", form, `groups-${form}`),
      );
      m.patch({ kind: "topic", key: "groupCount", value: "4" });
      m.applyWording();
      const p = m.working;
      expect(p.interpretation!.quantities[0].state).toBe(
        form === "groups" ? "derived" : "given",
      );
      expect(p.interpretation!.quantities[1].state).toBe(
        form === "total" ? "derived" : "given",
      );
      const duplicate = structuredClone(p);
      duplicate.interpretation!.quantities = [
        p.interpretation!.quantities[1],
        p.interpretation!.quantities[1],
      ];
      expect(validatePackage(duplicate).package).toBeUndefined();
      const units = structuredClone(p);
      units.interpretation!.quantities[1].unit = "kilograms";
      expect(validatePackage(units).package).toBeUndefined();
      const states = structuredClone(p);
      states.interpretation!.quantities[0].state = "incorrect";
      expect(validatePackage(states).package).toBeUndefined();
    }
  });
  it("prunes a mixed approved subset, preserves order and exposes no draft-only library skills", async () => {
    const entries = await Promise.all(
      ["ribbon-collection", "read-the-key"].map(entry),
    );
    const subset = pruneLibraryIndex(
      index,
      entries.map((e) => e.payload),
    );
    const library = {
      index: subset,
      digest: await digest(subset),
      sourceDigest: await digest(index),
    };
    await expect(
      verifyReleasedLibrary(library, entries),
    ).resolves.toBeUndefined();
    const records = buildLibraryRecords(
      entries.map((e) => e.payload),
      subset,
    );
    expect(records.map((r) => r.lesson.id).sort()).toEqual([
      "read-the-key",
      "ribbon-collection",
    ]);
    expect(subset.lessons).toHaveLength(2);
    expect(subset.topics).toHaveLength(2);
    expect(JSON.stringify(subset)).not.toContain("sharing-equally");
    const forged = structuredClone(subset);
    forged.topics[0].skills.push({
      id: "hidden-draft-skill",
      label: "A hidden draft skill",
    });
    await expect(
      verifyReleasedLibrary(
        { ...library, index: forged, digest: await digest(forged) },
        entries,
      ),
    ).rejects.toThrow();
    await expect(
      verifyReleasedLibrary({ ...library, digest: "edited" }, entries),
    ).rejects.toThrow();
    await expect(
      verifyReleasedLibrary(
        {
          index,
          digest: await digest(index),
          sourceDigest: await digest(index),
        },
        entries,
      ),
    ).rejects.toThrow();
  });
  it("binds reordering independently from lesson digests and rejects cycles/duplicate identities", async () => {
    const changed = structuredClone(index);
    changed.lessons[0].sequence = 100;
    const hash = await digest(packages[0]);
    expect(await digest(changed)).not.toBe(await digest(index));
    expect(await digest(packages[0])).toBe(hash);
    const cycle = structuredClone(index);
    cycle.lessons[0].prerequisites = [cycle.lessons[0].skillId];
    expect(() => validateLibraryIndex(cycle)).toThrow(/Cyclic/);
    expect(() =>
      buildLibraryRecords([packages[0], packages[0]], index),
    ).toThrow(/Duplicate/);
  });
});
