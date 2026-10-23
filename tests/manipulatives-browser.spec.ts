import { expect, test, type Page } from "@playwright/test";

/*
 * Hands-on net folder (WP1/WP1b). Chromium emulation only: touch is CDP touch emulation, not a
 * device. These checks are not a human review of the lessons.
 */
const LESSONS = [
  "p4-fold-a-cube-net",
  "p4-fold-a-net-that-fails",
  "p4-fold-a-solid",
] as const;
const SHOTS = "docs/screenshots/manipulatives";

async function open(page: Page, id: string) {
  await page.goto("/#library?all=1");
  await page.getByTestId(`lesson-card-${id}`).click();
  await expect(page.getByTestId("bench-stage")).toBeVisible();
  await expect(page.getByTestId("bench-stage")).toHaveAttribute(
    "data-renderer",
    /webgl|fallback/,
  );
}
/** The right answer for the current step, read from the lesson data the page uses. */
async function answerLabel(page: Page, id: string): Promise<string> {
  const step = Number(
    await page
      .locator("[data-step-index]")
      .first()
      .getAttribute("data-step-index"),
  );
  const pkg = await (
    await page.request.get(`/content/lessons/${id}.json`)
  ).json();
  const s = pkg.lesson.steps[step];
  return s.choices.find((c: { id: string }) => c.id === s.answer).label;
}
async function layoutChecks(page: Page, width: number) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      ".bench button, .bench-list > summary",
    )) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.width < 44 || r.height < 44)
        out.push(`target ${el.textContent} ${r.width}x${r.height}`);
    }
    for (const el of document.querySelectorAll<HTMLElement>(".bench *")) {
      if (!el.childNodes.length || !el.getBoundingClientRect().width) continue;
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent!.trim(),
      );
      if (hasText && parseFloat(getComputedStyle(el).fontSize) < 11)
        out.push(`text ${el.textContent}`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}
async function finishReflection(page: Page, id: string, keyboard: boolean) {
  await page.locator(".answer-options").waitFor();
  const label = await answerLabel(page, id);
  const radio = page.getByRole("radio", { name: label });
  if (keyboard) {
    await radio.focus();
    await page.keyboard.press("Space");
    await page.getByTestId("check-answer").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("next-step").focus();
    await page.keyboard.press("Enter");
  } else {
    await radio.check();
    await page.getByTestId("check-answer").click();
    await page.getByTestId("next-step").click();
  }
}
async function benchStep(page: Page, id: string, keyboard: boolean) {
  const press = async (name: string) => {
    const b = page.locator(".bench").getByRole("button", { name, exact: true });
    if (keyboard) {
      await b.focus();
      await page.keyboard.press("Enter");
    } else await b.click();
  };
  await press("Your turn");
  if (keyboard) {
    // fold crease by crease with the keyboard
    const creases = page.locator(".bench-crease");
    for (let i = 0; i < (await creases.count()); i++) {
      await creases.nth(i).focus();
      await page.keyboard.press("Space");
    }
  } else await press("Fold all");
  const full = String(2 ** (await page.locator(".bench-crease").count()) - 1);
  await expect(page.getByTestId("bench-stage")).toHaveAttribute(
    "data-fold",
    full,
  );
  await press(await answerLabel(page, id));
  if (keyboard) {
    await page.getByTestId("check-answer").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("next-step")).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await page.getByTestId("check-answer").click();
    await page.getByTestId("next-step").click();
  }
}
async function complete(page: Page, id: string, keyboard: boolean, width = 0) {
  await open(page, id);
  const steps = await page.locator(".step-rail li").count();
  for (let i = 0; i < steps; i++) {
    if (await page.locator('[data-region="workbench"]').isVisible()) {
      await expect(page.getByTestId("bench-stage")).toBeVisible();
      if (width) await layoutChecks(page, width);
      await benchStep(page, id, keyboard);
    } else await finishReflection(page, id, keyboard);
  }
  await expect(page.getByText("You worked it out.")).toBeVisible();
  await expect(page.locator(".completion-label")).toHaveText(
    "Completed without app support",
  );
}

for (const width of [390, 360, 1280])
  test(`every hands-on lesson completes by buttons at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 800 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const id of LESSONS) await complete(page, id, false, width);
    expect(errors).toEqual([]);
  });

test("every hands-on lesson completes by keyboard alone at 390px", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 800 });
  for (const id of LESSONS) await complete(page, id, true);
});

test("WebGL in headless Chromium, screenshots of Watch and Your turn", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const renderers: string[] = [];
  for (const id of LESSONS) {
    await open(page, id);
    const stage = page.getByTestId("bench-stage");
    renderers.push((await stage.getAttribute("data-renderer"))!);
    const next = page
      .locator(".bench")
      .getByRole("button", { name: "Next", exact: true });
    await next.click();
    await next.click();
    await page.waitForTimeout(700);
    await page
      .locator(".bench")
      .screenshot({ path: `${SHOTS}/${id}-watch-mid.png` });
    while (await next.isEnabled()) await next.click();
    await page.waitForTimeout(700);
    await page
      .locator(".bench")
      .screenshot({ path: `${SHOTS}/${id}-watch-end.png` });
    await page
      .locator(".bench")
      .getByRole("button", { name: "Your turn" })
      .click();
    await page.locator(".bench-crease").first().click();
    await page.locator(".bench-crease").nth(1).click();
    await page.waitForTimeout(700);
    await page
      .locator(".bench")
      .screenshot({ path: `${SHOTS}/${id}-try-mid.png` });
    await page
      .locator(".bench")
      .getByRole("button", { name: "Fold all", exact: true })
      .click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${SHOTS}/${id}-try-folded-page.png`,
      fullPage: true,
    });
    await page
      .locator(".bench")
      .screenshot({ path: `${SHOTS}/${id}-try-folded.png` });
  }
  // headless Chromium on this machine provides WebGL (software); the fallback is tested below
  expect(renderers).toEqual(["webgl", "webgl", "webgl"]);
});

test("reduced motion: stepwise stills, no Play, a fold lands in one frame", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "p4-fold-a-cube-net");
  const bench = page.locator(".bench");
  await expect(bench).toHaveAttribute("data-motion", "reduced");
  await expect(bench.getByRole("button", { name: /^Play/ })).toBeHidden();
  await bench.getByRole("button", { name: "Next", exact: true }).click();
  await bench.getByRole("button", { name: "Your turn" }).click();
  const stage = page.getByTestId("bench-stage");
  await bench.getByRole("button", { name: "Fold all", exact: true }).click();
  // sample the drawn turns over the next frames: never an in-between value
  const samples = await page.evaluate(async () => {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      out.push(
        document.querySelector<HTMLElement>(".bench-stage")!.dataset.shown!,
      );
    }
    return out;
  });
  const full = "1.571,1.571,1.571,1.571,1.571";
  expect(samples.slice(1).every((s) => s === full)).toBe(true);
  await expect(stage).toHaveAttribute("data-shown", full);
});

test("full motion tweens through in-between turns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "p4-fold-a-cube-net");
  const bench = page.locator(".bench");
  await bench.getByRole("button", { name: "Your turn" }).click();
  await bench.getByRole("button", { name: "Fold all", exact: true }).click();
  const samples = await page.evaluate(async () => {
    const out: string[] = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      out.push(
        document.querySelector<HTMLElement>(".bench-stage")!.dataset.shown!,
      );
    }
    return out;
  });
  const between = samples.filter((s) =>
    s.split(",").some((a) => Number(a) > 0.01 && Number(a) < 1.56),
  );
  expect(between.length).toBeGreaterThan(0);
});

test("hint rung 4 folds the learner's own net and counts as support", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "p4-fold-a-cube-net");
  for (let i = 0; i < 4; i++) await page.getByTestId("hint-button").click();
  await expect(page.locator(".bench")).toHaveAttribute("data-phase", "try");
  await expect(page.getByTestId("bench-stage")).toHaveAttribute(
    "data-fold",
    "31",
  );
});

test("touch drag on the canvas turns the view and does not scroll the page", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await open(page, "p4-fold-a-cube-net");
  const canvas = page.locator(".bench-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const before = await page.evaluate(() => window.scrollY);
  const shotBefore = await canvas.screenshot();
  const cdp = await context.newCDPSession(page);
  const x = box.x + box.width / 2,
    y0 = box.y + box.height * 0.3;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: y0 }],
  });
  for (let k = 1; k <= 8; k++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + k * 6, y: y0 + k * 18 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect((await canvas.screenshot()).equals(shotBefore)).toBe(false);
  // a swipe that starts outside the canvas still scrolls the page
  const caption = (await page.locator(".bench-caption").boundingBox())!;
  const cy = caption.y + caption.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 30, y: cy }],
  });
  for (let k = 1; k <= 8; k++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 30, y: cy - k * 20 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await context.close();
});

test("a lost WebGL context shows the still picture and the buttons keep working", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "p4-fold-a-cube-net");
  await page.waitForTimeout(600); // let a still be captured
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".bench-canvas")!;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl!.getExtension("WEBGL_lose_context")!.loseContext();
  });
  const stage = page.getByTestId("bench-stage");
  await expect(stage).toHaveAttribute("data-renderer", "fallback");
  await expect(page.getByText("The 3D view stopped")).toBeVisible();
  await page
    .locator(".bench")
    .getByRole("button", { name: "Your turn" })
    .click();
  await page.locator(".bench-crease").first().click();
  await expect(stage).toHaveAttribute("data-fold", "1");
});

test("without WebGL the flat net and the button route remain", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await complete(page, "p4-fold-a-cube-net", false, 360);
});
