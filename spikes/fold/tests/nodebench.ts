import { basis, buildBsp, bspOrder, pose, sortOrder } from "../fold";
import { cellModel } from "../nets-model";
const cells: [number, number][] = [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]];
const m = cellModel(cells, 0);
const N = 20000;
const run = (name: string, f: (ang: number[], v: { yaw: number; pitch: number }) => void) => {
  for (let i = 0; i < 2000; i++) f(m.hinges.map((h) => h.max * ((i % 8) / 8)), { yaw: -30, pitch: 45 });
  const t0 = performance.now();
  for (let i = 0; i < N; i++) f(m.hinges.map((h) => h.max * ((i % 64) / 64)), { yaw: (i % 24) * 15 - 180, pitch: 45 });
  console.log(name.padEnd(10), ((performance.now() - t0) / N * 1000).toFixed(2), "us/frame");
};
run("pose only", (a) => void pose(m, a));
run("centroid", (a, v) => { const P = pose(m, a); sortOrder(m, P, basis(v), "centroid"); });
run("nearest", (a, v) => { const P = pose(m, a); sortOrder(m, P, basis(v), "nearest"); });
run("bsp split", (a, v) => { const P = pose(m, a); const { root } = buildBsp(m, P); bspOrder(root, basis(v)); });
