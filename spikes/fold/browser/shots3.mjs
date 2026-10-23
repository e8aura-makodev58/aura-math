// WP0a SPIKE (throwaway): three.js screenshots. LD_LIBRARY_PATH=/home/makodev58/rendertest/libs/usr/lib/x86_64-linux-gnu
import { chromium } from "@playwright/test";
const out = "docs/screenshots/manipulatives/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://127.0.0.1:5192/demo3.html" + (process.argv[2] ? "?persp=1" : ""));
await page.waitForFunction(() => window.__s3 && window.__s3.wb);
const names = await page.evaluate(() => window.__s3.entries);
async function shot(file, idx, root, eighths, cam) {
  await page.evaluate(([i, r]) => window.__s3.select(i, r), [idx, root]);
  await page.evaluate(([e, cam]) => {
    const wb = window.__s3.wb;
    wb.vp.setView(cam);
    wb.vp.setDrawing(wb.vp.t8.map((_, i) => (typeof e === "number" ? e : e[i])));
    wb.placeGrips();
    wb.vp.renderNow();
  }, [eighths, cam]);
  await page.addStyleTag({ content: ".grip{display:none!important}" });
  await page.locator("#stage").screenshot({ path: out + file });
}
const f = (p) => names.findIndex((n) => n.startsWith(p));
const sfx = process.argv[2] ? "-persp" : "";
await shot(`gl-cube-flat${sfx}.png`, f("cube net"), 0, 0, { yaw: 0, pitch: 0 });
for (const k of [2, 4, 6]) await shot(`gl-cube-tween${k}${sfx}.png`, f("cube net"), 0, k, { yaw: -30, pitch: 45 });
await shot(`gl-cube-folded${sfx}.png`, f("cube net"), 0, 8, { yaw: -30, pitch: 45 });
await shot(`gl-collision-folded${sfx}.png`, f("collision net"), 0, 8, { yaw: -30, pitch: 45 });
await shot(`gl-collision-tween5${sfx}.png`, f("collision net"), 0, 5, { yaw: -30, pitch: 45 });
await shot(`gl-cuboid${sfx}.png`, f("cuboid"), 0, 8, { yaw: -30, pitch: 45 });
await shot(`gl-prism-tween4${sfx}.png`, f("triangular"), 0, 4, { yaw: -30, pitch: 45 });
await shot(`gl-prism${sfx}.png`, f("triangular"), 0, 8, { yaw: -30, pitch: 45 });
await shot(`gl-pyramid-tween4${sfx}.png`, f("square-pyr"), 0, 4, { yaw: -30, pitch: 45 });
await shot(`gl-pyramid${sfx}.png`, f("square-pyr"), 0, 8, { yaw: -30, pitch: 45 });
await browser.close();
