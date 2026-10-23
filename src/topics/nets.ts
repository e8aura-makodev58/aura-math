import type { Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { lazyWorkbench } from "../workbench/lazy";
import {
  checkKinds,
  checkMeanings,
  choiceFor,
  esc,
  hasOnlyKeys,
  isInt,
  isRecord,
  makeAdapter,
} from "./p4-kit";

/** A grid point or polygon vertex. Net cells use (column, row) with the row counted downwards. */
export type Pt = [number, number];

/* ------------------------------------------------------------------------------------------ */
/* Net strings                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Largest side of a net's bounding box. Six is needed so the straight line of six squares fits. */
export const MAX_SIDE = 6;
export interface NetCell {
  x: number;
  y: number;
  /** `#` unlabelled square, `A` to `F` labelled square, `a` to `d` candidate spot. */
  ch: string;
}
export interface ParsedNet {
  cols: number;
  rows: number;
  cells: NetCell[];
}
const NET_CHARS = /^[.#A-Fa-d]+$/;

/**
 * Parses a net such as `.#../####/.#..`: rows joined by `/`, one character per cell. Returns the
 * parsed net or a sentence naming the problem. A net must be rectangular, at most six squares
 * wide and high, and already trimmed of empty outer rows and columns.
 */
export function parseNet(text: unknown): ParsedNet | string {
  if (typeof text !== "string" || !text) return "A net must be written as text";
  const rows = text.split("/");
  if (rows.some((r) => !r)) return "A net row must not be empty";
  if (rows.some((r) => !NET_CHARS.test(r)))
    return "A net uses only . # and the letters A to F and a to d";
  if (rows.some((r) => r.length !== rows[0].length))
    return "Every row of a net must have the same length";
  const cols = rows[0].length;
  if (cols > MAX_SIDE || rows.length > MAX_SIDE)
    return `A net is at most ${MAX_SIDE} squares wide and high`;
  const cells: NetCell[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") cells.push({ x, y, ch });
    }),
  );
  if (!cells.length) return "A net needs at least one square";
  if (
    !rows[0].split("").some((c) => c !== ".") ||
    !rows
      .at(-1)!
      .split("")
      .some((c) => c !== ".") ||
    !rows.some((r) => r[0] !== ".") ||
    !rows.some((r) => r[cols - 1] !== ".")
  )
    return "Remove empty outer rows and columns from the net";
  return { cols, rows: rows.length, cells };
}
/**
 * Trims empty outer rows and columns from rectangular text made of net characters. Anything else
 * is returned unchanged, so a mistyped net stays editable and the validator names the problem.
 */
export function normaliseNet(text: string): string {
  const rows = text.split("/");
  if (
    !rows.length ||
    rows.some((r) => !NET_CHARS.test(r) || r.length !== rows[0].length)
  )
    return text;
  const used = rows.map((r) => [...r].map((c) => c !== "."));
  const rowKeep = used.map((r) => r.some(Boolean));
  const colKeep = rows[0].split("").map((_, x) => used.some((r) => r[x]));
  if (!rowKeep.some(Boolean)) return text;
  return rows
    .filter((_, y) => rowKeep[y])
    .map((r) => [...r].filter((_, x) => colKeep[x]).join(""))
    .join("/");
}
const key = (x: number, y: number) => `${x},${y}`;
export const squareCells = (net: ParsedNet): Pt[] =>
  net.cells.filter((c) => !/[a-d]/.test(c.ch)).map((c) => [c.x, c.y]);
const DIRS: Pt[] = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
];

export function isConnected(cells: Pt[]): boolean {
  if (!cells.length) return false;
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  const seen = new Set<string>([key(...cells[0])]);
  const queue: Pt[] = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of DIRS) {
      const k = key(x + dx, y + dy);
      if (have.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}
export function hasBlock2x2(cells: Pt[]): boolean {
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  return cells.some(
    ([x, y]) =>
      have.has(key(x + 1, y)) &&
      have.has(key(x, y + 1)) &&
      have.has(key(x + 1, y + 1)),
  );
}
/** Same shape up to turning over and turning round: equal keys mean the same free polyomino. */
export function canonicalKey(cells: Pt[]): string {
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
  let best = "";
  for (const m of maps) {
    const moved = cells.map(m);
    const x0 = Math.min(...moved.map((p) => p[0])),
      y0 = Math.min(...moved.map((p) => p[1]));
    const text = moved
      .map(([x, y]): Pt => [x - x0, y - y0])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([x, y]) => `${x}.${y}`)
      .join(" ");
    if (!best || text < best) best = text;
  }
  return best;
}

/* ------------------------------------------------------------------------------------------ */
/* Folding: rolling a cube over the net                                                       */
/* ------------------------------------------------------------------------------------------ */

/** (down, up, north, south, east, west) as face ids. */
type State = [number, number, number, number, number, number];
const START: State = [0, 1, 2, 3, 4, 5];
/** Rolling across an edge: 0 east, 1 west, 2 north (row above), 3 south (row below). */
function roll(s: State, dir: number): State {
  const [d, u, n, so, e, w] = s;
  if (dir === 0) return [e, w, n, so, u, d];
  if (dir === 1) return [w, e, n, so, d, u];
  if (dir === 2) return [n, so, u, d, e, w];
  return [so, n, d, u, e, w];
}
export type FoldFailure = "wrong-count" | "not-connected" | "overlap";
export type FoldResult =
  | { ok: true; face: Map<string, number>; states: Map<string, State> }
  | { ok: false; reason: FoldFailure };

/**
 * Does this arrangement of squares fold into a cube? Roll a cube over the net: the first square is
 * the floor, and every square the cube lands on must show a different face. Every edge between
 * neighbouring squares is checked, including edges the search did not use, so a 2 by 2 block (whose
 * creases would need 360 degrees at a corner) is rejected.
 */
export function foldsToCube(cells: Pt[]): FoldResult {
  if (cells.length !== 6) return { ok: false, reason: "wrong-count" };
  if (!isConnected(cells)) return { ok: false, reason: "not-connected" };
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  const first = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
  const states = new Map<string, State>([[key(...first), START]]);
  const queue: Pt[] = [first];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const here = states.get(key(x, y))!;
    DIRS.forEach(([dx, dy], dir) => {
      const k = key(x + dx, y + dy);
      if (have.has(k) && !states.has(k)) {
        states.set(k, roll(here, dir));
        queue.push([x + dx, y + dy]);
      }
    });
  }
  for (const [x, y] of cells) {
    const here = states.get(key(x, y))!;
    for (const [dir, [dx, dy]] of DIRS.entries()) {
      const there = states.get(key(x + dx, y + dy));
      if (
        there &&
        roll(here, dir).join(",") !== there.join(",") // the paper would have to stretch
      )
        return { ok: false, reason: "overlap" };
    }
  }
  const face = new Map<string, number>();
  for (const [x, y] of cells) face.set(key(x, y), states.get(key(x, y))![0]);
  if (new Set(face.values()).size !== 6)
    return { ok: false, reason: "overlap" };
  return { ok: true, face, states };
}
/**
 * The face (0 to 5) under every square when a cube is rolled over the net from its first square,
 * whether or not two squares land on the same face. Defined for six connected squares; for a net
 * with no 2 by 2 block the joins form a tree, so the result does not depend on the search order.
 */
export function rolledFaceIds(cells: Pt[]): number[] | null {
  if (cells.length !== 6 || !isConnected(cells)) return null;
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  const first = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
  const states = new Map<string, State>([[key(...first), START]]);
  const queue: Pt[] = [first];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const here = states.get(key(x, y))!;
    DIRS.forEach(([dx, dy], dir) => {
      const k = key(x + dx, y + dy);
      if (have.has(k) && !states.has(k)) {
        states.set(k, roll(here, dir));
        queue.push([x + dx, y + dy]);
      }
    });
  }
  return cells.map(([x, y]) => states.get(key(x, y))![0]);
}
/** Opposite faces are the pairs 0-1, 2-3 and 4-5 of the starting position. */
export const oppositeFace = (id: number) => id ^ 1;

/** The reason a connected six-square net does not fold, in the words a learner would use. */
export function whyReason(cells: Pt[]): "overlap" | "corner" | null {
  if (cells.length !== 6 || !isConnected(cells)) return null;
  if (foldsToCube(cells).ok) return null;
  return hasBlock2x2(cells) ? "corner" : "overlap";
}

/** For a labelled net that folds: the letter opposite each letter, or null when it does not fold. */
export function oppositeLetters(net: ParsedNet): Record<string, string> | null {
  const squares = net.cells.filter((c) => /[A-F]/.test(c.ch));
  const fold = foldsToCube(squares.map((c) => [c.x, c.y]));
  if (!fold.ok) return null;
  const byFace = new Map<number, string>();
  for (const c of squares) byFace.set(fold.face.get(key(c.x, c.y))!, c.ch);
  const result: Record<string, string> = {};
  for (const [id, letter] of byFace)
    result[letter] = byFace.get(oppositeFace(id))!;
  return result;
}

/** Letters of a labelled six-square net and the cube face each lands on when every crease folds. */
function letterFaces(
  net: ParsedNet,
): { letter: string; face: number }[] | null {
  const squares = net.cells.filter((c) => /[A-F]/.test(c.ch));
  const ids = rolledFaceIds(squares.map((c) => [c.x, c.y]));
  return ids && squares.map((c, i) => ({ letter: c.ch, face: ids[i] }));
}
/** Pairs of letters (each pair sorted) that land on the same face of the cube. */
export function collisionLetters(net: ParsedNet): [string, string][] {
  const faces = letterFaces(net) ?? [];
  const out: [string, string][] = [];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++)
      if (faces[i].face === faces[j].face)
        out.push([faces[i].letter, faces[j].letter].sort() as [string, string]);
  return out.sort((a, b) => (a.join("") < b.join("") ? -1 : 1));
}
/**
 * For a net with exactly one colliding pair, one face of the cube has no square. Returns the
 * letters on the face opposite it (one letter when the question "the face opposite which letter"
 * is well defined), or an empty list.
 */
export function uncoveredOppositeLetters(net: ParsedNet): string[] {
  const faces = letterFaces(net);
  if (!faces) return [];
  const used = new Set(faces.map((f) => f.face));
  const empty = [0, 1, 2, 3, 4, 5].filter((f) => !used.has(f));
  if (empty.length !== 1) return [];
  return faces
    .filter((f) => f.face === oppositeFace(empty[0]))
    .map((f) => f.letter)
    .sort();
}
/** Letters of squares that share a crease in the flat net, each pair sorted, in reading order. */
export function creasePairs(net: ParsedNet): [string, string][] {
  const at = new Map(net.cells.map((c) => [key(c.x, c.y), c.ch]));
  const out: [string, string][] = [];
  for (const c of [...net.cells].sort((a, b) => a.y - b.y || a.x - b.x))
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const other = at.get(key(c.x + dx, c.y + dy));
      if (other && /[A-F]/.test(c.ch) && /[A-F]/.test(other))
        out.push([c.ch, other].sort() as [string, string]);
    }
  return out;
}

/** Spots (letters a to d) where adding a sixth square to the five makes a cube net. */
export function validCompletions(net: ParsedNet): string[] {
  const piece = net.cells
    .filter((c) => c.ch === "#")
    .map((c): Pt => [c.x, c.y]);
  return net.cells
    .filter((c) => /[a-d]/.test(c.ch))
    .filter((c) => foldsToCube([...piece, [c.x, c.y]]).ok)
    .map((c) => c.ch)
    .sort();
}

/* ------------------------------------------------------------------------------------------ */
/* Catalogue solids: exact integer polygons                                                   */
/* ------------------------------------------------------------------------------------------ */

export type SolidId = "cube" | "cuboid" | "triangular-prism" | "square-pyramid";
export const SOLID_IDS: SolidId[] = [
  "cube",
  "cuboid",
  "triangular-prism",
  "square-pyramid",
];
export const SOLID_NAMES: Record<SolidId, string> = {
  cube: "cube",
  cuboid: "cuboid",
  "triangular-prism": "triangular prism",
  "square-pyramid": "square pyramid",
};
/** Wrong answers offered for "which solid", from a fixed table. */
export const SOLID_DISTRACTORS: Record<SolidId, [SolidId, SolidId]> = {
  cube: ["cuboid", "square-pyramid"],
  cuboid: ["cube", "triangular-prism"],
  "triangular-prism": ["cuboid", "square-pyramid"],
  "square-pyramid": ["triangular-prism", "cuboid"],
};

/**
 * A net as faces and the edges that fold together. Faces are convex polygons with integer vertices
 * in whole units, y pointing up, listed counter-clockwise; side k of a face runs from vertex k to
 * vertex k+1. Two faces that share a segment in the plane are hinged there. Every other side is
 * glued to exactly one other side, listed as (face, side, face, side), traversed in opposite
 * directions.
 */
export interface CatalogueNet {
  faces: Pt[][];
  glue: [number, number, number, number][];
}
const cellNet = ".#../####/.#..";
const CUBOID_EDGES: [number, number, number] = [3, 2, 1];

/**
 * Sizes of a box net's squares, derived from the fold. The three edge lengths are given to the
 * three opposite-face pairs (in each of the six orders until the net sits on a grid of columns and
 * rows). A cell's width is the box's length in the east-west direction while that cell is the
 * floor, and its height the length north-south.
 */
export function cuboidLayout(
  cells: Pt[],
  edges: [number, number, number],
): { widths: number[]; heights: number[]; sizes: Map<string, Pt> } | null {
  const fold = foldsToCube(cells);
  if (!fold.ok) return null;
  const orders: [number, number, number][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const cols = Math.max(...cells.map((c) => c[0])) + 1;
  const rows = Math.max(...cells.map((c) => c[1])) + 1;
  for (const order of orders) {
    // pair p of the starting position gets edge length edges[order[p]]
    const sizes = new Map<string, Pt>();
    for (const [x, y] of cells) {
      const s = fold.states.get(key(x, y))!;
      sizes.set(key(x, y), [edges[order[s[4] >> 1]], edges[order[s[2] >> 1]]]);
    }
    const widths: number[] = Array(cols).fill(0),
      heights: number[] = Array(rows).fill(0);
    let aligned = true;
    for (const [x, y] of cells) {
      const [w, h] = sizes.get(key(x, y))!;
      if (widths[x] && widths[x] !== w) aligned = false;
      if (heights[y] && heights[y] !== h) aligned = false;
      widths[x] = w;
      heights[y] = h;
    }
    if (aligned) return { widths, heights, sizes };
  }
  return null;
}

/** Glue list for a net of squares or rectangles, found from the fold: sides that meet on the box. */
function glueFromFold(cells: Pt[]): [number, number, number, number][] {
  const fold = foldsToCube(cells);
  if (!fold.ok) throw new Error("Not a box net");
  const have = new Set(cells.map(([x, y]) => key(x, y)));
  // polygon side order is south, east, north, west; roll order is east, west, north, south
  const sideDir = [3, 0, 2, 1];
  const sides: { cell: number; side: number; here: number; across: number }[] =
    [];
  cells.forEach(([x, y], cell) => {
    const s = fold.states.get(key(x, y))!;
    sideDir.forEach((dir, side) => {
      const [dx, dy] = DIRS[dir];
      if (!have.has(key(x + dx, y + dy)))
        sides.push({ cell, side, here: s[0], across: s[[4, 5, 2, 3][dir]] });
    });
  });
  const glue: [number, number, number, number][] = [];
  const used = new Set<number>();
  sides.forEach((a, i) => {
    if (used.has(i)) return;
    const j = sides.findIndex(
      (b, k) =>
        k !== i && !used.has(k) && b.here === a.across && b.across === a.here,
    );
    if (j < 0) throw new Error("Unpaired side");
    used.add(i);
    used.add(j);
    glue.push([a.cell, a.side, sides[j].cell, sides[j].side]);
  });
  return glue;
}
function boxNet(edges: [number, number, number]): CatalogueNet {
  const net = parseNet(cellNet) as ParsedNet;
  const cells = net.cells.map((c): Pt => [c.x, c.y]);
  const layout = cuboidLayout(cells, edges)!;
  const left = (x: number) =>
    layout.widths.slice(0, x).reduce((a, b) => a + b, 0);
  const top = (y: number) =>
    layout.heights.slice(0, y).reduce((a, b) => a + b, 0);
  const faces = cells.map(([x, y]): Pt[] => {
    const [w, h] = layout.sizes.get(key(x, y))!;
    const X = left(x),
      Y = -top(y);
    return [
      [X, Y - h],
      [X + w, Y - h],
      [X + w, Y],
      [X, Y],
    ];
  });
  return { faces, glue: glueFromFold(cells) };
}

/**
 * Triangular prism with 3-4-5 right-angled ends and length 4: a belt of rectangles 3, 4 and 5 wide
 * with a triangle above and below the 4-wide one. The right angle is at the left of each triangle,
 * so the slope of 3 meets the 3-wide face and the slope of 5 meets the 5-wide face.
 */
const PRISM: CatalogueNet = {
  faces: [
    [
      [0, 0],
      [3, 0],
      [3, 4],
      [0, 4],
    ],
    [
      [3, 0],
      [7, 0],
      [7, 4],
      [3, 4],
    ],
    [
      [7, 0],
      [12, 0],
      [12, 4],
      [7, 4],
    ],
    [
      [3, 4],
      [7, 4],
      [3, 7],
    ],
    [
      [7, 0],
      [3, 0],
      [3, -3],
    ],
  ],
  glue: [
    [0, 2, 3, 2],
    [2, 2, 3, 1],
    [0, 0, 4, 1],
    [2, 0, 4, 2],
    [0, 3, 2, 1],
  ],
};
/** Square pyramid: base 4 by 4 and four triangles of height 5 (slope edge squared is 29). */
const PYRAMID: CatalogueNet = {
  faces: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    [
      [4, 0],
      [0, 0],
      [2, -5],
    ],
    [
      [4, 4],
      [4, 0],
      [9, 2],
    ],
    [
      [0, 4],
      [4, 4],
      [2, 9],
    ],
    [
      [0, 0],
      [0, 4],
      [-5, 2],
    ],
  ],
  glue: [
    [1, 2, 2, 1],
    [2, 2, 3, 1],
    [3, 2, 4, 1],
    [4, 2, 1, 1],
  ],
};
export function catalogueNet(solid: SolidId, rotation = 0): CatalogueNet {
  const net =
    solid === "cube"
      ? boxNet([3, 3, 3])
      : solid === "cuboid"
        ? boxNet(CUBOID_EDGES)
        : structuredClone(solid === "triangular-prism" ? PRISM : PYRAMID);
  net.faces = net.faces.map((face) =>
    face.map((point) => {
      let [x, y] = point;
      for (let turn = 0; turn < rotation; turn++) [x, y] = [-y, x];
      return [x, y] as Pt;
    }),
  );
  return net;
}

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const sqLen = (a: Pt, b: Pt) => dot(sub(a, b), sub(a, b));
const sideOf = (face: Pt[], k: number): [Pt, Pt] => [
  face[k],
  face[(k + 1) % face.length],
];

/** Convex polygons overlap when no side of either one separates them; touching is allowed. */
function overlaps(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b])
    for (let k = 0; k < poly.length; k++) {
      const [p, q] = sideOf(poly, k);
      const side = (pt: Pt) => cross(sub(q, p), sub(pt, p));
      // polygons are counter-clockwise, so the inside is on the left (positive)
      const other = poly === a ? b : a;
      if (other.every((pt) => side(pt) <= 0)) return false;
    }
  return true;
}

/**
 * Checks a net exactly, in integer arithmetic. Faces are convex and counter-clockwise and do not
 * overlap. Every side is either hinged in the plane or glued to exactly one other side of equal
 * squared length, with matching end points. Gluing must give a closed surface (Euler) and the
 * face angles at every corner of the solid must total less than 360 degrees; a corner angle is
 * judged only as acute, right or obtuse, which is enough here and never needs a square root.
 * Returns the problems found (empty when the net is sound).
 */
export function checkCatalogueNet(net: CatalogueNet): string[] {
  const errors: string[] = [];
  const { faces } = net;
  faces.forEach((face, f) => {
    if (face.length < 3) errors.push(`Face ${f} has fewer than 3 vertices`);
    face.forEach((p, k) => {
      if (!p.every((v) => Number.isInteger(v)))
        errors.push(`Face ${f} has a non-integer vertex`);
      const [a, b] = sideOf(face, k);
      const c = face[(k + 2) % face.length];
      if (cross(sub(b, a), sub(c, b)) <= 0)
        errors.push(
          `Face ${f} is not convex and counter-clockwise at vertex ${k}`,
        );
    });
  });
  if (errors.length) return errors;
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++)
      if (overlaps(faces[i], faces[j]))
        errors.push(`Faces ${i} and ${j} overlap in the plane`);
  // relation of every side: hinged in the plane, or glued
  const partner = new Map<string, string>();
  const name = (f: number, k: number) => `${f}:${k}`;
  const relate = (a: string, b: string) => {
    partner.set(a, [...(partner.get(a)?.split("|") ?? []), b].join("|"));
  };
  const pairs: [number, number, number, number][] = [];
  faces.forEach((fa, f) =>
    fa.forEach((_, k) => {
      const [p, q] = sideOf(fa, k);
      faces.forEach((fb, g) => {
        if (g <= f) return;
        fb.forEach((__, l) => {
          const [r, s] = sideOf(fb, l);
          if (
            p[0] === s[0] &&
            p[1] === s[1] &&
            q[0] === r[0] &&
            q[1] === r[1]
          ) {
            relate(name(f, k), name(g, l));
            relate(name(g, l), name(f, k));
            pairs.push([f, k, g, l]);
          }
        });
      });
    }),
  );
  const hinged = new Set(partner.keys());
  for (const [f, k, g, l] of net.glue) {
    if (!faces[f]?.[k] || !faces[g]?.[l] || (f === g && k === l)) {
      errors.push("A glue pair names a side that does not exist");
      continue;
    }
    if (hinged.has(name(f, k)) || hinged.has(name(g, l)))
      errors.push("A glued side is already hinged in the plane");
    const [p, q] = sideOf(faces[f], k),
      [r, s] = sideOf(faces[g], l);
    if (sqLen(p, q) !== sqLen(r, s))
      errors.push(
        `Glued sides differ in length (squared ${sqLen(p, q)} against ${sqLen(r, s)})`,
      );
    relate(name(f, k), name(g, l));
    relate(name(g, l), name(f, k));
    pairs.push([f, k, g, l]);
  }
  faces.forEach((fa, f) =>
    fa.forEach((_, k) => {
      const count = partner.get(name(f, k))?.split("|").length ?? 0;
      if (count !== 1) errors.push(`Side ${f}:${k} is joined ${count} times`);
    }),
  );
  if (errors.length) return errors;
  // vertices of the solid: end points identified by every hinge and glue
  const index = new Map<string, number>();
  const node = (f: number, v: number) => {
    const id = name(f, v);
    if (!index.has(id)) index.set(id, index.size);
    return index.get(id)!;
  };
  faces.forEach((fa, f) => fa.forEach((_, v) => node(f, v)));
  const root = [...index.values()].map((_, i) => i);
  const find = (i: number): number =>
    root[i] === i ? i : (root[i] = find(root[i]));
  const join = (a: number, b: number) => (root[find(a)] = find(b));
  for (const [f, k, g, l] of pairs) {
    const nf = faces[f].length,
      ng = faces[g].length;
    join(node(f, k), node(g, (l + 1) % ng));
    join(node(f, (k + 1) % nf), node(g, l));
  }
  const classes = new Map<number, [number, number][]>();
  faces.forEach((fa, f) =>
    fa.forEach((_, v) => {
      const c = find(node(f, v));
      classes.set(c, [...(classes.get(c) ?? []), [f, v]]);
    }),
  );
  const F = faces.length;
  const E = faces.reduce((n, fa) => n + fa.length, 0) / 2;
  if (classes.size !== 2 + E - F)
    errors.push(
      `The gluing does not make a closed solid: ${classes.size} vertices, expected ${2 + E - F}`,
    );
  for (const corners of classes.values()) {
    let bound = 0,
      acute = false;
    for (const [f, v] of corners) {
      const fa = faces[f];
      const at = fa[v];
      const d = dot(
        sub(fa[(v + fa.length - 1) % fa.length], at),
        sub(fa[(v + 1) % fa.length], at),
      );
      if (d > 0) {
        bound += 90;
        acute = true;
      } else if (d === 0) bound += 90;
      else bound += 180;
    }
    if (corners.length < 3 || bound > 360 || (bound === 360 && !acute))
      errors.push(
        "The face angles at a corner do not total less than 360 degrees",
      );
  }
  return errors;
}

export interface SolidFacts {
  faces: number;
  edges: number;
  vertices: number;
}
/** Faces, edges (half the total number of sides) and vertices (Euler: V = 2 + E - F). */
export function solidFacts(solid: SolidId): SolidFacts {
  const { faces } = catalogueNet(solid);
  const edges = faces.reduce((n, f) => n + f.length, 0) / 2;
  return { faces: faces.length, edges, vertices: 2 + edges - faces.length };
}
/** Solid named from the shapes of its faces alone. */
export function solidFromFaces(faces: Pt[][]): SolidId | null {
  let squares = 0,
    rectangles = 0,
    triangles = 0;
  for (const poly of faces) {
    if (poly.length === 3) triangles++;
    else if (poly.length === 4) {
      const e = [0, 1, 2, 3].map((k) => {
        const [a, b] = sideOf(poly, k);
        return sub(b, a);
      });
      const right = [0, 1, 2, 3].every((k) => dot(e[k], e[(k + 1) % 4]) === 0);
      if (!right) return null;
      if (dot(e[0], e[0]) === dot(e[1], e[1])) squares++;
      else rectangles++;
    } else return null;
  }
  if (!triangles && squares === 6) return "cube";
  if (!triangles && squares + rectangles === 6) return "cuboid";
  if (triangles === 2 && squares + rectangles === 3) return "triangular-prism";
  if (triangles === 4 && squares === 1 && !rectangles) return "square-pyramid";
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Specification                                                                              */
/* ------------------------------------------------------------------------------------------ */

export interface NetsSpec {
  task:
    | "check"
    | "opposite"
    | "solid"
    | "complete"
    | "fold"
    | "collide"
    | "fold-solid";
  /**
   * Net strings: four for `check`, one for `opposite` and `complete`, none for `solid`. The
   * hands-on `fold` and `collide` tasks give two labelled nets: the learner's, then the different
   * net the app demonstrates on (Watch).
   */
  nets: string[];
  /** Index of the net the "why" step asks about (`check` only). */
  asked: number;
  /** The face whose opposite is asked, A to F (`opposite` only). */
  face: string;
  solid: SolidId | "";
  /** Hands-on tasks only: the floor face of the demonstration net. */
  demoFace?: string;
  /** `fold` only: the face whose opposite the second step asks about. */
  second?: string;
  /** `fold-solid` only: the catalogue solid folded in Watch (different from `solid`). */
  demoSolid?: string;
  /** Quarter-turn orientation of catalogue nets; absent means the original orientation. */
  rotation?: number;
}
const KEYS = [
  "task",
  "nets",
  "asked",
  "face",
  "solid",
  "demoFace",
  "second",
  "demoSolid",
  "rotation",
];
const TASKS: NetsSpec["task"][] = [
  "check",
  "opposite",
  "solid",
  "complete",
  "fold",
  "collide",
  "fold-solid",
];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function checkNet(
  text: string,
  label: string,
  errors: string[],
): ParsedNet | null {
  const net = parseNet(text);
  if (typeof net === "string") {
    errors.push(`${label}: ${net}`);
    return null;
  }
  return net;
}
/** The index of the single net that folds, or -1. */
export function validNetIndex(nets: string[]): number {
  const folding = nets
    .map((n, i) => {
      const p = parseNet(n);
      return typeof p !== "string" && foldsToCube(squareCells(p)).ok ? i : -1;
    })
    .filter((i) => i >= 0);
  return folding.length === 1 ? folding[0] : -1;
}
/** Six squares labelled A to F once each. */
const labelledSix = (net: ParsedNet) =>
  net.cells
    .map((c) => c.ch)
    .sort()
    .join("") === LETTERS.join("");
/** Pairs offered beside the colliding pair: no crease between them and no collision. */
export function collideDistractors(net: ParsedNet): [string, string][] {
  const taken = new Set(
    [...collisionLetters(net), ...creasePairs(net)].map((p) => p.join("")),
  );
  const out: [string, string][] = [];
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (!taken.has(LETTERS[i] + LETTERS[j]))
        out.push([LETTERS[i], LETTERS[j]]);
  return out.slice(0, 2);
}
/** Letters offered beside the answer for "the face opposite which letter has no square". */
export function missingDistractors(net: ParsedNet): string[] {
  const skip = new Set([
    ...collisionLetters(net).flat(),
    ...uncoveredOppositeLetters(net),
  ]);
  return LETTERS.filter((l) => !skip.has(l)).slice(0, 2);
}
function validateBenchSpec(s: NetsSpec, errors: string[]) {
  if (s.asked !== 0) errors.push("Only the check task asks about a net");
  if (s.solid) errors.push("The hands-on tasks use no solid");
  if (s.nets.length !== 2)
    errors.push("Give two labelled nets: the learner's and the demonstration");
  if (typeof s.demoFace !== "string" || !LETTERS.includes(s.demoFace))
    errors.push("Choose the floor face of the demonstration net");
  if (!LETTERS.includes(s.face)) errors.push("Choose a face from A to F");
  if (errors.length) return;
  const nets: ParsedNet[] = [];
  for (const [i, text] of s.nets.entries()) {
    const net = checkNet(text, i ? "The demonstration net" : "The net", errors);
    if (!net) return;
    if (!labelledSix(net)) {
      errors.push("Label the six squares A to F, each letter once");
      return;
    }
    nets.push(net);
  }
  const cells = nets.map(squareCells);
  if (canonicalKey(cells[0]) === canonicalKey(cells[1]))
    errors.push("The demonstration net must be a different shape");
  if (s.task === "fold") {
    if (!nets.every((n) => oppositeLetters(n)))
      errors.push("Both nets must fold into a cube");
    else {
      const opp = oppositeLetters(nets[0])!;
      if (
        typeof s.second !== "string" ||
        !LETTERS.includes(s.second) ||
        s.second === s.face ||
        s.second === opp[s.face]
      )
        errors.push(
          "Choose a second face that is not the floor and not the top",
        );
    }
  } else {
    if (s.second !== undefined && s.second !== "")
      errors.push("The collide task uses no second face");
    for (const [i, net] of nets.entries()) {
      const label = i ? "The demonstration net" : "The net";
      if (hasBlock2x2(cells[i]))
        errors.push(`${label} must not contain a 2 by 2 block`);
      else if (collisionLetters(net).length !== 1)
        errors.push(`${label} must have exactly one pair of squares that meet`);
      else if (uncoveredOppositeLetters(net).length !== 1)
        errors.push(
          `${label} must have a single square opposite the empty face`,
        );
    }
  }
}
export function validateNetsSpec(input: unknown): string[] {
  if (!isRecord(input)) return ["Expected a nets specification"];
  const errors: string[] = [];
  if (!hasOnlyKeys(input, KEYS)) errors.push("Unknown nets field");
  const s = input as unknown as NetsSpec;
  if (!TASKS.includes(s.task)) errors.push("Unsupported nets task");
  if (
    s.rotation !== undefined &&
    (!isInt(s.rotation, 0, 3) || !["solid", "fold-solid"].includes(s.task))
  )
    errors.push("Only catalogue solids accept quarter-turn rotation 0 to 3");
  const bench = s.task === "fold" || s.task === "collide";
  if (!bench && (s.demoFace !== undefined || s.second !== undefined))
    errors.push("Only the hands-on tasks use a demonstration face");
  if (s.task !== "fold-solid" && s.demoSolid !== undefined)
    errors.push("Only the fold-a-solid task uses a demonstration solid");
  if (!Array.isArray(s.nets) || s.nets.some((n) => typeof n !== "string"))
    errors.push("List the nets as text");
  if (!isInt(s.asked, 0, 3)) errors.push("Choose which net is asked about");
  if (typeof s.face !== "string") errors.push("The face must be text");
  if (typeof s.solid !== "string") errors.push("The solid must be text");
  if (errors.length) return errors;
  if (s.task !== "check" && s.asked !== 0)
    errors.push("Only the check task asks about a net");
  if (bench) {
    validateBenchSpec(s, errors);
    return errors;
  }
  if (s.task === "fold-solid") {
    if (s.nets.length)
      errors.push("The solid task keeps its net in the catalogue");
    if (s.face) errors.push("The solid task uses no face");
    if (!SOLID_IDS.includes(s.solid as SolidId))
      errors.push("Choose a supported solid");
    if (!SOLID_IDS.includes(s.demoSolid as SolidId) || s.demoSolid === s.solid)
      errors.push("Choose a different solid for the demonstration");
    return errors;
  }
  if (s.task === "check") {
    if (s.nets.length !== 4) errors.push("Give exactly four nets, A to D");
    if (s.face || s.solid) errors.push("The check task uses no face or solid");
    if (errors.length) return errors;
    const kept: Pt[][] = [];
    s.nets.forEach((text, i) => {
      const label = `Net ${LETTERS[i]}`;
      const net = checkNet(text, label, errors);
      if (!net) return;
      if (net.cells.some((c) => c.ch !== "#"))
        errors.push(`${label} uses only # for squares`);
      const cells = squareCells(net);
      if (cells.length < 5 || cells.length > 7)
        errors.push(`${label} needs 5 to 7 squares`);
      else if (!isConnected(cells))
        errors.push(`${label} must be one connected piece`);
      kept.push(cells);
    });
    if (errors.length) return errors;
    if (new Set(kept.map(canonicalKey)).size !== 4)
      errors.push("The four nets must all be different shapes");
    if (validNetIndex(s.nets) < 0)
      errors.push("Exactly one net must fold into a cube");
    if (errors.length) return errors;
    if (!whyReason(kept[s.asked]))
      errors.push("The net asked about must have six squares and not fold");
  } else if (s.task === "opposite") {
    if (s.nets.length !== 1) errors.push("Give one labelled net");
    if (s.solid) errors.push("The opposite task uses no solid");
    if (errors.length) return errors;
    const net = checkNet(s.nets[0], "The net", errors);
    if (!net) return errors;
    const letters = net.cells
      .map((c) => c.ch)
      .sort()
      .join("");
    if (letters !== LETTERS.join(""))
      errors.push("Label the six squares A to F, each letter once");
    else if (!oppositeLetters(net))
      errors.push("The labelled net must fold into a cube");
    if (!LETTERS.includes(s.face)) errors.push("Choose a face from A to F");
  } else if (s.task === "complete") {
    if (s.nets.length !== 1) errors.push("Give one net with spots");
    if (s.face || s.solid)
      errors.push("The complete task uses no face or solid");
    if (errors.length) return errors;
    const net = checkNet(s.nets[0], "The net", errors);
    if (!net) return errors;
    const piece = net.cells.filter((c) => c.ch === "#");
    const spots = net.cells.filter((c) => c.ch !== "#");
    if (
      piece.length !== 5 ||
      spots.length !== 4 ||
      spots
        .map((c) => c.ch)
        .sort()
        .join("") !== "abcd"
    )
      errors.push("Use five # squares and the four spots a, b, c and d");
    else if (!isConnected(piece.map((c): Pt => [c.x, c.y])))
      errors.push("The five squares must be one connected piece");
    else {
      const have = new Set(piece.map((c) => key(c.x, c.y)));
      if (
        spots.some(
          (c) => !DIRS.some(([dx, dy]) => have.has(key(c.x + dx, c.y + dy))),
        )
      )
        errors.push("Every spot must touch one of the squares");
      else {
        const n = validCompletions(net).length;
        if (n < 1 || n > 3)
          errors.push("One to three spots must make a cube net");
      }
    }
  } else {
    if (s.nets.length)
      errors.push("The solid task keeps its net in the catalogue");
    if (s.face) errors.push("The solid task uses no face");
    if (!SOLID_IDS.includes(s.solid as SolidId))
      errors.push("Choose a supported solid");
  }
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Answers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const netOf = (s: NetsSpec, i = 0) => parseNet(s.nets[i]) as ParsedNet;
/** The five other letters, in order, and the faces touching `face`. */
export const otherLetters = (face: string) => LETTERS.filter((l) => l !== face);
export function touchingLetters(s: NetsSpec): string[] {
  const opp = oppositeLetters(netOf(s))!;
  return otherLetters(s.face).filter((l) => l !== opp[s.face]);
}
/** Pairs of letters not involving `face`: the first true opposite pair and the first two touching pairs. */
export function pairOptions(s: NetsSpec): {
  meaning: "opposite" | "touch-1" | "touch-2";
  pair: [string, string];
}[] {
  const opp = oppositeLetters(netOf(s))!;
  const rest = otherLetters(s.face);
  const pairs: [string, string][] = [];
  for (let i = 0; i < rest.length; i++)
    for (let j = i + 1; j < rest.length; j++) pairs.push([rest[i], rest[j]]);
  const yes = pairs.filter(([a, b]) => opp[a] === b);
  const no = pairs.filter(([a, b]) => opp[a] !== b);
  return [
    { meaning: "opposite", pair: yes[0] },
    { meaning: "touch-1", pair: no[0] },
    { meaning: "touch-2", pair: no[1] },
  ];
}
export const pairLabel = (p: [string, string]) => `${p[0]} and ${p[1]}`;

export function netsAnswer(s: NetsSpec, step: Step): Step["answer"] {
  const goal = step.goal ?? step.id;
  switch (goal) {
    case "reflection":
      return step.answer;
  }
  // A malformed specification has no answers; the validator reports it.
  if (validateNetsSpec(s).length) return "";
  switch (goal) {
    case "count":
      return "6";
    case "valid":
      return choiceFor(step, `net:${validNetIndex(s.nets)}`);
    case "why":
      return choiceFor(step, whyReason(squareCells(netOf(s, s.asked)))!);
    case "opposite":
      return choiceFor(step, `face:${oppositeLetters(netOf(s))![s.face]}`);
    case "touching": {
      const yes = new Set(touchingLetters(s).map((l) => `face:${l}`));
      return (step.choices ?? [])
        .filter((c) => yes.has(c.meaning ?? ""))
        .map((c) => c.id);
    }
    case "opposite-pair":
      return choiceFor(step, "opposite");
    case "faces":
      return String(solidFacts(s.solid as SolidId).faces);
    case "solid":
      return choiceFor(step, s.solid);
    case "edges":
      return String(solidFacts(s.solid as SolidId).edges);
    case "vertices":
      return String(solidFacts(s.solid as SolidId).vertices);
    case "fold-top":
      return choiceFor(step, `face:${oppositeLetters(netOf(s))![s.face]}`);
    case "fold-opposite":
      return choiceFor(
        step,
        `face:${oppositeLetters(netOf(s))![s.second ?? ""]}`,
      );
    case "collide":
      return choiceFor(step, `pair:${collisionLetters(netOf(s))[0].join("")}`);
    case "fold-name":
      return choiceFor(step, s.solid);
    case "missing":
      return choiceFor(step, `opp:${uncoveredOppositeLetters(netOf(s))[0]}`);
    case "spots": {
      const yes = new Set(validCompletions(netOf(s)).map((l) => `spot:${l}`));
      return (step.choices ?? [])
        .filter((c) => yes.has(c.meaning ?? ""))
        .map((c) => c.id);
    }
  }
  return "";
}

const GOALS: Record<NetsSpec["task"], string[]> = {
  check: ["count", "valid", "why", "reflection"],
  opposite: ["opposite", "touching", "opposite-pair", "reflection"],
  solid: ["faces", "solid", "edges", "vertices", "reflection"],
  complete: ["spots", "reflection"],
  fold: ["fold-top", "fold-opposite", "reflection"],
  collide: ["collide", "missing", "reflection"],
  "fold-solid": ["fold-name", "reflection"],
};
const KINDS: Record<string, Step["kind"]> = {
  count: "exact",
  valid: "choice",
  why: "choice",
  opposite: "choice",
  touching: "multi",
  "opposite-pair": "choice",
  faces: "exact",
  solid: "choice",
  edges: "exact",
  vertices: "exact",
  spots: "multi",
  "fold-top": "choice",
  "fold-opposite": "choice",
  collide: "choice",
  missing: "choice",
  "fold-name": "choice",
  reflection: "choice",
};
export function validateNetsSteps(lesson: Lesson): string[] {
  const errors = validateNetsSpec(lesson.specification);
  if (errors.length) return errors;
  const s = lesson.specification as unknown as NetsSpec;
  if (lesson.steps.map((x) => x.goal).join(",") !== GOALS[s.task].join(","))
    errors.push("Unsupported nets goal sequence");
  errors.push(...checkKinds(lesson, KINDS));
  for (const step of lesson.steps) {
    const goal = step.goal ?? "";
    const answer = netsAnswer(s, step);
    if (
      goal !== "reflection" &&
      (JSON.stringify(step.answer) !== JSON.stringify(answer) ||
        answer === "" ||
        (Array.isArray(answer) && !answer.length))
    )
      errors.push("Answer contradicts nets model");
    if (goal === "valid")
      errors.push(
        ...checkMeanings(
          step,
          [0, 1, 2, 3].map((i) => `net:${i}`),
          goal,
        ),
      );
    if (goal === "why")
      errors.push(
        ...checkMeanings(
          step,
          [whyReason(squareCells(netOf(s, s.asked)))!, "missing", "turn"],
          goal,
        ),
      );
    if (goal === "opposite" || goal === "touching")
      errors.push(
        ...checkMeanings(
          step,
          otherLetters(s.face).map((l) => `face:${l}`),
          goal,
        ),
      );
    if (goal === "opposite-pair") {
      errors.push(
        ...checkMeanings(step, ["opposite", "touch-1", "touch-2"], goal),
      );
      const opp = oppositeLetters(netOf(s))!;
      for (const c of step.choices ?? []) {
        const m = /^([A-F]) and ([A-F])$/.exec(c.label);
        const isOpposite = !!m && opp[m[1]] === m[2];
        if (
          !m ||
          m[1] === s.face ||
          m[2] === s.face ||
          isOpposite !== (c.meaning === "opposite")
        )
          errors.push("Pair choices contradict the folded net");
      }
    }
    if (goal === "solid" || goal === "fold-name")
      errors.push(
        ...checkMeanings(
          step,
          [s.solid, ...SOLID_DISTRACTORS[s.solid as SolidId]],
          goal,
        ),
      );
    if (goal === "fold-top" || goal === "fold-opposite")
      errors.push(
        ...checkMeanings(
          step,
          otherLetters(goal === "fold-top" ? s.face : (s.second ?? "")).map(
            (l) => `face:${l}`,
          ),
          goal,
        ),
      );
    if (goal === "collide")
      errors.push(
        ...checkMeanings(
          step,
          [collisionLetters(netOf(s))[0], ...collideDistractors(netOf(s))].map(
            (p) => `pair:${p.join("")}`,
          ),
          goal,
        ),
      );
    if (goal === "missing")
      errors.push(
        ...checkMeanings(
          step,
          [
            ...uncoveredOppositeLetters(netOf(s)),
            ...missingDistractors(netOf(s)),
          ].map((l) => `opp:${l}`),
          goal,
        ),
      );
    if (goal === "spots")
      errors.push(
        ...checkMeanings(
          step,
          ["a", "b", "c", "d"].map((l) => `spot:${l}`),
          goal,
        ),
      );
  }
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Text alternative                                                                           */
/* ------------------------------------------------------------------------------------------ */

function runsOf(net: ParsedNet, y: number, spots: boolean): string[] {
  const row = net.cells.filter((c) => c.y === y).sort((a, b) => a.x - b.x);
  const out: string[] = [];
  let run: NetCell[] = [];
  const flush = () => {
    if (!run.length) return;
    const from = run[0].x + 1,
      to = run.at(-1)!.x + 1;
    const where = from === to ? `column ${from}` : `columns ${from} to ${to}`;
    const first = run[0].ch;
    if (/[A-F]/.test(first))
      out.push(`${run.map((c) => c.ch).join(", ")} in ${where}`);
    else if (spots && /[a-d]/.test(first))
      out.push(`a dashed spot ${first.toUpperCase()} in ${where}`);
    else out.push(`${run.length === 1 ? "a square" : "squares"} in ${where}`);
    run = [];
  };
  for (const c of row) {
    if (
      run.length &&
      (c.x !== run.at(-1)!.x + 1 ||
        /[a-d]/.test(c.ch) ||
        /[a-d]/.test(run[0].ch))
    )
      flush();
    run.push(c);
  }
  flush();
  return out;
}
function netWords(net: ParsedNet): string {
  const rows: string[] = [];
  for (let y = 0; y < net.rows; y++) {
    const runs = runsOf(net, y, true);
    if (runs.length) rows.push(`Row ${y + 1}: ${runs.join(" and ")}.`);
  }
  return rows.join(" ");
}
const rootOf = (n: number) => {
  let r = 0;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
};
const lengthWords = (sq: number) =>
  rootOf(sq) ** 2 === sq ? String(rootOf(sq)) : `the square root of ${sq}`;
function faceWords(poly: Pt[]): string {
  const sq = poly.map((_, k) => {
    const [a, b] = sideOf(poly, k);
    return sqLen(a, b);
  });
  if (poly.length === 3)
    return `a triangle with sides ${[...sq]
      .sort((a, b) => a - b)
      .map(lengthWords)
      .join(", ")}`;
  return sq[0] === sq[1]
    ? `a square of side ${lengthWords(sq[0])}`
    : `a rectangle ${lengthWords(sq[0])} by ${lengthWords(sq[1])}`;
}
/**
 * The text alternative lists the data of the picture (as the line graphs do). For the solid task
 * this names the shapes and so answers the picture, which is recorded for accessibility review.
 */
export function describe(s: NetsSpec): string {
  if (validateNetsSpec(s).length) return "A net that needs correcting.";
  if (s.task === "check")
    return `Four flat patterns made of joined squares. ${s.nets
      .map((n, i) => `Net ${LETTERS[i]}. ${netWords(parseNet(n) as ParsedNet)}`)
      .join(" ")}`;
  if (s.task === "opposite")
    return `A flat pattern of six labelled squares. ${netWords(netOf(s))}`;
  if (s.task === "fold" || s.task === "collide")
    return `A flat pattern of six labelled squares that can be folded along its creases. ${netWords(netOf(s))}`;
  if (s.task === "complete")
    return `A flat pattern of five joined squares and four dashed spots A to D where a sixth square could go. ${netWords(netOf(s))}`;
  const { faces } = catalogueNet(s.solid as SolidId, s.rotation);
  return `A flat pattern of ${faces.length} joined shapes: ${faces.map(faceWords).join("; ")}.`;
}

/* ------------------------------------------------------------------------------------------ */
/* Drawing                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const INK = "#1b6b5c";
const FILL = "#cfe9e2";
const TEXT = "#143f36";
const SVG_STYLE =
  "display:block;margin-inline:auto;width:{w}px;max-width:100%;height:auto";
const svgOpen = (w: number, h: number) =>
  `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false" style="${SVG_STYLE.replace("{w}", String(w))}">`;
const square = (x: number, y: number, size: number, extra = "") =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${FILL}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"${extra}/>`;

/** Four small nets in a 360-wide sheet; letters are 16 units so they stay legible on a phone. */
function checkSheet(s: NetsSpec): string {
  const cell = 26,
    panelW = 180,
    head = 30;
  const nets = s.nets.map((n) => parseNet(n) as ParsedNet);
  const rowsMax = Math.max(...nets.map((n) => n.rows));
  const panelH = head + rowsMax * cell + 14;
  let body = "";
  nets.forEach((net, i) => {
    const px = (i % 2) * panelW,
      py = Math.floor(i / 2) * panelH;
    const ox = px + (panelW - net.cols * cell) / 2,
      oy = py + head;
    body += `<rect x="${px + 4}" y="${py + 4}" width="${panelW - 8}" height="${panelH - 8}" rx="8" fill="none" stroke="#a3d3c7" stroke-width="1.5"/><text x="${px + 14}" y="${py + 24}" font-size="16" font-weight="700" fill="${TEXT}">${LETTERS[i]}</text>`;
    for (const c of net.cells)
      body += square(ox + c.x * cell, oy + c.y * cell, cell);
  });
  return `${svgOpen(360, 2 * panelH)}${body}</svg>`;
}
function bigNet(s: NetsSpec, cell: number, spots: boolean): string {
  const net = netOf(s);
  const pad = 14;
  const w = 360,
    h = net.rows * cell + 2 * pad;
  const ox = (w - net.cols * cell) / 2;
  let body = "";
  for (const c of net.cells) {
    const x = ox + c.x * cell,
      y = pad + c.y * cell;
    if (/[a-d]/.test(c.ch) && spots)
      body += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" fill="#fffdf8" stroke="${INK}" stroke-width="2" stroke-dasharray="6 4"/><text x="${x + cell / 2}" y="${y + cell / 2}" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="${INK}">${c.ch.toUpperCase()}</text>`;
    else {
      body += square(x, y, cell);
      if (/[A-F]/.test(c.ch))
        body += `<text x="${x + cell / 2}" y="${y + cell / 2}" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="${TEXT}">${c.ch}</text>`;
    }
  }
  return `${svgOpen(w, h)}${body}</svg>`;
}
/** The catalogue net drawn from its polygons, with no text so nothing names the solid. */
function solidSvg(solid: SolidId, rotation = 0): string {
  const { faces } = catalogueNet(solid, rotation);
  const all = faces.flat();
  const x0 = Math.min(...all.map((p) => p[0])),
    x1 = Math.max(...all.map((p) => p[0])),
    y0 = Math.min(...all.map((p) => p[1])),
    y1 = Math.max(...all.map((p) => p[1]));
  const pad = 12;
  const scale = Math.min(
    28,
    Math.floor((360 - 2 * pad) / Math.max(x1 - x0, y1 - y0)),
  );
  const X = (x: number) => pad + (x - x0) * scale,
    Y = (y: number) => pad + (y1 - y) * scale;
  const w = 360,
    h = 2 * pad + (y1 - y0) * scale;
  const ox = Math.round((w - 2 * pad - (x1 - x0) * scale) / 2);
  const polys = faces
    .map(
      (f) =>
        `<polygon points="${f.map(([x, y]) => `${X(x) + ox},${Y(y)}`).join(" ")}" fill="${FILL}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    )
    .join("");
  return `${svgOpen(w, h)}${polys}</svg>`;
}
export function netsSvg(s: NetsSpec): string {
  if (s.task === "check") return checkSheet(s);
  if (s.task === "opposite" || s.task === "fold" || s.task === "collide")
    return bigNet(s, 52, false);
  if (s.task === "complete") return bigNet(s, 44, true);
  return solidSvg(s.solid as SolidId, s.rotation);
}

/** Steps that carry the hands-on net folder. */
export const BENCH_GOALS = [
  "fold-top",
  "fold-opposite",
  "collide",
  "missing",
  "fold-name",
];
const adapter = makeAdapter<NetsSpec>({
  id: "nets",
  answerFor: netsAnswer,
  describe,
});
export const netsTopic: RuntimeTopic = {
  id: "nets",
  label: "Nets of solids",
  visualTitle: "Fold it in your head",
  adapter,
  validateSpec: validateNetsSpec,
  validateSteps: validateNetsSteps,
  answer: (l, step) => netsAnswer(l.specification as unknown as NetsSpec, step),
  workbench: (lesson, step) =>
    BENCH_GOALS.includes(step.goal ?? "") &&
    !validateNetsSpec(lesson.specification).length
      ? lazyWorkbench(() =>
          import("./nets-workbench").then((m) =>
            m.netsBenchFactory(lesson, step),
          ),
        )
      : null,
  render: (l) => {
    const s = l.specification as unknown as NetsSpec;
    if (validateNetsSpec(s).length)
      return `<div class="nets-model"><p>Correct the net to see the picture.</p></div>`;
    // The text alternative lists the layout; it is not shown on screen.
    return `<div class="nets-model" role="img" aria-label="${esc(describe(s))}">${netsSvg(s)}</div>`;
  },
};
