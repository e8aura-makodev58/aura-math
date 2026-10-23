import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as nodeProcess from "node:process";

/**
 * Admin model settings. Needs a dev server started with a temporary AURA_MATH_DATA_DIR and
 * AURA_MATH_FAKE_PROVIDER=1 (no provider is ever contacted), and the same two variables in this
 * test process so the test can read the token file. Skipped otherwise, so a default run can never
 * touch the real data folder or make a paid call.
 */
const dataDir = nodeProcess.env.AURA_MATH_DATA_DIR;
const fake = nodeProcess.env.AURA_MATH_FAKE_PROVIDER === "1";
test.skip(
  !dataDir || !fake,
  "Set AURA_MATH_DATA_DIR (temporary) and AURA_MATH_FAKE_PROVIDER=1 for the test server and this run.",
);
test.describe.configure({ mode: "serial" });

const KEY = "sk-test-BROWSER-secret-material-Wx9k";
const OTHER = "or-test-BROWSER-other-material-Pq4m";

async function adminToken(page: Page) {
  await page.goto("/admin.html");
  await expect(page.getByTestId("admin-lock")).toBeVisible();
  // The page's first (refused) request creates the token on first use.
  for (let i = 0; i < 50; i++) {
    try {
      return (await readFile(join(dataDir!, "admin.token"), "utf8")).trim();
    } catch {
      await page.waitForTimeout(100);
    }
  }
  throw new Error("admin.token was not created");
}

function recordResponses(page: Page) {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/admin/settings/"))
      bodies.push(await response.text().catch(() => ""));
  });
  return bodies;
}

const runId = Date.now().toString(36);

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`admin settings flow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const bodies = recordResponses(page);
    const token = await adminToken(page);

    // Wrong token, then unlock with the keyboard.
    const tokenField = page.getByLabel("Admin token", { exact: true });
    await tokenField.fill("not-the-token");
    await tokenField.press("Enter");
    await expect(page.getByTestId("admin-status")).toContainText(
      "did not match",
    );
    await tokenField.fill(token);
    await page.getByRole("button", { name: "Unlock settings" }).click();
    await expect(page.getByTestId("admin-settings")).toBeVisible();
    await expect(page.getByLabel("Provider", { exact: true })).toBeFocused();
    await expect(
      page.getByText("Test transport: this server never contacts a provider."),
    ).toBeVisible();
    expect(
      await page.evaluate(() => sessionStorage.getItem("aura-admin-token")),
    ).toBe(token);

    // The server keeps state between runs: start from Anthropic explicitly.
    await page
      .getByLabel("Provider", { exact: true })
      .selectOption("anthropic");
    const leftover = page.getByRole("button", { name: "Remove key" });
    if (await leftover.isVisible()) await leftover.click();
    // Save a key: only the masked hint comes back.
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "No key saved for Anthropic",
    );
    await page.getByLabel("New API key", { exact: true }).fill(KEY);
    await page.getByRole("button", { name: "Save key", exact: true }).click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "ending ••••Wx9k",
    );
    await expect(page.getByLabel("New API key", { exact: true })).toHaveValue(
      "",
    );
    await expect(
      page.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();

    // Discovery fills the model list; Opus 5.5 shows the seeded, unverified price.
    await page.getByRole("button", { name: "Refresh models" }).click();
    await expect(page.getByTestId("admin-status")).toContainText(
      "3 models found",
    );
    await page.getByLabel("Discovered models").selectOption("claude-opus-5-5");
    await expect(page.getByLabel("Model ID", { exact: true })).toHaveValue(
      "claude-opus-5-5",
    );
    await expect(page.getByTestId("admin-price-note")).toContainText(
      "not verified",
    );
    await expect(
      page.getByLabel("Input price (US$ per million tokens)"),
    ).toHaveValue("4");

    // Budget edit and enable.
    await page.getByLabel("Daily spending cap (US$)").fill("2.50");
    await page.getByLabel("Allow live model calls").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("admin-status")).toContainText(
      "Settings saved",
    );
    await expect(page.getByTestId("admin-spend")).toContainText("of US$2.50");
    await expect(page.getByTestId("admin-live")).toContainText(
      "On: Anthropic · claude-opus-5-5",
    );

    // Paid connection test (fake transport) needs the confirmation box.
    const run = page.getByRole("button", { name: "Run paid connection test" });
    await expect(run).toBeDisabled();
    await page
      .getByLabel("I understand this makes one small paid call")
      .check();
    await run.click();
    await expect(page.getByTestId("admin-test-result")).toContainText("PASS");
    await expect(page.getByTestId("admin-spend")).toContainText(
      "Paid calls today",
    );
    await expect(run).toBeDisabled();

    // Provider switch: OpenRouter discovery fails and asks for a manual id; no price yet.
    await page
      .getByLabel("Provider", { exact: true })
      .selectOption("openrouter");
    if (await leftover.isVisible()) await leftover.click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "No key saved for OpenRouter",
    );
    await page.getByLabel("New API key", { exact: true }).fill(OTHER);
    await page.getByRole("button", { name: "Save key", exact: true }).click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "ending ••••Pq4m",
    );
    await page.getByRole("button", { name: "Refresh models" }).click();
    await expect(page.getByTestId("admin-status")).toContainText(
      "Enter the exact model ID",
    );
    await page
      .getByLabel("Model ID", { exact: true })
      .fill(`vendor/test-${viewport.width}-${runId}`);
    await expect(page.getByTestId("admin-price-note")).toContainText(
      "No price yet",
    );
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("admin-status")).toContainText(
      "Enter this model's prices",
    );
    await page.getByLabel("Input price (US$ per million tokens)").fill("0.5");
    await page.getByLabel("Output price (US$ per million tokens)").fill("1.5");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("admin-live")).toContainText(
      `On: OpenRouter · vendor/test-${viewport.width}-${runId}`,
    );
    await expect(page.getByTestId("admin-price-note")).toContainText(
      "Entered by the admin",
    );

    // Remove keys: live calls switch off.
    await page.getByRole("button", { name: "Remove key" }).click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "No key saved for OpenRouter",
    );
    await expect(page.getByTestId("admin-live")).toContainText("Off");
    await page
      .getByLabel("Provider", { exact: true })
      .selectOption("anthropic");
    await page.getByRole("button", { name: "Remove key" }).click();
    await expect(page.getByTestId("admin-key-status")).toContainText(
      "No key saved for Anthropic",
    );

    // Layout: no horizontal scroll, 44 px targets, text floor.
    const layout = await page.evaluate(() => {
      const small = [
        ...document.querySelectorAll<HTMLElement>(
          ".admin-page button, .admin-page input:not([type=checkbox]), .admin-page select",
        ),
      ]
        .filter((node) => node.offsetParent !== null)
        .filter((node) => node.getBoundingClientRect().height < 44)
        .map((node) => node.id || node.textContent);
      const tiny = [
        ...document.querySelectorAll<HTMLElement>(
          ".admin-page p, .admin-page label, .admin-page button",
        ),
      ]
        .filter(
          (node) =>
            node.offsetParent !== null &&
            parseFloat(getComputedStyle(node).fontSize) < 14,
        )
        .map((node) => node.textContent);
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        small,
        tiny,
      };
    });
    expect(layout).toEqual({ overflow: false, small: [], tiny: [] });

    // Lock clears the token from this tab.
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByTestId("admin-lock")).toBeVisible();
    await expect(page.getByTestId("admin-settings")).toBeHidden();
    expect(
      await page.evaluate(() => sessionStorage.getItem("aura-admin-token")),
    ).toBeNull();
    await expect(page.getByLabel("Admin token", { exact: true })).toBeFocused();

    // No key ever reached the browser.
    const html = await page.content();
    for (const text of [html, ...bodies]) {
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(OTHER);
      expect(text).not.toContain(token);
    }
  });
}

test("admin routes refuse requests without the token or from another origin", async ({
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const anonymous = await request.post("/api/admin/settings/read", {
    headers: { origin, "content-type": "application/json" },
    data: {},
  });
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()["cache-control"]).toBe("no-store");
  expect(anonymous.headers()["x-content-type-options"]).toBe("nosniff");
  const crossOrigin = await request.post("/api/admin/settings/read", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
  // The data root is outside every served folder (R-120).
  const served = await request.get(`/@fs${dataDir}/provider-credentials.json`);
  expect([403, 404]).toContain(served.status());
  const token = await request.get(`/@fs${dataDir}/admin.token`);
  expect([403, 404]).toContain(token.status());
});
