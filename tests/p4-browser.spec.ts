import { expect, test, type Page } from "@playwright/test";
import library from "../content/library.json" with { type: "json" };

for (const [id, field, value] of [
  ["p4-decimal-add-subtract", "First / available value", "8.25"],
  ["p4-fraction-of-quantity", "Whole set quantity (1–120)", "32"],
  ["p4-composite-area", "Outer width in cm (2–30)", "14"],
]) {
  test(`P4 author can edit and try ${id} without JSON`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.goto("/author.html");
    await page.getByTestId(`lesson-card-${id}`).click();
    await page
      .getByRole("button", { name: "Edit diagram", exact: true })
      .click();
    await page.getByLabel(field, { exact: true }).fill(value);
    await expect(
      page.getByRole("button", { name: "Try as learner", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Update wording from this task",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Apply proposed wording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Try as learner", exact: true })
      .click();
    await expect(page.getByTestId("check-answer")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: `docs/screenshots/${id}-author-trial-390.png`,
      fullPage: true,
    });
  });
}

async function finish(page: Page, id: string) {
  const payload = (
    await import(`../content/lessons/${id}.json`, { with: { type: "json" } })
  ).default;
  for (const step of payload.lesson.steps) {
    // hands-on steps keep their answer controls in a collapsed list version
    const list = page.locator(".bench-list:not([open]) > summary");
    if (await list.count()) await list.click();
    if (step.kind === "exact" || step.kind === "number")
      await page.getByTestId("answer-input").fill(String(step.answer));
    else
      for (const value of Array.isArray(step.answer)
        ? step.answer
        : [step.answer])
        await page.locator(`input[value="${value}"]`).check();
    await page.getByTestId("check-answer").click();
    await expect(page.getByRole("status")).toContainText("Nice thinking");
    await page.getByTestId("next-step").click();
  }
  await expect(page.locator(".completion")).toBeVisible();
}

test("P4 mixed practice survives reload and returns to preparation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start the adventure →", exact: true })
    .click();
  const ids = library.collections[0].practiceIds;
  await page
    .getByRole("button", {
      name: `Try ${ids.length} mixed ${ids.length === 1 ? "question" : "questions"} →`,
      exact: true,
    })
    .click();
  await page.reload();
  for (const [i, id] of ids.entries()) {
    await expect(page).toHaveURL(new RegExp(`lesson/${id}\\?`));
    await finish(page, id);
    if (i < ids.length - 1)
      await page
        .getByRole("button", { name: "Next mixed question →", exact: true })
        .click();
  }
  await page.getByTestId("lesson-home").click();
  await expect(page.locator(".preparation h1")).toHaveText(
    "P4 revision adventures",
  );
});

test("P4 decimal syntax recovery and adult solutions retain support", async ({
  page,
}) => {
  await page.goto("/#lesson/p4-decimal-practice");
  const input = page.getByTestId("answer-input");
  await expect(input).toHaveAttribute("inputmode", "decimal");
  await input.fill("3+4");
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("format");
  await expect(input).toHaveValue("3+4");
  await page
    .getByRole("button", {
      name: "For adults: reveal worked solutions (uses support)",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-slot="solutions"]')).toBeVisible();
  await finish(page, "p4-decimal-practice");
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed with support",
  );
});

test("P4 lessons complete with exact inputs and remain usable with expanded text spacing", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const entry of library.lessons.filter((l) => l.level === "P4")) {
    await page.goto(`/#lesson/${entry.lessonId}`);
    await finish(page, entry.lessonId);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#lesson/p4-fraction-practice");
  await expect(page.getByTestId("answer-input")).toHaveAttribute(
    "inputmode",
    "text",
  );
  await page.addStyleTag({
    content:
      "* {line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p {margin-bottom:2em!important}",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.getByTestId("check-answer")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/p4-text-spacing-390.png",
    fullPage: true,
  });
});
