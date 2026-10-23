import { expect, test } from "@playwright/test";

test("learner and author views load the bundled faces without a font CDN", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(?:woff2?|ttf)(?:\?|$)/.test(request.url()))
      fontRequests.push(request.url());
  });

  await page.goto("/");
  const learner = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
      loaded: [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family),
    };
  });
  expect(learner.body).toContain("Atkinson Hyperlegible Next");
  expect(learner.heading).toContain("Outfit");
  expect(learner.loaded).toContain("Atkinson Hyperlegible Next");
  expect(learner.loaded).toContain("Outfit");

  await page.goto("/author.html");
  const author = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
      loaded: [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family),
    };
  });
  expect(author.heading).toContain("Outfit");
  expect(author.loaded).toContain("Atkinson Hyperlegible Next");
  expect(
    fontRequests.some((url) => url.includes("outfit-latin-wght-normal.woff2")),
  ).toBe(true);
  expect(
    fontRequests.some((url) =>
      url.includes("atkinson-hyperlegible-next-latin-wght-normal.woff2"),
    ),
  ).toBe(true);
  expect(
    fontRequests.every(
      (url) => new URL(url).origin === new URL(page.url()).origin,
    ),
  ).toBe(true);
});
