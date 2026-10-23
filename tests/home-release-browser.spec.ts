import type { Lesson } from "../src/core/types";
import { test, expect, type Page } from "@playwright/test";
import example from "../content/examples/p4/p4-protractor-bench-read-ex1.json" with { type: "json" };

// The built learner app served by the dev server at /app/ (scripts/learner-static-plugin.ts).
// Build it first with `npm run deploy:home`.
test.beforeEach(async ({ request }) => {
  test.skip(
    (await request.get("/app/")).status() !== 200,
    "dist-learner is not built (run npm run deploy:home)",
  );
});
const LABEL = "Not reviewed by a teacher. Published by a parent for home use.";
const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const width of [390, 360]) {
  test(`/app/ home shows the unreviewed banner at ${width}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/app/");
    const banner = page.locator('[data-review-note="home"]');
    await expect(banner).toHaveText(LABEL);
    await expect(banner).toBeVisible();
    await expect(page.locator(".review-note")).toHaveCount(1);
    expect(
      await banner.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(14);
    expect(await noSideways(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`/app/ P4 lesson shows the label and saved examples at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/app/#lesson/p4-decimal-places");
    await expect(page.locator('[data-review-note="lesson"]')).toHaveText(LABEL);
    const nav = page.getByRole("navigation", { name: "Saved examples" });
    await expect(nav).toContainText("Example 1 of 6");
    await nav
      .getByRole("button", { name: "Next example →", exact: true })
      .click();
    await expect(nav).toContainText("Example 2 of 6");
    await expect(page).toHaveURL(/example=2/);
    await expect(page.locator('[data-review-note="lesson"]')).toBeVisible();
    expect(await noSideways(page)).toBe(true);
  });
}

test("/app/ saved example completes and keeps the picker", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/#lesson/p4-protractor-bench-read?example=2");
  await expect(page.locator('[data-review-note="lesson"]')).toHaveText(LABEL);
  await page.locator('[data-bench="phase-try"]').click();
  for (const step of (example.lesson as unknown as Lesson).steps) {
    const closedList = page.locator(".bench-list:not([open]) > summary");
    if (await closedList.count()) {
      await closedList.focus();
      await page.keyboard.press("Enter");
    }
    if (step.kind === "exact")
      await page.getByTestId("answer-input").fill(String(step.answer));
    else {
      const input = page.locator(
        `.answer-options input[value="${step.answer}"]`,
      );
      await input.focus();
      await page.keyboard.press("Space");
    }
    await page.getByTestId("check-answer").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('.feedback[role="status"]')).toContainText(
      "Nice thinking",
    );
    await page.getByTestId("next-step").focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator(".completion")).toBeVisible();
  const nav = page.locator(".completion").getByRole("navigation", {
    name: "Saved examples",
  });
  await expect(nav).toContainText("Example 2 of 6");
  await nav
    .getByRole("button", { name: "Next example →", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Saved examples" }),
  ).toContainText("Example 3 of 6");
  expect(await noSideways(page)).toBe(true);
});

// URL clients normalise "..", so raw traversal is covered in tests/learner-static.test.ts.
test("/app/ serves only the learner build", async ({ request }) => {
  expect((await request.get("/app/missing.js")).status()).toBe(404);
  expect((await request.get("/app/assets/")).status()).toBe(404);
  expect((await request.post("/app/")).status()).toBe(405);
  const html = await request.get("/app/");
  expect(html.headers()["cache-control"]).toBe("no-cache");
  expect(await html.text()).toContain('src="/app/assets/');
});
