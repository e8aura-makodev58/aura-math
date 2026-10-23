/** WP0a SPIKE (THROWAWAY): net enumeration and fold models built on src/topics/nets.ts exports. */
import {
  canonicalKey,
  catalogueNet,
  foldsToCube,
  hasBlock2x2,
  type Pt,
  type SolidId,
} from "../../src/topics/nets";
import { buildModel, type FoldModel, type P2 } from "./fold";

const key = (x: number, y: number) => `${x},${y}`;
const DIRS: Pt[] = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
];

/** All 35 free hexominoes, found by growing one square at a time and deduplicating. */
export function freeHexominoes(): Pt[][] {
  let level = new Map<string, Pt[]>([[canonicalKey([[0, 0]]), [[0, 0]]]]);
  for (let n = 2; n <= 6; n++) {
    const next = new Map<string, Pt[]>();
    for (const cells of level.values()) {
      const have = new Set(cells.map(([x, y]) => key(x, y)));
      for (const [x, y] of cells)
        for (const [dx, dy] of DIRS) {
          if (have.has(key(x + dx, y + dy))) continue;
          const grown: Pt[] = [...cells, [x + dx, y + dy]];
          const k = canonicalKey(grown);
          if (!next.has(k)) next.set(k, normalise(grown));
        }
    }
    level = next;
  }
  return [...level.values()];
}
export function normalise(cells: Pt[]): Pt[] {
  const x0 = Math.min(...cells.map((c) => c[0])),
    y0 = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]): Pt => [x - x0, y - y0])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
/** The distinct fixed orientations (turns and flips) of a free polyomino. */
export function fixedOrientations(cells: Pt[]): Pt[][] {
  const maps: ((p: Pt) => Pt)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [-x, y],
    ([x, y]) => [x, -y],
    ([x, y]) => [-x, -y],
    ([x, y]) => [y, x],
    ([x, y]) => [-y, x],
    ([x, y]) => [y, -x],
    ([x, y]) => [-y, -x],
  ];
  const seen = new Map<string, Pt[]>();
  for (const m of maps) {
    const c = normalise(cells.map(m));
    seen.set(c.map((p) => p.join(".")).join(" "), c);
  }
  return [...seen.values()];
}
/** The distinct orientations reachable by turning only (no flips): 1, 2 or 4 of them. */
export function turnOrientations(cells: Pt[]): Pt[][] {
  const maps: ((p: Pt) => Pt)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [-y, x],
    ([x, y]) => [-x, -y],
    ([x, y]) => [y, -x],
  ];
  const seen = new Map<string, Pt[]>();
  for (const m of maps) {
    const c = normalise(cells.map(m));
    seen.set(c.map((p) => p.join(".")).join(" "), c);
  }
  return [...seen.values()];
}
/** Chiral classes: one orientation per rotation class (mirror images are separate classes). */
export function rotationClasses(cells: Pt[]): Pt[][] {
  const out = new Map<string, Pt[]>();
  for (const o of fixedOrientations(cells)) {
    const k = turnOrientations(o)
      .map((t) => t.map((p) => p.join(".")).join(" "))
      .sort()[0];
    if (!out.has(k)) out.set(k, o);
  }
  return [...out.values()];
}

/**
 * The rolling-cube model, written again here (an EQUIVALENT of the one inside foldsToCube,
 * which does not expose its states on failure): the face id under each square, or null.
 */
export function rolledFaces(cells: Pt[]): Map<string, number> {
  type S = [number, number, number, number, number, number];
  const roll = (s: S, dir: number): S => {
    const [d, u, n, so, e, w] = s;
    if (dir === 0) return [e, w, n, so, u, d];
    if (dir === 1) return [w, e, n, so, d, u];
    if (dir === 2) return [n, so, u, d, e, w];
    return [so, n, d, u, e, w];
  };
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  const first = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
  const st = new Map<string, S>([[key(...first), [0, 1, 2, 3, 4, 5]]]);
  const q: Pt[] = [first];
  while (q.length) {
    const [x, y] = q.shift()!;
    const here = st.get(key(x, y))!;
    DIRS.forEach(([dx, dy], dir) => {
      const k = key(x + dx, y + dy);
      if (have.has(k) && !st.has(k)) {
        st.set(k, roll(here, dir));
        q.push([x + dx, y + dy]);
      }
    });
  }
  const out = new Map<string, number>();
  for (const [x, y] of cells) out.set(key(x, y), st.get(key(x, y))![0]);
  return out;
}
/** Cell index pairs sharing the same face under the rolling model. */
export function rolledCoincidences(cells: Pt[]): [number, number][] {
  const f = rolledFaces(cells);
  const out: [number, number][] = [];
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++)
      if (f.get(key(...cells[i])) === f.get(key(...cells[j]))) out.push([i, j]);
  return out;
}

export type NetClass = "cube" | "block" | "collide1" | "collide2" | "other";
export function classify(cells: Pt[]): NetClass {
  if (foldsToCube(cells).ok) return "cube";
  if (hasBlock2x2(cells)) return "block";
  const n = rolledCoincidences(cells).length;
  return n === 1 ? "collide1" : n === 2 ? "collide2" : "other";
}

export const LABELS = "ABCDEF";

/** Squares of a hexomino as polygons (x right, y up), counter-clockwise. */
export function cellPolys(cells: Pt[]): P2[][] {
  return cells.map(([x, y]): P2[] => [
    [x, -y - 1],
    [x + 1, -y - 1],
    [x + 1, -y],
    [x, -y],
  ]);
}
/** Fold model of a hexomino with the given square as the floor (root), 90 degree creases. */
export function cellModel(cells: Pt[], root = 0, labels = LABELS): FoldModel {
  return buildModel(
    cellPolys(cells),
    cells.map((_, i) => labels[i]),
    root,
    () => Math.PI / 2,
  );
}

/** Fold angles per solid, from the dihedral angles of the finished solid. */
export function solidModel(solid: SolidId, root = 0): FoldModel {
  const net = catalogueNet(solid);
  const polys = net.faces.map((f) => f.map((p): P2 => [p[0], p[1]]));
  const labels = polys.map((_, i) => LABELS[i]);
  let angle: (a: number, b: number) => number = () => Math.PI / 2;
  if (solid === "triangular-prism") {
    // belt faces 0 (leg 3), 1 (leg 4), 2 (hypotenuse 5); ends 3 and 4 hinge on face 1
    angle = (a, b) => {
      const k = [a, b].sort().join(",");
      if (k === "1,2") return Math.PI - Math.acos(4 / 5);
      if (k === "0,2") return Math.PI - Math.acos(3 / 5);
      return Math.PI / 2;
    };
  } else if (solid === "square-pyramid") {
    angle = () => Math.PI - Math.acos(2 / 5); // base 4, slant height 5: cos(dihedral) = 2/5
  }
  return buildModel(polys, labels, root, angle);
}
export { catalogueNet };
