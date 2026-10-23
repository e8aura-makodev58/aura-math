// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { createPracticeJournal } from "../src/practice/controller";

const captured = vi.hoisted(() => ({
  journals: [] as ReturnType<typeof createPracticeJournal>[],
}));
vi.mock("../src/practice/controller", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/practice/controller")>();
  return {
    ...original,
    createPracticeJournal() {
      const journal = original.createPracticeJournal();
      captured.journals.push(journal);
      return journal;
    },
  };
});

let hashListener: EventListener | undefined;
beforeEach(() => {
  vi.resetModules();
  captured.journals.length = 0;
  vi.stubGlobal("scrollTo", vi.fn());
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    (type, listener, options) => {
      if (type === "hashchange" && typeof listener === "function")
        hashListener = listener as EventListener;
      add(type, listener, options);
    },
  );
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  if (hashListener) window.removeEventListener("hashchange", hashListener);
  hashListener = undefined;
  vi.restoreAllMocks();
});

const journal = () => captured.journals.at(-1)!;
const click = (selector: string) => {
  const control = document.querySelector<HTMLElement>(selector);
  expect(control, `Control ${selector}`).not.toBeNull();
  control!.click();
};
const check = () => {
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};
function chooseLabel(pattern: RegExp) {
  const label = [
    ...document.querySelectorAll<HTMLLabelElement>(".answer-choice"),
  ].find((item) => pattern.test(item.textContent ?? ""));
  expect(label).toBeDefined();
  label!.querySelector<HTMLInputElement>("input")!.click();
  check();
  expect(document.querySelector(".feedback")?.textContent).toContain(
    "Nice thinking",
  );
  click('[data-testid="next-step"]');
}
function hundredths(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
function answerNumber(value: number) {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="answer-input"]',
  )!;
  input.value = `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
  check();
  expect(document.querySelector(".feedback")?.textContent).toContain(
    "Nice thinking",
  );
  click('[data-testid="next-step"]');
}
function finishSubtraction() {
  chooseLabel(/Line up decimal points/);
  const prompt = document.querySelector('[data-region="prompt"]')!.textContent!;
  const values = prompt.match(/(\d+(?:\.\d+)?)\s*[−-]\s*(\d+(?:\.\d+)?)/)!;
  expect(values).not.toBeNull();
  answerNumber(hundredths(values[1]) - hundredths(values[2]));
  chooseLabel(/Use equal place units/);
  expect(document.querySelector<HTMLElement>(".completion")!.hidden).toBe(
    false,
  );
  return prompt;
}
function finishCord() {
  const prompt = document.querySelector('[data-region="prompt"]')!.textContent!;
  const values = prompt.match(/\d+(?:\.\d+)?/g)!;
  expect(values).toHaveLength(3);
  answerNumber(
    hundredths(values[0]) - Number(values[1]) * hundredths(values[2]),
  );
  chooseLabel(/Use equal place units/);
  return prompt;
}
async function start(hash = "#lesson/p4-decimal-add-subtract") {
  history.replaceState(null, "", hash);
  await import("../src/main");
}

it("keeps hinted source evidence separate from unsupported generated results and deduplicates callbacks", async () => {
  await start();
  click('[data-testid="hint-button"]');
  const base = finishSubtraction();
  expect(journal().getSummaries()).toHaveLength(1);
  expect(journal().getSummaries()[0]).toMatchObject({
    sourceId: "p4-decimal-add-subtract",
    hadSupport: true,
    completed: true,
  });
  click('[data-testid="try-another"]');
  expect(location.hash).toContain("#lesson/p4-decimal-add-subtract");
  expect(
    document.querySelector<HTMLElement>('[data-region="hint"]')!.hidden,
  ).toBe(true);
  expect(finishSubtraction()).not.toBe(base);
  const summaries = journal().getSummaries();
  expect(summaries).toHaveLength(2);
  expect(summaries[1]).toMatchObject({ hadSupport: false, completed: true });
  expect(summaries[1].variant).toBeDefined();
  click('[data-testid="lesson-home"]');
  expect(journal().getSummaries()).toHaveLength(2);
  const card = document
    .querySelector('[data-testid="lesson-card-p4-decimal-add-subtract"]')!
    .closest("article")!;
  expect(card.textContent).toContain("Completed with support");
  expect(card.textContent).not.toContain("Completed without app support");
});

it("new variants inherit selected guided mode but never earlier hint history", async () => {
  await start();
  click('[data-testid="mode-guided"]');
  click('[data-testid="hint-button"]');
  finishSubtraction();
  click('[data-testid="try-another"]');
  expect(
    document
      .querySelector('[data-testid="mode-guided"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  click('[data-mode="independent"]');
  finishSubtraction();
  expect(journal().getSummaries()[1]).toMatchObject({
    hintsUsed: 0,
    hadSupport: false,
    hadFacilitator: true,
    label: "Completed with facilitator",
  });
});

it("same-example replay records repeated practice once and simulated reload resets journal/source", async () => {
  await start();
  finishSubtraction();
  click('[data-testid="try-another"]');
  const generated = finishSubtraction();
  click('[data-action="replay"]');
  expect(journal().getSummaries()).toHaveLength(2);
  expect(finishSubtraction()).toBe(generated);
  expect(journal().getSummaries()).toHaveLength(3);
  expect(journal().getSummaries()[2].repeatedExample).toBe(true);
  window.removeEventListener("hashchange", hashListener!);
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  await import("../src/main");
  expect(journal().getSummaries()).toEqual([]);
  expect(finishSubtraction()).toBe("Work out 7.25 − 2.6.");
});

it("Next mixed question records a completed original before navigation and variants do not advance the slot", async () => {
  await start(
    "#lesson/p4-decimal-practice?collection=p4-preparation&practice=1&tab=p4",
  );
  const prompts = new Set([finishCord()]);
  click('[data-testid="try-another"]');
  prompts.add(finishCord());
  expect(prompts.size).toBe(2);
  click('[data-action="next-lesson"]');
  expect(location.hash).toContain("#lesson/p4-fraction-practice?");
  const summaries = journal().getSummaries();
  expect(summaries).toHaveLength(2);
  expect(summaries[0]).toMatchObject({
    sourceId: "p4-decimal-practice",
    completed: true,
  });
  expect(summaries[0].variant).toBeUndefined();
  click('[data-testid="lesson-home"]');
  expect(document.querySelector(".preparation h1")!.textContent).toBe(
    "P4 revision adventures",
  );
  const card = document
    .querySelector('[data-testid="lesson-card-p4-decimal-practice"]')!
    .closest("article")!;
  expect(card.textContent).toContain("Completed without app support");
});

it("exhausts a small fraction set without losing completion and restarts with a fresh instance", async () => {
  await start("#lesson/p4-fraction-practice");
  function finishFraction() {
    const prompt = document.querySelector(
      '[data-region="prompt"]',
    )!.textContent!;
    const total = Number(prompt.match(/box has (\d+)/)![1]);
    const input = document.querySelector<HTMLInputElement>("#answer-input")!;
    input.value = String(total / 4);
    check();
    expect(document.querySelector(".feedback")!.textContent).toContain(
      "Nice thinking",
    );
    click('[data-testid="next-step"]');
    chooseLabel(/The wholes match/);
    return total;
  }
  const totals = new Set([finishFraction()]);
  for (let index = 0; index < 6; index++) {
    click('[data-testid="try-another"]');
    totals.add(finishFraction());
  }
  expect(totals.size).toBe(7);
  const identity = journal().getActive();
  click('[data-testid="try-another"]');
  expect(journal().getActive()).toEqual(identity);
  expect(document.querySelector<HTMLElement>(".completion")!.hidden).toBe(
    false,
  );
  expect(document.querySelector(".variant-feedback")!.textContent).toContain(
    "every example",
  );
  expect(journal().getSummaries()).toHaveLength(7);
  click('[data-action="restart-variants"]');
  expect(journal().getActive()?.lessonId).not.toBe(identity?.lessonId);
  expect(journal().getActive()?.repeatedExample).toBe(false);
  expect(journal().getSummaries()).toHaveLength(7);
  expect(document.querySelector<HTMLElement>(".completion")!.hidden).toBe(true);
  expect(document.querySelector<HTMLInputElement>("#answer-input")!.value).toBe(
    "",
  );
});

it("approved learner's relative import graph excludes preview generators and author modules", () => {
  const rawSources = import.meta.glob<string>("../src/**/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  const sources = new Map(
    Object.entries(rawSources).map(([path, code]) => [path.slice(3), code]),
  );
  function relativePath(importer: string, specifier: string) {
    const segments = importer.split("/").slice(0, -1);
    for (const segment of specifier.split("/")) {
      if (segment === "..") segments.pop();
      else if (segment !== ".") segments.push(segment);
    }
    return segments.join("/");
  }
  const seen = new Set<string>();
  function visit(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    const code = sources.get(path)!;
    const imports = /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g;
    for (const match of code.matchAll(imports)) {
      if (!match[1].startsWith(".")) continue;
      const target = relativePath(path, match[1]);
      const file = [target, `${target}.ts`, `${target}/index.ts`].find(
        (candidate) => sources.has(candidate),
      );
      if (file) visit(file);
    }
  }
  visit("src/learner.ts");
  expect(
    [...seen].filter((path) => /^src\/(?:practice|authoring)\//.test(path)),
  ).toEqual([]);
});
