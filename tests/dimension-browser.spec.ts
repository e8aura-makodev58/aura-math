import { expect, test } from "@playwright/test";

const lessons = [
  ["p4-rectangle-missing-side", ["?", "7 cm"]],
  ["p4-composite-area", ["12 cm", "8 cm", "4 cm", "3 cm"]],
  ["p4-composite-perimeter", ["?", "12 cm", "8 cm", "4 cm", "3 cm"]],
] as const;

for (const [id, expected] of lessons) {
  for (const width of [390, 1280]) {
    test(`${id} draws dimension lines inside the page at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/#lesson/${id}`);
      const model = page.locator(".area-perimeter-model svg").first();
      await expect(model).toBeVisible();
      // A straight SVG line has zero thickness in layout, so assert it exists rather than that it is "visible".
      await expect(model.locator(".dim-line").first()).toBeAttached();
      await expect(model.locator(".dim-extension").first()).toBeAttached();
      await expect(model.locator(".dim-arrow").first()).toBeAttached();
      const labels = await model.locator("text").allTextContents();
      for (const text of expected) expect(labels).toContain(text);
      // Nothing is clipped by the SVG viewport and the page does not scroll sideways.
      const clipped = await model.evaluate((svg) => {
        const view = svg.getBoundingClientRect();
        return [...svg.querySelectorAll("text")].some((t) => {
          const box = t.getBoundingClientRect();
          return (
            box.left < view.left - 1 ||
            box.right > view.right + 1 ||
            box.top < view.top - 1 ||
            box.bottom > view.bottom + 1
          );
        });
      });
      expect(clipped).toBe(false);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("the answer is never drawn: a missing side stays a question mark in the learner view", async ({
  page,
}) => {
  await page.goto("/#lesson/p4-rectangle-missing-side");
  const labels = await page
    .locator(".area-perimeter-model svg text")
    .allTextContents();
  expect(labels).toContain("?");
  expect(labels).not.toContain("12 cm");
});

test("author inspector offers dimension lines and explains when suggestions are unavailable", async ({
  page,
}) => {
  await page.goto("/author.html");
  await page.evaluate(() =>
    (
      document.querySelector(
        '[data-lesson="p4-composite-perimeter"]',
      ) as HTMLElement
    ).click(),
  );
  await page.getByRole("button", { name: "Edit diagram", exact: true }).click();
  const panel = page.locator(".dimension-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Layout: automatic.")).toBeVisible();
  const suggest = panel.getByRole("button", { name: "Suggest a layout" });
  // Without credentials the control is disabled with an explanation; with them it is enabled.
  await expect(panel.locator(".dimension-message")).not.toHaveText(
    "Checking whether suggestions are available…",
  );
  if (await suggest.isDisabled())
    await expect(panel.locator(".dimension-message")).toContainText(
      /ANTHROPIC_API_KEY|development server/,
    );
  // The inspector stays inside the viewport on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
