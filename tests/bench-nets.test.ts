import { describe, expect, it } from "vitest";
import { netMenu } from "../src/authoring/nets";
import {
  catalogueNet,
  canonicalKey,
  collisionLetters,
  hasBlock2x2,
  oppositeLetters,
  parseNet,
  squareCells,
  uncoveredOppositeLetters,
  validateNetsSpec,
  type NetsSpec,
  type ParsedNet,
} from "../src/topics/nets";
import {
  allFolded,
  demoScript,
  exactCoincident,
  exactCorners,
  exactTop,
  foldReducer,
  netFoldModel,
  solidFoldModel,
  solidScript,
  type FoldModel,
  type V3,
} from "../src/topics/nets-bench";
import { FoldScene } from "../src/topics/nets-scene";
import { KeyframePlayer } from "../src/workbench/player";
import { lessons } from "../src/content/lessons";

const LETTERS = "ABCDEF";
const label = (net: string) => {
  let i = 0;
  return net.replace(/#/g, () => LETTERS[i++]);
};
/** Net text turned a quarter turn `k` times, keeping each square's letter. */
function turned(net: string, k: number): string {
  let cells = (parseNet(net) as ParsedNet).cells.map(
    (c) => [c.x, c.y, c.ch] as [number, number, string],
  );
  for (let t = 0; t < k; t++) cells = cells.map(([x, y, ch]) => [-y, x, ch]);
  const x0 = Math.min(...cells.map((c) => c[0])),
    y0 = Math.min(...cells.map((c) => c[1]));
  const w = Math.max(...cells.map((c) => c[0])) - x0 + 1,
    h = Math.max(...cells.map((c) => c[1])) - y0 + 1;
  const grid = Array.from({ length: h }, () => Array(w).fill("."));
  for (const [x, y, ch] of cells) grid[y - y0][x - x0] = ch;
  return grid.map((r) => r.join("")).join("/");
}
const cubeNets = netMenu()
  .filter((m) => m.valid)
  .map((m) => label(m.net));
const collisionNets = netMenu()
  .filter((m) => !m.valid)
  .map((m) => label(m.net))
  .filter((n) => {
    const p = parseNet(n) as ParsedNet;
    return !hasBlock2x2(squareCells(p)) && collisionLetters(p).length === 1;
  });
const parsed = (n: string) => parseNet(n) as ParsedNet;

/* ------------- independent oracle (tests only): rotate point sets about world creases ------------- */
type Vec = [number, number, number];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossV = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Rodrigues rotation of p about the line through o along unit k. */
function rotate(p: Vec, o: Vec, k: Vec, t: number): Vec {
  const v = sub(p, o),
    c = Math.cos(t),
    s = Math.sin(t),
    kv = crossV(k, v),
    kd = dot(k, v);
  return [0, 1, 2].map(
    (i) => o[i] + v[i] * c + kv[i] * s + k[i] * kd * (1 - c),
  ) as Vec;
}
/**
 * Folds by moving whole subtrees: for each crease (parents first) the crease line is read from the
 * parent's current corners, and the child's subtree turns about it towards the side the parent's
 * front faces. Fold amount per crease is a fraction of a quarter turn (or the solid's angle).
 */
function oracle(m: FoldModel, fraction: number[]): Vec[][] {
  const pts: Vec[][] = m.polys.map((poly) => poly.map(([x, y]) => [x, y, 0]));
  const children = new Map<number, number[]>();
  for (const h of m.hinges)
    children.set(h.parent, [...(children.get(h.parent) ?? []), h.child]);
  const subtree = (f: number): number[] => [
    f,
    ...(children.get(f) ?? []).flatMap(subtree),
  ];
  m.hinges.forEach((h, i) => {
    if (!fraction[i]) return;
    const poly = m.polys[h.parent];
    const ia = poly.findIndex((p) => p[0] === h.a[0] && p[1] === h.a[1]);
    const ib = poly.findIndex((p) => p[0] === h.b[0] && p[1] === h.b[1]);
    const a = pts[h.parent][ia],
      b = pts[h.parent][ib];
    const len = Math.hypot(...sub(b, a));
    const k = sub(b, a).map((v) => v / len) as Vec;
    const P = pts[h.parent];
    const normal = crossV(sub(P[1], P[0]), sub(P[2], P[0]));
    const centre = (face: Vec[]) =>
      [0, 1, 2].map(
        (j) => face.reduce((t, p) => t + p[j], 0) / face.length,
      ) as Vec;
    const angle = h.max * fraction[i];
    // pick the turning sense that lifts the child to the front of its parent
    const probe = rotate(centre(pts[h.child]), a, k, Math.PI / 2);
    const sign = dot(sub(probe, a), normal) > 0 ? 1 : -1;
    for (const f of subtree(h.child))
      pts[f] = pts[f].map((p) => rotate(p, a, k, sign * angle));
  });
  return pts;
}
const close = (a: V3[][], b: Vec[][], tol = 1e-9) =>
  a.every((face, f) =>
    face.every((p, i) => Math.hypot(...sub(p as Vec, b[f][i])) < tol),
  );
const sceneAt = (m: FoldModel, fraction: number[]) => {
  const scene = new FoldScene(m, { textures: false });
  scene.setAngles(m.hinges.map((h, i) => h.max * fraction[i]));
  return scene;
};

describe("net folder model", () => {
  it("finds 11 cube nets and the 14-net collision pool", () => {
    expect(cubeNets).toHaveLength(11);
    expect(collisionNets).toHaveLength(14);
  });
  it("builds a five-crease tree for every usable net and refuses a 2 by 2 block", () => {
    for (const n of [...cubeNets, ...collisionNets])
      expect(netFoldModel(n, "A")!.hinges).toHaveLength(5);
    expect(netFoldModel("AB../CD../.EF.", "A")).toBeNull();
    expect(netFoldModel("AB../.CDE/...F", "Z")).toBeNull();
  });
  it("reducer: toggles are involutions, fold-all equals toggling in any order, bad moves are refused", () => {
    const m = netFoldModel(cubeNets[0], "A")!;
    expect(foldReducer(m, 0, { type: "toggle", crease: 2 }).state).toBe(4);
    expect(foldReducer(m, 4, { type: "toggle", crease: 2 }).state).toBe(0);
    const perms = (xs: number[]): number[][] =>
      xs.length < 2
        ? [xs]
        : xs.flatMap((x) =>
            perms(xs.filter((y) => y !== x)).map((r) => [x, ...r]),
          );
    for (const order of perms([0, 1, 2, 3, 4]))
      expect(
        order.reduce(
          (s, crease) => foldReducer(m, s, { type: "toggle", crease }).state,
          0,
        ),
      ).toBe(foldReducer(m, 0, { type: "fold-all" }).state);
    for (const bad of [
      { type: "toggle", crease: 5 },
      { type: "toggle", crease: -1 },
      { type: "toggle", crease: 1.5 },
      { type: "set", state: 32 },
      { type: "spin" },
      null,
    ])
      expect(
        foldReducer(m, 3, bad as unknown as Parameters<typeof foldReducer>[2]),
      ).toMatchObject({ state: 3, rejected: expect.any(String) });
    expect(foldReducer(m, 31, { type: "unfold-all" }).state).toBe(0);
  });
  it("exact integer pose agrees with the rolling cube on every net, floor and quarter turn", () => {
    for (const base of cubeNets)
      for (let k = 0; k < 4; k++) {
        const net = turned(base, k);
        const opp = oppositeLetters(parsed(net))!;
        for (const floor of LETTERS) {
          const m = netFoldModel(net, floor)!;
          expect(exactTop(m, allFolded(m))).toEqual([opp[floor]]);
          expect(exactCoincident(m, allFolded(m))).toEqual([]);
          expect(
            exactCorners(m, allFolded(m))!.flat(2).every(Number.isInteger),
          ).toBe(true);
        }
      }
    for (const base of collisionNets)
      for (let k = 0; k < 4; k++) {
        const net = turned(base, k);
        const m = netFoldModel(net, "A")!;
        expect(exactCoincident(m, allFolded(m))).toEqual(
          collisionLetters(parsed(net)),
        );
      }
  });
});

describe("scene graph against an independent float oracle", () => {
  const fractions = [
    [1, 1, 1, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 0.5],
    [1, 0, 1, 0, 1],
    [0, 0.25, 1, 0.75, 0],
  ];
  it("matrix read-back equals the oracle on all 11 cube nets and 14 collision nets in four orientations", () => {
    let checked = 0;
    for (const base of [...cubeNets, ...collisionNets])
      for (let k = 0; k < 4; k++) {
        const m = netFoldModel(turned(base, k), "C")!;
        for (const fr of fractions) {
          const scene = sceneAt(m, fr);
          const read = m.polys.map((_, f) => scene.corners(f));
          expect(close(read, oracle(m, fr))).toBe(true);
          if (fr.every((x) => x === 0 || x === 1)) {
            const state = fr.reduce((s: number, x, i) => s | (x << i), 0);
            expect(close(exactCorners(m, state)!, read as Vec[][])).toBe(true);
          }
          scene.dispose();
          checked++;
        }
      }
    expect(checked).toBe(25 * 4 * fractions.length);
  });
  it("picture and judged answer agree: top face, meeting pair and open face", () => {
    for (const base of cubeNets)
      for (let k = 0; k < 4; k++) {
        const net = turned(base, k);
        for (const floor of LETTERS) {
          const m = netFoldModel(net, floor)!;
          const scene = sceneAt(m, [1, 1, 1, 1, 1]);
          const top = m.labels.filter((_, f) =>
            scene.corners(f).every((p) => Math.abs(p[2] - 1) < 1e-9),
          );
          expect(top).toEqual([oppositeLetters(parsed(net))![floor]]);
          scene.dispose();
        }
      }
    for (const base of collisionNets)
      for (let k = 0; k < 4; k++) {
        const net = turned(base, k);
        const m = netFoldModel(net, "A")!;
        const scene = sceneAt(m, [1, 1, 1, 1, 1]);
        const pairs = scene
          .coincident(1e-6)
          .map(([i, j]) => [m.labels[i], m.labels[j]].sort());
        expect(pairs).toEqual(collisionLetters(parsed(net)));
        // the open face of the unit cube on the floor: the side whose plane holds no square
        const planes: [number, number][] = [
          [2, 0],
          [2, 1],
          [0, Math.min(...m.polys[m.root].map((p) => p[0]))],
          [0, Math.max(...m.polys[m.root].map((p) => p[0]))],
          [1, Math.min(...m.polys[m.root].map((p) => p[1]))],
          [1, Math.max(...m.polys[m.root].map((p) => p[1]))],
        ];
        const onPlane = ([axis, v]: [number, number]) =>
          m.polys
            .map((_, f) => f)
            .filter((f) =>
              scene.corners(f).every((p) => Math.abs(p[axis] - v) < 1e-9),
            );
        const open = planes.findIndex((pl) => !onPlane(pl).length);
        const across = planes[open ^ 1];
        const letters = onPlane(across).map((f) => m.labels[f]);
        const judged = uncoveredOppositeLetters(parsed(net));
        if (judged.length === 1) expect(letters).toEqual(judged);
        scene.dispose();
      }
  });
  it("catalogue solids (WP1b models) close up in the oracle and the scene graph alike", () => {
    for (const solid of [
      "cuboid",
      "triangular-prism",
      "square-pyramid",
    ] as const) {
      const m = solidFoldModel(solid)!;
      const full = m.hinges.map(() => 1);
      const scene = sceneAt(m, full);
      const read = m.polys.map((_, f) => scene.corners(f));
      expect(close(read, oracle(m, full), 1e-9)).toBe(true);
      // every glued pair of sides meets end to end once folded: the solid closes
      for (const [f, k, g, l] of catalogueNet(solid).glue) {
        const nf = read[f].length,
          ng = read[g].length;
        const near = (p: V3, q: V3) =>
          Math.hypot(...sub(p as Vec, q as Vec)) < 1e-9;
        expect(near(read[f][k], read[g][(l + 1) % ng])).toBe(true);
        expect(near(read[f][(k + 1) % nf], read[g][l])).toBe(true);
      }
      scene.dispose();
    }
  });
});

describe("nets workbench lessons", () => {
  const benchLessons = lessons.filter((l) =>
    ["fold", "collide"].includes(String(l.specification.task)),
  );
  it("has both lessons, with a demonstration net of a different shape", () => {
    expect(
      benchLessons
        .filter((l) => !l.id.includes("-ex"))
        .map((l) => l.id)
        .sort(),
    ).toEqual(["p4-fold-a-cube-net", "p4-fold-a-net-that-fails"]);
    expect(benchLessons).toHaveLength(12);
    for (const l of benchLessons) {
      const s = l.specification as unknown as NetsSpec;
      expect(canonicalKey(squareCells(parsed(s.nets[0])))).not.toBe(
        canonicalKey(squareCells(parsed(s.nets[1]))),
      );
      for (const step of l.steps.filter((x) => x.goal !== "reflection")) {
        const frames = demoScript(step.goal!, s.nets[1], s.demoFace!);
        expect(frames.at(-1)!.state).toBe(31);
        // the closing caption speaks about the demonstration net, not the learner's answer
        const answer = step.choices!.find((c) => c.id === step.answer)!.label;
        expect(frames.at(-1)!.caption).not.toContain(answer);
      }
    }
  });
  it("rejects malformed hands-on specifications", () => {
    const fold: NetsSpec = {
      task: "fold",
      nets: ["AB../.CDE/...F", ".A../BCDE/.F.."],
      asked: 0,
      face: "C",
      solid: "",
      demoFace: "B",
      second: "A",
    };
    const collide: NetsSpec = {
      task: "collide",
      nets: ["ABC./..DE/...F", "ABCD/.E../.F.."],
      asked: 0,
      face: "C",
      solid: "",
      demoFace: "B",
    };
    expect(validateNetsSpec(fold)).toEqual([]);
    expect(validateNetsSpec(collide)).toEqual([]);
    const bad: [NetsSpec, RegExp][] = [
      [{ ...fold, nets: [fold.nets[0], "BA../.CDE/...F"] }, /different shape/],
      [{ ...fold, second: "E" }, /second face/],
      [{ ...fold, second: "C" }, /second face/],
      [{ ...fold, demoFace: "Q" }, /floor face of the demonstration/],
      [{ ...fold, nets: [fold.nets[0]] }, /two labelled nets/],
      [{ ...fold, nets: ["ABCDE/.F...", fold.nets[1]] }, /fold into a cube/],
      [{ ...collide, nets: ["ABCDEF", collide.nets[1]] }, /exactly one pair/],
      [{ ...collide, nets: ["ABCD/E.F.", collide.nets[1]] }, /single square/],
      [
        { ...collide, nets: [".A../BCDE/.F..", collide.nets[1]] },
        /exactly one pair/,
      ],
      [{ ...collide, second: "A" }, /no second face/],
      [{ ...fold, nets: ["AA../.CDE/...F", fold.nets[1]] }, /each letter once/],
      [
        { ...fold, task: "opposite", nets: ["A.../BCDE/..F."] } as NetsSpec,
        /demonstration face/,
      ],
    ];
    for (const [spec, pattern] of bad)
      expect(validateNetsSpec(spec).join(" "), JSON.stringify(spec)).toMatch(
        pattern,
      );
  });
});

describe("fold-a-solid task (WP1b)", () => {
  const base: NetsSpec = {
    task: "fold-solid",
    nets: [],
    asked: 0,
    face: "",
    solid: "square-pyramid",
    demoSolid: "cuboid",
  };
  it("validates the solid and a different demonstration solid", () => {
    expect(validateNetsSpec(base)).toEqual([]);
    expect(
      validateNetsSpec({ ...base, demoSolid: "square-pyramid" }).join(),
    ).toMatch(/different solid/);
    expect(
      validateNetsSpec({ ...base, solid: "sphere" as "cube" }).join(),
    ).toMatch(/supported solid/);
    expect(
      validateNetsSpec({ ...base, task: "solid", solid: "cuboid" }).join(),
    ).toMatch(/demonstration solid/);
  });
  it("Watch folds the demonstration solid and names it, not the learner's", () => {
    const frames = solidScript("cuboid");
    expect(frames.at(-1)!.state).toBe(31);
    expect(frames.at(-1)!.caption).toContain("cuboid");
    expect(frames.at(-1)!.caption).not.toContain("pyramid");
  });
});

describe("Watch keyframe player (fake clock)", () => {
  function make(reduced: boolean) {
    const timers = new Map<number, () => void>();
    let id = 0;
    const shown: [number, boolean][] = [];
    const player = new KeyframePlayer({
      count: 4,
      ms: 100,
      clock: {
        schedule: (run) => (timers.set(++id, run), id),
        cancel: (t) => timers.delete(t),
      },
      reducedMotion: () => reduced,
      show: (i, animate) => shown.push([i, animate]),
    });
    const tick = () => {
      const [first] = timers.entries();
      if (!first) return false;
      timers.delete(first[0]);
      first[1]();
      return true;
    };
    return { player, timers, shown, tick };
  }
  it("plays to the last keyframe and stops without looping", () => {
    const { player, shown, tick, timers } = make(false);
    expect(player.play()).toBe(true);
    while (tick());
    expect(player.index).toBe(3);
    expect(player.playing).toBe(false);
    expect(timers.size).toBe(0);
    expect(shown.map((s) => s[0])).toEqual([1, 2, 3]);
    player.play(); // from the end it replays from the start
    expect(shown.at(-1)).toEqual([0, false]);
    player.destroy();
    expect(timers.size).toBe(0);
  });
  it("with reduced motion refuses Play, schedules nothing and steps between stills", () => {
    const { player, shown, timers } = make(true);
    expect(player.play()).toBe(false);
    expect(timers.size).toBe(0);
    player.next();
    player.next();
    player.back();
    player.back();
    player.back();
    expect(shown).toEqual([
      [1, false],
      [2, false],
      [1, false],
      [0, false],
      [0, false],
    ]);
  });
});
