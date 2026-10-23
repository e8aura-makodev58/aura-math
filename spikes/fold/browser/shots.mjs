// WP0a SPIKE (throwaway): screenshots of folded states. LD_LIBRARY_PATH=/home/makodev58/rendertest/libs/usr/lib/x86_64-linux-gnu
import { chromium } from "@playwright/test";
const out = "docs/screenshots/manipulatives/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:5192/");
const names = await page.evaluate(() => window.__spike.entries);
console.log(names.join("\n"));
async function shot(file, idx, root, t, cam) {
  await page.evaluate(([idx, root]) => window.__spike.select(idx, root, false), [idx, root]);
  await page.evaluate(([t, cam]) => {
    const wb = window.__spike.wb;
    wb.t.forEach((_, i) => (wb.t[i] = typeof t === "number" ? t : t[i]));
    wb.setCamera(cam);
  }, [t, cam]);
  await page.addStyleTag({ content: ".grip{display:none!important}" });
  const box = await page.evaluate(() => {
    const svg = document.querySelector("#stage svg");
    const r = svg.getBoundingClientRect();
    const gs = [...svg.querySelectorAll("g[data-face]")].map((g) => g.getBoundingClientRect());
    const x0 = Math.min(...gs.map((g) => g.left)), y0 = Math.min(...gs.map((g) => g.top));
    const x1 = Math.max(...gs.map((g) => g.right)), y1 = Math.max(...gs.map((g) => g.bottom));
    return { x: x0 - 12, y: y0 - 12, width: x1 - x0 + 24, height: y1 - y0 + 24, r: r.width };
  });
  await page.screenshot({ path: out + file, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
}
const cubeIdx = names.findIndex((n) => n.startsWith("cube net"));
const colIdx = names.findIndex((n) => n.startsWith("collision net"));
const prism = names.indexOf("triangular-prism"), pyr = names.indexOf("square-pyramid"), cuboid = names.indexOf("cuboid");
await shot("cube-flat.png", cubeIdx, 0, 0, { yaw: 0, pitch: 0 });
await shot("cube-half.png", cubeIdx, 0, 0.5, { yaw: -30, pitch: 45 });
await shot("cube-folded-corner.png", cubeIdx, 0, 1, { yaw: -30, pitch: 45 });
await shot("collision-folded-corner.png", colIdx, 0, 1, { yaw: -30, pitch: 45 });
await shot("collision-folded-front.png", colIdx, 0, 1, { yaw: 0, pitch: 30 });
await shot("cuboid-folded-corner.png", cuboid, 0, 1, { yaw: -30, pitch: 45 });
await shot("prism-half.png", prism, 0, 0.5, { yaw: -30, pitch: 45 });
await shot("prism-folded-corner.png", prism, 0, 1, { yaw: -30, pitch: 45 });
await shot("pyramid-half.png", pyr, 0, 0.5, { yaw: -30, pitch: 45 });
await shot("pyramid-folded-corner.png", pyr, 0, 1, { yaw: -30, pitch: 45 });
await browser.close();
