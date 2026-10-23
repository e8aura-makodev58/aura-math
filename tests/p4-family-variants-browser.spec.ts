import { expect, test, type Page } from "@playwright/test";

/**
 * One phone-width check per newly enabled family: complete the starter, press "Try another",
 * see a different example and complete it too. Answers are read from the last hint rung (exact
 * steps) or found by trying options (choice steps), so the check exercises the real lesson view.
 */
const LESSONS: [family: string, id: string][] = [
  ["whole numbers", "p4-estimate-by-rounding"],
  ["bar charts", "p4-read-bar-chart"],
  ["pie charts", "p4-pie-chart-count"],
  ["line graphs", "p4-line-graph-change"],
  ["angle measure", "p4-turns"],
  ["symmetry", "p4-symmetric-figure"],
  ["nets", "p4-cube-net-check"],
  ["area and perimeter", "p4-composite-area"],
];

async function lastHint(page: Page): Promise<string> {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('[data-hint-rung="4"]').count()) break;
    await page.getByTestId("hint-button").click();
  }
  return page.locator('[data-region="hint"] p').innerText();
}

async function solveStep(page: Page) {
  const input = page.getByTestId("answer-input");
  if (await input.count()) {
    const hint = (await lastHint(page)).replace(/\u00a0/g, "");
    const enter = hint.match(/Enter (\d+(?:\.\d+)?)\./);
    const numbers = hint.match(/\d+(?:\.\d+)?/g) ?? [];
    await input.fill(enter ? enter[1] : numbers[numbers.length - 1]);
    await page.getByTestId("check-answer").click();
    await expect(page.getByTestId("next-step")).toBeVisible();
  } else {
    const options = page.getByRole("radio");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      await options.nth(i).check();
      await page.getByTestId("check-answer").click();
      await expect(page.locator(".feedback")).not.toBeEmpty();
      if (await page.getByTestId("next-step").isVisible()) break;
    }
    await expect(page.getByTestId("next-step")).toBeVisible();
  }
  await page.getByTestId("next-step").click();
}

async function finish(page: Page) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator(".completion").isVisible()) return;
    await solveStep(page);
  }
  await expect(page.locator(".completion")).toBeVisible();
}

for (const [family, id] of LESSONS)
  test(`${family}: Try another gives a different example that completes at 390px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/#lesson/${id}`);
    const canvas = page.locator(".lesson-canvas");
    await expect(canvas).toBeVisible();
    const original = await canvas.innerHTML();
    await finish(page);
    await page.getByTestId("try-another").click();
    await expect(page).toHaveURL(new RegExp(`lesson/${id}(?:\\?|$)`));
    await expect(canvas).toBeVisible();
    const fresh = await canvas.innerHTML();
    expect(fresh).not.toBe(original);
    await finish(page);
    await expect(page.locator(".completion-label")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
