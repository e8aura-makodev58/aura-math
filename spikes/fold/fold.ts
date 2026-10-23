/**
 * WP0a SPIKE (THROWAWAY): SVG orthographic-camera fold renderer.
 *
 * Everything here is spike code. The production module comes in WP0b. Nothing in src/ imports it.
 * Faces are flat convex polygons in net coordinates (x right, y UP). A hinge folds its child
 * towards the viewer (+z) by a given angle. Each face is drawn as one affine matrix() group.
 */

export type P2 = [number, number];
export type V3 = [number, number, number];
/** Row-major 3 by 4 affine matrix: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type M34 = number[];

export const IDENT: M34 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function mul(A: M34, B: M34): M34 {
  const o = new Array<number>(12);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      o[r * 4 + c] =
        A[r * 4] * B[c] +
        A[r * 4 + 1] * B[4 + c] +
        A[r * 4 + 2] * B[8 + c] +
        (c === 3 ? A[r * 4 + 3] : 0);
    }
  return o;
}
export const apply = (M: M34, p: P2): V3 => [
  M[0] * p[0] + M[1] * p[1] + M[3],
  M[4] * p[0] + M[5] * p[1] + M[7],
  M[8] * p[0] + M[9] * p[1] + M[11],
];

export interface Hinge {
  parent: number;
  child: number;
  /** A point on the crease (flat coordinates). */
  p: P2;
  /** Unit axis (flat coordinates) such that a positive angle lifts the child towards +z. */
  u: P2;
  /** Fold angle in radians at "fully folded". */
  max: number;
  /** Crease length. */
  len: number;
}
export interface FoldModel {
  polys: P2[][];
  labels: string[];
  root: number;
  hinges: Hinge[];
  /** Faces in an order where every parent precedes its children, with the hinge into each. */
  order: { face: number; hinge: number }[];
  /** True when the adjacency graph has a cycle (2 by 2 block): not foldable independently. */
  cyclic: boolean;
  /** Radius (in net units) of a circle around `centre` containing the shape in every end state. */
  radius: number;
  centre: V3;
}

const ek = (a: P2, b: P2) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;

export function buildModel(
  polys: P2[][],
  labels: string[],
  root: number,
  maxAngle: (a: number, b: number) => number,
): FoldModel {
  const edgeOwner = new Map<string, number>();
  polys.forEach((poly, f) =>
    poly.forEach((a, k) => edgeOwner.set(ek(a, poly[(k + 1) % poly.length]), f)),
  );
  // adjacency: face f, edge a->b, neighbour g owns b->a
  const adj: { to: number; a: P2; b: P2 }[][] = polys.map(() => []);
  polys.forEach((poly, f) =>
    poly.forEach((a, k) => {
      const b = poly[(k + 1) % poly.length];
      const g = edgeOwner.get(ek(b, a));
      if (g !== undefined) adj[f].push({ to: g, a, b });
    }),
  );
  const seen = new Set<number>([root]);
  const order: FoldModel["order"] = [{ face: root, hinge: -1 }];
  const hinges: Hinge[] = [];
  const queue = [root];
  while (queue.length) {
    const f = queue.shift()!;
    for (const { to, a, b } of adj[f]) {
      if (seen.has(to)) continue;
      seen.add(to);
      const ex = b[0] - a[0],
        ey = b[1] - a[1],
        L = Math.hypot(ex, ey);
      hinges.push({
        parent: f,
        child: to,
        p: a,
        u: [-ex / L, -ey / L],
        max: maxAngle(f, to),
        len: L,
      });
      order.push({ face: to, hinge: hinges.length - 1 });
      queue.push(to);
    }
  }
  const totalEdges = adj.reduce((n, l) => n + l.length, 0) / 2;
  const cyclic = totalEdges > polys.length - 1;
  const model: FoldModel = {
    polys,
    labels,
    root,
    hinges,
    order,
    cyclic,
    radius: 1,
    centre: [0, 0, 0],
  };
  // bounding sphere over all end states and the all-halfway state
  const xs = polys.flat().map((p) => p[0]),
    ys = polys.flat().map((p) => p[1]);
  const centre: V3 = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    0,
  ];
  let r = 0;
  const n = hinges.length;
  const states = n <= 8 ? 1 << n : 2;
  for (let s = 0; s < states; s++) {
    const ang = hinges.map((h, i) => (s >> i) & 1 ? h.max : 0);
    const P = pose(model, ang);
    polys.forEach((poly, f) =>
      poly.forEach((p) => {
        const w = apply(P[f], p);
        r = Math.max(
          r,
          Math.hypot(w[0] - centre[0], w[1] - centre[1], w[2] - centre[2]),
        );
      }),
    );
  }
  // folded shapes can leave the flat bounding circle; also sample the halfway state
  const half = pose(
    model,
    hinges.map((h) => h.max / 2),
  );
  polys.forEach((poly, f) =>
    poly.forEach((p) => {
      const w = apply(half[f], p);
      r = Math.max(r, Math.hypot(w[0] - centre[0], w[1] - centre[1], w[2]));
    }),
  );
  model.radius = r * 1.06 + 0.2;
  model.centre = centre;
  return model;
}

/** Rotation about the crease through `p` along `u` by `phi`. */
export function hingeMatrix(h: Hinge, phi: number): M34 {
  const c = Math.cos(phi),
    s = Math.sin(phi),
    [ux, uy] = h.u,
    k = 1 - c;
  // R = c I + s [u]x + k u u^T with u = (ux, uy, 0)
  const R = [
    c + k * ux * ux,
    k * ux * uy,
    s * uy,
    k * ux * uy,
    c + k * uy * uy,
    -s * ux,
    -s * uy,
    s * ux,
    c,
  ];
  const t = [
    h.p[0] - (R[0] * h.p[0] + R[1] * h.p[1]),
    h.p[1] - (R[3] * h.p[0] + R[4] * h.p[1]),
    0 - (R[6] * h.p[0] + R[7] * h.p[1]),
  ];
  return [R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2]];
}

/** World matrix of every face for the given per-hinge angles (radians). */
export function pose(m: FoldModel, ang: number[]): M34[] {
  const out: M34[] = new Array(m.polys.length);
  for (const { face, hinge } of m.order) {
    out[face] =
      hinge < 0
        ? IDENT
        : mul(out[m.hinges[hinge].parent], hingeMatrix(m.hinges[hinge], ang[hinge]));
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Camera                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export interface View {
  yaw: number;
  pitch: number;
}
export interface Basis {
  sx: V3;
  up: V3;
  zv: V3;
}
const D2R = Math.PI / 180;
export function basis(v: View): Basis {
  const cy = Math.cos(v.yaw * D2R),
    sy = Math.sin(v.yaw * D2R),
    cp = Math.cos(v.pitch * D2R),
    sp = Math.sin(v.pitch * D2R);
  const yv: V3 = [sy, cy, 0];
  return {
    sx: [cy, -sy, 0],
    up: [cp * yv[0], cp * yv[1], sp],
    zv: [-sp * yv[0], -sp * yv[1], cp],
  };
}
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export { dot3 };

/** SVG matrix (a b c d e f) of a face: local (u, v) with v up -> screen px (y down). */
export function faceMatrix(
  M: M34,
  b: Basis,
  scale: number,
  ox: number,
  oy: number,
  centre: V3,
): [number, number, number, number, number, number] {
  const c0: V3 = [M[0], M[4], M[8]],
    c1: V3 = [M[1], M[5], M[9]],
    t: V3 = [M[3] - centre[0], M[7] - centre[1], M[11] - centre[2]];
  return [
    scale * dot3(b.sx, c0),
    -scale * dot3(b.up, c0),
    scale * dot3(b.sx, c1),
    -scale * dot3(b.up, c1),
    ox + scale * dot3(b.sx, t),
    oy - scale * dot3(b.up, t),
  ];
}
/** Depth (towards viewer) of a world point. */
export const depthOf = (b: Basis, w: V3) => dot3(b.zv, w);

/* ------------------------------------------------------------------------------------------ */
/* Sorts                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type SortMode = "centroid" | "nearest" | "split";

function faceDepths(m: FoldModel, P: M34[], b: Basis) {
  return m.polys.map((poly, f) => {
    let sum = 0,
      max = -Infinity;
    for (const p of poly) {
      const d = depthOf(b, apply(P[f], p));
      sum += d;
      if (d > max) max = d;
    }
    return { centroid: sum / poly.length, nearest: max };
  });
}
/** Face ids back to front for the two single-key sorts. */
export function sortOrder(
  m: FoldModel,
  P: M34[],
  b: Basis,
  mode: "centroid" | "nearest",
): number[] {
  const d = faceDepths(m, P, b);
  return m.polys
    .map((_, i) => i)
    .sort((i, j) => {
      const q = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x); // equal depths keep index order
      return mode === "centroid"
        ? q(d[i].centroid - d[j].centroid) || i - j
        : q(d[i].nearest - d[j].nearest) || q(d[i].centroid - d[j].centroid) || i - j;
    });
}

/* ---- face splitting: BSP over the face planes, fragments kept in the face's local 2D ------ */

export interface Frag {
  face: number;
  poly: P2[];
}
interface Bsp {
  n: V3;
  c: number;
  here: Frag[];
  front: Bsp | null;
  back: Bsp | null;
}
const EPS = 1e-9;

function planeOf(M: M34): { n: V3; c: number } {
  const c0: V3 = [M[0], M[4], M[8]],
    c1: V3 = [M[1], M[5], M[9]];
  const n: V3 = [
    c0[1] * c1[2] - c0[2] * c1[1],
    c0[2] * c1[0] - c0[0] * c1[2],
    c0[0] * c1[1] - c0[1] * c1[0],
  ];
  return { n, c: n[0] * M[3] + n[1] * M[7] + n[2] * M[11] };
}
function splitPoly(
  poly: P2[],
  d: number[],
): { front: P2[]; back: P2[] } {
  const front: P2[] = [],
    back: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const a = poly[i],
      b = poly[j],
      da = d[i],
      db = d[j];
    if (da >= -EPS) front.push(a);
    if (da <= EPS) back.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      const x: P2 = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      front.push(x);
      back.push(x);
    }
  }
  return { front, back };
}
export function buildBsp(m: FoldModel, P: M34[]): { root: Bsp | null; frags: number } {
  let count = 0;
  const planes = m.polys.map((_, f) => planeOf(P[f]));
  function build(frags: Frag[]): Bsp | null {
    if (!frags.length) return null;
    // choose the splitter that splits the fewest others (small n)
    let best = 0,
      bestScore = Infinity;
    if (frags.length > 1)
      for (let i = 0; i < frags.length; i++) {
        let score = 0;
        const { n, c } = planes[frags[i].face];
        for (let j = 0; j < frags.length; j++) {
          if (i === j) continue;
          const dd = distances(frags[j], n, c);
          if (dd.some((x) => x > EPS) && dd.some((x) => x < -EPS)) score++;
        }
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
    const sp = frags[best];
    const { n, c } = planes[sp.face];
    const here: Frag[] = [sp],
      fr: Frag[] = [],
      bk: Frag[] = [];
    frags.forEach((fg, i) => {
      if (i === best) return;
      const d = distances(fg, n, c);
      const pos = d.some((x) => x > EPS),
        neg = d.some((x) => x < -EPS);
      if (!pos && !neg) here.push(fg);
      else if (pos && !neg) fr.push(fg);
      else if (neg && !pos) bk.push(fg);
      else {
        const s = splitPoly(fg.poly, d);
        if (s.front.length >= 3) fr.push({ face: fg.face, poly: s.front });
        if (s.back.length >= 3) bk.push({ face: fg.face, poly: s.back });
      }
    });
    count++;
    return { n, c, here, front: build(fr), back: build(bk) };
  }
  function distances(fg: Frag, n: V3, c: number): number[] {
    const M = P[fg.face];
    return fg.poly.map((p) => {
      const w = apply(M, p);
      return n[0] * w[0] + n[1] * w[1] + n[2] * w[2] - c;
    });
  }
  const root = build(m.polys.map((poly, face) => ({ face, poly })));
  return { root, frags: count };
}
/** Fragments back to front for a camera (viewer on the +zv side). */
export function bspOrder(root: Bsp | null, b: Basis): Frag[] {
  const out: Frag[] = [];
  const walk = (node: Bsp | null) => {
    if (!node) return;
    const s = dot3(node.n, b.zv);
    if (s > EPS) {
      walk(node.back);
      out.push(...node.here);
      walk(node.front);
    } else if (s < -EPS) {
      walk(node.front);
      out.push(...node.here);
      walk(node.back);
    } else {
      walk(node.back);
      out.push(...node.here);
      walk(node.front);
    }
  };
  walk(root);
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Coincident faces                                                                           */
/* ------------------------------------------------------------------------------------------ */

/** Pairs of faces that lie exactly on the same polygon in the world (same plane, same corners). */
export function coincidentPairs(m: FoldModel, P: M34[], tol = 1e-6): [number, number][] {
  const corners = m.polys.map((poly, f) => poly.map((p) => apply(P[f], p)));
  const out: [number, number][] = [];
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++) {
      if (corners[i].length !== corners[j].length) continue;
      const same = corners[i].every((a) =>
        corners[j].some(
          (b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol,
        ),
      );
      if (same) out.push([i, j]);
    }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* SVG output                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export const TINTS = ["#f4c7c3", "#c9dff5", "#d3ecc4", "#f7e3a6", "#e1d0f0", "#cde9e6"];
export const PX = 60; // pixels per net unit at scale 1
/** Fraction of a face width by which the later of two coincident faces is slid sideways. */
export const COINCIDENT_SHIFT = 0.8;

export interface FaceView {
  m: [number, number, number, number, number, number];
  /** Back face (seen from behind): determinant sign. */
  back: boolean;
  /** Extra screen offset applied for a coincident face. */
  shift: P2;
}
export interface Frame {
  width: number;
  height: number;
  scale: number;
  faces: FaceView[];
  /** Face ids back to front. */
  order: number[];
  /** Fragments back to front when mode is split. */
  frags?: Frag[];
  coincident: [number, number][];
}

/** Determinant of the linear part: front faces have det < 0 in this convention (y flip). */
export const isBack = (a: number, b: number, c: number, d: number) => a * d - b * c > 0;

export function frameFor(
  m: FoldModel,
  ang: number[],
  view: View,
  mode: SortMode,
  opts: { separate?: boolean; px?: number } = {},
): Frame {
  const P = pose(m, ang);
  const b = basis(view);
  const scale = opts.px ?? PX;
  const size = Math.ceil(2 * m.radius * scale);
  const faces: FaceView[] = P.map((M) => {
    const mat = faceMatrix(M, b, scale, size / 2, size / 2, m.centre);
    return { m: mat, back: isBack(mat[0], mat[1], mat[2], mat[3]), shift: [0, 0] };
  });
  const coincident = coincidentPairs(m, P);
  let order: number[];
  let frags: Frag[] | undefined;
  if (mode === "split") {
    const { root } = buildBsp(m, P);
    frags = bspOrder(root, b);
    order = frags.map((f) => f.face);
  } else order = sortOrder(m, P, b, mode);
  if (opts.separate)
    for (const [i, j] of coincident)
      faces[j].shift = chooseShift(m, faces.map((f) => f.m), order, i, j);
  return { width: size, height: size, scale, faces, order, frags, coincident };
}

const pointInConvex = (poly: P2[], x: number, y: number) => {
  let pos = 0,
    neg = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k],
      c = poly[(k + 1) % poly.length];
    const cr = (c[0] - a[0]) * (y - a[1]) - (c[1] - a[1]) * (x - a[0]);
    if (cr > 0) pos++;
    else if (cr < 0) neg++;
  }
  return pos === 0 || neg === 0;
};
/**
 * Slide the later face of a coincident pair sideways (screen px) so both letters stay visible.
 * Four candidate directions (along the first and last local edge, both signs) are scored with a
 * coarse painter pass over the current draw order; the best wins (first candidate on ties).
 */
export function chooseShift(
  m: FoldModel,
  mats: number[][],
  order: number[],
  i: number,
  j: number,
): P2 {
  const img = (mm: number[], e: P2): P2 => [mm[0] * e[0] + mm[2] * e[1], mm[1] * e[0] + mm[3] * e[1]];
  const pj = m.polys[j];
  const e0: P2 = [pj[1][0] - pj[0][0], pj[1][1] - pj[0][1]];
  const e1: P2 = [pj[pj.length - 1][0] - pj[0][0], pj[pj.length - 1][1] - pj[0][1]];
  const base = [img(mats[j], e0), img(mats[j], e1)];
  const cands: P2[] = [base[0], [-base[0][0], -base[0][1]], base[1], [-base[1][0], -base[1][1]]].map(
    (v) => [COINCIDENT_SHIFT * v[0], COINCIDENT_SHIFT * v[1]] as P2,
  );
  const map = (mm: number[], p: P2, s: P2): P2 => [
    mm[0] * p[0] + mm[2] * p[1] + mm[4] + s[0],
    mm[1] * p[0] + mm[3] * p[1] + mm[5] + s[1],
  ];
  let best = cands[0],
    bestScore = -1;
  for (const s of cands) {
    const polys = new Map<number, P2[]>();
    for (const f of order) polys.set(f, m.polys[f].map((p) => map(mats[f], p, f === j ? s : [0, 0])));
    const top = (x: number, y: number) => {
      let id = -1;
      for (const f of order) if (pointInConvex(polys.get(f)!, x, y)) id = f;
      return id;
    };
    let score = Infinity;
    for (const f of [i, j]) {
      const sh: P2 = f === j ? s : [0, 0];
      const poly = m.polys[f];
      const c = centreOf(poly);
      const xs = poly.map((p) => p[0]),
        ys = poly.map((p) => p[1]);
      let own = 0,
        tot = 0;
      for (let a = 0; a < 6; a++)
        for (let b = 0; b < 6; b++) {
          const q = map(mats[f], [Math.min(...xs) + ((a + 0.5) / 6) * (Math.max(...xs) - Math.min(...xs)), Math.min(...ys) + ((b + 0.5) / 6) * (Math.max(...ys) - Math.min(...ys))], sh);
          tot++;
          if (top(q[0], q[1]) === f) own++;
        }
      let letter = 0;
      for (const d of [[0, 0], [0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) {
        const q = map(mats[f], [c[0] + d[0], c[1] + d[1]], sh);
        if (top(q[0], q[1]) === f) letter++;
      }
      score = Math.min(score, 0.5 * (letter / 5) + 0.5 * (own / tot));
    }
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}
const f4 = (x: number) => (Math.round(x * 10000) / 10000).toString();
export const matrixAttr = (mm: number[], shift: P2 = [0, 0]) =>
  `matrix(${f4(mm[0])} ${f4(mm[1])} ${f4(mm[2])} ${f4(mm[3])} ${f4(mm[4] + shift[0])} ${f4(mm[5] + shift[1])})`;

export function centreOf(poly: P2[]): P2 {
  return [
    poly.reduce((s, p) => s + p[0], 0) / poly.length,
    poly.reduce((s, p) => s + p[1], 0) / poly.length,
  ];
}
/** Text transform that keeps a letter reading normally on either side of the face. */
export const letterFlip = (back: boolean) => (back ? "scale(-1 -1)" : "scale(1 -1)");

/**
 * Letter transform: never mirrored (flip chosen by the face side) and turned in quarter steps
 * inside the face plane so that the glyph's up direction is as close to screen-up as possible.
 */
export function letterAttr(m: number[], back: boolean, c: P2): string {
  const sx = back ? -1 : 1,
    sy = -1;
  let bestK = 0,
    best = -Infinity;
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2,
      cs = Math.round(Math.cos(th)),
      sn = Math.round(Math.sin(th));
    // text-local up is (0,-1); S then R then the face matrix (a b c d in SVG order)
    const sxv = [sx * 0, sy * -1]; // S . (0,-1) = (0, 1)
    const rx = cs * sxv[0] - sn * sxv[1],
      ry = sn * sxv[0] + cs * sxv[1];
    const upY = m[1] * rx + m[3] * ry; // screen y (down) of the glyph up vector
    const upX = m[0] * rx + m[2] * ry;
    const score = -upY / (Math.hypot(upX, upY) || 1);
    if (score > best + 1e-9) {
      best = score;
      bestK = k;
    }
  }
  return `translate(${f4(c[0])} ${f4(c[1])}) rotate(${bestK * 90}) ${letterFlip(back)}`;
}

export function svgString(m: FoldModel, fr: Frame, opts: { hatch?: boolean } = {}): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fr.width} ${fr.height}" width="${fr.width}" height="${fr.height}" data-spike="throwaway">`,
  );
  parts.push(
    `<defs><pattern id="hatch" width="0.2" height="0.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.2" stroke="#444" stroke-width="0.04"/></pattern></defs>`,
  );
  const items: { face: number; frag?: Frag }[] = fr.frags
    ? fr.frags.map((frag) => ({ face: frag.face, frag }))
    : fr.order.map((face) => ({ face }));
  const coinc = new Set(fr.coincident.flatMap((p) => p));
  const later = new Set(fr.coincident.map((p) => p[1]));
  let clip = 0;
  for (const { face, frag } of items) {
    const poly = m.polys[face];
    const fv = fr.faces[face];
    const pts = poly.map((p) => `${f4(p[0])},${f4(p[1])}`).join(" ");
    const c = centreOf(poly);
    let attr = "";
    let defs = "";
    if (frag) {
      const id = `c${clip++}`;
      defs = `<clipPath id="${id}"><polygon points="${frag.poly.map((p) => `${f4(p[0])},${f4(p[1])}`).join(" ")}"/></clipPath>`;
      attr = ` clip-path="url(#${id})"`;
    }
    const stroke = later.has(face) ? ` stroke-dasharray="0.12 0.08"` : "";
    parts.push(
      `${defs}<g data-face="${face}" data-back="${fv.back ? 1 : 0}" transform="${matrixAttr(fv.m, fv.shift)}"${attr}>` +
        `<polygon points="${pts}" fill="${TINTS[face % 6]}" stroke="${coinc.has(face) ? "#b00020" : "#222"}" stroke-width="0.05"${stroke} stroke-linejoin="round"/>` +
        (fv.back && opts.hatch !== false
          ? `<polygon points="${pts}" fill="url(#hatch)" stroke="none"/>`
          : "") +
        `<text x="0" y="0" transform="${letterAttr(fv.m, fv.back, c)}" font-size="0.5" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" fill="#111">${m.labels[face]}</text></g>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
