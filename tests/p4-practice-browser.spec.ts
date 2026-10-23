import { expect, test, type Page } from "@playwright/test";

const source = "p4-decimal-add-subtract";
const sourceURL = `/#lesson/${source}`;

test("design mock captures desktop and phone for inspection", async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/docs/design/playful-p4-lesson.html");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({
      path: `/tmp/aura-p4-mock-${width}.png`,
      fullPage: true,
    });
  }
});

function hundredths(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function decimal(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

async function correctStep(page: Page) {
  await page.getByTestId("check-answer").click();
  // The author view also has a draft-status region, so pick the answer feedback specifically.
  await expect(page.locator(".feedback")).toContainText("Nice thinking");
  await page.getByTestId("next-step").click();
}

async function alignment(page: Page) {
  await page.getByRole("radio", { name: /Line up decimal points/ }).check();
  await correctStep(page);
}

async function calculation(page: Page) {
  const prompt = await page.locator('[data-region="prompt"]').innerText();
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*[−-]\s*(\d+(?:\.\d+)?)/);
  expect(match, `Visible subtraction in: ${prompt}`).not.toBeNull();
  const result = hundredths(match![1]) - hundredths(match![2]);
  await page.getByTestId("answer-input").fill(decimal(result));
  await correctStep(page);
  return prompt;
}

async function reflection(page: Page) {
  await page.getByRole("radio", { name: /Use equal place units/ }).check();
  await correctStep(page);
  await expect(page.locator(".completion")).toBeVisible();
}

async function finishSubtraction(page: Page) {
  await alignment(page);
  const prompt = await calculation(page);
  await reflection(page);
  return prompt;
}

test("hinted subtraction gets different variables and a fresh unsupported attempt", async ({
  page,
}) => {
  await page.goto(sourceURL);
  await page.getByTestId("hint-button").click();
  const original = await finishSubtraction(page);
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed with support",
  );
  await page.getByTestId("try-another").click();
  await expect(page).toHaveURL(new RegExp(`lesson/${source}(?:\\?|$)`));
  await expect(page.locator('[data-region="hint"]')).toBeHidden();
  await expect(page.locator('[data-slot="solutions"]')).toBeHidden();
  const fresh = await finishSubtraction(page);
  expect(fresh).not.toBe(original);
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed without app support",
  );
});

test("guided mode carries to a fresh example and survives switching back", async ({
  page,
}) => {
  await page.goto(sourceURL);
  await page.getByTestId("mode-guided").click();
  await finishSubtraction(page);
  await page.getByTestId("try-another").click();
  await expect(page.getByTestId("mode-guided")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-mode="independent"]').click();
  await finishSubtraction(page);
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed with facilitator",
  );
});

test("syntax recovery retains input, same-example replay retains values, reload restores source", async ({
  page,
}) => {
  await page.goto(sourceURL);
  await finishSubtraction(page);
  await page.getByTestId("try-another").click();
  await alignment(page);
  const generated = await page.locator('[data-region="prompt"]').innerText();
  const input = page.getByTestId("answer-input");
  await input.fill("3+4");
  await page.getByTestId("check-answer").click();
  await expect(input).toHaveValue("3+4");
  await expect(page.getByRole("status")).toContainText("format");
  await page.getByTestId("hint-button").click();
  await calculation(page);
  await reflection(page);
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed with support",
  );
  await page.locator('[data-action="replay"]').click();
  await alignment(page);
  await expect(page.locator('[data-region="prompt"]')).toHaveText(generated);
  await expect(page.getByTestId("answer-input")).toHaveValue("");
  await page.reload();
  await alignment(page);
  await expect(page.locator('[data-region="prompt"]')).toHaveText(
    "Work out 7.25 − 2.6.",
  );
});

async function finishCord(page: Page) {
  const prompt = await page.locator('[data-region="prompt"]').innerText();
  const values = prompt.match(/\d+(?:\.\d+)?/g)!;
  expect(values).toHaveLength(3);
  const result =
    hundredths(values[0]) - Number(values[1]) * hundredths(values[2]);
  await page.getByTestId("answer-input").fill(decimal(result));
  await correctStep(page);
  await reflection(page);
  return prompt;
}

test("fresh mixed questions stay in their source slot and return to preparation", async ({
  page,
}) => {
  await page.goto(
    "/#lesson/p4-decimal-practice?collection=p4-preparation&practice=1&tab=p4",
  );
  const prompts = new Set([await finishCord(page)]);
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("try-another").click();
    prompts.add(await finishCord(page));
    await expect(page).toHaveURL(/lesson\/p4-decimal-practice\?/);
  }
  expect(prompts.size).toBe(3);
  await page
    .getByRole("button", { name: "Next mixed question →", exact: true })
    .click();
  await expect(page).toHaveURL(/lesson\/p4-fraction-practice\?/);
  await page.getByTestId("lesson-home").click();
  await expect(page.locator(".preparation h1")).toHaveText(
    "P4 revision adventures",
  );
});

test("author frozen trial has no generation control or draft mutation", async ({
  page,
}) => {
  await page.goto("/author.html");
  await page.getByTestId(`lesson-card-${source}`).click();
  // innerText also holds a line break and the "Edit story" button label; compare the story line only.
  const story = (await page.locator('[data-region="story"]').innerText()).split(
    "\n",
  )[0];
  await page
    .getByRole("button", { name: "Try as learner", exact: true })
    .click();
  await finishSubtraction(page);
  await expect(page.getByTestId("try-another")).toBeHidden();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator('[data-region="story"]')).toContainText(story);
  await expect(
    page.getByRole("button", { name: "Edit diagram", exact: true }),
  ).toBeVisible();
});

test("phone active prompt and controls remain usable with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(sourceURL);
  const prompt = await page.locator('[data-region="prompt"]').boundingBox();
  expect(prompt).not.toBeNull();
  expect(prompt!.y + prompt!.height).toBeLessThan(844);
  await finishSubtraction(page);
  await page.getByTestId("try-another").click();
  await finishSubtraction(page);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
