// WP0a SPIKE (throwaway): frame cost at 1x and 4x CPU throttle, layout counters, listener leaks.
// LD_LIBRARY_PATH=/home/makodev58/rendertest/libs/usr/lib/x86_64-linux-gnu node spikes/fold/browser/perf.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const stat = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(4), median: +q(0.5).toFixed(4), p95: +q(0.95).toFixed(4), max: +s.at(-1).toFixed(4) };
};
const out = { runs: {} };
for (const rate of [1, 4]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    // count forced-layout reads
    window.__layoutReads = 0;
    for (const [proto, names] of [
      [Element.prototype, ["getBoundingClientRect", "getClientRects"]],
      [SVGGraphicsElement.prototype, ["getBBox", "getCTM", "getScreenCTM"]],
      [Window.prototype, ["getComputedStyle"]],
    ])
      for (const n of names) {
        const orig = proto[n];
        proto[n] = function (...a) {
          window.__layoutReads++;
          return orig.apply(this, a);
        };
      }
    for (const n of ["offsetWidth", "offsetHeight", "clientWidth", "clientHeight", "scrollWidth", "scrollHeight"]) {
      const d = Object.getOwnPropertyDescriptor(Element.prototype, n) || Object.getOwnPropertyDescriptor(HTMLElement.prototype, n);
      if (d && d.get)
        Object.defineProperty(Element.prototype, n, { configurable: true, get() { window.__layoutReads++; return d.get.call(this); } });
    }
  });
  await page.goto("http://127.0.0.1:5192/");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await cdp.send("Performance.enable");
  await page.evaluate(() => window.__spike.select(0, 0, true)); // cube net, tween on
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  // 1. direct frame cost (setState + grips), 240 frames fold-all, after warm-up
  await page.evaluate(() => window.__spike.bench(120));
  await page.evaluate(() => (window.__layoutReads = 0));
  const direct = await page.evaluate(() => window.__spike.bench(240));
  const readsDirect = await page.evaluate(() => window.__layoutReads);
  // 2. real rAF-driven animation with browser metrics
  const m0 = await metrics();
  const raf = await page.evaluate(() => window.__spike.rafBench(120));
  const m1 = await metrics();
  const d = (k) => +(m1[k] - m0[k]).toFixed(5);
  const frames = raf.length;
  // 3. frame interval (does the page hold 60 fps?) measured with plain rAF timestamps
  const intervals = await page.evaluate(
    () =>
      new Promise((res) => {
        const wb = window.__spike.wb;
        const ts = [];
        let f = 0;
        const step = (now) => {
          ts.push(now);
          wb.t.forEach((_, i) => (wb.t[i] = (f % 60) / 60));
          wb.draw();
          if (++f < 180) requestAnimationFrame(step);
          else res(ts.slice(1).map((t, i) => t - ts[i]));
        };
        requestAnimationFrame(step);
      }),
  );
  out.runs[`cpu${rate}x`] = {
    directSetStateMs: stat(direct),
    layoutReadsDuringDirectBench: readsDirect,
    rafScriptMs: stat(raf),
    perFrame: {
      LayoutCount: +(d("LayoutCount") / frames).toFixed(3),
      RecalcStyleCount: +(d("RecalcStyleCount") / frames).toFixed(3),
      ScriptMs: +((d("ScriptDuration") * 1000) / frames).toFixed(3),
      LayoutMs: +((d("LayoutDuration") * 1000) / frames).toFixed(3),
      RecalcStyleMs: +((d("RecalcStyleDuration") * 1000) / frames).toFixed(3),
      TaskMs: +((d("TaskDuration") * 1000) / frames).toFixed(3),
    },
    frameIntervalMs: stat(intervals),
    layoutReadsDuringRaf: await page.evaluate(() => window.__layoutReads),
  };
  await ctx.close();
}

// listener leaks (1x)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    const targets = new Set();
    const live = new Map(); // target -> Set(key)
    const id = new WeakMap();
    let n = 0;
    const key = (l) => (id.has(l) ? id.get(l) : (id.set(l, ++n), n));
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (t, l, o) {
      if (l) {
        targets.add(this);
        const k = `${t}|${typeof o === "object" ? !!o?.capture : !!o}|${key(l)}`;
        (live.get(this) ?? live.set(this, new Set()).get(this)).add(k);
      }
      return add.call(this, t, l, o);
    };
    EventTarget.prototype.removeEventListener = function (t, l, o) {
      if (l) live.get(this)?.delete(`${t}|${typeof o === "object" ? !!o?.capture : !!o}|${key(l)}`);
      return rem.call(this, t, l, o);
    };
    window.__listeners = () => {
      let win = 0, doc = 0, mql = 0, connected = 0, detached = 0;
      for (const [t, s] of live) {
        if (t === window) win += s.size;
        else if (t === document) doc += s.size;
        else if (t instanceof MediaQueryList) mql += s.size;
        else if (t instanceof Node) t.isConnected ? (connected += s.size) : (detached += s.size);
      }
      return { window: win, document: doc, mediaQueryList: mql, connectedElements: connected, detachedElements: detached };
    };
  });
  await page.goto("http://127.0.0.1:5192/");
  const R = {};
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }] });
  await page.evaluate(() => window.__spike.destroy());
  R.baselineAfterDestroy = await page.evaluate(() => window.__listeners());
  await page.evaluate(() => window.__spike.mount());
  R.mounted = await page.evaluate(() => window.__listeners());
  // 50 mount/destroy cycles over all shapes
  await page.evaluate(() => {
    const names = window.__spike.entries.length;
    for (let i = 0; i < 50; i++) window.__spike.select(i % names, 0, i % 2 === 0);
  });
  await page.evaluate(() => window.__spike.destroy());
  R.after50CyclesAndDestroy = await page.evaluate(() => window.__listeners());
  // mid-drag destroy
  await page.evaluate(() => window.__spike.select(0, 0, true));
  const g = await page.locator('.grip[data-hinge="0"]').boundingBox();
  // (Playwright injects ~12 hit-target listeners on window the first time it targets an element; take the baseline after that)
  R.beforeDrag = await page.evaluate(() => window.__listeners());
  await touch("touchStart", g.x + 22, g.y + 22);
  await touch("touchMove", g.x + 42, g.y + 22);
  R.midDrag = await page.evaluate(() => window.__listeners());
  await page.evaluate(() => window.__spike.destroy());
  R.afterMidDragDestroy = await page.evaluate(() => window.__listeners());
  await touch("touchEnd");
  // no rAF after destroy
  await page.evaluate(() => window.__spike.select(0, 0, true));
  R.framesAfterDestroy = await page.evaluate(async () => {
    const wb = window.__spike.wb;
    wb.foldAll(true);
    await new Promise((r) => setTimeout(r, 40));
    window.__spike.destroy();
    const f0 = wb.frames;
    await new Promise((r) => setTimeout(r, 600));
    return { framesAtDestroy: f0, framesLater: wb.frames };
  });
  out.listeners = R;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
