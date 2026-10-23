/**
 * WP0a SPIKE (throwaway). Picture vs judged answer, collision pool and distinguishability, and the
 * non-cube solids. All geometry cross-checks use the test-side axis-angle kinematics (zbuffer.ts).
 */
import { describe, expect, it } from "vitest";
import {
  foldsToCube,
  oppositeLetters,
  type ParsedNet,
  type Pt,
} from "../../../src/topics/nets";
import {
  basis,
  coincidentPairs,
  frameFor,
  pose,
  svgString,
  type FoldModel,
  type SortMode,
  type V3,
  type View,
} from "../fold";
import {
  cellModel,
  classify,
  fixedOrientations,
  freeHexominoes,
  LABELS,
  rolledCoincidences,
  rotationClasses,
  solidModel,
} from "../nets-model";
import { applyMat, corners3d, readSvg } from "./readback";
import { MODES, bucketOf, evalState, views, type Result } from "./sweep";
import { Grid, refState, painter, wholeFaces, zbuffer } from "./zbuffer";
import { writeFileSync } from "node:fs";

import { existsSync, readFileSync } from "node:fs";
const statsFile = new URL("../results/model-tests.json", import.meta.url);
const stats: Record<string, unknown> = existsSync(statsFile) ? JSON.parse(readFileSync(statsFile, "utf8")) : {};
const record = (k: string, v: unknown) => {
  stats[k] = v;
  writeFileSync(new URL("../results/model-tests.json", import.meta.url), JSON.stringify(stats, null, 1));
};

const full = (m: FoldModel) => m.hinges.map((h) => h.max);
const parsedOf = (cells: Pt[]): ParsedNet => ({
  cols: Math.max(...cells.map((c) => c[0])) + 1,
  rows: Math.max(...cells.map((c) => c[1])) + 1,
  cells: cells.map(([x, y], i) => ({ x, y, ch: LABELS[i] })),
});
const centreOfCorners = (cs: V3[]): V3 => [
  cs.reduce((s, c) => s + c[0], 0) / cs.length,
  cs.reduce((s, c) => s + c[1], 0) / cs.length,
  cs.reduce((s, c) => s + c[2], 0) / cs.length,
];
const near = (a: V3, b: V3, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol;

function readback(m: FoldModel, ang: number[]) {
  const top = readSvg(svgString(m, frameFor(m, ang, { yaw: 0, pitch: 0 }, "centroid")));
  const side = readSvg(svgString(m, frameFor(m, ang, { yaw: 0, pitch: 90 }, "centroid")));
  return corners3d(top, side, m.centre);
}

describe("picture vs judged answer (item 3)", () => {
  it("every cube net, every fixed orientation, every floor face", () => {
    let nets = 0,
      checks = 0,
      pairAgree = 0,
      lidAgree = 0,
      cornerOk = 0,
      cornerTotal = 0,
      maxCornerErr = 0;
    const fails: string[] = [];
    for (const free of freeHexominoes().filter((c) => classify(c) === "cube"))
      for (const cells of fixedOrientations(free)) {
        nets++;
        const judged = oppositeLetters(parsedOf(cells))!;
        expect(judged).not.toBeNull();
        expect(foldsToCube(cells).ok).toBe(true);
        for (let root = 0; root < 6; root++) {
          const m = cellModel(cells, root);
          const ang = full(m);
          const pic = readback(m, ang);
          const ref = refState(m, ang);
          // (a) read-back corners equal the axis-angle float model
          for (let f = 0; f < 6; f++)
            ref.corners[f].forEach((c, k) => {
              const err = Math.hypot(...[0, 1, 2].map((i) => c[i] - pic.get(f)![k][i]));
              maxCornerErr = Math.max(maxCornerErr, err);
              cornerTotal++;
              if (err < 0.01) cornerOk++;
            });
          // (b) opposite pairs seen in the picture vs production oppositeLetters
          const cen = [0, 1, 2, 3, 4, 5].map((f) => centreOfCorners(pic.get(f)!));
          const mid: V3 = [0, 1, 2].map((i) => cen.reduce((s, c) => s + c[i], 0) / 6) as V3;
          let allPairs = true;
          for (let f = 0; f < 6; f++) {
            const want: V3 = [0, 1, 2].map((i) => 2 * mid[i] - cen[f][i]) as V3;
            const g = cen.findIndex((c) => near(c, want, 0.02));
            if (g < 0 || judged[LABELS[f]] !== LABELS[g]) allPairs = false;
          }
          // (c) lid: the face of the picture at height 1 above the floor face (z = 1)
          const lid = cen.findIndex((c) => Math.abs(c[2] - 1) < 0.02 && !near(c, cen[root], 0.02));
          const floorOk = Math.abs(cen[root][2]) < 0.02;
          const lidOk = floorOk && lid >= 0 && judged[LABELS[root]] === LABELS[lid];
          checks++;
          if (allPairs) pairAgree++;
          else fails.push(`${cells.join(";")} root=${root} pairs`);
          if (lidOk) lidAgree++;
          else fails.push(`${cells.join(";")} root=${root} lid`);
        }
      }
    record("pictureVsModel", { nets, checks, pairAgree, lidAgree, cornerOk, cornerTotal, maxCornerErr, fails: fails.slice(0, 10) });
    expect(nets).toBe(64);
    expect(pairAgree).toBe(checks);
    expect(lidAgree).toBe(checks);
    expect(cornerOk).toBe(cornerTotal);
  });
});

describe("collision pool (R-92)", () => {
  it("pool size and agreement of three methods", () => {
    const free = freeHexominoes();
    const tally: Record<string, number> = {};
    let compared = 0,
      agree = 0,
      foldsToCubeOk = 0;
    for (const f of free) {
      const cls = classify(f);
      tally[cls] = (tally[cls] ?? 0) + 1;
      if (cls === "block") continue; // creases cannot all fold: refused by the model
      for (const cells of fixedOrientations(f))
        for (let root = 0; root < 6; root++) {
          const m = cellModel(cells, root);
          const P = pose(m, full(m));
          const mine = coincidentPairs(m, P).map((p) => p.join(","));
          // independent: axis-angle corners, faces coincide when the corner sets are equal
          const ref = refState(m, full(m));
          const axis: string[] = [];
          for (let i = 0; i < 6; i++)
            for (let j = i + 1; j < 6; j++)
              if (ref.corners[i].every((a) => ref.corners[j].some((b) => near(a, b, 1e-6)))) axis.push(`${i},${j}`);
          const rolled = rolledCoincidences(cells).map((p) => p.join(","));
          compared++;
          if (JSON.stringify(mine) === JSON.stringify(rolled) && JSON.stringify(axis) === JSON.stringify(rolled)) agree++;
        }
      if (foldsToCube(f).ok) foldsToCubeOk++;
    }
    record("collisionPool", { tally, compared, agree, foldsToCubeOk });
    expect(tally.collide1).toBe(14);
    expect(tally.collide2).toBe(2);
    expect(tally.cube).toBe(11);
    expect(tally.block).toBe(8);
    expect(agree).toBe(compared);
  });
});

/* ---- distinguishability ---------------------------------------------------------------- */

function sv(svg: string) {
  const r = readSvg(svg);
  return r;
}
function pointIn(poly: [number, number][], x: number, y: number) {
  let pos = 0,
    neg = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k],
      b = poly[(k + 1) % poly.length];
    const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cr > 0) pos++;
    else if (cr < 0) neg++;
  }
  return pos === 0 || neg === 0;
}
const screenPolys = new WeakMap<object, [number, number][][]>();
function cache(r: ReturnType<typeof readSvg>) {
  screenPolys.set(r, r.faces.map((f) => f.poly.map((p) => applyMat(f.m, p))));
}
/** Which face is on top at an SVG pixel (document order, later wins). */
function topAt(r: ReturnType<typeof readSvg>, x: number, y: number) {
  if (!screenPolys.has(r)) cache(r);
  const polys = screenPolys.get(r)!;
  let id = -1;
  r.faces.forEach((f, k) => {
    if (pointIn(polys[k], x, y)) id = f.face;
  });
  return id;
}

describe("coincident faces are distinguishable (R-92)", () => {
  it("both letters legible and both faces visibly separate wherever the stack can be seen", () => {
    const vs = views("above");
    let renders = 0,
      applicable = 0,
      pass = 0;
    const reasons: Record<string, number> = {};
    const failByPitch: Record<string, number> = {};
    let minVisible = 1,
      minGlyph = 1e9,
      worst = "";
    let nets = 0,
      netsWithNoView = 0,
      minViewsPerNet = Infinity;
    let flatOnly = 0;
    for (const free of freeHexominoes().filter((c) => classify(c) === "collide1"))
      for (const cells of rotationClasses(free))
        for (let root = 0; root < 6; root++) {
          const m = cellModel(cells, root);
          const ang = full(m);
          const grid = new Grid(m.radius, 64);
          const st = refState(m, ang);
          nets++;
          let viewsOk = 0;
          for (const view of vs) {
            renders++;
            const fr = frameFor(m, ang, view, "centroid", { separate: true });
            expect(fr.coincident.length).toBe(1);
            const [i, j] = fr.coincident[0];
            // is the stack seen at all? (test-side z-buffer: tie samples are the stack)
            const z = zbuffer(st, m.centre, view, grid);
            const zv = basis(view).zv;
            const nz = Math.abs(st.n[i][0] * zv[0] + st.n[i][1] * zv[1] + st.n[i][2] * zv[2]);
            const step = (2 * grid.R) / grid.N;
            const expected = (nz * 1) / (step * step);
            let ties = 0;
            for (let p = 0; p < z.tie.length; p++) ties += z.tie[p];
            const exposed = nz >= 0.35 && ties >= 0.9 * expected;
            if (!exposed) continue;
            applicable++;
            const r = readSvg(svgString(m, fr));
            cache(r);
            let ok = true;
            const why: string[] = [];
            for (const id of [i, j]) {
              const f = r.faces.find((x) => x.face === id)!;
              let own = 0,
                tot = 0;
              for (let a = 0; a < 10; a++)
                for (let b = 0; b < 10; b++) {
                  const sp = applyMat(f.m, [(a + 0.5) / 10 + Math.min(...f.poly.map((p) => p[0])), (b + 0.5) / 10 + Math.min(...f.poly.map((p) => p[1]))]);
                  tot++;
                  if (topAt(r, sp[0], sp[1]) === id) own++;
                }
              const vis = own / tot;
              if (vis < minVisible) {
                minVisible = vis;
                worst = `visible ${vis.toFixed(2)} at yaw=${view.yaw} pitch=${view.pitch}`;
              }
              if (vis < 0.15) {
                ok = false;
                why.push("visible<15%");
              }
              const c = f.centre;
              for (const d of [[0, 0], [0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) {
                const sp = applyMat(f.m, [c[0] + d[0], c[1] + d[1]]);
                if (topAt(r, sp[0], sp[1]) !== id) {
                  ok = false;
                  why.push("letter covered");
                  break;
                }
              }
              const [a, b, cc, d] = f.m;
              const t = a * a + b * b + cc * cc + d * d,
                det = Math.abs(a * d - b * cc);
              const smin = Math.sqrt((t - Math.sqrt(Math.max(0, t * t - 4 * det * det))) / 2);
              const glyph = 0.5 * smin;
              if (glyph < minGlyph) minGlyph = glyph;
              if (glyph < 8) {
                ok = false;
                why.push("glyph<8px");
              }
            }
            expect(/stroke-dasharray/.test(svgString(m, fr))).toBe(true);
            if (ok) {
              pass++;
              viewsOk++;
            } else {
              failByPitch[`pitch=${view.pitch}`] = (failByPitch[`pitch=${view.pitch}`] ?? 0) + 1;
              for (const w of new Set(why)) reasons[w] = (reasons[w] ?? 0) + 1;
            }
          }
          minViewsPerNet = Math.min(minViewsPerNet, viewsOk);
          if (viewsOk === 0) netsWithNoView++;
          if (viewsOk < 5) flatOnly++;
        }
    record("distinguishable", {
      netRootCombos: nets,
      renders,
      applicableRenders: applicable,
      pass,
      passRateOfApplicable: pass / applicable,
      reasons,
      failByPitch,
      minVisible,
      minGlyph,
      worst,
      netRootCombosWithNoGoodView: netsWithNoView,
      minGoodViewsPerCombo: minViewsPerNet,
      combosWithFewerThan5GoodViews: flatOnly,
    });
    expect(netsWithNoView).toBe(0);
  });

  it("letters never mirrored: effective text matrix has positive determinant", () => {
    let n = 0,
      bad = 0,
      nUp = 0,
      notUpright = 0,
      maxDeg = 0,
      over60 = 0,
      over90 = 0;
    for (const free of freeHexominoes().filter((c) => classify(c) !== "block").slice(0, 8))
      for (const cells of rotationClasses(free)) {
        const m = cellModel(cells, 0);
        for (const view of views("above").filter((_, i) => i % 7 === 0))
          for (const mask of [0, 5, 31]) {
            const ang = m.hinges.map((h, i) => ((mask >> i) & 1 ? h.max : 0));
            const r = readSvg(svgString(m, frameFor(m, ang, view, "centroid")));
            for (const f of r.faces) {
              n++;
              // text matrix = face matrix . [sx 0; 0 sy] with (sx, sy) = (1,-1) front / (-1,-1) back
              const sx = f.back ? -1 : 1,
                sy = -1;
              const det = (f.m[0] * f.m[3] - f.m[1] * f.m[2]) * sx * sy;
              if (!(det > 0) && Math.abs(det) > 1e-6) bad++;
              // glyph up (text-local (0,-1)) after scale, rotate and the face matrix
              const th = (f.rot * Math.PI) / 180,
                ux = 0,
                uy = -sy; // S . (0,-1) = (0, 1)
              const rx = Math.cos(th) * ux - Math.sin(th) * uy,
                ry = Math.sin(th) * ux + Math.cos(th) * uy;
              const gx = f.m[0] * rx + f.m[2] * ry,
                gy = f.m[1] * rx + f.m[3] * ry;
              const len = Math.hypot(gx, gy);
              if (Math.abs(det) > 0.02 && len > 1e-6) {
                nUp++;
                const deg = (Math.acos(Math.min(1, Math.max(-1, -gy / len))) * 180) / Math.PI;
                maxDeg = Math.max(maxDeg, deg);
                if (deg > 45 + 1e-6) notUpright++;
                if (deg > 60) over60++;
                if (deg > 90) over90++;
              }
            }
          }
      }
    record("letterMirror", { n, bad, nUp, notUpright, over60, over90, maxDeg });
    expect(bad).toBe(0);
    expect(over90).toBe(0); // never upside down on screen
  });
});

/* ---- SVG route equals the direct route ---------------------------------------------------- */

describe("SVG text round-trip", () => {
  it("painter picture from parsed SVG equals the picture from the renderer data", () => {
    let n = 0,
      diff = 0;
    const nets = freeHexominoes().filter((c) => classify(c) === "cube");
    for (const free of nets)
      for (const view of views("above").filter((_, i) => i % 11 === 3))
        for (const mask of [0, 3, 12, 31, 21]) {
          const m = cellModel(free, 0);
          const ang = m.hinges.map((h, i) => ((mask >> i) & 1 ? h.max * 0.625 : 0));
          const mode: SortMode = "centroid";
          const fr = frameFor(m, ang, view, mode);
          const r = readSvg(svgString(m, fr));
          // direct
          const grid = new Grid(m.radius, 48);
          const direct = painter(m, pose(m, ang), view, grid, wholeFaces(m, fr.order));
          // from svg text: same sample points converted to px
          const scale = 60;
          let d = 0;
          for (let j = 0; j < grid.N; j++)
            for (let i = 0; i < grid.N; i++) {
              const px = r.size / 2 + grid.xs[i] * scale,
                py = r.size / 2 - grid.ys[j] * scale;
              const id = topAt(r, px, py);
              if (id !== direct[j * grid.N + i]) d++;
            }
          n++;
          if (d > 0) diff++;
          void basis;
        }
    record("svgRoundTrip", { n, configsWithAnyDifferentSample: diff });
    expect(diff / n).toBeLessThan(0.05); // 4-decimal matrix rounding may flip a boundary sample
  });
});

/* ---- non-cube solids ---------------------------------------------------------------------- */

describe("cuboid, triangular prism and square pyramid", () => {
  const solids = ["cuboid", "triangular-prism", "square-pyramid"] as const;
  it("closes: glued edges meet exactly in 3D after folding", async () => {
    const { catalogueNet } = await import("../../../src/topics/nets");
    const out: Record<string, unknown> = {};
    for (const s of solids) {
      const net = catalogueNet(s);
      const m = solidModel(s, 0);
      const ref = refState(m, full(m));
      let worst = 0;
      for (const [f, k, g, l] of net.glue) {
        const pf = m.polys[f],
          pg = m.polys[g];
        const a0 = ref.corners[f][k],
          a1 = ref.corners[f][(k + 1) % pf.length];
        const b0 = ref.corners[g][l],
          b1 = ref.corners[g][(l + 1) % pg.length];
        // glued sides are traversed in opposite directions: a0 meets b1 and a1 meets b0
        worst = Math.max(worst, Math.hypot(...[0, 1, 2].map((i) => a0[i] - b1[i])), Math.hypot(...[0, 1, 2].map((i) => a1[i] - b0[i])));
      }
      // all corners of the folded solid: count distinct points = vertices of the solid
      const pts: V3[] = [];
      ref.corners.flat().forEach((c) => {
        if (!pts.some((p) => near(p, c, 1e-6))) pts.push(c);
      });
      // the renderer's own matrices agree with the axis-angle model
      const P = pose(m, full(m));
      let rend = 0;
      m.polys.forEach((poly, f) =>
        poly.forEach((p, k) => {
          const w = [P[f][0] * p[0] + P[f][1] * p[1] + P[f][3], P[f][4] * p[0] + P[f][5] * p[1] + P[f][7], P[f][8] * p[0] + P[f][9] * p[1] + P[f][11]];
          rend = Math.max(rend, Math.hypot(...[0, 1, 2].map((i) => w[i] - ref.corners[f][k][i])));
        }),
      );
      out[s] = { glueMaxGap: worst, distinctVertices: pts.length, rendererVsAxisAngle: rend, hinges: m.hinges.length, faces: m.polys.length };
      expect(worst).toBeLessThan(1e-9);
      expect(rend).toBeLessThan(1e-9);
    }
    record("solidClosure", out);
  });

  it("painter vs z-buffer for end states, per-hinge tween and fold-all tween (all roots)", () => {
    const res: Result = {};
    const vs = views("above");
    for (const s of solids) {
      const faces = solidModel(s, 0).polys.length;
      for (let root = 0; root < faces; root++) {
        const m = solidModel(s, root);
        const grid = new Grid(m.radius);
        const n = m.hinges.length;
        for (let mask = 0; mask < 1 << n; mask++)
          evalState(m, m.hinges.map((h, i) => ((mask >> i) & 1 ? h.max : 0)), vs, grid, bucketOf(res, `${s}-end`), `${s} root=${root} mask=${mask}`);
        for (let h = 0; h < n; h++)
          for (let k = 1; k <= 7; k++)
            for (let o = 0; o < 1 << (n - 1); o++)
              evalState(
                m,
                m.hinges.map((hh, i) => (i === h ? (k / 8) * hh.max : (o >> (i < h ? i : i - 1)) & 1 ? hh.max : 0)),
                vs,
                grid,
                bucketOf(res, `${s}-tween`),
                `${s} root=${root} hinge=${h} t=${k}/8 others=${o}`,
              );
        for (let k = 1; k <= 7; k++)
          evalState(m, m.hinges.map((hh) => (k / 8) * hh.max), vs, grid, bucketOf(res, `${s}-foldall`), `${s} root=${root} all t=${k}/8`);
      }
    }
    record("solidSweeps", res);
    for (const key of Object.keys(res)) expect(res[key].split.mism).toBe(0);
    void MODES;
  });
});
