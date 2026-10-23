import { describe, expect, it } from "vitest";
import { createSession, nextStep, submit, useHint } from "../src/core/runtime";
import { netMenu, netsAuthor } from "../src/authoring/nets";
import { createAuthorModel } from "../src/authoring/model";
import { validatePackage } from "../src/content/package-validation";
import {
  SOLID_IDS,
  catalogueNet,
  checkCatalogueNet,
  cuboidLayout,
  describe as describeNets,
  foldsToCube,
  normaliseNet,
  oppositeFace,
  oppositeLetters,
  parseNet,
  solidFacts,
  solidFromFaces,
  squareCells,
  validCompletions,
  validateNetsSpec,
  validateNetsSteps,
  whyReason,
  netsTopic,
  type CatalogueNet,
  type NetsSpec,
  type ParsedNet,
  type SolidId,
} from "../src/topics/nets";

const template = (form: string) => netsAuthor.template(form, `${form}-t`);
const specOf = (form: string): NetsSpec =>
  template(form).lesson.specification as unknown as NetsSpec;
const base = (form: string, over: Partial<NetsSpec> = {}): NetsSpec => ({
  ...specOf(form),
  ...over,
});
const parsed = (text: string) => parseNet(text) as ParsedNet;

/* ---------------------------------------------------------------------------------------- */
/* Independent oracles, written differently from the production rolling table               */
/* ---------------------------------------------------------------------------------------- */

type P = [number, number];
const textOf = (cells: P[]) =>
  cells
    .map((p) => p.join(","))
    .sort()
    .join(";");
function moveToCorner(cells: P[]): P[] {
  const x0 = Math.min(...cells.map((c) => c[0])),
    y0 = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - x0, y - y0]);
}
/** All fixed hexominoes: add one edge neighbour five times, drop duplicates after translating. */
function allFixedHexominoes(): P[][] {
  let level: P[][] = [[[0, 0]]];
  for (let size = 1; size < 6; size++) {
    const seen = new Map<string, P[]>();
    for (const cells of level)
      for (const [x, y] of cells)
        for (const n of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as P[]) {
          if (cells.some((c) => c[0] === n[0] && c[1] === n[1])) continue;
          const grown = moveToCorner([...cells, n]);
          seen.set(textOf(grown), grown);
        }
    level = [...seen.values()];
  }
  return level;
}
const rotate = (cells: P[]): P[] => cells.map(([x, y]) => [-y, x]);
const mirror = (cells: P[]): P[] => cells.map(([x, y]) => [-x, y]);
function eightWays(cells: P[]): P[][] {
  const out: P[][] = [];
  let c = cells;
  for (let i = 0; i < 4; i++) {
    out.push(moveToCorner(c), moveToCorner(mirror(c)));
    c = rotate(c);
  }
  return out;
}
const freeKey = (cells: P[]) => eightWays(cells).map(textOf).sort()[0];

type M = number[][];
const mul = (a: M, b: M): M =>
  a.map((_, i) =>
    [0, 1, 2].map(
      (j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j],
    ),
  );
const IDENTITY: M = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
// Quarter turns taking the net's frame (east, north, out of the page towards the viewer) to the
// frame of the neighbour folded up towards the viewer. Columns are the images of the three axes.
const TURN: Record<string, M> = {
  east: [
    [0, 0, -1],
    [0, 1, 0],
    [1, 0, 0],
  ],
  west: [
    [0, 0, 1],
    [0, 1, 0],
    [-1, 0, 0],
  ],
  north: [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  south: [
    [1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
  ],
};
const STEP: Record<string, P> = {
  east: [1, 0],
  west: [-1, 0],
  north: [0, 1],
  south: [0, -1],
};
/** 3D fold with integer matrices. Cells are (x, y) with y pointing up, as on the page. */
function geometric(cells: P[]): { ok: boolean; normal: Map<string, string> } {
  const at = (x: number, y: number) =>
    cells.find((c) => c[0] === x && c[1] === y);
  const frame = new Map<string, M>([[textOf([cells[0]]), IDENTITY]]);
  const todo: P[] = [cells[0]];
  while (todo.length) {
    const u = todo.shift()!;
    for (const dir of Object.keys(STEP)) {
      const v = at(u[0] + STEP[dir][0], u[1] + STEP[dir][1]);
      if (v && !frame.has(textOf([v]))) {
        frame.set(textOf([v]), mul(frame.get(textOf([u]))!, TURN[dir]));
        todo.push(v);
      }
    }
  }
  let ok = frame.size === cells.length;
  for (const u of cells)
    for (const dir of Object.keys(STEP)) {
      const v = at(u[0] + STEP[dir][0], u[1] + STEP[dir][1]);
      if (
        v &&
        frame.has(textOf([u])) &&
        frame.has(textOf([v])) &&
        JSON.stringify(mul(frame.get(textOf([u]))!, TURN[dir])) !==
          JSON.stringify(frame.get(textOf([v])))
      )
        ok = false;
    }
  const normal = new Map<string, string>();
  for (const c of cells) {
    const f = frame.get(textOf([c]));
    if (f) normal.set(textOf([c]), [-f[0][2], -f[1][2], -f[2][2]].join(","));
  }
  if (cells.length !== 6 || new Set(normal.values()).size !== 6) ok = false;
  return { ok, normal };
}
const negative = (a: string, b: string) =>
  a.split(",").every((v, i) => Number(v) === -Number(b.split(",")[i]));
/** Production wants the row counted downwards; the oracle counts upwards. */
const flipY = (cells: P[]): P[] => cells.map(([x, y]) => [x, -y]);

const fixed = allFixedHexominoes();
const freeShapes = new Map<string, P[]>();
for (const c of fixed) freeShapes.set(freeKey(c), c);
const oracleValid = fixed.filter((c) => geometric(flipY(c)).ok);
const oracleValidFree = new Set(oracleValid.map(freeKey));

// Typed by hand from the usual textbook diagrams: six of the 1-4-1 kind, three 2-3-1, one 2-2-2, one 3-3.
const TEXTBOOK = [
  "#.../####/#...",
  "#.../####/.#..",
  "#.../####/..#.",
  "#.../####/...#",
  ".#../####/.#..",
  ".#../####/..#.",
  "##../.###/.#..",
  "##../.###/..#.",
  "##../.###/...#",
  "##../.##./..##",
  "###../..###",
];
const cellsOfText = (text: string): P[] =>
  text
    .split("/")
    .flatMap((row, y) =>
      [...row].map((ch, x) => (ch === "." ? null : ([x, y] as P))),
    )
    .filter((c): c is P => c !== null);

describe("cube nets: two independent oracles", () => {
  it("enumerates 216 fixed and 35 free hexominoes, of which 64 fixed and 11 free fold", () => {
    expect(fixed).toHaveLength(216);
    expect(freeShapes.size).toBe(35);
    expect(oracleValid).toHaveLength(64);
    expect(oracleValidFree.size).toBe(11);
    expect(freeShapes.size - oracleValidFree.size).toBe(24);
  });

  it("matches the typed textbook list in both directions", () => {
    const typed = new Set(TEXTBOOK.map((t) => freeKey(cellsOfText(t))));
    expect(typed.size).toBe(11);
    expect([...typed].filter((k) => !oracleValidFree.has(k))).toEqual([]);
    expect([...oracleValidFree].filter((k) => !typed.has(k))).toEqual([]);
  });

  it("agrees on validity for all 216 and on every opposite pair of the 64", () => {
    let valid = 0;
    for (const c of fixed) {
      const oracle = geometric(flipY(c));
      const production = foldsToCube(c);
      expect(production.ok, textOf(c)).toBe(oracle.ok);
      if (!production.ok) continue;
      valid++;
      const up = flipY(c);
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++) {
          const opp = negative(
            oracle.normal.get(textOf([up[i]]))!,
            oracle.normal.get(textOf([up[j]]))!,
          );
          const ours =
            oppositeFace(production.face.get(`${c[i][0]},${c[i][1]}`)!) ===
            production.face.get(`${c[j][0]},${c[j][1]}`)!;
          expect(ours, `${textOf(c)} ${i} ${j}`).toBe(opp);
        }
    }
    expect(valid).toBe(64);
  });

  it("holds for all 720 letterings of each of the 64 foldable orientations", () => {
    const perms: string[][] = [];
    const walk = (rest: string[], chosen: string[]) => {
      if (!rest.length) perms.push(chosen);
      rest.forEach((l, i) =>
        walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...chosen, l]),
      );
    };
    walk([..."ABCDEF"], []);
    expect(perms).toHaveLength(720);
    const failures: string[] = [];
    let total = 0;
    for (const cells of oracleValid) {
      const up = flipY(cells);
      const normal = geometric(up).normal;
      const partner = cells.map((_, i) =>
        cells.findIndex((__, j) =>
          negative(normal.get(textOf([up[i]]))!, normal.get(textOf([up[j]]))!),
        ),
      );
      const cols = Math.max(...cells.map((c) => c[0])) + 1,
        rows = Math.max(...cells.map((c) => c[1])) + 1;
      for (const letters of perms) {
        const grid = Array.from({ length: rows }, () => Array(cols).fill("."));
        cells.forEach(([x, y], i) => (grid[y][x] = letters[i]));
        const text = grid.map((r) => r.join("")).join("/");
        const result = oppositeLetters(parsed(text));
        const pairs = new Set<string>();
        let sound = result !== null;
        cells.forEach((_, i) => {
          const mine = letters[i];
          // matches the geometric oracle, symmetric, irreflexive
          if (
            !result ||
            result[mine] !== letters[partner[i]] ||
            result[result[mine]] !== mine ||
            result[mine] === mine
          )
            sound = false;
          pairs.add([mine, letters[partner[i]]].sort().join(""));
        });
        if (!sound || pairs.size !== 3) failures.push(text); // pairs: a perfect matching
        total++;
      }
    }
    expect(total).toBe(64 * 720);
    expect(failures).toEqual([]);
  }, 60_000);

  it("rejects all 24 invalid free nets in both methods, and the ready-made menu agrees", () => {
    const invalid = [...freeShapes.entries()].filter(
      ([k]) => !oracleValidFree.has(k),
    );
    expect(invalid).toHaveLength(24);
    for (const [, cells] of invalid) {
      expect(geometric(flipY(cells)).ok).toBe(false);
      for (const turned of eightWays(cells))
        expect(foldsToCube(turned).ok).toBe(false);
    }
    const menu = netMenu();
    expect(menu.filter((m) => m.valid)).toHaveLength(11);
    expect(menu.filter((m) => !m.valid)).toHaveLength(24);
    expect(new Set(menu.map((m) => m.id)).size).toBe(35);
    for (const entry of menu) {
      const cells = cellsOfText(entry.net);
      expect(parseNet(entry.net), entry.id).not.toBeTypeOf("string");
      expect(normaliseNet(entry.net)).toBe(entry.net);
      expect(geometric(flipY(cells)).ok, entry.id).toBe(entry.valid);
    }
    expect(
      new Set(
        menu.filter((m) => m.valid).map((m) => freeKey(cellsOfText(m.net))),
      ),
    ).toEqual(oracleValidFree);
    expect(
      new Set(
        menu.filter((m) => !m.valid).map((m) => freeKey(cellsOfText(m.net))),
      ),
    ).toEqual(new Set(invalid.map(([k]) => k)));
  });

  it("finds the completions of a five-square piece exactly as a brute-force fold does", () => {
    let checked = 0;
    for (const cells of oracleValid)
      for (let drop = 0; drop < 6; drop++) {
        const piece = cells.filter((_, i) => i !== drop);
        const connected = geometric(flipY([...piece, cells[drop]])).ok;
        expect(connected).toBe(true);
        const near: P[] = [];
        for (const [x, y] of piece)
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (
              !piece.some((c) => c[0] === x + dx && c[1] === y + dy) &&
              !near.some((c) => c[0] === x + dx && c[1] === y + dy)
            )
              near.push([x + dx, y + dy]);
        near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (let from = 0; from + 4 <= near.length; from++) {
          const spots = near.slice(from, from + 4);
          const net: ParsedNet = {
            cols: 9,
            rows: 9,
            cells: [
              ...piece.map(([x, y]) => ({ x, y, ch: "#" })),
              ...spots.map(([x, y], i) => ({ x, y, ch: "abcd"[i] })),
            ],
          };
          const brute = spots
            .map((s, i) =>
              geometric(flipY([...piece, s])).ok ? "abcd"[i] : "",
            )
            .filter(Boolean);
          expect(validCompletions(net)).toEqual(brute);
          checked++;
        }
        // the square that was removed is one valid completion, so there is always one
        const all = near.filter((s) => geometric(flipY([...piece, s])).ok);
        expect(all.length).toBeGreaterThanOrEqual(1);
        expect(
          all.some((s) => s[0] === cells[drop][0] && s[1] === cells[drop][1]),
        ).toBe(true);
      }
    expect(checked).toBeGreaterThan(100);
  });

  it("names the reason a six-square net fails, and rejects other counts and broken pieces", () => {
    expect(whyReason(cellsOfText("#..#/####"))).toBe("overlap");
    expect(whyReason(cellsOfText("##../##../.##."))).toBe("corner");
    expect(whyReason(cellsOfText("#####/#...."))).toBe("overlap");
    expect(whyReason(cellsOfText(".#../####/.#.."))).toBeNull();
    expect(whyReason(cellsOfText("####/#..."))).toBeNull(); // five squares
    const fold = (text: string) => foldsToCube(cellsOfText(text));
    expect(fold("#####")).toMatchObject({ ok: false, reason: "wrong-count" });
    expect(fold("##../....")).toMatchObject({ ok: false });
    expect(fold("###./...#/#..#")).toMatchObject({
      ok: false,
      reason: "not-connected",
    });
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Catalogue solids                                                                         */
/* ---------------------------------------------------------------------------------------- */

// Typed solids: 3D vertices and the faces as cycles of vertex indexes. Edges and vertices are
// counted from these lists, independently of the nets and of Euler's formula.
const SOLIDS_3D: Record<SolidId, { vertices: number[][]; faces: number[][] }> =
  {
    cube: {
      vertices: [
        [0, 0, 0],
        [3, 0, 0],
        [3, 3, 0],
        [0, 3, 0],
        [0, 0, 3],
        [3, 0, 3],
        [3, 3, 3],
        [0, 3, 3],
      ],
      faces: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ],
    },
    cuboid: {
      vertices: [
        [0, 0, 0],
        [3, 0, 0],
        [3, 2, 0],
        [0, 2, 0],
        [0, 0, 1],
        [3, 0, 1],
        [3, 2, 1],
        [0, 2, 1],
      ],
      faces: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ],
    },
    "triangular-prism": {
      vertices: [
        [0, 0, 0],
        [3, 0, 0],
        [0, 4, 0],
        [0, 0, 4],
        [3, 0, 4],
        [0, 4, 4],
      ],
      faces: [
        [0, 1, 2],
        [3, 4, 5],
        [0, 1, 4, 3],
        [1, 2, 5, 4],
        [2, 0, 3, 5],
      ],
    },
    "square-pyramid": {
      vertices: [
        [0, 0, 0],
        [4, 0, 0],
        [4, 4, 0],
        [0, 4, 0],
        [2, 2, 5],
      ],
      faces: [
        [0, 1, 2, 3],
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ],
    },
  };
const LITERAL: Record<SolidId, [number, number, number]> = {
  cube: [6, 12, 8],
  cuboid: [6, 12, 8],
  "triangular-prism": [5, 9, 6],
  "square-pyramid": [5, 8, 5],
};

describe("catalogue nets", () => {
  for (const solid of SOLID_IDS) {
    it(`${solid}: exact edge gluing, angles and facts agree with the literal tables and a vertex-list count`, () => {
      const net = catalogueNet(solid);
      expect(checkCatalogueNet(net)).toEqual([]);
      const facts = solidFacts(solid);
      expect([facts.faces, facts.edges, facts.vertices]).toEqual(
        LITERAL[solid],
      );
      const lists = SOLIDS_3D[solid];
      const edges = new Set<string>();
      for (const f of lists.faces)
        f.forEach((v, i) =>
          edges.add([v, f[(i + 1) % f.length]].sort((a, b) => a - b).join("-")),
        );
      expect([lists.faces.length, edges.size, lists.vertices.length]).toEqual(
        LITERAL[solid],
      );
      expect(solidFromFaces(net.faces)).toBe(solid);
      for (const poly of net.faces)
        for (const [x, y] of poly) {
          expect(Number.isInteger(x)).toBe(true);
          expect(Number.isInteger(y)).toBe(true);
        }
    });
  }

  it("the prism has 3-4-5 ends and the pyramid slant edges are exactly equal (squared 29)", () => {
    const prism = catalogueNet("triangular-prism");
    const squaredSides = (poly: number[][]) =>
      poly.map((p, i) => {
        const q = poly[(i + 1) % poly.length];
        return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      });
    expect(squaredSides(prism.faces[3]).sort((a, b) => a - b)).toEqual([
      9, 16, 25,
    ]);
    expect(squaredSides(prism.faces[4]).sort((a, b) => a - b)).toEqual([
      9, 16, 25,
    ]);
    const pyramid = catalogueNet("square-pyramid");
    for (const tri of pyramid.faces.slice(1))
      expect(squaredSides(tri).sort((a, b) => a - b)).toEqual([16, 29, 29]);
  });

  it("fails a mirrored face, a reversed face, a missing glue, an overlap and a flat pyramid", () => {
    const prism = (): CatalogueNet => catalogueNet("triangular-prism");
    // Mirror the top triangle across the vertical line x = 5 and keep it counter-clockwise.
    const mirrored = prism();
    mirrored.faces[3] = [
      [3, 4],
      [7, 4],
      [7, 7],
    ];
    expect(checkCatalogueNet(mirrored).join(" ")).toMatch(/differ in length/);
    // The same triangle written clockwise.
    const reversed = prism();
    reversed.faces[3] = [
      ...reversed.faces[3],
    ].reverse() as CatalogueNet["faces"][number];
    expect(checkCatalogueNet(reversed).join(" ")).toMatch(/counter-clockwise/);
    const missing = prism();
    missing.glue.pop();
    expect(checkCatalogueNet(missing).join(" ")).toMatch(/joined 0 times/);
    const twice = prism();
    twice.glue.push(twice.glue[0]);
    expect(checkCatalogueNet(twice).join(" ")).toMatch(/joined 2 times/);
    const overlapping = prism();
    overlapping.faces[4] = [
      [6, 1],
      [2, 1],
      [2, -2],
    ];
    expect(checkCatalogueNet(overlapping).join(" ")).toMatch(/overlap/);
    // Same gluing, but the apex is too low: the four apex angles total 360 degrees or more.
    const flat = catalogueNet("square-pyramid");
    flat.faces = [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
      [
        [4, 0],
        [0, 0],
        [2, -1],
      ],
      [
        [4, 4],
        [4, 0],
        [5, 2],
      ],
      [
        [0, 4],
        [4, 4],
        [2, 5],
      ],
      [
        [0, 0],
        [0, 4],
        [-1, 2],
      ],
    ];
    expect(checkCatalogueNet(flat).join(" ")).toMatch(/less than 360/);
    // A glue pair that joins sides of different length is caught by the squared lengths.
    const wrong = prism();
    wrong.glue[0] = [0, 2, 3, 1];
    expect(checkCatalogueNet(wrong).join(" ")).toMatch(/differ in length/);
  });

  it("names a solid from its faces by the rule table, and nothing for odd faces", () => {
    expect(
      solidFromFaces([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 2],
        ],
      ]),
    ).toBeNull();
    expect(
      solidFromFaces([
        [
          [0, 0],
          [2, 0],
          [1, 1],
        ],
      ]),
    ).toBeNull();
    expect(
      solidFromFaces([
        [
          [0, 0],
          [2, 0],
          [3, 1],
          [1, 1],
        ],
      ]),
    ).toBeNull(); // not a rectangle
  });

  it("derives cuboid sizes from the fold and they are consistent across every crease", () => {
    const cells = cellsOfText(".#../####/.#..");
    const layout = cuboidLayout(cells, [3, 2, 1])!;
    expect(layout).not.toBeNull();
    const net = catalogueNet("cuboid");
    const flat = net.faces.map((poly) => {
      const xs = poly.map((p) => p[0]),
        ys = poly.map((p) => p[1]);
      return [
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      ];
    });
    cells.forEach((c, i) => {
      expect(flat[i]).toEqual(layout.sizes.get(`${c[0]},${c[1]}`));
    });
    // A 3 by 2 by 1 box has two faces of each size 3x2, 3x1 and 2x1.
    expect(flat.map((d) => [...d].sort().join("x")).sort()).toEqual([
      "1x2",
      "1x2",
      "1x3",
      "1x3",
      "2x3",
      "2x3",
    ]);
    // Every foldable orientation either has no grid layout or one whose shared edges agree.
    let aligned = 0;
    for (const c of oracleValid) {
      const result = cuboidLayout(c, [3, 2, 1]);
      if (!result) continue;
      aligned++;
      for (const [x, y] of c) {
        const here = result.sizes.get(`${x},${y}`)!;
        const east = result.sizes.get(`${x + 1},${y}`);
        const south = result.sizes.get(`${x},${y + 1}`);
        if (east) expect(east[1]).toBe(here[1]);
        if (south) expect(south[0]).toBe(here[0]);
      }
    }
    expect(aligned).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Packages, specifications, drawing, authoring                                             */
/* ---------------------------------------------------------------------------------------- */

describe("nets packages", () => {
  for (const form of netsAuthor.forms) {
    it(`${form.id}: validates, is normalised and completes in both modes`, () => {
      const p = template(form.id);
      expect(
        validatePackage(JSON.parse(JSON.stringify(p))).issues.filter(
          (i) => i.severity === "error",
        ),
      ).toEqual([]);
      expect(p.library!.tags).toContain("nets");
      expect(p.library!.tags).toContain("level-unconfirmed");
      expect(p.lesson.reviewStatus).toBe("draft");
      for (const net of (p.lesson.specification as unknown as NetsSpec).nets)
        expect(normaliseNet(net)).toBe(net);
      for (const step of p.lesson.steps) {
        expect(step.hints).toHaveLength(4);
        step.choices?.forEach((c, i) => {
          expect(c.id).toMatch(/^k\d+$/);
          expect(c.id).not.toBe(String(i));
        });
      }
      for (const mode of ["independent", "guided"] as const) {
        let session = createSession(p.lesson, netsTopic.adapter, mode);
        for (const [i, step] of p.lesson.steps.entries()) {
          session = useHint(session);
          expect(p.fixtures![i].rejected.length).toBeGreaterThan(0);
          for (const rejected of p.fixtures![i].rejected) {
            session = submit(session, p.lesson, netsTopic.adapter, {
              type: "answer",
              value: rejected,
            });
            expect(session.feedback?.outcome).toBe("incorrect");
          }
          session = submit(session, p.lesson, netsTopic.adapter, {
            type: "answer",
            value: step.answer,
          });
          expect(session.feedback?.outcome).toBe("correct");
          session = nextStep(session, p.lesson, netsTopic.adapter);
        }
        expect(session.completed).toBe(true);
      }
    });
  }

  it("keeps the starter answers the model gives, with the right choice never in a fixed place", () => {
    const check = template("p4-cube-net-check").lesson;
    expect(check.steps[0].answer).toBe("6");
    const valid = check.steps[1];
    expect(valid.choices!.map((c) => c.label)).toEqual([
      "Net A",
      "Net B",
      "Net C",
      "Net D",
    ]);
    expect(valid.choices!.find((c) => c.id === valid.answer)!.label).toBe(
      "Net B",
    );
    const opposite = template("p4-cube-opposite-faces").lesson;
    expect(
      opposite.steps[0].choices!.find((c) => c.id === opposite.steps[0].answer)!
        .label,
    ).toBe("Face E");
    const net = parsed("A.../BCDE/..F.");
    expect(oppositeLetters(net)).toEqual({
      A: "F",
      F: "A",
      B: "D",
      D: "B",
      C: "E",
      E: "C",
    });
    const complete = template("p4-complete-the-net").lesson;
    const spots = complete.steps[0];
    expect(
      (spots.answer as string[]).map(
        (id) => spots.choices!.find((c) => c.id === id)!.label,
      ),
    ).toEqual(["Spot A", "Spot D"]);
    const solid = template("p4-solid-from-net").lesson;
    expect(solid.steps.slice(0, 4).map((s) => s.answer)).toEqual([
      "5",
      solid.steps[1].choices!.find((c) => c.label === "A triangular prism")!.id,
      "9",
      "6",
    ]);
  });

  it("rejects malformed specifications and net strings", () => {
    const check = (over: Partial<NetsSpec>) => base("p4-cube-net-check", over);
    const complete = (over: Partial<NetsSpec>) =>
      base("p4-complete-the-net", over);
    const opposite = (over: Partial<NetsSpec>) =>
      base("p4-cube-opposite-faces", over);
    const nets4 = specOf("p4-cube-net-check").nets;
    const netAt = (i: number, text: string) =>
      check({ nets: nets4.map((n, k) => (k === i ? text : n)) });
    const bad: [NetsSpec, RegExp][] = [
      [check({ task: "roll" as "check" }), /Unsupported nets task/],
      [check({ nets: nets4.slice(0, 3) }), /exactly four/],
      [netAt(0, "#..#/###"), /Every row of a net/],
      [netAt(0, "#..x/####"), /uses only/],
      [netAt(0, "/####"), /must not be empty/],
      [netAt(0, "#..#/####/...."), /Remove empty outer/],
      [netAt(0, "#######"), /at most 6/],
      [netAt(0, "#/#/#/#/#/#/#"), /at most 6/],
      [netAt(0, "A..#/####"), /uses only #/],
      [netAt(0, "####"), /needs 5 to 7/],
      [netAt(0, "##.##/#...#"), /connected/],
      [netAt(1, "#..#/####"), /different shapes/],
      [netAt(0, ".#../####/.#.."), /Exactly one net must fold/],
      [netAt(1, "#...#/#####"), /Exactly one net must fold/],
      [check({ asked: 1 }), /must have six squares and not fold/],
      [check({ asked: 4 }), /Choose which net/],
      [check({ face: "A" }), /no face or solid/],
      [opposite({ nets: ["A.../BCDE/..B."] }), /Label the six squares/],
      [opposite({ nets: ["A.../BCDE/..F.", "A"] }), /one labelled net/],
      [opposite({ nets: ["A#../BCDE/..F."] }), /Label the six squares/],
      [opposite({ nets: ["AB./CD./.EF"] }), /fold into a cube/],
      [opposite({ face: "G" }), /from A to F/],
      [opposite({ face: "" }), /from A to F/],
      [opposite({ solid: "cube" }), /no solid/],
      [
        complete({
          nets: [".#.b./####c/a.d.."].map((n) => n.replace("d", ".")),
        }),
        /five # squares/,
      ],
      [
        complete({
          nets: [".#.b./####c/a.d.."].map((n) => n.replace("a", "b")),
        }),
        /five # squares/,
      ],
      [complete({ nets: ["####/#abc/...d"] }), /touch one of the squares/],
      [
        complete({ nets: ["#.#.b/#.#.c/#a.d."] }),
        /five # squares|connected|touch/,
      ],
      [complete({ solid: "cube" }), /no face or solid/],
      [
        base("p4-solid-from-net", { solid: "cylinder" as "cube" }),
        /supported solid/,
      ],
      [base("p4-solid-from-net", { nets: ["#"] }), /catalogue/],
      [base("p4-solid-from-net", { face: "A" }), /uses no face/],
      [base("p4-solid-from-net", { asked: 2 }), /Only the check task/],
    ];
    for (const [spec, pattern] of bad)
      expect(validateNetsSpec(spec).join(" "), JSON.stringify(spec)).toMatch(
        pattern,
      );
    // Spots that make no net, or too many nets, are refused: found by search over real pieces.
    const counts = new Set<number>();
    for (const cells of oracleValid.slice(0, 40))
      for (let drop = 0; drop < 6; drop++) {
        const piece = cells.filter((_, i) => i !== drop);
        const all: P[] = [];
        for (const [x, y] of piece)
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (
              !piece.some((c) => c[0] === x + dx && c[1] === y + dy) &&
              !all.some((c) => c[0] === x + dx && c[1] === y + dy)
            )
              all.push([x + dx, y + dy]);
        for (let from = 0; from + 4 <= all.length; from++) {
          const spots = all.slice(from, from + 4);
          const xs = [...piece, ...spots].map((c) => c[0]),
            ys = [...piece, ...spots].map((c) => c[1]);
          const x0 = Math.min(...xs),
            y0 = Math.min(...ys);
          const cols = Math.max(...xs) - x0 + 1,
            rows = Math.max(...ys) - y0 + 1;
          if (cols > 6 || rows > 6) continue;
          const grid = Array.from({ length: rows }, () =>
            Array(cols).fill("."),
          );
          piece.forEach(([x, y]) => (grid[y - y0][x - x0] = "#"));
          spots.forEach(([x, y], i) => (grid[y - y0][x - x0] = "abcd"[i]));
          const text = grid.map((r) => r.join("")).join("/");
          const good = spots.filter(
            (s) => geometric(flipY([...piece, s])).ok,
          ).length;
          const errors = validateNetsSpec(complete({ nets: [text] }));
          const joined = (() => {
            const seen = new Set([piece[0].join(",")]);
            for (let grew = true; grew;) {
              grew = false;
              for (const c of piece)
                if (
                  !seen.has(c.join(",")) &&
                  [...seen].some((k) => {
                    const [a, b] = k.split(",").map(Number);
                    return Math.abs(a - c[0]) + Math.abs(b - c[1]) === 1;
                  })
                ) {
                  seen.add(c.join(","));
                  grew = true;
                }
            }
            return seen.size === 5;
          })();
          if (!joined) expect(errors.join(" "), text).toMatch(/connected/);
          else if (good >= 1 && good <= 3) expect(errors, text).toEqual([]);
          else expect(errors.join(" "), text).toMatch(/One to three spots/);
          counts.add(good);
        }
      }
    expect(counts.has(0) || counts.has(4)).toBe(true);
    expect(validateNetsSpec(null)).not.toEqual([]);
    expect(validateNetsSpec([])).not.toEqual([]);
    expect(validateNetsSpec({ ...check({}), extra: 1 })).toContain(
      "Unknown nets field",
    );
    expect(validateNetsSpec({ ...check({}), nets: "abc" })).not.toEqual([]);
    expect(validateNetsSpec({ ...check({}), asked: 1.5 })).not.toEqual([]);
    expect(
      validateNetsSpec(check({ nets: ["<script>", ...nets4.slice(1)] })).join(
        " ",
      ),
    ).toMatch(/uses only/);
    expect(parseNet(7)).toBeTypeOf("string");
    expect(parseNet("")).toBeTypeOf("string");
    expect(normaliseNet("..../.#../.##./....")).toBe("#./##");
    expect(normaliseNet("##/#")).toBe("##/#"); // ragged text is left for the validator
    const lesson = template("p4-cube-net-check").lesson;
    lesson.steps[0].answer = "7";
    expect(validateNetsSteps(lesson).join(" ")).toMatch(/contradicts/);
    const wrongPair = template("p4-cube-opposite-faces").lesson;
    wrongPair.steps[2].choices!.find((c) => c.meaning === "opposite")!.label =
      "A and B";
    expect(validateNetsSteps(wrongPair).join(" ")).toMatch(
      /Pair choices|contradicts/,
    );
  });

  it("draws every model without revealing the answer", () => {
    for (const form of netsAuthor.forms) {
      const html = netsTopic.render(template(form.id).lesson);
      const svg = html.slice(html.indexOf("<svg"));
      const words = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
        (m) => m[1],
      );
      expect(svg).not.toMatch(
        /fold|valid|opposite|prism|pyramid|cuboid|cube|face|edge|vertex|net /i,
      );
      expect(html).toMatch(/role="img"/);
      expect(html).toMatch(/aria-hidden="true"/);
      if (form.id === "p4-cube-net-check")
        expect(words).toEqual(["A", "B", "C", "D"]);
      if (form.id === "p4-cube-opposite-faces")
        expect(words.sort()).toEqual([..."ABCDEF"]);
      if (form.id === "p4-complete-the-net")
        expect(words.sort()).toEqual([..."ABCD"]);
      if (form.id === "p4-solid-from-net") expect(words).toEqual([]);
      for (const size of svg.matchAll(/font-size="(\d+)"/g))
        expect(Number(size[1])).toBeGreaterThanOrEqual(16);
      const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
      expect(Number(box[1])).toBeLessThanOrEqual(360);
    }
    // Everything drawn stays inside the viewBox.
    for (const solid of SOLID_IDS) {
      const html = netsTopic.render({
        ...template("p4-solid-from-net").lesson,
        specification: { task: "solid", nets: [], asked: 0, face: "", solid },
      });
      const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(html)!.map(Number);
      for (const m of html.matchAll(/points="([^"]+)"/g))
        for (const pair of m[1].split(" ")) {
          const [x, y] = pair.split(",").map(Number);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(w);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(h);
        }
    }
    const sheet = netsTopic.render(template("p4-cube-net-check").lesson);
    for (const m of sheet.matchAll(
      /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
    )) {
      expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(360);
    }
  });

  it("lists the layout in the text alternative, never the answer, and escapes it", () => {
    const check = describeNets(specOf("p4-cube-net-check"));
    expect(check).toContain(
      "Net A. Row 1: a square in column 1 and a square in column 4.",
    );
    expect(check).not.toMatch(/fold into|valid|does not/i);
    expect(describeNets(specOf("p4-cube-opposite-faces"))).toContain(
      "B, C, D, E in columns 1 to 4",
    );
    expect(describeNets(specOf("p4-complete-the-net"))).toMatch(
      /dashed spot B in column 4/,
    );
    expect(describeNets(specOf("p4-solid-from-net"))).toMatch(
      /triangle with sides 3, 4, 5/,
    );
    expect(
      describeNets(base("p4-solid-from-net", { solid: "square-pyramid" })),
    ).toMatch(/the square root of 29/);
    const html = netsTopic.render(template("p4-cube-net-check").lesson);
    expect(html).not.toContain("<script");
    expect(squareCells(parsed("#a/##")).length).toBe(3);
  });

  it("keeps author edits coherent and malformed text editable", () => {
    const model = createAuthorModel(template("p4-cube-net-check"));
    model.patch({ kind: "topic", key: "load:C", value: "v4" });
    const loaded = model.working.lesson.specification as unknown as NetsSpec;
    expect(foldsToCube(cellsOfText(loaded.nets[2])).ok).toBe(true);
    // Two nets now fold, so the model reports it rather than guessing.
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    model.patch({ kind: "topic", key: "load:B", value: "x3" });
    expect(model.issues.filter((i) => i.severity === "error")).toEqual([]);
    const valid = model.working.lesson.steps[1];
    expect(valid.choices!.find((c) => c.id === valid.answer)!.label).toBe(
      "Net C",
    );
    model.patch({ kind: "topic", key: "net:0", value: "#.#/###/..." });
    expect(
      (model.working.lesson.specification as unknown as NetsSpec).nets[0],
    ).toBe("#.#/###");
    model.patch({ kind: "topic", key: "net:0", value: "garbage" });
    expect(model.issues.some((i) => i.severity === "error")).toBe(true);
    expect(
      (model.working.lesson.specification as unknown as NetsSpec).nets[0],
    ).toBe("garbage");

    const opp = createAuthorModel(template("p4-cube-opposite-faces"));
    opp.patch({ kind: "topic", key: "face", value: "A" });
    let step = opp.working.lesson.steps[0];
    expect(step.choices!.find((c) => c.id === step.answer)!.label).toBe(
      "Face F",
    );
    opp.patch({ kind: "topic", key: "load:valid", value: "v1" });
    // The offered faces were written for the old net; updating the wording regenerates them.
    opp.applyWording();
    expect(opp.issues.filter((i) => i.severity === "error")).toEqual([]);
    const spec = opp.working.lesson.specification as unknown as NetsSpec;
    expect(spec.nets[0]).toMatch(/^[A-F./]+$/);
    step = opp.working.lesson.steps[0];
    const letters = oppositeLetters(parsed(spec.nets[0]))!;
    expect(step.choices!.find((c) => c.id === step.answer)!.label).toBe(
      `Face ${letters.A}`,
    );

    const solid = createAuthorModel(template("p4-solid-from-net"));
    solid.patch({ kind: "topic", key: "solid", value: "square-pyramid" });
    expect(
      solid.working.lesson.steps
        .slice(0, 4)
        .map((s) => (s.kind === "exact" ? s.answer : "")),
    ).toEqual(["5", "", "8", "5"]);
    solid.patch({ kind: "topic", key: "solid", value: "cube" });
    expect(
      solid.working.lesson.steps
        .slice(0, 4)
        .map((s) => (s.kind === "exact" ? s.answer : "")),
    ).toEqual(["6", "", "12", "8"]);

    const done = createAuthorModel(template("p4-complete-the-net"));
    done.patch({ kind: "topic", key: "net:0", value: ".#.b./####c/a.d.." });
    expect(done.issues.filter((i) => i.severity === "error")).toEqual([]);
    done.patch({ kind: "topic", key: "net:0", value: "#####/....a" });
    expect(done.issues.some((i) => i.severity === "error")).toBe(true);
    // Updating wording regenerates prompts, hints and choices from the specification.
    const fresh = createAuthorModel(template("p4-cube-opposite-faces"));
    fresh.patch({ kind: "topic", key: "face", value: "B" });
    fresh.applyWording();
    expect(fresh.working.lesson.steps[0].prompt).toContain("face B");
  });
});
