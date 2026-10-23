/**
 * WP0a SPIKE (throwaway). GPU depth buffer (SwiftShader) vs the test-side plane-equation reference.
 * Run: LD_LIBRARY_PATH=... npx vite-node spikes/fold/tests/glcheck.ts <out.json> [sample]
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cellModel, classify, fixedOrientations, freeHexominoes, rotationClasses, solidModel } from "../nets-model";
import { Grid, refState, zbuffer } from "./zbuffer";
import { views } from "./sweep";

const outFile = process.argv[2];
const quick = process.argv[3] === "quick";
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const vs = views("above");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://127.0.0.1:5192/demo3.html");
await page.waitForFunction(() => (window as any).__s3?.wb);

interface Agg { states: number; renders: number; covered: number; mism: number; ties: number; cfgAny: number; cfgOver: number; worst: number; desc: string; ms: number }
const agg: Record<string, Agg> = {};
const A = (k: string) => (agg[k] ??= { states: 0, renders: 0, covered: 0, mism: 0, ties: 0, cfgAny: 0, cfgOver: 0, worst: 0, desc: "", ms: 0 });

async function run(bucket: string, mountExpr: () => Promise<void>, m: ReturnType<typeof cellModel>, label: string, states: number[][], viewsPer: number) {
  await mountExpr();
  const grid = new Grid(m.radius, 64);
  const jobs: { t8: number[]; view: { yaw: number; pitch: number } }[] = [];
  for (const t8 of states) for (let v = 0; v < viewsPer; v++) jobs.push({ t8, view: vs[Math.floor(rnd() * vs.length)] });
  const a = A(bucket);
  for (let i = 0; i < jobs.length; i += 60) {
    const batch = jobs.slice(i, i + 60);
    const t0 = Date.now();
    const res: number[][] = await page.evaluate((b) => (window as any).__s3.idBatch(b), batch);
    a.ms += Date.now() - t0;
    batch.forEach((j, k) => {
      const ang = j.t8.map((e, h) => (e / 8) * m.hinges[h].max);
      const z = zbuffer(refState(m, ang), m.centre, j.view, grid);
      let cov = 0, mism = 0, ties = 0;
      for (let p = 0; p < z.id.length; p++) {
        if (z.tie[p]) { ties++; continue; }
        const r = z.id[p], g = res[k][p] - 1;
        if (r < 0 && g < 0) continue;
        cov++;
        if (r !== g) mism++;
      }
      a.renders++; a.covered += cov; a.mism += mism; a.ties += ties;
      if (mism) a.cfgAny++;
      const fr = cov ? mism / cov : 0;
      if (fr > 0.005) a.cfgOver++;
      if (fr > a.worst) { a.worst = fr; a.desc = `${label} t8=${j.t8.join("")} yaw=${j.view.yaw} pitch=${j.view.pitch}`; }
    });
  }
  a.states += states.length;
}
function tweenStates(n: number, others: number) {
  const s: number[][] = [];
  for (let h = 0; h < n; h++) for (let k = 1; k <= 7; k++) for (let o = 0; o < others; o++) {
    const mask = Math.floor(rnd() * (1 << n));
    s.push(Array.from({ length: n }, (_, i) => (i === h ? k : (mask >> i) & 1 ? 8 : 0)));
  }
  return s;
}
function endStates(n: number) { return Array.from({ length: 1 << n }, (_, m) => Array.from({ length: n }, (_, i) => ((m >> i) & 1 ? 8 : 0))); }

const T0 = Date.now();
for (const group of ["cube", "collide1"] as const) {
  let ni = 0;
  for (const free of freeHexominoes().filter((c) => classify(c) === group))
    for (const cells of rotationClasses(free)) {
      ni++;
      if (quick && ni > 2) continue;
      for (let root = 0; root < 6; root++) {
        const m = cellModel(cells, root);
        const mount = () => page.evaluate(([c, r]) => (window as any).__s3.mountCells(c, r), [cells, root] as [typeof cells, number]);
        await run(`${group}-end`, mount, m, `${group} ${cells.join(";")} root=${root}`, endStates(5), 3);
        await run(`${group}-tween`, mount, m, `${group} ${cells.join(";")} root=${root}`, tweenStates(5, 2), 3);
        // fold-all tween (what the Fold all button shows)
        await run(`${group}-foldall`, mount, m, `${group} ${cells.join(";")} root=${root}`, Array.from({ length: 7 }, (_, k) => Array(5).fill(k + 1)), 6);
      }
      console.log(group, ni, "done", ((Date.now() - T0) / 1000).toFixed(0), "s");
    }
}
for (const s of ["cuboid", "triangular-prism", "square-pyramid"] as const) {
  const nf = solidModel(s, 0).polys.length;
  for (let root = 0; root < nf; root++) {
    const m = solidModel(s, root);
    const mount = () => page.evaluate(([n, r]) => (window as any).__s3.mountSolid(n, r), [s, root] as [string, number]);
    const n = m.hinges.length;
    await run(`${s}-end`, mount, m, `${s} root=${root}`, endStates(n), 6);
    await run(`${s}-tween`, mount, m, `${s} root=${root}`, tweenStates(n, 3), 4);
    await run(`${s}-foldall`, mount, m, `${s} root=${root}`, Array.from({ length: 7 }, (_, k) => Array(n).fill(k + 1)), 10);
  }
}
writeFileSync(outFile, JSON.stringify({ totalMs: Date.now() - T0, agg }, null, 1));
console.log("done", Date.now() - T0, "ms");
await browser.close();
