import { expect, test, type Page } from "@playwright/test";
import library from "../content/library.json" with { type: "json" };

const families = [
  "whole-numbers",
  "line-graphs",
  "symmetry",
  "angle-measure",
  "nets",
  "pie-charts",
  "bar-charts",
];
const lessons = library.lessons.filter((l) => families.includes(l.topic));

async function payloadOf(id: string) {
  return (
    await import(`../content/lessons/${id}.json`, { with: { type: "json" } })
  ).default;
}
/** Hands-on lessons hide the static picture behind the workbench; answers sit in the list version. */
const isBench = (payload: { library: { tags: string[] } }) =>
  payload.library.tags.includes("workbench");
async function openListVersion(page: Page) {
  const summary = page.locator(".bench-list:not([open]) > summary");
  if (await summary.count()) await summary.click();
}
const noSideways = (page: Page, width: number) =>
  page.evaluate((w) => document.documentElement.scrollWidth <= w, width);

for (const width of [390, 1280]) {
  for (const entry of lessons) {
    test(`${entry.lessonId} draws, fits and completes at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.goto(`/#lesson/${entry.lessonId}`);
      const bench = isBench(await payloadOf(entry.lessonId));
      const visual = page.locator('[data-region="visual"]');
      if (bench) await expect(page.getByTestId("bench-stage")).toBeVisible();
      else await expect(visual.locator("svg, table").first()).toBeVisible();
      // Nothing drawn in the picture is clipped by its own box.
      const clipped = await visual.evaluate((root) =>
        [...root.querySelectorAll("svg")].some((svg) => {
          const view = svg.getBoundingClientRect();
          return [...svg.querySelectorAll("text")].some((t) => {
            const b = t.getBoundingClientRect();
            return (
              b.width > 0 &&
              (b.left < view.left - 1 ||
                b.right > view.right + 1 ||
                b.top < view.top - 1 ||
                b.bottom > view.bottom + 1)
            );
          });
        }),
      );
      expect(clipped).toBe(false);
      expect(await noSideways(page, width)).toBe(true);
      if (width === 390)
        await page.screenshot({
          path: `docs/screenshots/p4-expansion/${entry.lessonId}-390.png`,
          fullPage: true,
        });
      const payload = await payloadOf(entry.lessonId);
      for (const step of payload.lesson.steps) {
        await openListVersion(page);
        if (step.kind === "exact") {
          const input = page.getByTestId("answer-input");
          await expect(input).toHaveAttribute("inputmode", "numeric");
          await input.fill(String(step.answer));
        } else
          for (const value of Array.isArray(step.answer)
            ? step.answer
            : [step.answer])
            await page.locator(`input[value="${value}"]`).check();
        await page.getByTestId("check-answer").click();
        await expect(page.getByRole("status")).toContainText("Nice thinking");
        expect(await noSideways(page, width)).toBe(true);
        await page.getByTestId("next-step").click();
      }
      await expect(page.locator(".completion")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test("a wrong exact answer keeps the learner on the step and a malformed one is not counted", async ({
  page,
}) => {
  await page.goto("/#lesson/p4-rounding");
  const first = (await payloadOf("p4-rounding")).lesson.steps;
  for (const step of first.slice(0, 2)) {
    await page.locator(`input[value="${step.answer}"]`).check();
    await page.getByTestId("check-answer").click();
    await page.getByTestId("next-step").click();
  }
  const input = page.getByTestId("answer-input");
  await input.fill("4,6o0");
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("format");
  await input.fill("4 700");
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("Not quite");
  await expect(input).toHaveValue("4 700");
  await input.fill("4 600");
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("Nice thinking");
});

test("today's spotlight starts a lesson and the level tabs work by keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const spotlight = page.getByTestId("spotlight");
  await expect(spotlight).toBeVisible();
  const lessonId = await page
    .getByTestId("spotlight-go")
    .getAttribute("data-lesson");
  await page.getByTestId("level-tab-p23").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("level-tab-p23")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("level-tab-p23")).toBeFocused();
  await expect(
    page.locator('.topic-tile[data-topic="comparison"]'),
  ).toBeVisible();
  await page.getByTestId("level-tab-p4").focus();
  await page.keyboard.press("Space");
  await expect(
    page.locator('.topic-tile[data-topic="whole-numbers"]'),
  ).toBeVisible();
  await page.getByTestId("spotlight-go").click();
  await expect(page).toHaveURL(new RegExp(`lesson/${lessonId}`));
  await expect(
    page
      .getByTestId("check-answer")
      .or(page.getByTestId("answer-input"))
      .first(),
  ).toBeVisible();
});

test("the spotlight changes with the date and stays on the level shown", async ({
  page,
}) => {
  const topics: string[] = [];
  for (const day of [6, 7, 8, 9]) {
    await page.clock.setFixedTime(new Date(2026, 9, day, 12));
    await page.goto("/");
    topics.push(
      (await page.getByTestId("spotlight").getAttribute("data-topic")) ?? "",
    );
  }
  for (let i = 1; i < topics.length; i++)
    expect(topics[i]).not.toBe(topics[i - 1]);
  const p4Topics = new Set(
    library.lessons.filter((l) => l.level === "P4").map((l) => l.topic),
  );
  const old = new Set(
    library.lessons.filter((l) => l.level !== "P4").map((l) => l.topic),
  );
  for (const t of topics) expect(p4Topics.has(t) || old.has(t)).toBe(true);
  for (const t of topics) expect(old.has(t)).toBe(false); // the default tab is Primary 4
});

// Net pictures are drawn in a 360-wide sheet: at a 360 px phone width nothing may shrink below 11 px.
for (const entry of library.lessons.filter((l) => l.topic === "nets"))
  test(`${entry.lessonId} stays legible and tappable at 360px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/#lesson/${entry.lessonId}`);
    let visual = page.locator('[data-region="visual"]');
    if (isBench(await payloadOf(entry.lessonId))) {
      // the hands-on lessons are checked in manipulatives-browser.spec.ts; here the list version
      await expect(page.getByTestId("bench-stage")).toBeVisible();
      await openListVersion(page);
      visual = page.getByTestId("bench-stage");
      await expect(visual.locator("canvas, svg").first()).toBeVisible();
    } else await expect(visual.locator("svg").first()).toBeVisible();
    const heights = await visual.evaluate((root) =>
      [...root.querySelectorAll("svg text")].map(
        (t) => t.getBoundingClientRect().height,
      ),
    );
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(11);
    // The drawing fits its card: nothing is wider than the page.
    expect(await noSideways(page, 360)).toBe(true);
    const box = await visual.locator("svg, canvas").first().boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    const targets = page.locator(
      ".answer-choice, [data-testid=check-answer], [data-testid=answer-input]",
    );
    for (const target of await targets.all()) {
      const t = await target.boundingBox();
      if (t) expect(t.height).toBeGreaterThanOrEqual(44);
    }
  });

// Pie labels are placed by a conservative estimate; the browser measures what was really drawn.
for (const width of [390, 360])
  for (const entry of library.lessons.filter((l) => l.topic === "pie-charts"))
    test(`${entry.lessonId} keeps every label inside the picture and clear of its neighbours at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/#lesson/${entry.lessonId}`);
      const visual = page.locator('[data-region="visual"]');
      await expect(visual.locator("svg").first()).toBeVisible();
      const report = await visual.evaluate((root) => {
        const svg = root.querySelector("svg")!;
        const view = svg.viewBox.baseVal;
        const boxes = [...svg.querySelectorAll("text")].map((t) => {
          const b = (t as SVGTextElement).getBBox();
          return {
            name: t.textContent ?? "",
            x0: b.x,
            y0: b.y,
            x1: b.x + b.width,
            y1: b.y + b.height,
            px: t.getBoundingClientRect().height,
            size: Number(t.getAttribute("font-size")),
          };
        });
        const outside = boxes.filter(
          (b) =>
            b.x0 < view.x ||
            b.y0 < view.y ||
            b.x1 > view.x + view.width ||
            b.y1 > view.y + view.height,
        );
        const overlaps: string[] = [];
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i],
              b = boxes[j];
            if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)
              overlaps.push(`${a.name} / ${b.name}`);
          }
        // Labels must also stay off the pie itself (centre 200,160, radius 95).
        const onPie = boxes.filter((b) =>
          [
            [b.x0, b.y0],
            [b.x1, b.y0],
            [b.x0, b.y1],
            [b.x1, b.y1],
          ].some(([x, y]) => Math.hypot(x - 200, y - 160) < 95),
        );
        return {
          count: boxes.length,
          outside: outside.map((b) => b.name),
          overlaps,
          onPie: onPie.map((b) => b.name),
          smallest: Math.min(...boxes.map((b) => b.px)),
          sizes: boxes.map((b) => b.size),
          width: view.width,
        };
      });
      expect(report.count).toBeGreaterThanOrEqual(3);
      expect(report.width).toBe(400);
      expect(report.outside).toEqual([]);
      expect(report.overlaps).toEqual([]);
      expect(report.onPie).toEqual([]);
      for (const size of report.sizes) expect(size).toBeGreaterThanOrEqual(15);
      expect(report.smallest).toBeGreaterThanOrEqual(11);
      expect(await noSideways(page, width)).toBe(true);
      const targets = page.locator(
        ".answer-choice, [data-testid=check-answer], [data-testid=answer-input]",
      );
      for (const target of await targets.all()) {
        const t = await target.boundingBox();
        if (t) expect(t.height).toBeGreaterThanOrEqual(44);
      }
    });

// Bar charts: each lesson is completed in both modes at 390 and 360 px; the drawing is checked in the browser.
for (const width of [390, 360])
  for (const mode of ["independent", "guided"] as const)
    for (const entry of library.lessons.filter((l) => l.topic === "bar-charts"))
      test(`${entry.lessonId} completes in ${mode} mode, stays legible and tappable at ${width}px`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/#lesson/${entry.lessonId}`);
        if (mode === "guided") await page.getByTestId("mode-guided").click();
        const visual = page.locator('[data-region="visual"]');
        await expect(visual.locator("svg").first()).toBeVisible();
        const report = await visual.evaluate((root) => {
          const svg = root.querySelector("svg")!;
          const view = svg.viewBox.baseVal;
          const texts = [...svg.querySelectorAll("text")].map((t) => ({
            px: t.getBoundingClientRect().height,
            size: Number(t.getAttribute("font-size")),
            box: (t as SVGTextElement).getBBox(),
          }));
          const inside = texts.every(
            (t) =>
              t.box.x >= view.x &&
              t.box.y >= view.y &&
              t.box.x + t.box.width <= view.x + view.width &&
              t.box.y + t.box.height <= view.y + view.height,
          );
          // Bars as drawn: heights against the gridline spacing, in the browser's own geometry.
          const grid = [...svg.querySelectorAll(".bar-grid")].map((l) =>
            Number(l.getAttribute("y1")),
          );
          const base = Number(
            svg.querySelector(".bar-baseline")!.getAttribute("y1"),
          );
          const rowPx = (base - Math.min(...grid)) / grid.length;
          const bars = [...svg.querySelectorAll("rect.bar")].map((r) => ({
            series: Number(r.getAttribute("data-series")),
            index: Number(r.getAttribute("data-index")),
            rows: (r as SVGRectElement).height.baseVal.value / rowPx,
          }));
          const overlay = [...svg.querySelectorAll(".bar-hatch")].length;
          return {
            width: view.width,
            smallest: Math.min(...texts.map((t) => t.px)),
            sizes: texts.map((t) => t.size),
            inside,
            bars,
            overlay,
            box: svg.getBoundingClientRect().toJSON(),
          };
        });
        expect(report.width).toBe(400);
        expect(report.inside).toBe(true);
        for (const size of report.sizes)
          expect(size).toBeGreaterThanOrEqual(15);
        expect(report.smallest).toBeGreaterThanOrEqual(11);
        expect(report.box.x).toBeGreaterThanOrEqual(0);
        expect(report.box.x + report.box.width).toBeLessThanOrEqual(width);
        const spec = (await payloadOf(entry.lessonId)).lesson.specification;
        for (const bar of report.bars) {
          const value = (bar.series === 1 ? spec.values : spec.values2)[
            bar.index
          ];
          expect(bar.rows * spec.step).toBeCloseTo(value, 6);
        }
        expect(report.overlay).toBe(spec.values2.length);
        expect(await noSideways(page, width)).toBe(true);
        const payload = await payloadOf(entry.lessonId);
        for (const step of payload.lesson.steps) {
          const targets = page.locator(
            ".answer-choice, [data-testid=check-answer], [data-testid=answer-input]",
          );
          for (const target of await targets.all()) {
            const t = await target.boundingBox();
            if (t) expect(t.height).toBeGreaterThanOrEqual(44);
          }
          if (step.kind === "exact") {
            const input = page.getByTestId("answer-input");
            await expect(input).toHaveAttribute("inputmode", "numeric");
            await input.fill(String(step.answer));
          } else await page.locator(`input[value="${step.answer}"]`).check();
          await page.getByTestId("check-answer").click();
          await expect(page.getByRole("status")).toContainText("Nice thinking");
          expect(await noSideways(page, width)).toBe(true);
          await page.getByTestId("next-step").click();
        }
        await expect(page.locator(".completion")).toBeVisible();
        expect(errors).toEqual([]);
      });
