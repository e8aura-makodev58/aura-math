// @vitest-environment jsdom
import indexData from "../content/library.json";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  libraryRoute,
  mountLibraryView,
  readLibraryRoute,
  emptyLibraryState,
} from "../src/ui/library-view";
import {
  buildLibraryRecords,
  validateLibraryIndex,
  type LibraryRecord,
} from "../src/library/catalogue";
import { packages } from "../src/content/lessons";
import { pickSpotlight } from "../src/library/spotlight";

const index = validateLibraryIndex(indexData);
const collections = index.collections ?? [];
const all = buildLibraryRecords(packages, index);
const p4 = all.filter((r) => r.level === "P4");
const older = all.filter((r) => r.level !== "P4");
const day = (d: number) => new Date(2026, 9, d, 12);

let host: HTMLElement;
beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});
function mount(
  records: readonly LibraryRecord[] = all,
  extra: Partial<Parameters<typeof mountLibraryView>[1]> = {},
) {
  const onOpen = vi.fn();
  const onStateChange = vi.fn();
  const view = mountLibraryView(host, {
    records,
    collections,
    onOpen,
    onStateChange,
    today: day(6),
    ...extra,
  });
  return { view, onOpen, onStateChange };
}
const tiles = () => [...host.querySelectorAll<HTMLElement>(".topic-tile")];
const click = (selector: string) =>
  host.querySelector<HTMLElement>(selector)!.click();

describe("home page structure", () => {
  it("shows one level at a time, Primary 4 first, grouped under strands in teaching order", () => {
    mount();
    expect(
      host.querySelector('[data-tab="p4"]')!.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      host.querySelector('[data-tab="p23"]')!.getAttribute("aria-pressed"),
    ).toBe("false");
    const strands = [...host.querySelectorAll(".strand-group__title")].map(
      (n) => n.textContent,
    );
    expect(strands).toEqual([
      "Numbers and operations",
      "Measurement",
      "Geometry",
      "Data",
    ]);
    // The tiles are the Primary 4 topics of the library index, grouped by strand in teaching order.
    const p4Topics = new Set(p4.map((r) => r.topic));
    const shown = tiles().map((t) => t.dataset.topic!);
    expect(new Set(shown)).toEqual(p4Topics);
    expect(shown).toHaveLength(p4Topics.size);
    const strandOf = (topic: string) =>
      index.topics.find((t) => t.id === topic)!.strand;
    const rank = shown.map((t) => strands.indexOf(strandOf(t)));
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
    expect(shown.indexOf("nets")).toBeLessThan(shown.indexOf("symmetry"));
    // Nothing from the earlier levels is on the page until its tab is chosen.
    expect(
      host.querySelector('[data-topic="comparison"].topic-tile'),
    ).toBeNull();
    click('[data-tab="p23"]');
    expect(tiles().map((t) => t.dataset.topic)).toEqual([
      "place-value",
      "equal-groups",
      "fractions",
      "comparison",
      "angles",
      "picture-graphs",
    ]);
    expect(
      host.querySelector('[data-tab="p23"]')!.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.activeElement?.getAttribute("data-tab")).toBe("p23");
  });

  it("gives every tile a count and a first-lesson example, and keeps the page far shorter than the full list", () => {
    mount();
    for (const tile of tiles()) {
      const text = tile.textContent!;
      expect(text).toMatch(/\d lessons? · P4/);
      expect(text).toMatch(/Try first: /);
    }
    // The old home listed every topic at once; one level now holds roughly half.
    expect(tiles().length).toBeLessThan(new Set(all.map((r) => r.topic)).size);
    expect(host.querySelectorAll(".lesson-card")).toHaveLength(0);
  });

  it("offers the revision adventure only with Primary 4, with honest counts", () => {
    const { onStateChange } = mount();
    const banner = host.querySelector(".revision-banner")!;
    expect(banner.textContent).toContain(`${p4.length} lessons`);
    expect(banner.textContent).toContain(
      `${collections[0].practiceIds!.length} mixed questions`,
    );
    click('[data-tab="p23"]');
    expect(host.querySelector(".revision-banner")).toBeNull();
    click('[data-tab="p4"]');
    click(".preparation-entry");
    expect(host.querySelector(".topic-detail.preparation")).not.toBeNull();
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ collection: collections[0].id, tab: "p4" }),
    );
  });

  it("hides the level switch when only one level is on offer and shows nothing for no lessons", () => {
    mount(p4);
    expect(host.querySelector(".level-tabs")).toBeNull();
    expect(tiles()).toHaveLength(new Set(p4.map((r) => r.topic)).size);
    mount([]);
    expect(host.querySelector(".spotlight")).toBeNull();
    expect(host.querySelector(".library-start")).toBeNull();
    expect(host.textContent).toContain("Approved lessons will appear");
  });

  it("starts with the first lesson of the first topic on the chosen level", () => {
    const { onOpen } = mount();
    click(".library-start");
    expect(onOpen.mock.calls[0][0].lesson.id).toBe("p4-place-value-100k");
    const second = mount();
    click('[data-tab="p23"]');
    click(".library-start");
    expect(second.onOpen.mock.calls.at(-1)![0].lesson.id).toBe(
      "hundreds-tens-ones",
    );
  });
});

describe("today's spotlight", () => {
  it("shows the lesson the pure function picks for the date, from the level on show", () => {
    mount();
    const card = host.querySelector<HTMLElement>(".spotlight")!;
    const pick = pickSpotlight(p4, day(6))!;
    expect(card.dataset.topic).toBe(pick.topic);
    expect(card.textContent).toContain(pick.lesson.title);
    expect(card.textContent).toContain("Today’s spotlight");
    click('[data-tab="p23"]');
    const next = pickSpotlight(older, day(6))!;
    expect(host.querySelector<HTMLElement>(".spotlight")!.dataset.topic).toBe(
      next.topic,
    );
  });

  it("changes every day and never repeats a topic on consecutive days", () => {
    const seen: string[] = [];
    for (let d = 1; d <= 14; d++) {
      mount(all, { today: day(d) });
      seen.push(host.querySelector<HTMLElement>(".spotlight")!.dataset.topic!);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(new Set(seen).size).toBe(new Set(p4.map((r) => r.topic)).size);
  });

  it("opens the lesson or its topic, and is an ordinary labelled button group", () => {
    const { onOpen } = mount();
    const go = host.querySelector<HTMLButtonElement>(
      '[data-testid="spotlight-go"]',
    )!;
    expect(go.getAttribute("aria-label")).toMatch(/^Try today’s spotlight: /);
    go.click();
    expect(onOpen.mock.calls[0][0].lesson.id).toBe(go.dataset.lesson);
    mount();
    host.querySelector<HTMLElement>(".spotlight .text-button")!.click();
    expect(host.querySelector(".topic-detail")).not.toBeNull();
  });

  it("can only pick from the permitted lessons and leaves nothing behind in storage", () => {
    const subset = p4.filter((r) => r.topic === "symmetry");
    mount(subset);
    expect(host.querySelector<HTMLElement>(".spotlight")!.dataset.topic).toBe(
      "symmetry",
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("home routes", () => {
  it("round-trips the level tab and ignores anything unknown", () => {
    expect(readLibraryRoute("#library?tab=p23", all).state.tab).toBe("p23");
    expect(readLibraryRoute("#library?tab=p4", all).state.tab).toBe("p4");
    for (const bad of [
      "#library?tab=p9",
      "#library?tab=<img>",
      "#library?tab=",
    ])
      expect(readLibraryRoute(bad, all).state.tab).toBeUndefined();
    expect(libraryRoute({ ...emptyLibraryState(), tab: "p23" })).toBe(
      "#library?tab=p23",
    );
    expect(libraryRoute(emptyLibraryState())).toBe("#library");
    const parsed = readLibraryRoute("#topic/symmetry?tab=p4", all);
    expect(parsed.state.topic).toBe("symmetry");
    expect(parsed.state.tab).toBe("p4");
  });

  it("restores the chosen tab from state and reports it for the address bar", () => {
    const { onStateChange } = mount(all, {
      state: { ...emptyLibraryState(), tab: "p23" },
    });
    expect(
      host.querySelector('[data-tab="p23"]')!.getAttribute("aria-pressed"),
    ).toBe("true");
    click('[data-tab="p4"]');
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "p4" }),
    );
  });
});
