/**
 * WP0a SPIKE (THROWAWAY). TEST-SIDE reference renderer. Written differently from fold.ts on purpose:
 *  - kinematics: each world point is moved by applying the hinge rotations one after another
 *    (leaf hinge first, root-nearest hinge last) with the Rodrigues formula about a pivot, and the
 *    sign of every rotation is decided by a lift test (does the child's centroid go up?), not by a
 *    formula for the axis direction. fold.ts composes matrices from the root down.
 *  - visibility: per sample a ray along the view direction meets each face's PLANE EQUATION
 *    (n . X = c); the nearest hit wins; inside-ness is decided in 3D with edge cross products.
 *    fold.ts only ever sorts faces and the painter just overwrites pixels.
 */
import type { FoldModel, Frag, P2, V3, View } from "../fold";
import { apply, basis, faceMatrix, pose } from "../fold";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function rodrigues(p: V3, pivot: V3, k: V3, theta: number): V3 {
  const v = sub(p, pivot);
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const kv = cross(k, v),
    kd = dot(k, v) * (1 - c);
  return [
    pivot[0] + v[0] * c + kv[0] * s + k[0] * kd,
    pivot[1] + v[1] * c + kv[1] * s + k[1] * kd,
    pivot[2] + v[2] * c + kv[2] * s + k[2] * kd,
  ];
}

export interface RefState {
  /** World corners per face (counter-clockwise from the face's front). */
  corners: V3[][];
  /** Unit normals and plane constants. */
  n: V3[];
  c: number[];
}

/** Independent forward kinematics: world corners of every face for the given hinge angles. */
export function refState(m: FoldModel, ang: number[]): RefState {
  // hinge chain from root to each face
  const chain: number[][] = m.polys.map(() => []);
  for (const { face, hinge } of m.order)
    if (hinge >= 0) chain[face] = [...chain[m.hinges[hinge].parent], hinge];
  // per hinge: pivot and the lift-test sign
  const pivot = m.hinges.map((h): V3 => [h.p[0], h.p[1], 0]);
  const axis = m.hinges.map((h): V3 => {
    const k: V3 = [h.u[0], h.u[1], 0];
    // centroid of the child in the flat net
    const poly = m.polys[h.child];
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length,
      cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const lifted = rodrigues([cx, cy, 0], [h.p[0], h.p[1], 0], k, 0.1);
    return lifted[2] > 0 ? k : [-k[0], -k[1], 0];
  });
  const corners = m.polys.map((poly, f) =>
    poly.map((p): V3 => {
      let w: V3 = [p[0], p[1], 0];
      for (let i = chain[f].length - 1; i >= 0; i--) {
        const h = chain[f][i];
        w = rodrigues(w, pivot[h], axis[h], ang[h]);
      }
      return w;
    }),
  );
  const n = corners.map((cs): V3 => {
    const a = cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]));
    const L = Math.hypot(...a);
    return [a[0] / L, a[1] / L, a[2] / L];
  });
  const c = corners.map((cs, f) => dot(n[f], cs[0]));
  return { corners, n, c };
}

/* ------------------------------------------------------------------------------------------ */

export class Grid {
  readonly N: number;
  readonly R: number;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  constructor(R: number, N = 64) {
    this.N = N;
    this.R = R;
    this.xs = new Float64Array(N);
    this.ys = new Float64Array(N);
    // offsets are fixed and awkward so that samples never sit exactly on a grid-aligned edge
    for (let i = 0; i < N; i++) {
      this.xs[i] = -R + ((i + 0.5 + 0.137) / N) * 2 * R;
      this.ys[i] = -R + ((i + 0.5 + 0.291) / N) * 2 * R;
    }
  }
  /** Sample index range covering [lo, hi] on an axis. */
  range(arr: Float64Array, lo: number, hi: number): [number, number] {
    const step = (2 * this.R) / this.N;
    const a = Math.max(0, Math.floor((lo - arr[0]) / step));
    const b = Math.min(this.N - 1, Math.ceil((hi - arr[0]) / step));
    return [a, b];
  }
}

export interface Raster {
  id: Int16Array; // face id, -1 empty
  tie: Uint8Array;
}

const TIE = 1e-7;
const IN_TOL = -1e-9;
/** Per-sample z-buffer by plane equations. Samples in (screen x, screen y UP) units of net length. */
export function zbuffer(
  st: RefState,
  centre: V3,
  view: View,
  g: Grid,
): Raster {
  const b = basis(view);
  const N = g.N;
  const id = new Int16Array(N * N).fill(-1);
  const tie = new Uint8Array(N * N);
  const depth = new Float64Array(N * N).fill(-Infinity);
  const nf = st.corners.length;
  for (let f = 0; f < nf; f++) {
    const cs = st.corners[f].map((w) => sub(w, centre));
    const nn = st.n[f];
    const nz = dot(nn, b.zv);
    if (Math.abs(nz) < 1e-9) continue; // edge on: covers no area
    const nsx = dot(nn, b.sx),
      nup = dot(nn, b.up);
    const cc = dot(nn, cs[0]);
    const sxs = cs.map((w) => dot(w, b.sx)),
      sys = cs.map((w) => dot(w, b.up));
    const [i0, i1] = g.range(g.xs, Math.min(...sxs), Math.max(...sxs));
    const [j0, j1] = g.range(g.ys, Math.min(...sys), Math.max(...sys));
    for (let j = j0; j <= j1; j++) {
      const sy = g.ys[j];
      for (let i = i0; i <= i1; i++) {
        const sx = g.xs[i];
        // plane-equation depth at this sample: n . (sx*SX + sy*UP + s*ZV) = c
        const s = (cc - nsx * sx - nup * sy) / nz;
        const X: V3 = [
          sx * b.sx[0] + sy * b.up[0] + s * b.zv[0],
          sx * b.sx[1] + sy * b.up[1] + s * b.zv[1],
          sx * b.sx[2] + sy * b.up[2] + s * b.zv[2],
        ];
        let inside = true;
        for (let k = 0; k < cs.length && inside; k++) {
          const a = cs[k],
            e = sub(cs[(k + 1) % cs.length], a);
          if (dot(cross(e, sub(X, a)), nn) < IN_TOL) inside = false;
        }
        if (!inside) continue;
        const p = j * N + i;
        if (s > depth[p] + TIE) {
          depth[p] = s;
          id[p] = f;
          tie[p] = 0;
        } else if (Math.abs(s - depth[p]) <= TIE) tie[p] = 1;
      }
    }
  }
  return { id, tie };
}

/** Painter's picture from the renderer's own matrices and draw list (fragments or whole faces). */
export function painter(
  m: FoldModel,
  P: ReturnType<typeof pose>,
  view: View,
  g: Grid,
  items: { face: number; poly: P2[] }[],
): Int16Array {
  const b = basis(view);
  const N = g.N;
  const id = new Int16Array(N * N).fill(-1);
  const mats = P.map((M) => faceMatrix(M, b, 1, 0, 0, m.centre));
  for (const { face, poly } of items) {
    const [a, bb, c, d, e, f] = mats[face];
    // screen position, y down -> convert to y up for the grid
    const px = poly.map((p) => a * p[0] + c * p[1] + e);
    const py = poly.map((p) => -(bb * p[0] + d * p[1] + f));
    const area = px.reduce(
      (s, x, k) => s + (x * py[(k + 1) % px.length] - px[(k + 1) % px.length] * py[k]),
      0,
    );
    if (Math.abs(area) < 1e-12) continue;
    const [i0, i1] = g.range(g.xs, Math.min(...px), Math.max(...px));
    const [j0, j1] = g.range(g.ys, Math.min(...py), Math.max(...py));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const sx = g.xs[i],
          sy = g.ys[j];
        let pos = 0,
          neg = 0;
        for (let k = 0; k < px.length; k++) {
          const k2 = (k + 1) % px.length;
          const cr = (px[k2] - px[k]) * (sy - py[k]) - (py[k2] - py[k]) * (sx - px[k]);
          if (cr > 0) pos++;
          else if (cr < 0) neg++;
        }
        if (pos === 0 || neg === 0) id[j * N + i] = face;
      }
  }
  return id;
}

export const wholeFaces = (m: FoldModel, order: number[]) =>
  order.map((face) => ({ face, poly: m.polys[face] }));
export const fragItems = (frags: Frag[]) => frags.map((f) => ({ face: f.face, poly: f.poly }));
export { apply };
