/** WP0a SPIKE (throwaway). three.js scene graph read-back vs the axis-angle oracle. No WebGL context. */
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { classify, cellModel, fixedOrientations, freeHexominoes, rolledCoincidences, solidModel } from "../nets-model";
import { Fold3 } from "../three/fold3";
import { refState } from "./zbuffer";

const out: Record<string, unknown> = {};
const save = () => writeFileSync(new URL("../results/scene-tests.json", import.meta.url), JSON.stringify(out, null, 1));

function maxErr(f3: Fold3, ang: number[]) {
  const ref = refState(f3.model, ang);
  f3.setAngles(ang);
  let e = 0;
  f3.model.polys.forEach((_, f) =>
    f3.corners(f).forEach((c, k) => {
      for (let i = 0; i < 3; i++) e = Math.max(e, Math.abs(c[i] - ref.corners[f][k][i]));
    }),
  );
  return e;
}
const statesFor = (n: number, max: number[]) => {
  const s: number[][] = [];
  for (let m = 0; m < 1 << n; m++) s.push(max.map((v, i) => ((m >> i) & 1 ? v : 0)));
  // integer-eighth tween frames: every hinge alone at 1..7 eighths, others folded
  for (let h = 0; h < n; h++) for (let k = 1; k <= 7; k++) s.push(max.map((v, i) => (i === h ? (k / 8) * v : v)));
  return s;
};

describe("three.js scene graph vs independent axis-angle oracle", () => {
  it("cube nets (64 fixed orientations x 6 floors), collision nets (100 x 6), all hinge subsets and tween frames", () => {
    let configs = 0,
      worst = 0;
    const per: Record<string, number> = {};
    for (const group of ["cube", "collide1"]) {
      let n = 0;
      for (const free of freeHexominoes().filter((c) => classify(c) === group))
        for (const cells of fixedOrientations(free))
          for (let root = 0; root < 6; root++) {
            const m = cellModel(cells, root);
            const f3 = new Fold3(m, { textures: false });
            for (const ang of statesFor(m.hinges.length, m.hinges.map((h) => h.max))) {
              worst = Math.max(worst, maxErr(f3, ang));
              configs++;
              n++;
            }
            f3.dispose();
          }
      per[group] = n;
    }
    out.cubeAndCollision = { configs, per, worstCornerErr: worst };
    save();
    expect(worst).toBeLessThan(1e-9);
  });

  it("integer eighths drive the angles exactly (t8 / 8 * max)", () => {
    const m = cellModel(freeHexominoes().find((c) => classify(c) === "cube")!, 0);
    const f3 = new Fold3(m, { textures: false });
    let worst = 0;
    for (let k = 0; k <= 8; k++) {
      f3.setEighths(m.hinges.map(() => k));
      worst = Math.max(worst, maxErr2(f3, m.hinges.map((h) => (k / 8) * h.max)));
    }
    function maxErr2(f: Fold3, ang: number[]) {
      const ref = refState(f.model, ang);
      let e = 0;
      f.model.polys.forEach((_, i) => f.corners(i).forEach((c, kk) => { for (let a = 0; a < 3; a++) e = Math.max(e, Math.abs(c[a] - ref.corners[i][kk][a])); }));
      return e;
    }
    out.eighths = { worst };
    save();
    expect(worst).toBeLessThan(1e-9);
  });

  it("scene-graph coincidence agrees with the rolling-cube model for all 14 collision nets", () => {
    let n = 0,
      ok = 0;
    for (const free of freeHexominoes().filter((c) => classify(c) === "collide1"))
      for (const cells of fixedOrientations(free)) {
        const m = cellModel(cells, 0);
        const f3 = new Fold3(m, { textures: false });
        f3.setEighths(m.hinges.map(() => 8));
        const got = JSON.stringify(f3.coincident());
        n++;
        if (got === JSON.stringify(rolledCoincidences(cells))) ok++;
        f3.dispose();
      }
    out.coincidence = { n, ok };
    save();
    expect(ok).toBe(n);
  });

  it("cuboid, prism, pyramid scene graphs close and match the oracle", () => {
    const r: Record<string, unknown> = {};
    for (const s of ["cuboid", "triangular-prism", "square-pyramid"] as const)
      for (let root = 0; root < 5; root++) {
        const m = solidModel(s, root);
        const f3 = new Fold3(m, { textures: false });
        let w = 0;
        for (const ang of statesFor(m.hinges.length, m.hinges.map((h) => h.max))) w = Math.max(w, maxErr(f3, ang));
        const prev = (r[s] as number | undefined) ?? 0;
        r[s] = Math.max(prev, w);
        expect(w).toBeLessThan(1e-9);
      }
    out.solids = r;
    save();
  });
});
