// WP0a SPIKE (throwaway): R-102 touch checks in Chromium with touch EMULATION (not a device).
// LD_LIBRARY_PATH=/home/makodev58/rendertest/libs/usr/lib/x86_64-linux-gnu node spikes/fold/browser/grips.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto("http://127.0.0.1:5192/");
await page.evaluate(() => window.__spike.select(0, 0, false));
const res = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function touch(type, x, y) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }] });
}
async function swipe(x0, y0, x1, y1, steps = 12, end = "touchEnd") {
  await touch("touchStart", x0, y0);
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(16);
  }
  if (end) await touch(end, x1, y1);
  await sleep(300);
}
const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
const centre = async (sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};
const grip = async (i) => centre(`.grip[data-hinge="${i}"]`);
const tOf = (i) => page.evaluate((i) => window.__spike.wb.t[i], i);
const log = () => page.evaluate(() => window.__spike.wb.log.slice());

// size of the grips
const g0 = await grip(0);
res.gripSizeCssPx = [g0.w, g0.h];
res.computedTouchAction = await page.evaluate(() => getComputedStyle(document.querySelector(".grip")).touchAction);

// A. swipe that starts OUTSIDE any grip scrolls the page
await page.evaluate(() => window.scrollTo(0, 0));
const sp = await centre("#spacer");
await page.evaluate(() => window.scrollTo(0, 0));
// start on the empty margin below the picture, inside the viewport
const vp = page.viewportSize();
await swipe(20, vp.height - 40, 20, vp.height - 340);
res.A_swipeOutsideGrip_scrollY = await scrollY();

// B. vertical thumb swipe starting ON a grip must not scroll the page
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(100);
const g1 = await grip(0);
await swipe(g1.x, g1.y, g1.x, g1.y - 180);
res.B_verticalSwipeOnGrip_scrollY = await scrollY();
res.B_tAfter = await tOf(0);

// C. horizontal drag on grip changes the hinge, page does not scroll, release snaps
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(100);
const g2 = await grip(1);
await touch("touchStart", g2.x, g2.y);
for (let i = 1; i <= 10; i++) {
  await touch("touchMove", g2.x + i * 8, g2.y + i * 3);
  await sleep(16);
}
res.C_tDuringDrag = await tOf(1);
await touch("touchEnd");
await sleep(400);
res.C_tAfterRelease = await tOf(1);
res.C_scrollY = await scrollY();

// D. pointercancel: drag halfway, cancel, state reverts to the value at pointerdown
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(100);
const before = await tOf(2);
const g3 = await grip(2);
await touch("touchStart", g3.x, g3.y);
for (let i = 1; i <= 8; i++) {
  await touch("touchMove", g3.x + i * 10, g3.y);
  await sleep(16);
}
res.D_tMidDrag = await tOf(2);
await touch("touchCancel");
await sleep(200);
res.D_tBefore = before;
res.D_tAfterCancel = await tOf(2);
res.D_log = (await log()).filter((l) => /h=2/.test(l));
res.D_windowListenersStillAttached = await page.evaluate(() => window.__spike.wb && window.__spike.wb["dragWin"] !== null);

// E. negative controls: a plain button WITHOUT touch-action:none, and an SVG circle with it
await page.evaluate(() => {
  window.scrollTo(0, 0);
  const b = document.createElement("button");
  b.id = "ctl";
  b.textContent = "no touch-action";
  b.style.cssText = "position:fixed;left:150px;top:560px;width:88px;height:60px;z-index:9;touch-action:auto";
  window.__ctlEvents = [];
  for (const t of ["pointerdown", "pointercancel", "pointerup"]) b.addEventListener(t, () => window.__ctlEvents.push(t));
  document.body.append(b);
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  s.id = "ctlsvg";
  s.setAttribute("width", "120");
  s.setAttribute("height", "120");
  s.style.cssText = "position:fixed;left:20px;top:540px;z-index:9;touch-action:auto;background:#eee";
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("cx", "60");
  c.setAttribute("cy", "60");
  c.setAttribute("r", "50");
  c.setAttribute("fill", "#9cf");
  c.style.touchAction = "none";
  window.__svgEvents = [];
  for (const t of ["pointerdown", "pointercancel", "pointerup"]) c.addEventListener(t, () => window.__svgEvents.push(t));
  s.append(c);
  document.body.append(s);
});
await sleep(100);
const cb = await centre("#ctl");
await swipe(cb.x, cb.y, cb.x, cb.y - 180);
res.E_plainButton_scrollY = await scrollY();
res.E_plainButton_events = await page.evaluate(() => window.__ctlEvents);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(100);
const cc = await centre("#ctlsvg");
await swipe(cc.x, cc.y, cc.x, cc.y - 180);
res.F_svgCircleTouchActionNone_scrollY = await scrollY();
res.F_svgCircle_events = await page.evaluate(() => window.__svgEvents);

// G. keyboard route on a grip
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('.grip[data-hinge="3"]').focus();
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
res.G_tAfterTwoArrowRight = await tOf(3);
await page.keyboard.press("End");
res.G_tAfterEnd = await tOf(3);

console.log(JSON.stringify(res, null, 1));
await browser.close();
