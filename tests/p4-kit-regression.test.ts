/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { symmetryAuthor } from "../src/authoring/symmetry";
import { p4Package } from "../src/topics/p4-kit";

const saved = import.meta.glob("../content/lessons/p4-*.json", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

// Guards the shared kit: re-emitting an existing family's starters must give exactly the saved
// data files, so any change to `p4Package` that alters default output is caught here.
describe("p4 kit regression", () => {
  for (const form of symmetryAuthor.forms)
    it(`${form.id}: the starter re-emits byte-identically to the saved file`, () => {
      const emitted =
        JSON.stringify(symmetryAuthor.template(form.id, form.id), null, 2) +
        "\n";
      const file = Object.entries(saved).find(([path]) =>
        path.endsWith(`/${form.id}.json`),
      );
      expect(file, `saved file for ${form.id}`).toBeDefined();
      expect(emitted).toBe(file![1]);
    });

  it("sources and extra tags are used only when given", () => {
    const base = symmetryAuthor.template("p4-symmetry-practice", "x");
    const options = {
      lesson: base.lesson,
      form: "p4-symmetry-practice",
      family: "symmetry",
      author: "t",
      taskLabel: "practice",
      specErrors: () => [],
    };
    const plain = p4Package(options);
    expect(plain.library!.tags).toEqual(["P4", "symmetry", "general revision"]);
    const custom = p4Package({
      ...options,
      sources: ["https://example.org/a"],
      extraTags: ["level-unconfirmed"],
    });
    expect(custom.library!.tags).toEqual([
      "P4",
      "symmetry",
      "general revision",
      "level-unconfirmed",
    ]);
    expect(custom.curriculum!.sources).toEqual(["https://example.org/a"]);
  });
});
