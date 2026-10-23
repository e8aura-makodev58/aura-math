// @vitest-environment jsdom
import { it, expect } from "vitest";
import {
  mountExamplePicker,
  readExampleNumber,
  withExample,
  savedInstances,
} from "../src/ui/example-picker";
import { packages } from "../src/content/lessons";
import index from "../content/library.json";
import { validateLibraryIndex } from "../src/library/catalogue";
it("navigates saved instances with labelled native buttons and honest variant wording", () => {
  const root = document.createElement("div");
  root.innerHTML = '<div class="workspace-heading"></div>';
  const changes: number[] = [];
  mountExamplePicker(root, {
    number: 1,
    count: 6,
    onChange: (n) => changes.push(n),
  });
  expect(root.querySelector("nav")!.getAttribute("aria-label")).toBe(
    "Saved examples",
  );
  expect(root.querySelectorAll("button")[0].disabled).toBe(true);
  root.querySelectorAll("button")[1].click();
  expect(changes).toEqual([2]);
  mountExamplePicker(root, {
    number: 6,
    count: 6,
    onChange: (n) => changes.push(n),
  });
  expect(root.querySelectorAll("button")[1].disabled).toBe(true);
  root.querySelectorAll("button")[0].click();
  expect(changes).toEqual([2, 5]);
  mountExamplePicker(root, {
    number: 1,
    count: 6,
    temporary: true,
    onChange: () => undefined,
  });
  expect(root.textContent).toContain("Fresh preview variant");
  mountExamplePicker(root, { number: 1, count: 1, onChange: () => undefined });
  expect(root.querySelector("nav")).toBeNull();
});
it("preserves library query parameters and falls back on invalid example links", () => {
  expect(
    withExample("#lesson/p4-turns?collection=p4-revision&practice=1", 3),
  ).toBe("#lesson/p4-turns?collection=p4-revision&practice=1&example=3");
  expect(withExample("#lesson/p4-turns?example=3", 1)).toBe("#lesson/p4-turns");
  for (const n of ["0", "-1", "7", "no", "1.5", "9999999999999999999"])
    expect(readExampleNumber(`#lesson/x?example=${n}`, 6)).toBe(1);
  expect(readExampleNumber("#lesson/x?example=3", 6)).toBe(3);
});
it("lists only instances present in the supplied approved package subset", () => {
  const validated = validateLibraryIndex(index),
    parent = packages.find((p) => p.lesson.id === "p4-turns")!,
    example = packages.find((p) => p.lesson.id === "p4-turns-ex2")!;
  expect(savedInstances(validated, parent.lesson.id, [parent])).toEqual([
    parent,
  ]);
  expect(
    savedInstances(validated, parent.lesson.id, [parent, example]),
  ).toEqual([parent, example]);
});
