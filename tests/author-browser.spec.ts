import { test, expect } from "@playwright/test";

test("visual author edits a canvas block, undoes, saves and tries without JSON", async ({
  page,
}) => {
  await page.goto("/author.html");
  await page.getByTestId("lesson-card-ribbon-collection").click();
  await expect(page.locator("#draft-editor")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit title", exact: true }).click();
  await page
    .locator('[data-field="Lesson title"]')
    .first()
    .fill("A browser-authored title");
  await expect(page.locator('[data-region="title"]')).toContainText(
    "A browser-authored title",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-region="title"]')).not.toContainText(
    "A browser-authored title",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByTestId("author-status")).toContainText("Saved");
  await page
    .getByRole("button", { name: "Try as learner", exact: true })
    .click();
  await expect(page.locator(".author-edit-region")).toHaveCount(0);
  await expect(page.getByTestId("check-answer")).toBeVisible();
});

test("tablet author edits quantities and checks proposed wording before trial", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.goto("/author.html");
  await page.getByTestId("lesson-card-ribbon-collection").click();
  await page.getByRole("button", { name: "Edit diagram", exact: true }).click();
  await page.getByLabel("Smaller amount", { exact: true }).fill("12");
  await expect(
    page.getByRole("button", { name: "Try as learner", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Update wording from this task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply proposed wording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try as learner", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Try as learner", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".author-edit-region")).toHaveCount(0);
});

test("invalid file import retains the visual draft", async ({ page }) => {
  await page.goto("/author.html");
  await page.getByTestId("lesson-card-ribbon-collection").click();
  const title = await page.locator('[data-region="title"]').textContent();
  await page.getByText("More", { exact: true }).click();
  await page.getByText("Files and saved drafts", { exact: true }).click();
  await page
    .locator("#draft-file")
    .setInputFiles("tests/fixtures/hostile-import.json");
  await expect(
    page.getByText("Import rejected. The active draft is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('[data-region="title"]')).toHaveText(title!);
  await expect(page.locator("#author-app img")).toHaveCount(0);
});

for (const size of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
]) {
  test(`author library/editor and inspector fit ${size.width}×${size.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await page.goto("/author.html");
    await expect(
      page.getByRole("button", { name: "Starter lessons", exact: true }),
    ).toBeVisible();
    await page.getByTestId("lesson-card-ribbon-collection").click();
    await page.getByRole("button", { name: "Edit title", exact: true }).click();
    const input = page.locator('[data-field="Lesson title"]').first();
    await input.fill("Responsive draft title");
    await expect(input).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await testInfo.attach(`author-${size.width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    if (size.width < 1280) {
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Edit title", exact: true }),
      ).toBeFocused();
    }
  });
}

test("author new-task chooser presents a real model and starts a distinct lesson", async ({
  page,
}) => {
  await page.goto("/author.html");
  await page.getByRole("button", { name: "New lesson", exact: true }).click();
  await page
    .getByLabel("New topic and task")
    .selectOption("fractions:name-the-fraction");
  await expect(
    page.locator('.chooser-preview svg[role="img"]').first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create lesson", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit diagram", exact: true }).click();
  await expect(page.locator(".author-inspector input").first()).toBeVisible();
});

test("phone inspector traps focus and returns to the edited choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/author.html");
  await page.getByTestId("lesson-card-ribbon-collection").click();
  const edit = page
    .getByRole("button", { name: "Edit choice", exact: true })
    .first();
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Lesson editor" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Choice wording").fill("A edited choice");
  await dialog
    .getByRole("button", { name: "Done editing", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
});
