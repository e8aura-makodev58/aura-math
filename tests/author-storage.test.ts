// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { packages } from "../src/content/lessons";
import {
  claimDraft,
  deleteDraft,
  listDrafts,
  loadDraft,
  saveDraft,
  DRAFT_PREFIX,
} from "../src/authoring/storage";
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "locks", {
    value: undefined,
    configurable: true,
  });
  vi.restoreAllMocks();
});
function locks() {
  const held = new Set<string>();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        name: string,
        optionsOrCallback: unknown,
        supplied?: (lock: unknown) => unknown,
      ) => {
        const callback = (
          typeof optionsOrCallback === "function" ? optionsOrCallback : supplied
        ) as (lock: unknown) => unknown;
        if (held.has(name)) return callback(null);
        held.add(name);
        try {
          return await callback({ name });
        } finally {
          held.delete(name);
        }
      },
    },
  });
}
describe("local author draft storage", () => {
  it("saves and reloads exact bounded packages; fallback makes separate records", async () => {
    const first = await saveDraft(packages[0], packages[0]);
    const changed = structuredClone(packages[0]);
    changed.lesson.title = "Changed";
    const second = await saveDraft(changed, packages[0], first.id);
    expect(second.id).not.toBe(first.id);
    expect(loadDraft(first.id)?.payload).toEqual(packages[0]);
    expect(loadDraft(second.id)?.origin).toEqual(packages[0]);
    expect(listDrafts()).toHaveLength(2);
    deleteDraft(second.id);
    expect(listDrafts()).toHaveLength(1);
  });
  it("continues in place only while exclusively claimed and rejects a second claim", async () => {
    locks();
    const saved = await saveDraft(packages[0], packages[0]);
    const release = await claimDraft(saved.id);
    expect(release).not.toBeNull();
    expect(await claimDraft(saved.id)).toBeNull();
    const changed = structuredClone(packages[0]);
    changed.lesson.title = "Continuing";
    expect((await saveDraft(changed, packages[0], saved.id)).id).toBe(saved.id);
    expect(listDrafts()).toHaveLength(1);
    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = await claimDraft(saved.id);
    expect(next).not.toBeNull();
    next!();
  });
  it("does not evict records at the limit or write invalid packages", async () => {
    for (let i = 0; i < 10; i++) await saveDraft(packages[0], packages[0]);
    await expect(saveDraft(packages[0], packages[0])).rejects.toThrow(
      "Ten drafts",
    );
    expect(listDrafts()).toHaveLength(10);
    const invalid = structuredClone(packages[0]);
    invalid.lesson.steps[1].answer = 999;
    await expect(saveDraft(invalid, packages[0])).rejects.toThrow(
      "Fix draft errors",
    );
    expect(listDrafts()).toHaveLength(10);
  });
  it("keeps corruption intact and surfaces read/write failures", async () => {
    localStorage.setItem(DRAFT_PREFIX + "corrupt", "{broken");
    expect(() => listDrafts()).toThrow("could not be read");
    await expect(saveDraft(packages[0], packages[0])).rejects.toThrow(
      "could not be saved",
    );
    expect(localStorage.getItem(DRAFT_PREFIX + "corrupt")).toBe("{broken");
    localStorage.clear();
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    await expect(saveDraft(packages[0], packages[0])).rejects.toThrow(
      "could not be saved",
    );
    write.mockRestore();
    const read = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(() => loadDraft("known-id")).toThrow("could not be read");
    read.mockRestore();
  });
});
