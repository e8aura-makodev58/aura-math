import libraryIndex from "../content/library.json" with { type: "json" };
import { expect, test } from "@playwright/test";

const p4Topics = new Set(
  libraryIndex.lessons.filter((l) => l.level === "P4").map((l) => l.topic),
).size;

for (const width of [390, 1280]) {
  test(`playful home, focused topic and search work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto("/");
    const tiles = page.locator(".topic-tile");
    // One level at a time: Primary 4 first, with today's spotlight above the topics.
    await expect(tiles).toHaveCount(p4Topics);
    await expect(page.locator('[data-testid^="lesson-card-"]')).toHaveCount(0);
    const spotlight = await page.getByTestId("spotlight").boundingBox();
    expect(spotlight!.y).toBeLessThan(width === 390 ? 844 : 800);
    const first = await tiles.first().boundingBox();
    expect(first!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId("level-tab-p4")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `docs/screenshots/playful-home-${width}.png`,
      fullPage: true,
    });
    await page.getByTestId("level-tab-p23").click();
    await expect(page.getByTestId("level-tab-p23")).toBeFocused();
    await page.getByTestId("topic-tile-fractions").click();
    await expect(page.locator(".topic-detail h1")).toBeFocused();
    await expect(page.locator('[data-testid^="lesson-card-"]')).toHaveCount(3);
    await expect(page).toHaveURL(/#topic\/fractions\?tab=p23$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: `docs/screenshots/playful-topic-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "← All topics", exact: true })
      .click();
    await expect(page.getByTestId("topic-tile-fractions")).toBeFocused();
    await page.getByRole("searchbox").fill("zero");
    await expect(page.getByTestId("lesson-card-zero-in-a-place")).toBeVisible();
    await page.getByRole("searchbox").fill('<img src=x onerror="alert(1)">');
    await expect(
      page.getByRole("heading", { name: "No lessons match yet" }),
    ).toBeVisible();
    await expect(page.locator("img")).toHaveCount(0);
    await page
      .getByRole("button", { name: "See all topics", exact: true })
      .click();
    await page
      .getByRole("button", { name: "All lessons", exact: true })
      .click();
    await expect(page.locator('[data-testid^="lesson-card-"]')).toHaveCount(
      libraryIndex.lessons.length,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("topic navigation works by keyboard with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByTestId("level-tab-p23").focus();
  await page.keyboard.press("Enter");
  const tile = page.getByTestId("topic-tile-place-value");
  await tile.focus();
  const outline = await tile.evaluate(
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator(".topic-detail h1")).toBeFocused();
  await page.getByTestId("lesson-card-zero-in-a-place").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("check-answer")).toBeVisible();
  await page.getByTestId("lesson-home").click();
  await expect(page.getByTestId("lesson-card-zero-in-a-place")).toBeFocused();
  await page.getByRole("button", { name: "← All topics", exact: true }).click();
  const starter = page.locator(".library-start");
  await starter.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("check-answer")).toBeVisible();
  await page.getByTestId("lesson-home").click();
  await expect(page.locator(".library-start")).toBeFocused();
});

test("capture design study home, topic and empty states", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const state of ["home", "topic", "empty"]) {
      await page.goto(`/docs/design/playful-home.html#${state}`);
      await expect(page.locator(`#${state}`)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `docs/design/${state}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto("/author.html");
    const tab = page.getByRole("button", {
      name: "Starter lessons",
      exact: true,
    });
    await tab.focus();
    expect(
      await tab.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `docs/screenshots/playful-author-${width}.png`,
      fullPage: true,
    });
  }
});
