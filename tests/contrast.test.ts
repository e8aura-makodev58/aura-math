import { describe, expect, it } from "vitest";
import {
  PIE_FILLS,
  PIE_INK,
  PIE_PAGE,
  pieChartsTopic,
} from "../src/topics/pie-charts";
import { pieChartsAuthor } from "../src/authoring/pie-charts";
import {
  AXIS_INK,
  BAR_FILLS,
  BAR_INK,
  BAR_PAGE,
  BAR_TITLE_INK,
  GRID_INK,
  barChartsTopic,
} from "../src/topics/bar-charts";
import { barChartsAuthor } from "../src/authoring/bar-charts";
// The project has no Node typings, so the file system module is loaded without a static type.
const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as {
  readFileSync: (path: URL, encoding: string) => string;
};
const read = (name: string) =>
  fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
const p4css = read("p4.css");
const styles = read("styles.css");

// An independently written WCAG relative-luminance and contrast calculation.
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const rgb = (hex: string): [number, number, number] => {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Reads `[data-topic="x"] { --name: value; ... }` blocks out of a stylesheet. */
function topicBlock(css: string, topic: string, name: string): string | null {
  for (const block of css.matchAll(
    new RegExp(`\\[data-topic="${topic}"\\]\\s*\\{([^}]*)\\}`, "g"),
  ) as Iterable<RegExpMatchArray>) {
    const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block[1]);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

describe("contrast numbers the pie-chart design relies on", () => {
  it("computes known reference ratios", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(ratio("#c0561f", PIE_PAGE)).toBeLessThan(4.5);
    expect(ratio("#c0561f", PIE_PAGE)).toBeGreaterThan(4.49);
  });

  it("keeps the pie accent text at 4.5:1 on its tile surface and on the page", () => {
    const ink = topicBlock(p4css, "pie-charts", "topic-ink")!;
    const tint = topicBlock(p4css, "pie-charts", "topic-tint")!;
    const accent = topicBlock(p4css, "pie-charts", "topic-accent")!;
    const surface = topicBlock(p4css, "pie-charts", "topic-surface")!;
    expect(ink).toBe("#b3261e");
    for (const [text, ground] of [
      [ink, tint],
      [accent, surface],
      [ink, PIE_PAGE],
      [accent, PIE_PAGE],
    ])
      expect(
        ratio(text, ground),
        `${text} on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
    // The decorative border is exempt from the text threshold and is not asserted.
  });

  it("keeps the label ink at 4.5:1 and every sector fill at 3:1 against the page", () => {
    expect(ratio(PIE_INK, PIE_PAGE)).toBeGreaterThanOrEqual(4.5);
    expect(PIE_FILLS).toHaveLength(5);
    for (const fill of PIE_FILLS)
      expect(ratio(fill, PIE_PAGE), fill).toBeGreaterThanOrEqual(3);
    // Orange is a graphic fill only: it is 4.498:1, just under the text threshold, so no text may use it.
    for (const form of pieChartsAuthor.forms) {
      const html = pieChartsTopic.render(
        pieChartsAuthor.template(form.id, form.id).lesson,
      );
      for (const m of html.matchAll(/<text[^>]*fill="(#[0-9a-fA-F]{6})"/g))
        expect(ratio(m[1], PIE_PAGE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives the pie tile an accent pair that differs from every other topic on the Primary 4 tab", () => {
    const distance = (a: string, b: string) =>
      Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
    const p4Topics = [
      "decimals",
      "fraction-calculations",
      "area-perimeter",
      "whole-numbers",
      "line-graphs",
      "symmetry",
      "nets",
      "angle-measure",
    ];
    const pie = topicBlock(p4css, "pie-charts", "topic-accent")!;
    const pieSurface = topicBlock(p4css, "pie-charts", "topic-surface")!;
    for (const topic of p4Topics) {
      const accent = topicBlock(p4css, topic, "topic-accent")!;
      const surface = topicBlock(p4css, topic, "topic-surface")!;
      expect(distance(pie, accent), topic).toBeGreaterThan(45);
      expect(distance(pieSurface, surface), topic).toBeGreaterThan(8);
    }
    // The older topics define theirs in styles.css; those sit on another tab but are compared anyway.
    for (const topic of ["comparison", "equal-groups", "place-value"]) {
      const accent = topicBlock(styles, topic, "topic-accent")!;
      expect(distance(pie, accent), topic).toBeGreaterThan(40);
    }
  });
});

describe("contrast numbers the bar-chart design relies on", () => {
  it("keeps the bar accent text at 4.5:1 on its tile surface and on the page", () => {
    const ink = topicBlock(p4css, "bar-charts", "topic-ink")!;
    const tint = topicBlock(p4css, "bar-charts", "topic-tint")!;
    const accent = topicBlock(p4css, "bar-charts", "topic-accent")!;
    const surface = topicBlock(p4css, "bar-charts", "topic-surface")!;
    expect([ink, tint, accent, surface]).toEqual([
      "#6b5a00",
      "#f7efc6",
      "#6b5a00",
      "#f7efc6",
    ]);
    for (const [text, ground] of [
      [ink, tint],
      [accent, surface],
      [ink, BAR_PAGE],
      [accent, BAR_PAGE],
    ])
      expect(
        ratio(text, ground),
        `${text} on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
    // The decorative border is exempt from the text threshold and is not asserted.
  });

  it("keeps every word at 4.5:1 and every graphic mark at 3:1 against the page", () => {
    for (const text of [BAR_INK, BAR_TITLE_INK])
      expect(ratio(text, BAR_PAGE), text).toBeGreaterThanOrEqual(4.5);
    // Marks: both bar fills, the axis and ticks, and the gridlines used to read values.
    for (const mark of [...BAR_FILLS, AXIS_INK, GRID_INK])
      expect(ratio(mark, BAR_PAGE), mark).toBeGreaterThanOrEqual(3);
    // The second bar fill is orange (just under the text threshold), so no drawn word may use a bar fill.
    for (const form of barChartsAuthor.forms) {
      const html = barChartsTopic.render(
        barChartsAuthor.template(form.id, form.id).lesson,
      );
      const words = [...html.matchAll(/<text[^>]*fill="(#[0-9a-fA-F]{6})"/g)];
      expect(words.length).toBeGreaterThan(5);
      for (const m of words) {
        expect(BAR_FILLS).not.toContain(m[1]);
        expect(ratio(m[1], BAR_PAGE)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("gives the bar tile an accent pair that is not a copy of any other topic", () => {
    const distance = (a: string, b: string) =>
      Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
    const bar = topicBlock(p4css, "bar-charts", "topic-accent")!;
    const barSurface = topicBlock(p4css, "bar-charts", "topic-surface")!;
    const others = [
      "decimals",
      "fraction-calculations",
      "area-perimeter",
      "whole-numbers",
      "line-graphs",
      "pie-charts",
      "symmetry",
      "nets",
      "angle-measure",
    ];
    // Thresholds are modest on purpose: the nearest accent (fraction-calculations) is only about 34
    // away in RGB, which is recorded for human visual review rather than hidden by a lenient test.
    for (const topic of others) {
      expect(
        distance(bar, topicBlock(p4css, topic, "topic-accent")!),
        topic,
      ).toBeGreaterThan(30);
      expect(
        distance(barSurface, topicBlock(p4css, topic, "topic-surface")!),
        topic,
      ).toBeGreaterThan(15);
    }
    for (const topic of ["comparison", "equal-groups", "place-value"])
      expect(
        distance(bar, topicBlock(styles, topic, "topic-accent")!),
        topic,
      ).toBeGreaterThan(30);
  });
});
