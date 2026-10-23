// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountAuthor } from "../src/author";
import { packages } from "../src/content/lessons";
import {
  MAX_PACKAGE_BYTES,
  parsePackage,
} from "../src/content/package-validation";
let root: HTMLElement;
let author: ReturnType<typeof mountAuthor>;
const click = (action: string) => {
  const button = root.querySelector<HTMLButtonElement>(
    `[data-action="${action}"]`,
  );
  if (!button) throw new Error(`Missing ${action}`);
  button.click();
};
function edit(label: string, value: string) {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field="${label}"]`,
  )!;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}
function select(selector: string, value: string) {
  const input = root.querySelector<HTMLSelectElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  root = document.createElement("main");
  document.body.append(root);
  author = mountAuthor(root);
  root
    .querySelector<HTMLElement>(
      '[data-testid="lesson-card-ribbon-collection"]',
    )!
    .click();
});
afterEach(() => {
  author.destroy();
  vi.restoreAllMocks();
});

describe("visual author workspace", () => {
  it("shows learner canvas, file-only import, and no raw JSON editor", () => {
    expect(root.querySelector("#draft-editor")).toBeNull();
    expect(
      root.querySelector('[data-region="visual"] [role="img"]'),
    ).not.toBeNull();
    expect(root.querySelectorAll("#draft-catalogue option")).toHaveLength(
      packages.filter((p) => !p.library?.tags.includes("example")).length,
    );
    expect(root.textContent).toContain(
      "human mathematical and teaching review",
    );
    expect(parsePackage(author.exportJson()).package).toEqual(
      author.getActive(),
    );
    expect(author.getSession()).toBeNull();
  });
  it("updates lesson text immediately without replacing the focused input or caret", () => {
    click("region-title");
    const input = edit("Lesson title", "A carefully edited title");
    input.setSelectionRange(8, 8);
    expect(root.querySelector('[data-region="title"]')?.textContent).toContain(
      "A carefully edited title",
    );
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(8);
    expect(root.querySelector('[data-field="Lesson title"]')).toBe(input);
    input.blur();
    click("undo");
    expect(author.getActive().lesson.title).toBe(packages[0].lesson.title);
    click("redo");
    expect(author.getActive().lesson.title).toBe("A carefully edited title");
  });
  it("preserves IME composition until compositionend", () => {
    click("region-story");
    const input = root.querySelector<HTMLTextAreaElement>(
      '[data-field="Task wording"]',
    )!;
    input.focus();
    const original = author.getActive().lesson.story;
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    input.value = "A new story";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(author.getActive().lesson.story).toBe(original);
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    expect(author.getActive().lesson.story).toBe("A new story");
    expect(document.activeElement).toBe(input);
  });
  it("keeps invalid model typing visible and shows the last-valid preview", () => {
    click("region-visual");
    const original = author.getActive().lesson.specification.smaller;
    const input = edit("Smaller amount", "");
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(root.textContent).toContain("Preview waiting for valid changes");
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="try"]')!.disabled,
    ).toBe(true);
    expect(() => author.exportJson()).toThrow();
    input.value = String(original);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe(String(original));
  });
  it("changes comparison quantities and applies coherent wording before trial", () => {
    click("region-visual");
    edit("Smaller amount", "12").blur();
    expect(author.getActive().lesson.specification.smaller).toBe(12);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="try"]')!.disabled,
    ).toBe(true);
    click("propose-wording");
    expect(root.textContent).toContain("Proposed wording replacement");
    click("apply-wording");
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="try"]')!.disabled,
    ).toBe(false);
    click("try");
    expect(author.getSession()).not.toBeNull();
    expect(root.querySelector(".author-edit-region")).toBeNull();
    expect(root.querySelector('[data-field="Smaller amount"]')).toBeNull();
    click("edit");
    expect(author.getSession()).toBeNull();
  });
  it("edits choices and each hint while navigating without learner events", () => {
    const step = author.getActive().lesson.steps[0];
    const choiceId = step.choices![0].id;
    click(`region-choice:${choiceId}`);
    edit("Choice wording", "A custom explanation").blur();
    expect(author.getActive().lesson.steps[0].choices![0].label).toBe(
      "A custom explanation",
    );
    click("inspect-hints");
    for (let rung = 1; rung <= 4; rung++) {
      select('[data-field="Hint rung"]', String(rung));
      edit("Hint wording", `Author hint ${rung}`).blur();
      expect(author.getActive().lesson.steps[0].hints[rung - 1]).toBe(
        `Author hint ${rung}`,
      );
    }
    expect(author.getSession()).toBeNull();
  });
  it("creates an angle lesson and keeps broken right-angle counts editable", () => {
    select("#new-form", "identify");
    click("new");
    expect(root.querySelector(".chooser-preview svg")).not.toBeNull();
    click("create-lesson");
    expect(author.getActive().lesson.topic).toBe("angles");
    click("region-visual");
    const cards = author.getActive().lesson.specification.angles as {
      id: string;
      degrees: number;
    }[];
    const right = cards.find((c) => c.degrees === 90)!;
    edit(`Card ${right.id} opening`, "80").blur();
    expect(root.textContent).toContain("Preview waiting for valid changes");
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="try"]')!.disabled,
    ).toBe(true);
    expect(root.textContent).toContain("smaller than a right angle");
    click("undo");
    expect(author.getActive().lesson.version).toBe(1);
  });
  it("keeps active work on invalid imports and renders hostile errors as text", () => {
    const original = author.getActive();
    expect(author.importText("{broken")).toBe(false);
    expect(author.getActive()).toEqual(original);
    const hostile = { ...packages[0], ["<img src=x onerror=alert(1)>"]: true };
    expect(author.importText(JSON.stringify(hostile))).toBe(false);
    expect(author.getActive()).toEqual(original);
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain("Import rejected");
  });
  it("checks file size before reading and handles read failures", async () => {
    const text = vi.fn().mockResolvedValue("{}");
    expect(
      await author.importFile({
        size: MAX_PACKAGE_BYTES + 1,
        text,
      } as unknown as File),
    ).toBe(false);
    expect(text).not.toHaveBeenCalled();
    expect(
      await author.importFile({
        size: 10,
        text: async () => {
          throw Error("denied");
        },
      } as unknown as File),
    ).toBe(false);
    expect(root.textContent).toContain("could not be read");
  });
  it("offers Save, Discard and Stay before replacing unsaved work", () => {
    click("region-title");
    edit("Lesson title", "Unsaved title").blur();
    select("#draft-catalogue", packages[3].lesson.id);
    click("open-source");
    expect(root.querySelector<HTMLElement>('[role="dialog"]')!.hidden).toBe(
      false,
    );
    click("guard-stay");
    expect(author.getActive().lesson.title).toBe("Unsaved title");
    click("open-source");
    click("guard-discard");
    expect(author.getActive().lesson.id).toBe(packages[3].lesson.id);
  });
  it("keeps the in-memory draft and download usable when storage fails", async () => {
    click("region-title");
    edit("Lesson title", "Still in memory").blur();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    click("save");
    await vi.waitFor(() =>
      expect(root.textContent).toContain("could not be saved"),
    );
    expect(parsePackage(author.exportJson()).package?.lesson.title).toBe(
      "Still in memory",
    );
  });
  it("saves and reopens a local edited draft without losing origin identity", async () => {
    click("region-title");
    edit("Lesson title", "Saved visual draft").blur();
    click("save");
    await vi.waitFor(() =>
      expect(root.querySelectorAll("#saved-drafts option").length).toBe(2),
    );
    const savedId = root.querySelectorAll<HTMLOptionElement>(
      "#saved-drafts option",
    )[1].value;
    select("#draft-catalogue", packages[3].lesson.id);
    click("open-source");
    select("#saved-drafts", savedId);
    click("open-saved");
    await vi.waitFor(() =>
      expect(author.getActive().lesson.title).toBe("Saved visual draft"),
    );
  });
});

describe("author material library and panels", () => {
  it("creates a copy with distinct identity and preserves source provenance in the report", async () => {
    const original = author.getActive();
    click("library");
    root
      .querySelectorAll<HTMLButtonElement>(".material-actions button")
      .forEach((b) => {
        if (
          b.textContent === "Create a copy" &&
          b.closest("article")?.dataset.lessonId === original.lesson.id
        )
          b.click();
      });
    expect(author.getActive().lesson.id).not.toBe(original.lesson.id);
    expect(author.getActive().lesson.version).toBe(1);
    expect(
      ((await author.exportReport()) as { origin: { lesson: { id: string } } })
        .origin.lesson.id,
    ).toBe(original.lesson.id);
  });
  it("keeps choice edit buttons outside answer labels", () => {
    expect(root.querySelector("label .author-edit-region")).toBeNull();
    const choice = author.getActive().lesson.steps[0].choices![0];
    click(`region-choice:${choice.id}`);
    expect(root.querySelector('[data-field="Choice wording"]')).not.toBeNull();
  });
  it("opens a phone dialog, preserves input, and returns focus on Escape", () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    click("region-title");
    const inspector = root.querySelector<HTMLElement>(".author-inspector")!;
    expect(inspector.getAttribute("role")).toBe("dialog");
    expect(inspector.getAttribute("aria-modal")).toBe("true");
    const input = edit("Lesson title", "Phone title");
    expect(document.activeElement).toBe(input);
    inspector.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(author.getActive().lesson.title).toBe("Phone title");
    expect(document.activeElement?.getAttribute("data-action")).toBe(
      "region-title",
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
  });
});
