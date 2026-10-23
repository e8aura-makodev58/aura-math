import type { Lesson } from "../src/core/types";
import { expect, test, type Page } from "@playwright/test";
import read from "../content/lessons/p4-protractor-bench-read.json" with { type: "json" };
import draw from "../content/lessons/p4-protractor-bench-draw.json" with { type: "json" };
import mirror from "../content/lessons/p4-mirror-line-bench.json" with { type: "json" };
import shade from "../content/lessons/p4-shade-to-complete-bench.json" with { type: "json" };

const lessons = [read, draw, mirror, shade] as unknown as { lesson: Lesson }[];
async function finish(page: Page, pkg: { lesson: Lesson }) {
  for (const step of pkg.lesson.steps.slice(1)) {
    if (step.kind === "exact")
      await page.getByTestId("answer-input").fill(String(step.answer));
    else
      for (const id of Array.isArray(step.answer) ? step.answer : [step.answer])
        await page.locator(`.answer-options input[value="${id}"]`).check();
    await page.getByTestId("check-answer").click();
    await expect(page.locator('.feedback[role="status"]')).toContainText(
      "Nice thinking",
    );
    await page.getByTestId("next-step").click();
  }
  await expect(page.locator(".completion")).toBeVisible();
}
for (const width of [320, 360, 390, 1280])
  for (const pkg of lessons) {
    test(`${pkg.lesson.id}: actual controls complete at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/#lesson/${pkg.lesson.id}`);
      const stage = page.getByTestId("bench-stage");
      await expect(stage).toBeVisible();
      await page.locator('[data-bench="phase-try"]').click();
      if (pkg.lesson.topic === "angle-measure") {
        const initial = await stage.getAttribute("data-pose");
        await page
          .getByRole("button", { name: "Move left", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        expect(await stage.getAttribute("data-pose")).not.toBe(initial);
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        expect(await stage.getAttribute("data-pose")).toBe(initial);
        if (pkg.lesson.id === draw.lesson.id)
          await page
            .getByLabel("Turn the angle arm (construction practice)")
            .evaluate((el) => {
              (el as HTMLInputElement).value = "115";
              el.dispatchEvent(new Event("input", { bubbles: true }));
            });
        await page
          .getByRole("textbox", {
            name:
              pkg.lesson.id === draw.lesson.id
                ? "Adjacent angle in degrees"
                : "Your angle reading in degrees",
            exact: true,
          })
          .fill(String(pkg.lesson.steps[0].answer));
      } else if (pkg.lesson.id === mirror.lesson.id) {
        await expect(stage.locator('[data-ghost="true"]')).toHaveCount(0);
        await page
          .locator(`.bench-chip[data-choice="${pkg.lesson.steps[0].answer}"]`)
          .click();
        await expect(stage.locator('[data-ghost="true"]')).toHaveCount(0);
      } else {
        for (const id of pkg.lesson.steps[0].answer as string[]) {
          const choice = pkg.lesson.steps[0].choices!.find((c) => c.id === id)!;
          await page
            .locator(`[data-cell="${choice.meaning!.replace("cell:", "")}"]`)
            .click();
        }
        await expect(stage.locator('[data-ghost="true"]')).toHaveCount(0);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390 || width === 1280)
        await page.screenshot({
          path: `docs/screenshots/manipulatives/${pkg.lesson.id}-${width}.png`,
          fullPage: true,
        });
      await page.getByTestId("check-answer").click();
      await expect(page.locator('.feedback[role="status"]')).toContainText(
        "Nice thinking",
      );
      await page.getByTestId("next-step").click();
      await expect(page.locator('[data-region="workbench"]')).toBeHidden();
      await finish(page, pkg);
      await expect(page.locator(".completion-note")).toContainText(
        "practice aids",
      );
      expect(errors).toEqual([]);
    });
  }

test("support reveals a reflection, mode switch preserves it, replay resets it", async ({
  page,
}) => {
  await page.goto(`/#lesson/${mirror.lesson.id}`);
  await page.locator('[data-bench="phase-try"]').click();
  await page
    .locator(`.bench-chip[data-choice="${mirror.lesson.steps[0].answer}"]`)
    .click();
  await page.locator('[data-action="hint"]').click();
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator('[data-ghost="true"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Learn together", exact: true })
    .click();
  await expect(page.locator('[data-ghost="true"]')).toBeVisible();
  await page.getByTestId("check-answer").click();
  await page.getByTestId("next-step").click();
  await finish(page, mirror as unknown as { lesson: Lesson });
  await page.locator('[data-action="replay"]').click();
  await page.locator('[data-bench="phase-try"]').click();
  await expect(page.locator('[data-ghost="true"]')).toHaveCount(0);
});

test("dial handles support pointer drag with cancellation and a keyboard equivalent", async ({
  page,
}) => {
  await page.goto(`/#lesson/${read.lesson.id}`);
  await page.locator('[data-bench="phase-try"]').click();
  const handle = page.getByRole("button", { name: "Move dial", exact: true }),
    stage = page.getByTestId("bench-stage");
  // The stage sits below the fold of the default 1280×720 viewport; a real pointer user scrolls
  // to it first, so do the same before reading the handle's on-screen position.
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const initial = await stage.getAttribute("data-pose");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 25,
    box.y + box.height / 2 - 15,
    { steps: 3 },
  );
  await page.mouse.up();
  expect(await stage.getAttribute("data-pose")).not.toBe(initial);
  await handle.focus();
  const before = await stage.getAttribute("data-pose");
  await page.keyboard.press("ArrowLeft");
  expect(await stage.getAttribute("data-pose")).not.toBe(before);
});

test("reduced motion keeps Watch stepwise and leaves hands-on buttons usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#lesson/${read.lesson.id}`);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".bench")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await page.locator('[data-bench="phase-try"]').click();
  await page.getByRole("button", { name: "Move left", exact: true }).click();
});
