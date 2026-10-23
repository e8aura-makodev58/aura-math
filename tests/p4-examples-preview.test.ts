// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { packages } from "../src/content/lessons";
let listener: EventListener | undefined;
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, fn, opts) => {
    if (type === "hashchange" && typeof fn === "function")
      listener = fn as EventListener;
    add(type, fn, opts);
  });
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  if (listener) window.removeEventListener("hashchange", listener);
  listener = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const click = (selector: string) =>
  document.querySelector<HTMLElement>(selector)!.click();
it("opens deep-linked saved payloads and resets hints while carrying guided mode", async () => {
  history.replaceState(null, "", "/#lesson/p4-decimal-places?example=2");
  await import("../src/main");
  expect(
    document.querySelector(".saved-example-picker")!.textContent,
  ).toContain("Example 2 of 6");
  expect(document.querySelector('[data-region="story"]')!.textContent).toBe(
    packages.find((p) => p.lesson.id === "p4-decimal-places-ex1")!.lesson.story,
  );
  click('[data-testid="mode-guided"]');
  click('[data-testid="hint-button"]');
  click(".saved-example-picker button:last-child");
  expect(location.hash).toContain("example=3");
  expect(
    document
      .querySelector('[data-testid="mode-guided"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    document.querySelector<HTMLElement>('[data-region="hint"]')!.hidden,
  ).toBe(true);
  expect(document.querySelector('[data-region="story"]')!.textContent).toBe(
    packages.find((p) => p.lesson.id === "p4-decimal-places-ex2")!.lesson.story,
  );
});
it("completion of a saved instance does not complete its starter or enable draft variants", async () => {
  history.replaceState(null, "", "/#lesson/p4-decimal-places?example=2");
  await import("../src/main");
  const example = packages.find(
    (p) => p.lesson.id === "p4-decimal-places-ex1",
  )!;
  for (const step of example.lesson.steps) {
    if (step.kind === "exact")
      document.querySelector<HTMLInputElement>(
        '[data-testid="answer-input"]',
      )!.value = String(step.answer);
    else
      document
        .querySelector<HTMLInputElement>(
          `.answer-options input[value="${step.answer}"]`,
        )!
        .click();
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.querySelector(".feedback")!.textContent).toContain(
      "Nice thinking",
    );
    click('[data-testid="next-step"]');
  }
  expect(document.querySelector<HTMLElement>(".completion")!.hidden).toBe(
    false,
  );
  expect(
    document.querySelector<HTMLElement>('[data-testid="try-another"]')
      ?.hidden ?? true,
  ).toBe(true);
  click('[data-testid="lesson-home"]');
  const card = document
    .querySelector('[data-testid="lesson-card-p4-decimal-places"]')!
    .closest("article")!;
  expect(card.textContent).not.toContain("Completed without app support");
  expect(card.textContent).not.toContain("Completed with support");
});
