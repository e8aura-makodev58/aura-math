import { describe, expect, it } from "vitest";
import { packages } from "../src/content/lessons";
import { digest } from "../src/content-release";
import { loadReleasedContent } from "../src/released-content";
describe("embedded release runtime integrity", () => {
  it("loads exact verified data and has an explicit empty catalogue", async () => {
    const payload = packages[0];
    const entry = {
      id: payload.lesson.id,
      version: payload.lesson.version,
      digest: await digest(payload),
      payload,
    };
    expect(await loadReleasedContent([entry])).toEqual([payload.lesson]);
    expect(await loadReleasedContent([])).toEqual([]);
  });
  it("rejects payload edits, identity mismatch and duplicate release IDs", async () => {
    const payload = structuredClone(packages[0]);
    const entry = {
      id: payload.lesson.id,
      version: payload.lesson.version,
      digest: await digest(payload),
      payload,
    };
    await expect(
      loadReleasedContent([{ ...entry, id: "other" }]),
    ).rejects.toThrow();
    await expect(loadReleasedContent([entry, entry])).rejects.toThrow();
    payload.lesson.steps[0].hints[0] = "Changed hint";
    await expect(loadReleasedContent([entry])).rejects.toThrow();
  });
});
