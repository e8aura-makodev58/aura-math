import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as nodeProcess from "node:process";

/**
 * Phase B2/B3 end to end: the adult generates story words on the locked admin page (fake provider,
 * no network), approves them, and a preview "Try another" on a framed lesson then shows an approved
 * story with its note. Needs a dev server started with a temporary AURA_MATH_DATA_DIR and
 * AURA_MATH_FAKE_PROVIDER=1, and the same variables here; skipped otherwise. Run it on its own
 * (--workers=1) so tests/admin-browser.spec.ts cannot change the shared settings mid-flow.
 */
const dataDir = nodeProcess.env.AURA_MATH_DATA_DIR;
const fake = nodeProcess.env.AURA_MATH_FAKE_PROVIDER === "1";
test.skip(
  !dataDir || !fake,
  "Set AURA_MATH_DATA_DIR (temporary) and AURA_MATH_FAKE_PROVIDER=1 for the test server and this run.",
);
test.describe.configure({ mode: "serial" });

const KEY = "sk-test-STORYFLOW-secret-material-Zt5w";
const NOTE =
  "Story words suggested by a computer helper and checked by a grown-up.";

async function unlock(page: Page) {
  await page.goto("/admin.html");
  await expect(page.getByTestId("admin-lock")).toBeVisible();
  let token = "";
  for (let i = 0; i < 50 && !token; i++) {
    try {
      token = (await readFile(join(dataDir!, "admin.token"), "utf8")).trim();
    } catch {
      await page.waitForTimeout(100);
    }
  }
  expect(token).not.toBe("");
  await page.getByLabel("Admin token", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Unlock settings" }).click();
  await expect(page.getByTestId("admin-settings")).toBeVisible();
  return token;
}

function hundredths(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
const decimal = (value: number) =>
  `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;

async function finishCord(page: Page) {
  const prompt = await page.locator('[data-region="prompt"]').innerText();
  const values = prompt.match(/\d+(?:\.\d+)?/g)!;
  expect(values).toHaveLength(3);
  await page
    .getByTestId("answer-input")
    .fill(
      decimal(
        hundredths(values[0]) - Number(values[1]) * hundredths(values[2]),
      ),
    );
  await page.getByTestId("check-answer").click();
  await expect(page.locator(".feedback")).toContainText("Nice thinking");
  await page.getByTestId("next-step").click();
  await page.getByRole("radio", { name: /Use equal place units/ }).check();
  await page.getByTestId("check-answer").click();
  await expect(page.locator(".feedback")).toContainText("Nice thinking");
  await page.getByTestId("next-step").click();
  await expect(page.locator(".completion")).toBeVisible();
}

test("adult generates and approves story words; Try another shows an approved story with its note", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const adminBodies: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/admin/settings/"))
      adminBodies.push(await response.text().catch(() => ""));
  });
  const token = await unlock(page);

  // Live calls on, with the fake transport.
  await page.getByLabel("Provider", { exact: true }).selectOption("anthropic");
  await expect(page.getByTestId("admin-key-status")).toContainText(
    "for Anthropic",
  );
  const remove = page.getByRole("button", { name: "Remove key" });
  if (await remove.isVisible()) {
    await remove.click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "No key saved for Anthropic",
    );
  }
  await page.getByLabel("New API key", { exact: true }).fill(KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await expect(page.getByTestId("admin-key-status")).toContainText("••••Zt5w");
  await page.getByLabel("Model ID", { exact: true }).fill("claude-opus-5-5");
  await page.getByLabel("Daily spending cap (US$)").fill("1.00");
  await page.getByLabel("Allow live model calls").check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("admin-live")).toContainText("On:");

  // Clear approved stories left by an earlier run.
  const approved = page.getByTestId("admin-approved-stories");
  const removes = approved.getByRole("button", { name: /^Remove/ });
  for (let left = await removes.count(); left > 0; left--) {
    await removes.first().click();
    await expect(removes).toHaveCount(left - 1);
  }

  // Generate: the outcome (kept, dropped, cost) appears under the button.
  await page
    .getByLabel("Story type")
    .selectOption({ label: "Length left after cutting pieces (decimals)" });
  await page.getByLabel("How many (1 to 10)").fill("4");
  await page.getByRole("button", { name: "Generate stories" }).click();
  const outcome = page.getByTestId("admin-inline-generate");
  await expect(outcome).toContainText("Kept 3, dropped 1");
  await expect(outcome).toContainText("Counted cost US$0.009600");
  const pending = page.getByTestId("admin-pending-stories");
  await expect(pending.getByTestId("admin-story")).not.toHaveCount(0);
  const waiting = await pending.getByTestId("admin-story").count();
  expect(waiting).toBeGreaterThanOrEqual(3);
  await expect(pending.getByTestId("admin-story").first()).toContainText(
    /has 9\.5 m of|holds 9\.5 m of|There are 9\.5 m of/,
  );

  // Reject one of the new ones, approve the other two newest (the last three are this batch).
  const stories = pending.getByTestId("admin-story");
  await stories
    .nth(waiting - 1)
    .getByRole("button", { name: /^Reject/ })
    .click();
  await expect(page.getByTestId("admin-inline-pending")).toContainText(
    "Rejected",
  );
  await expect(stories).toHaveCount(waiting - 1);
  for (const index of [waiting - 2, waiting - 3]) {
    await stories
      .nth(index)
      .getByRole("button", { name: /^Approve/ })
      .click();
    await expect(page.getByTestId("admin-inline-pending")).toContainText(
      "Approved",
    );
  }
  await expect(approved.getByTestId("admin-story")).toHaveCount(2);
  const approvedText = await approved.innerText();

  // Layout: no horizontal scroll and 44 px targets in the stories card.
  const layout = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="admin-stories"]')!;
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      small: [...card.querySelectorAll<HTMLElement>("button, input, select")]
        .filter((node) => node.getBoundingClientRect().height < 44)
        .map((node) => node.textContent),
    };
  });
  expect(layout).toEqual({ overflow: false, small: [] });
  for (const body of adminBodies) {
    expect(body).not.toContain(KEY);
    expect(body).not.toContain(token);
  }

  // The child's read-only route returns approved sets only.
  const publicReply = await page.request.get("/api/stories/approved");
  expect(publicReply.headers()["cache-control"]).toBe("no-store");
  const sets = (await publicReply.json()).sets as {
    slots: { name: string; item: string };
    status: string;
  }[];
  expect(sets).toHaveLength(2);
  expect(JSON.stringify(sets)).not.toContain("anthropic");
  for (const set of sets) expect(approvedText).toContain(set.slots.item);

  // Learner preview: Try another uses an approved set (3 in 4 chance each time) with the note.
  await page.goto("/#lesson/p4-decimal-practice");
  await expect(page.getByTestId("story-origin-note")).toHaveCount(0);
  let shown = false;
  for (let i = 0; i < 12 && !shown; i++) {
    await finishCord(page);
    await page.getByTestId("try-another").click();
    shown = (await page.getByTestId("story-origin-note").count()) > 0;
  }
  expect(shown).toBe(true);
  await expect(page.getByTestId("story-origin-note")).toHaveText(NOTE);
  const story = await page.locator('[data-region="story"]').innerText();
  expect(
    sets.some(
      (set) => story.includes(set.slots.name) && story.includes(set.slots.item),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  // Tidy the shared settings: remove the key so live calls stop.
  await page.goto("/admin.html");
  await expect(page.getByTestId("admin-settings")).toBeVisible();
  await page.getByLabel("Provider", { exact: true }).selectOption("anthropic");
  await page.getByRole("button", { name: "Remove key" }).click();
  await expect(page.getByTestId("admin-live")).toContainText("Off");
});

test("the approved-story route is read-only and needs no token; admin story routes need it", async ({
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  expect((await request.post("/api/stories/approved")).status()).toBe(405);
  const get = await request.get("/api/stories/approved");
  expect(get.status()).toBe(200);
  expect(get.headers()["x-content-type-options"]).toBe("nosniff");
  for (const action of [
    "stories-generate",
    "stories-list",
    "stories-approve",
    "stories-reject",
    "stories-remove",
  ]) {
    const reply = await request.post(`/api/admin/settings/${action}`, {
      headers: { origin, "content-type": "application/json" },
      data: {},
    });
    expect(reply.status(), action).toBe(401);
  }
});
