/**
 * WP0a SPIKE (THROWAWAY). Heavy painter's-order vs z-buffer sweep.
 * Run: npx vite-node spikes/fold/tests/sweep.ts <kind> <shard> <shards> <out.json>
 *   kind: end | tween | end-under
 */
import { writeFileSync } from "node:fs";
import {
  bspOrder,
  buildBsp,
  pose,
  sortOrder,
  basis,
  type FoldModel,
  type SortMode,
  type View,
} from "../fold";
import {
  cellModel,
  classify,
  fixedOrientations,
  freeHexominoes,
  rotationClasses,
} from "../nets-model";
import { fragItems, Grid, painter, refState, wholeFaces, zbuffer } from "./zbuffer";

export const MODES: SortMode[] = ["centroid", "nearest", "split"];
export function views(kind: "above" | "under"): View[] {
  const out: View[] = [];
  const pitches = kind === "above" ? [0, 15, 30, 45, 60, 75] : [-15, -30, -45, -60, -75];
  for (let yaw = -180; yaw < 180; yaw += 15) for (const pitch of pitches) out.push({ yaw, pitch });
  return out;
}

export interface Stat {
  configs: number;
  covered: number;
  mism: number;
  coverageMism: number;
  ties: number;
  configsAny: number;
  configsOver: number; // > 0.5 % of covered samples
  worst: { frac: number; desc: string };
}
const newStat = (): Stat => ({
  configs: 0,
  covered: 0,
  mism: 0,
  coverageMism: 0,
  ties: 0,
  configsAny: 0,
  configsOver: 0,
  worst: { frac: 0, desc: "" },
});
export type Result = Record<string, Record<SortMode, Stat>>; // bucket -> mode -> stat

export function netsFor(group: "cube" | "collide", mode: "fixed" | "rotation") {
  const out: { name: string; cells: [number, number][]; cls: string }[] = [];
  freeHexominoes().forEach((free, fi) => {
    const cls = classify(free);
    const want = group === "cube" ? cls === "cube" : cls === "collide1";
    if (!want) return;
    const list = mode === "fixed" ? fixedOrientations(free) : rotationClasses(free);
    list.forEach((cells, oi) =>
      out.push({ name: `${group}${fi}.${oi}`, cells: cells as [number, number][], cls }),
    );
  });
  return out;
}

export function evalState(
  m: FoldModel,
  ang: number[],
  vs: View[],
  grid: Grid,
  bucket: Record<SortMode, Stat>,
  tag: string,
) {
  const P = pose(m, ang);
  const ref = refState(m, ang);
  const bsp = buildBsp(m, P).root;
  for (const view of vs) {
    const z = zbuffer(ref, m.centre, view, grid);
    const b = basis(view);
    const picks: Record<SortMode, Int16Array> = {
      centroid: painter(m, P, view, grid, wholeFaces(m, sortOrder(m, P, b, "centroid"))),
      nearest: painter(m, P, view, grid, wholeFaces(m, sortOrder(m, P, b, "nearest"))),
      split: painter(m, P, view, grid, fragItems(bspOrder(bsp, b))),
    };
    let ties = 0;
    for (let p = 0; p < z.id.length; p++) if (z.tie[p]) ties++;
    for (const mode of MODES) {
      const pic = picks[mode];
      let covered = 0,
        mism = 0,
        cov = 0;
      for (let p = 0; p < z.id.length; p++) {
        if (z.tie[p]) continue;
        const r = z.id[p],
          q = pic[p];
        if (r < 0 && q < 0) continue;
        if (r < 0 || q < 0) {
          cov++;
          continue;
        }
        covered++;
        if (r !== q) mism++;
      }
      const s = bucket[mode];
      s.configs++;
      s.covered += covered;
      s.mism += mism;
      s.coverageMism += cov;
      s.ties += ties;
      if (mism > 0) s.configsAny++;
      const frac = covered ? mism / covered : 0;
      if (frac > 0.005) s.configsOver++;
      if (frac > s.worst.frac) s.worst = { frac, desc: `${tag} yaw=${view.yaw} pitch=${view.pitch}` };
    }
  }
}

export function bucketOf(res: Result, name: string) {
  return (res[name] ??= { centroid: newStat(), nearest: newStat(), split: newStat() });
}

export function runEnd(group: "cube" | "collide", shard: number, shards: number, under = false) {
  const res: Result = {};
  const vs = views(under ? "under" : "above");
  const nets = netsFor(group, "fixed");
  let item = 0;
  for (const net of nets)
    for (let root = 0; root < 6; root++) {
      if (item++ % shards !== shard) continue;
      const m = cellModel(net.cells, root);
      const grid = new Grid(m.radius);
      const n = m.hinges.length;
      for (let s = 0; s < 1 << n; s++) {
        const ang = m.hinges.map((h, i) => ((s >> i) & 1 ? h.max : 0));
        evalState(m, ang, vs, grid, bucketOf(res, `${group}-end`), `${net.name} root=${root} mask=${s}`);
      }
    }
  return res;
}

export function runTween(group: "cube" | "collide", shard: number, shards: number) {
  const res: Result = {};
  const vs = views("above");
  const nets = netsFor(group, "rotation");
  let item = 0;
  for (const net of nets)
    for (let root = 0; root < 6; root++) {
      if (item++ % shards !== shard) continue;
      const m = cellModel(net.cells, root);
      const grid = new Grid(m.radius);
      const n = m.hinges.length;
      for (let h = 0; h < n; h++)
        for (let k = 1; k <= 7; k++)
          for (let o = 0; o < 1 << (n - 1); o++) {
            const ang = m.hinges.map((hh, i) => {
              if (i === h) return (k / 8) * hh.max;
              const bit = i < h ? i : i - 1;
              return (o >> bit) & 1 ? hh.max : 0;
            });
            const tag = `${net.name} root=${root} hinge=${h} t=${k}/8 others=${o}`;
            evalState(m, ang, vs, grid, bucketOf(res, `${group}-tween`), tag);
            evalState(m, ang, vs, grid, bucketOf(res, `${group}-tween-t${k}`), tag);
          }
    }
  return res;
}

const [, , kind, shardS, shardsS, out] = process.argv;
if (kind && out) {
  const shard = Number(shardS),
    shards = Number(shardsS);
  const t0 = Date.now();
  let res: Result = {};
  const merge = (a: Result) => {
    for (const [k, v] of Object.entries(a)) res[k] = v;
  };
  if (kind === "end") {
    merge(runEnd("cube", shard, shards));
    merge(runEnd("collide", shard, shards));
  } else if (kind === "end-under") {
    merge(runEnd("cube", shard, shards, true));
    merge(runEnd("collide", shard, shards, true));
  } else if (kind === "tween") {
    merge(runTween("cube", shard, shards));
    merge(runTween("collide", shard, shards));
  } else if (kind === "tween-cube") merge(runTween("cube", shard, shards));
  else if (kind === "tween-collide") merge(runTween("collide", shard, shards));
  else if (kind === "end-cube") merge(runEnd("cube", shard, shards));
  else throw new Error("kind");
  res = JSON.parse(JSON.stringify(res));
  writeFileSync(out, JSON.stringify({ ms: Date.now() - t0, res }));
  console.log(`${kind} shard ${shard}/${shards} done in ${Date.now() - t0} ms`);
}
