/**
 * Pure model of the hands-on net folder: a hinge tree over the faces of a net, the exact fold
 * state (a bitmask: which creases are folded), its moves, exact integer geometry for square nets,
 * and the Watch script. No DOM and no three.js, so Vitest runs it in Node. Angles in radians are
 * drawing data only; nothing judged depends on them.
 */
import {
  SOLID_NAMES,
  catalogueNet,
  collisionLetters,
  oppositeLetters,
  parseNet,
  uncoveredOppositeLetters,
  type ParsedNet,
  type SolidId,
} from "./nets";

export type P2 = [number, number];
export type V3 = [number, number, number];
/** Row-major 3 by 4 affine matrix [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type M34 = number[];

export interface Hinge {
  parent: number;
  child: number;
  /** Crease end points in the flat net, along the parent's side. */
  a: P2;
  b: P2;
  /** Unit axis along the crease such that a positive turn lifts the child towards +z. */
  u: P2;
  /** Turn in radians when the crease is folded. */
  max: number;
}
export interface FoldModel {
  /** Faces as convex polygons in the flat net (x right, y up), counter-clockwise. */
  polys: P2[][];
  labels: string[];
  root: number;
  hinges: Hinge[];
  /** Faces with every parent before its children, and the hinge into each (-1 for the root). */
  order: { face: number; hinge: number }[];
  /** Centre and radius of a ball holding the shape in every end state (drawing only). */
  centre: V3;
  radius: number;
}

const edgeKey = (a: P2, b: P2) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;

/**
 * Builds the hinge tree from the root by breadth-first search, visiting each face's sides in
 * order, so hinge numbers are stable. Two faces are hinged where one owns side a to b and the
 * other side b to a. Returns null when the joins form a cycle (a 2 by 2 block of squares).
 */
export function buildFoldModel(
  polys: P2[][],
  labels: string[],
  root: number,
  maxAngle: (parent: number, child: number) => number,
): FoldModel | null {
  const owner = new Map<string, number>();
  polys.forEach((poly, f) =>
    poly.forEach((a, k) =>
      owner.set(edgeKey(a, poly[(k + 1) % poly.length]), f),
    ),
  );
  let joins = 0;
  const adjacent = polys.map((poly) =>
    poly.flatMap((a, k) => {
      const b = poly[(k + 1) % poly.length];
      const to = owner.get(edgeKey(b, a));
      if (to === undefined) return [];
      joins++;
      return [{ to, a, b }];
    }),
  );
  if (joins / 2 !== polys.length - 1) return null;
  const seen = new Set([root]);
  const order: FoldModel["order"] = [{ face: root, hinge: -1 }];
  const hinges: Hinge[] = [];
  for (let i = 0; i < order.length; i++) {
    const f = order[i].face;
    for (const { to, a, b } of adjacent[f]) {
      if (seen.has(to)) continue;
      seen.add(to);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      hinges.push({
        parent: f,
        child: to,
        a,
        b,
        u: [(a[0] - b[0]) / len, (a[1] - b[1]) / len],
        max: maxAngle(f, to),
      });
      order.push({ face: to, hinge: hinges.length - 1 });
    }
  }
  if (order.length !== polys.length) return null;
  const model: FoldModel = {
    polys,
    labels,
    root,
    hinges,
    order,
    centre: [0, 0, 0],
    radius: 1,
  };
  const all = polys.flat();
  const centre: V3 = [
    (Math.min(...all.map((p) => p[0])) + Math.max(...all.map((p) => p[0]))) / 2,
    (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2,
    0,
  ];
  let r = 0;
  for (const t of [0, 0.5, 1]) {
    const pose = floatPose(
      model,
      hinges.map((h) => h.max * t),
    );
    polys.forEach((poly, f) =>
      poly.forEach((p) => {
        const w = apply(pose[f], p);
        r = Math.max(
          r,
          Math.hypot(w[0] - centre[0], w[1] - centre[1], w[2] - centre[2]),
        );
      }),
    );
  }
  model.centre = centre;
  model.radius = r * 1.08 + 0.2;
  return model;
}

/** The labelled squares of a net as unit squares (x right, y up) in reading order. */
export function netFoldModel(net: string, floor: string): FoldModel | null {
  const parsed = parseNet(net);
  if (typeof parsed === "string") return null;
  const cells = parsed.cells.filter((c) => /[A-F]/.test(c.ch));
  const polys = cells.map(({ x, y }): P2[] => [
    [x, -y - 1],
    [x + 1, -y - 1],
    [x + 1, -y],
    [x, -y],
  ]);
  const root = cells.findIndex((c) => c.ch === floor);
  if (root < 0) return null;
  return buildFoldModel(
    polys,
    cells.map((c) => c.ch),
    root,
    () => Math.PI / 2,
  );
}

/**
 * Catalogue solids (WP1b): the faces of `catalogueNet`, hinged where they share a side, folded by
 * the outside angle of each edge of the finished solid. The prism and pyramid angles are not
 * multiples of 90 degrees, so their pictures are float only; nothing is judged from them.
 */
export function solidFoldModel(solid: SolidId, rotation = 0): FoldModel | null {
  const net = catalogueNet(solid, rotation);
  const polys = net.faces.map((f) => f.map((p): P2 => [p[0], p[1]]));
  const labels = polys.map((_, i) => "ABCDEF"[i]);
  let angle: (a: number, b: number) => number = () => Math.PI / 2;
  if (solid === "triangular-prism")
    // belt faces 0 (side 3), 1 (side 4), 2 (side 5) round a 3-4-5 right-angled end
    angle = (a, b) => {
      const k = [a, b].sort().join(",");
      if (k === "1,2") return Math.PI - Math.acos(4 / 5);
      if (k === "0,2") return Math.PI - Math.acos(3 / 5);
      return Math.PI / 2;
    };
  else if (solid === "square-pyramid")
    // base 4 by 4, triangles of height 5: the base-to-side angle has cosine 2/5
    angle = () => Math.PI - Math.acos(2 / 5);
  return buildFoldModel(polys, labels, 0, angle);
}

/* ---------------------------------------- matrices ---------------------------------------- */

export const IDENTITY: M34 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function mul(A: M34, B: M34): M34 {
  const out: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      out.push(
        A[r * 4] * B[c] +
          A[r * 4 + 1] * B[4 + c] +
          A[r * 4 + 2] * B[8 + c] +
          (c === 3 ? A[r * 4 + 3] : 0),
      );
  return out;
}
export const apply = (M: M34, p: P2): V3 => [
  M[0] * p[0] + M[1] * p[1] + M[3],
  M[4] * p[0] + M[5] * p[1] + M[7],
  M[8] * p[0] + M[9] * p[1] + M[11],
];
/** Turn by (cos, sin) about the crease line through `a` along `u`. */
function turnAbout(h: Hinge, c: number, s: number): M34 {
  const [ux, uy] = h.u,
    k = 1 - c;
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
  const [px, py] = h.a;
  return [
    R[0],
    R[1],
    R[2],
    px - (R[0] * px + R[1] * py),
    R[3],
    R[4],
    R[5],
    py - (R[3] * px + R[4] * py),
    R[6],
    R[7],
    R[8],
    -(R[6] * px + R[7] * py),
  ];
}
/** World matrix of every face for per-hinge turns in radians (drawing only). */
export function floatPose(m: FoldModel, angles: number[]): M34[] {
  const out: M34[] = [];
  for (const { face, hinge } of m.order)
    out[face] =
      hinge < 0
        ? IDENTITY
        : mul(
            out[m.hinges[hinge].parent],
            turnAbout(
              m.hinges[hinge],
              Math.cos(angles[hinge]),
              Math.sin(angles[hinge]),
            ),
          );
  return out;
}

/* ------------------------------------ exact fold state ------------------------------------ */

/** The judged state: bit k set means crease k is folded. Serialisable as a whole number. */
export type FoldState = number;
export type FoldMove =
  | { type: "toggle"; crease: number }
  | { type: "fold-all" }
  | { type: "unfold-all" }
  | { type: "set"; state: number };
export const allFolded = (m: FoldModel): FoldState =>
  (1 << m.hinges.length) - 1;
export const isFolded = (state: FoldState, crease: number) =>
  ((state >> crease) & 1) === 1;
export const foldedCount = (state: FoldState) =>
  [...state.toString(2)].filter((d) => d === "1").length;

/** Applies a move. A malformed or out-of-range move returns the same state and a reason. */
export function foldReducer(
  m: FoldModel,
  state: FoldState,
  move: FoldMove,
): { state: FoldState; rejected?: string } {
  const full = allFolded(m);
  switch (move?.type) {
    case "toggle":
      return Number.isInteger(move.crease) &&
        move.crease >= 0 &&
        move.crease < m.hinges.length
        ? { state: state ^ (1 << move.crease) }
        : { state, rejected: "No such crease" };
    case "fold-all":
      return { state: full };
    case "unfold-all":
      return { state: 0 };
    case "set":
      return Number.isInteger(move.state) &&
        move.state >= 0 &&
        move.state <= full
        ? { state: move.state }
        : { state, rejected: "No such fold state" };
  }
  return { state, rejected: "Unsupported move" };
}

/**
 * Exact pose of a square net (every crease 0 or 90 degrees): integer matrices, because a quarter
 * turn about an axis-parallel line through whole-number points maps whole numbers to whole numbers.
 * Null for a model whose creases are not quarter turns.
 */
export function exactPose(m: FoldModel, state: FoldState): M34[] | null {
  if (m.hinges.some((h) => Math.abs(h.max - Math.PI / 2) > 1e-12)) return null;
  const out: M34[] = [];
  for (const { face, hinge } of m.order) {
    if (hinge < 0) {
      out[face] = IDENTITY;
      continue;
    }
    const h = m.hinges[hinge];
    out[face] = isFolded(state, hinge)
      ? mul(out[h.parent], turnAbout(h, 0, 1)).map((v) => Math.round(v))
      : out[h.parent];
  }
  return out;
}
/** Integer corners of every face in an exact pose. */
export function exactCorners(m: FoldModel, state: FoldState): V3[][] | null {
  const pose = exactPose(m, state);
  return pose && m.polys.map((poly, f) => poly.map((p) => apply(pose[f], p)));
}
const cornerKey = (corners: V3[]) =>
  corners
    .map((c) => c.join(","))
    .sort()
    .join(" ");
/** Letter pairs (sorted) whose squares lie exactly on top of each other in the exact pose. */
export function exactCoincident(
  m: FoldModel,
  state: FoldState,
): [string, string][] {
  const corners = exactCorners(m, state);
  if (!corners) return [];
  const out: [string, string][] = [];
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++)
      if (cornerKey(corners[i]) === cornerKey(corners[j]))
        out.push([m.labels[i], m.labels[j]].sort() as [string, string]);
  return out.sort((a, b) => (a.join("") < b.join("") ? -1 : 1));
}
/** Letters of faces lying in the plane z = 1 (the top of a closed unit cube). */
export function exactTop(m: FoldModel, state: FoldState): string[] {
  const corners = exactCorners(m, state) ?? [];
  return m.labels.filter((_, f) => corners[f]?.every((c) => c[2] === 1));
}

/* ------------------------------------------ Watch ------------------------------------------ */

export interface FoldKeyframe {
  caption: string;
  state: FoldState;
}
const list = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * The demonstration: the flat demo net, then one crease at a time, then a closing sentence about
 * the demo net only (never the learner's net). Pure and deterministic.
 */
export function demoScript(
  goal: string,
  net: string,
  floor: string,
): FoldKeyframe[] {
  const m = netFoldModel(net, floor);
  const parsed = parseNet(net) as ParsedNet;
  if (!m) return [];
  const frames: FoldKeyframe[] = [
    {
      caption: `Watch a different net. Face ${floor} stays on the table as the floor.`,
      state: 0,
    },
  ];
  let state = 0;
  m.hinges.forEach((h, i) => {
    state |= 1 << i;
    frames.push({
      caption: `Crease ${i + 1} folds: face ${m.labels[h.child]} turns up on its edge with face ${m.labels[h.parent]}.`,
      state,
    });
  });
  const last = frames[frames.length - 1];
  const opp = oppositeLetters(parsed);
  if (goal === "fold-top" && opp)
    last.caption = `Every crease is folded. Face ${opp[floor]} is on top, opposite the floor, face ${floor}.`;
  else if (goal === "fold-opposite" && opp) {
    const side = m.labels.find((l) => l !== floor && l !== opp[floor])!;
    last.caption = `Every crease is folded. Face ${side} and face ${opp[side]} are opposite: they never share an edge.`;
  } else if (goal === "collide") {
    const [pair] = collisionLetters(parsed);
    if (pair)
      last.caption = `Every crease is folded. ${list(pair)} land on the same place, so this net does not make a cube.`;
  } else if (goal === "missing") {
    const [across] = uncoveredOppositeLetters(parsed);
    if (across)
      last.caption = `Every crease is folded. One face of the cube is left open: the face opposite ${across}.`;
  }
  return frames;
}

/** Watch script for a catalogue solid: flat, one crease at a time, then the solid named. */
export function solidScript(solid: SolidId): FoldKeyframe[] {
  const m = solidFoldModel(solid);
  if (!m) return [];
  const frames: FoldKeyframe[] = [
    {
      caption: `Watch a different net. Face ${m.labels[m.root]} stays on the table.`,
      state: 0,
    },
  ];
  let state = 0;
  m.hinges.forEach((h, i) => {
    state |= 1 << i;
    frames.push({
      caption: `Crease ${i + 1} folds: face ${m.labels[h.child]} turns up on its edge with face ${m.labels[h.parent]}.`,
      state,
    });
  });
  frames[frames.length - 1].caption =
    `Every crease is folded. The edges meet and close up: this net makes a ${SOLID_NAMES[solid]}.`;
  return frames;
}
