import { expect, test, type Page } from "@playwright/test";

async function checkCorrectAndAdvance(page: Page) {
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("Nice thinking");
  await page.getByTestId("next-step").click();
}

test("comparison checks intermediate work and retains answers and assistance across mode switches", async ({
  page,
}) => {
  await page.goto("/#library?all=1");
  await page.getByTestId("lesson-card-ribbon-collection").click();
  await page
    .getByRole("radio", {
      name: "Zac’s amount = Maya’s amount + the difference",
      exact: true,
    })
    .check();
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("Not quite yet");
  await expect(page.getByTestId("next-step")).toBeHidden();
  const relation = page.getByRole("radio", {
    name: "Maya’s amount = Zac’s amount + the difference",
    exact: true,
  });
  await relation.check();
  await page.getByTestId("hint-button").click();
  await expect(relation).toBeChecked();
  await checkCorrectAndAdvance(page);
  await page.getByTestId("answer-input").fill("18");
  await page.getByTestId("mode-guided").click();
  await expect(page.getByTestId("answer-input")).toHaveValue("18");
  await page.getByRole("button", { name: "On my own", exact: true }).click();
  await page.getByTestId("hint-button").click();
  await expect(page.getByTestId("answer-input")).toHaveValue("18");
  await checkCorrectAndAdvance(page);
  await page
    .getByRole("radio", {
      name: "The difference is 7: 11 + 7 = 18.",
      exact: true,
    })
    .check();
  await checkCorrectAndAdvance(page);
  await expect(
    page.getByText("Completed with facilitator", { exact: true }),
  ).toBeVisible();
});

test("rotated right angles accept reverse selection order and reject a partial set", async ({
  page,
}) => {
  await page.goto("/#library?all=1");
  await page.getByTestId("lesson-card-right-angle-hunt").click();
  await page.getByRole("checkbox", { name: "Card C", exact: true }).check();
  await page.getByTestId("check-answer").click();
  await expect(page.getByRole("status")).toContainText("Not quite yet");
  await expect(page.getByTestId("next-step")).toBeHidden();
  await page.getByRole("checkbox", { name: "Card A", exact: true }).check();
  await checkCorrectAndAdvance(page);
  await page
    .getByRole("radio", {
      name: "The opening between the arms matters, even when the angle is turned.",
      exact: true,
    })
    .check();
  await checkCorrectAndAdvance(page);
  await expect(
    page.getByText("Completed without app support", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".completion-note", {
      hasText: "The app cannot observe help from another person.",
    }),
  ).toBeVisible();
});

test("reset clears the current attempt and reload discards preview results", async ({
  page,
}) => {
  await page.goto("/#library?all=1");
  await page.getByTestId("lesson-card-corner-detective").click();
  await page.getByRole("radio", { name: "Card B", exact: true }).check();
  await checkCorrectAndAdvance(page);
  await page.getByTestId("hint-button").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Restart lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Which card shows a right angle?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Card B", exact: true }),
  ).not.toBeChecked();
  await expect(page.getByTestId("hint-button")).toContainText(
    "I’d like a little hint",
  );
  await page.getByRole("radio", { name: "Card B", exact: true }).check();
  await checkCorrectAndAdvance(page);
  await page
    .getByRole("radio", {
      name: "The opening between the arms matters, even when the angle is turned.",
      exact: true,
    })
    .check();
  await checkCorrectAndAdvance(page);
  await expect(
    page.getByText("Completed without app support", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("lesson-home").click();
  await expect(
    page.locator('article[data-lesson-id="corner-detective"]'),
  ).toContainText("Completed without app support");
  await page.reload();
  await expect(
    page.locator('article[data-lesson-id="corner-detective"]'),
  ).not.toContainText("Completed");
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

test("keyboard users can enter and complete an angle selection", async ({
  page,
}) => {
  await page.goto("/#library?all=1");
  await page.getByTestId("lesson-card-corner-detective").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Which card shows a right angle?",
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole("radio", { name: "Card B", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByTestId("check-answer").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("next-step")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "What matters when you compare angles?",
      exact: true,
    }),
  ).toBeFocused();
});

test("preview loads without external requests or browser errors", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // Primary 4 is the default tab; the earlier topics sit behind the Primary 2–3 tab.
  await expect(page.getByTestId("topic-tile-whole-numbers")).toBeVisible();
  await page.getByTestId("level-tab-p23").click();
  await expect(page.getByTestId("topic-tile-comparison")).toBeVisible();
  await page.goto("/#library?all=1");
  await expect(
    page.locator('[data-testid^="lesson-card-"]').first(),
  ).toBeVisible();
  await page.locator('[data-testid^="lesson-card-"]').first().click();
  await expect(page.getByTestId("check-answer")).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1024, 1280]) {
  test(`home and lesson fit a ${width}px viewport`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    // Primary 4 is the default tab; the earlier topics sit behind the Primary 2–3 tab.
    await expect(page.getByTestId("topic-tile-whole-numbers")).toBeVisible();
    await page.getByTestId("level-tab-p23").click();
    await expect(page.getByTestId("topic-tile-comparison")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await testInfo.attach(`home-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await page.goto("/#library?all=1");
    await expect(
      page.locator('[data-testid^="lesson-card-"]').first(),
    ).toBeVisible();
    await page.locator('[data-testid^="lesson-card-"]').first().click();
    await expect(page.getByTestId("check-answer")).toBeVisible();
    await testInfo.attach(`lesson-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
