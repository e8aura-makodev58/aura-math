// @vitest-environment jsdom
import indexData from "../content/library.json";
import { beforeEach, describe, expect, it, vi } from "vitest";

function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing control: ${selector}`);
  element.click();
}
function input(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(selector)!;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
const p4Topics = new Set(
  indexData.lessons.filter((l) => l.level === "P4").map((l) => l.topic),
).size;
const olderTopics = indexData.topics.length - p4Topics;
/** The home page shows one level at a time; the older P2–P3 topics sit behind their own tab. */
const showOlderTopics = () => click('[data-testid="level-tab-p23"]');
function check() {
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}
function choose(value: string) {
  click(`input[value="${value}"]`);
  check();
}
const text = () => document.querySelector("#app")!.textContent;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("scrollTo", vi.fn());
  history.replaceState(null, "", "#library");
  document.body.innerHTML = '<div id="app"></div>';
  await import("../src/main");
});

describe("preview UI integration (DOM, not browser layout)", () => {
  it("renders the original draft catalogue without browser storage writes", () => {
    // Primary 4 is the default tab; the earlier topics are one tab away, so the page stays short.
    expect(document.querySelectorAll(".topic-tile")).toHaveLength(p4Topics);
    expect(document.querySelectorAll(".lesson-card")).toHaveLength(0);
    showOlderTopics();
    expect(document.querySelectorAll(".topic-tile")).toHaveLength(olderTopics);
    expect(text()).toContain("not reviewed by a teacher");
    expect(localStorage.length).toBe(0);
  });

  it("completes comparison with wrong-answer recovery and structured reflection", () => {
    showOlderTopics();
    click('[data-testid="topic-tile-comparison"]');
    click('[data-testid="lesson-card-ribbon-collection"]');
    choose("smaller-is-larger-plus-difference");
    expect(text()).toContain("Not quite yet");
    expect(
      document.querySelector<HTMLButtonElement>('[data-testid="next-step"]')!
        .hidden,
    ).toBe(true);
    choose("larger-is-smaller-plus-difference");
    click('[data-testid="next-step"]');
    input('[data-testid="answer-input"]', "18");
    check();
    click('[data-testid="next-step"]');
    choose("reason");
    click('[data-testid="next-step"]');
    expect(text()).toContain("Completed without app support");
    expect(text()).toContain("cannot observe help from another person");
  });

  it("preserves a draft number across mode changes and hints, and records facilitator use", () => {
    showOlderTopics();
    click('[data-testid="topic-tile-comparison"]');
    click('[data-testid="lesson-card-ribbon-collection"]');
    choose("larger-is-smaller-plus-difference");
    click('[data-testid="next-step"]');
    input('[data-testid="answer-input"]', "18");
    click('[data-testid="mode-guided"]');
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="answer-input"]')!
        .value,
    ).toBe("18");
    click('[data-testid="hint-button"]');
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="answer-input"]')!
        .value,
    ).toBe("18");
    click('[data-mode="independent"]');
    check();
    click('[data-testid="next-step"]');
    choose("reason");
    click('[data-testid="next-step"]');
    expect(text()).toContain("Completed with facilitator");
  });

  it("accepts multi-selection independent of click order and restarts cleanly", () => {
    showOlderTopics();
    click('[data-testid="topic-tile-angles"]');
    click('[data-testid="lesson-card-right-angle-hunt"]');
    click('input[value="C"]');
    click('input[value="A"]');
    check();
    expect(text()).toContain("Nice thinking");
    click('[data-testid="next-step"]');
    choose("reason");
    click('[data-testid="next-step"]');
    expect(text()).toContain("Completed without app support");
    click('[data-action="replay"]');
    expect(document.querySelectorAll("input:checked")).toHaveLength(0);
    expect(text()).toContain("STEP 1 OF 2");
  });
});

describe("material library navigation", () => {
  it("only exposes permitted topics and offers no start action when none are approved", async () => {
    const { mountLibraryView } = await import("../src/ui/library-view");
    const { buildLibraryRecords } = await import("../src/library/catalogue");
    const { packages } = await import("../src/content/lessons");
    const host = document.createElement("div");
    document.body.append(host);
    const subset = buildLibraryRecords(packages).filter(
      (record) => record.topic === "angles",
    );
    mountLibraryView(host, { records: subset, onOpen: vi.fn() });
    expect(host.querySelectorAll(".topic-tile")).toHaveLength(1);
    expect(host.textContent).not.toContain("Place value");
    mountLibraryView(host, { records: [], onOpen: vi.fn() });
    expect(host.querySelector(".library-start")).toBeNull();
    expect(host.querySelectorAll(".topic-tile")).toHaveLength(0);
    expect(host.textContent).toContain("Approved lessons will appear");
  });
  it("opens a focused topic at the top and returns to its tile", () => {
    showOlderTopics();
    click('[data-testid="topic-tile-place-value"]');
    expect(location.hash).toBe("#topic/place-value?tab=p23");
    expect(document.querySelectorAll(".lesson-card")).toHaveLength(3);
    expect(document.activeElement?.textContent).toBe("Place value");
    click(".topic-detail__back");
    expect(location.hash).toBe("#library?tab=p23");
    expect(document.activeElement?.getAttribute("data-testid")).toBe(
      "topic-tile-place-value",
    );
  });
  it("shows every lesson only on request and keeps the hero starter within the permitted catalogue", () => {
    click(".library-all");
    expect(document.querySelectorAll(".lesson-card")).toHaveLength(
      indexData.lessons.length,
    );
    expect(location.hash).toBe("#library?all=1");
    click(".library-filters button:last-child");
    expect(document.querySelectorAll(".topic-tile")).toHaveLength(p4Topics);
    click(".library-start");
    expect(location.hash).toContain("#lesson/p4-place-value-100k");
  });
  it("combines literal search with level/topic filters and preserves return focus", () => {
    const search = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    search.value = "ribbon";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".lesson-card")).toHaveLength(1);
    click('[data-testid="lesson-card-ribbon-collection"]');
    click('[data-testid="lesson-home"]');
    expect(
      document.querySelector<HTMLInputElement>('input[type="search"]')!.value,
    ).toBe("ribbon");
    expect(document.activeElement?.getAttribute("data-testid")).toBe(
      "lesson-card-ribbon-collection",
    );
    const levels = document.querySelector<HTMLSelectElement>(
      '[aria-label="Lesson level"]',
    )!;
    levels.value = "P3";
    levels.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelectorAll(".lesson-card")).toHaveLength(0);
    expect(text()).toContain("No lessons match");
  });
  it("uses known routes only and keeps untrusted search as text", async () => {
    const { readLibraryRoute, libraryRoute } =
      await import("../src/ui/library-view");
    const { buildLibraryRecords } = await import("../src/library/catalogue");
    const { packages } = await import("../src/content/lessons");
    const records = buildLibraryRecords(packages);
    expect(
      readLibraryRoute(
        "#lesson/unknown?topic=absent&q=" + "x".repeat(250),
        records,
      ),
    ).toMatchObject({
      lessonId: null,
      state: { topic: "all", query: "x".repeat(200) },
    });
    expect(readLibraryRoute("#topic/unknown", records).state.topic).toBe("all");
    expect(
      readLibraryRoute("#untrusted?topic=comparison", records).state.topic,
    ).toBe("all");
    const state = {
      query: "<img src=x onerror=alert(1)>",
      topic: "all",
      level: "all",
    };
    expect(
      readLibraryRoute(libraryRoute(state, "ribbon-collection"), records)
        .lessonId,
    ).toBe("ribbon-collection");
    const search = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    search.value = state.query;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("img")).toBeNull();
  });
});
