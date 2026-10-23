// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import indexData from "../content/library.json";
import { packages } from "../src/content/lessons";
import {
  buildLibraryRecords,
  pruneLibraryIndex,
  validateLibraryIndex,
} from "../src/library/catalogue";
import {
  libraryRoute,
  readLibraryRoute,
  mountLibraryView,
} from "../src/ui/library-view";
import { mountLessonView } from "../src/ui/lesson-view";
import { adapters } from "../src/topics/registry";

beforeEach(() => {
  document.body.innerHTML = "<main></main>";
  vi.stubGlobal("scrollTo", vi.fn());
});
const index = validateLibraryIndex(indexData);
const decimal = packages.find((p) => p.lesson.id === "p4-decimal-practice")!;

it("preserves exact input on syntax errors and records adult answers as support", () => {
  const root = document.querySelector("main")!;
  const view = mountLessonView(root, {
    lesson: decimal.lesson,
    adapter: adapters.decimals,
  });
  view.startTrial(decimal.lesson);
  const input = root.querySelector<HTMLInputElement>("#answer-input")!;
  expect(input.inputMode).toBe("decimal");
  input.value = "3+4";
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(input.value).toBe("3+4");
  expect(view.getSession()?.submissions).toBe(0);
  expect(view.getSession()?.events).toEqual([]);
  root.querySelector<HTMLButtonElement>('[data-action="worked"]')!.click();
  expect(view.getSession()?.hadSupport).toBe(true);
  expect(root.querySelector('[data-slot="solutions"]')!.textContent).toContain(
    decimal.lesson.steps[0].hints[3],
  );
  view.startTrial(decimal.lesson);
  expect(
    root.querySelector<HTMLElement>('[data-slot="solutions"]')!.hidden,
  ).toBe(true);
});

it("prunes preparation links and practice counts to the approved subset", () => {
  const practice = packages.find((p) => p.lesson.id === "p4-decimal-practice")!;
  const subset = pruneLibraryIndex(index, [practice]);
  expect(subset.collections?.[0].lessonIds).toEqual([practice.lesson.id]);
  expect(subset.collections?.[0].practiceIds).toEqual([practice.lesson.id]);
  const records = buildLibraryRecords([practice], subset);
  const state = {
    query: "",
    topic: "all",
    level: "all",
    collection: "p4-preparation",
    practice: true,
  };
  expect(
    readLibraryRoute(
      libraryRoute(state, practice.lesson.id),
      records,
      subset.collections,
    ).state,
  ).toMatchObject(state);
  const onOpen = vi.fn();
  const root = document.querySelector("main")!;
  const library = mountLibraryView(root, {
    records,
    collections: subset.collections,
    state,
    onOpen,
  });
  const start = [...root.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith("Try 1 mixed question"),
  )!;
  start.click();
  expect(onOpen).toHaveBeenCalledWith(records[0]);
  expect(library.getState().practice).toBe(true);
  expect(root.textContent).not.toContain("Try 3 mixed questions");
  expect(pruneLibraryIndex(index, []).collections).toEqual([]);
});

it("rejects forged collection membership and never guesses P4 as P2", () => {
  const changed = structuredClone(index);
  changed.collections![0].practiceIds.push("not-published");
  expect(() => validateLibraryIndex(changed)).toThrow(/practice/);
  expect(buildLibraryRecords([decimal])[0].level).toBe("P4");
  const unknown = structuredClone(decimal);
  delete unknown.library;
  unknown.lesson.level = "P9";
  expect(() => buildLibraryRecords([unknown])).toThrow(/level/);
});
