import library from "../content/library.json" with { type: "json" };
import { expect, test } from "@playwright/test";

const lessons = library.lessons.map((entry) => ({ id: entry.lessonId }));

for (const width of [390, 1280]) {
  test(`all catalogue lessons and guided hints fit at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const lesson of lessons) {
      await page.goto("/#library?all=1");
      await page.getByTestId(`lesson-card-${lesson.id}`).click();
      await expect(page.getByTestId("check-answer")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.getByTestId("mode-guided").click();
      await page.getByTestId("hint-button").click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`${lesson.id}-${width}-hint`, {
        body: screenshot,
        contentType: "image/png",
      });
      if (width === 390) {
        await page.screenshot({
          path: `docs/screenshots/topics/${lesson.id}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("long title and author trial reflow at a 200% zoom viewport equivalent", async ({
  page,
}, testInfo) => {
  // A 640 CSS-pixel viewport models the reflow space of a 1280px window at 200%.
  // This is a viewport check, not a native browser zoom/accessibility audit.
  await page.setViewportSize({ width: 640, height: 500 });
  await page.goto("/author.html");
  await page.getByTestId("lesson-card-read-the-key").click();
  await page.getByRole("button", { name: "Edit title", exact: true }).click();
  await page
    .locator('[data-field="Lesson title"]')
    .first()
    .fill(
      "Reading our class picture graph: carefully count each symbol and use the key to explain the total",
    );
  await expect(
    page.getByRole("button", { name: "Done editing", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await page
    .getByRole("button", { name: "Try as learner", exact: true })
    .click();
  await expect(page.getByTestId("check-answer")).toBeVisible();
  await page.getByTestId("hint-button").click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  await page.screenshot({
    path: "docs/screenshots/author-long-title-trial-640.png",
    fullPage: true,
  });
  await testInfo.attach("long-title-640px-trial", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
