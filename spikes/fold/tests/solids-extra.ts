// WP0a SPIKE (throwaway): extra sort "backfirst" (back-facing faces first, then centroid) on solids.
import { basis, faceMatrix, isBack, pose, sortOrder } from "../fold";
import { solidModel } from "../nets-model";
import { Grid, painter, refState, wholeFaces, zbuffer } from "./zbuffer";
import { views } from "./sweep";

const vs = views("above");
const out: Record<string, { configs: number; mism: number; covered: number; cfgOver: number; worst: number; desc: string }> = {};
for (const s of ["cuboid", "triangular-prism", "square-pyramid"] as const) {
  for (const kind of ["end", "tween"]) {
    const key = `${s}-${kind}`;
    out[key] = { configs: 0, mism: 0, covered: 0, cfgOver: 0, worst: 0, desc: "" };
    const nf = solidModel(s, 0).polys.length;
    for (let root = 0; root < nf; root++) {
      const m = solidModel(s, root);
      const grid = new Grid(m.radius);
      const n = m.hinges.length;
      const states: number[][] = [];
      if (kind === "end") for (let mask = 0; mask < 1 << n; mask++) states.push(m.hinges.map((h, i) => ((mask >> i) & 1 ? h.max : 0)));
      else
        for (let h = 0; h < n; h++)
          for (let k = 1; k <= 7; k++)
            for (let o = 0; o < 1 << (n - 1); o++)
              states.push(m.hinges.map((hh, i) => (i === h ? (k / 8) * hh.max : (o >> (i < h ? i : i - 1)) & 1 ? hh.max : 0)));
      for (const ang of states) {
        const P = pose(m, ang), ref = refState(m, ang);
        for (const view of vs) {
          const b = basis(view);
          const z = zbuffer(ref, m.centre, view, grid);
          const backs = P.map((M) => {
            const mm = faceMatrix(M, b, 1, 0, 0, m.centre);
            return isBack(mm[0], mm[1], mm[2], mm[3]);
          });
          const cen = sortOrder(m, P, b, "centroid");
          const order = [...cen.filter((f) => backs[f]), ...cen.filter((f) => !backs[f])];
          const pic = painter(m, P, view, grid, wholeFaces(m, order));
          let cov = 0, mm = 0;
          for (let p = 0; p < z.id.length; p++) {
            if (z.tie[p] || z.id[p] < 0 || pic[p] < 0) continue;
            cov++;
            if (z.id[p] !== pic[p]) mm++;
          }
          const o = out[key];
          o.configs++; o.covered += cov; o.mism += mm;
          const fr = cov ? mm / cov : 0;
          if (fr > 0.005) o.cfgOver++;
          if (fr > o.worst) { o.worst = fr; o.desc = `root=${root} ang=${ang.map((a) => a.toFixed(2))} yaw=${view.yaw} pitch=${view.pitch}`; }
        }
      }
    }
  }
}
console.log(JSON.stringify(out, null, 1));
