import type { Lesson } from "../src/core/types";
import { test, expect } from "@playwright/test";
import example from "../content/examples/p4/p4-protractor-bench-read-ex1.json" with { type: "json" };
const familyCaptures = [
  "p4-decimal-places",
  "p4-fraction-add-subtract",
  "p4-composite-area",
  "p4-place-value-100k",
  "p4-read-line-graph",
  "p4-fold-a-solid",
  "p4-read-bar-chart",
  "p4-read-pie-chart",
  "p4-shade-to-complete-bench",
  "p4-protractor-bench-read",
];
for (const id of familyCaptures)
  test(`${id}: phone saved-example capture`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto(`/#lesson/${id}?example=2`);
    await expect(
      page.getByRole("navigation", { name: "Saved examples" }),
    ).toContainText("Example 2 of 6");
    if (await page.locator('[data-bench="phase-try"]').count())
      await page.locator('[data-bench="phase-try"]').click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/p4-examples/${id}-360.png`,
      fullPage: true,
    });
  });
for (const width of [360, 390])
  for (const id of [
    "p4-decimal-places",
    "p4-fold-a-cube-net",
    "p4-protractor-bench-read",
  ]) {
    test(`${id} saved picker and deep link at ${width}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/#lesson/${id}`);
      const nav = page.getByRole("navigation", { name: "Saved examples" });
      await expect(nav).toContainText("Example 1 of 6");
      for (let n = 2; n <= 6; n++) {
        await nav
          .getByRole("button", { name: "Next example →", exact: true })
          .click();
        await expect(nav).toContainText(`Example ${n} of 6`);
        await expect(page).toHaveURL(new RegExp(`example=${n}`));
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await nav
        .getByRole("button", { name: "← Previous", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(nav).toContainText("Example 5 of 6");
      await page.reload();
      await expect(nav).toContainText("Example 5 of 6");
      await page.goto(`/#lesson/${id}?example=999`);
      await expect(nav).toContainText("Example 1 of 6");
      expect(errors).toEqual([]);
    });
  }
test("a saved 2D example can be completed with keyboard entry", async ({
  page,
}) => {
  await page.goto("/#lesson/p4-protractor-bench-read?example=2");
  await page.locator('[data-bench="phase-try"]').click();
  for (const step of (example.lesson as unknown as Lesson).steps) {
    // Workbench steps keep the answer controls in the collapsed list version; open it by keyboard.
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
  await expect(
    page.getByRole("navigation", { name: "Saved examples" }),
  ).toContainText("Example 2 of 6");
  await expect(page.locator(".completion")).toBeVisible();
});
