import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  SOLID_DISTRACTORS,
  SOLID_IDS,
  SOLID_NAMES,
  canonicalKey,
  catalogueNet,
  foldsToCube,
  netsAnswer,
  normaliseNet,
  oppositeLetters,
  otherLetters,
  pairLabel,
  pairOptions,
  parseNet,
  solidFacts,
  squareCells,
  touchingLetters,
  collideDistractors,
  collisionLetters,
  missingDistractors,
  uncoveredOppositeLetters,
  validNetIndex,
  validateNetsSpec,
  whyReason,
  type NetsSpec,
  type ParsedNet,
  type Pt,
  type SolidId,
} from "../topics/nets";
import {
  choiceStep,
  choices,
  deriveAnswers,
  exactStep,
  hints,
  multiStep,
  p4Package,
  reflectionStep,
} from "../topics/p4-kit";

const FORMS = [
  "p4-cube-net-check",
  "p4-cube-opposite-faces",
  "p4-solid-from-net",
  "p4-complete-the-net",
  "p4-fold-a-cube-net",
  "p4-fold-a-net-that-fails",
  "p4-fold-a-solid",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], NetsSpec["task"]> = {
  "p4-fold-a-cube-net": "fold",
  "p4-fold-a-net-that-fails": "collide",
  "p4-fold-a-solid": "fold-solid",
  "p4-cube-net-check": "check",
  "p4-cube-opposite-faces": "opposite",
  "p4-solid-from-net": "solid",
  "p4-complete-the-net": "complete",
};
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const list = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/* ---------------------------------- ready-made nets ---------------------------------- */

export interface MenuNet {
  id: string;
  label: string;
  net: string;
  valid: boolean;
}
/** Every fixed hexomino: six squares joined edge to edge, grown one neighbour at a time. */
function fixedHexominoes(): Pt[][] {
  const norm = (cells: Pt[]): Pt[] => {
    const x0 = Math.min(...cells.map((c) => c[0])),
      y0 = Math.min(...cells.map((c) => c[1]));
    return cells
      .map(([x, y]): Pt => [x - x0, y - y0])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  const text = (cells: Pt[]) => cells.map((c) => c.join(".")).join(" ");
  let level = new Map<string, Pt[]>([["0.0", [[0, 0]]]]);
  for (let n = 1; n < 6; n++) {
    const next = new Map<string, Pt[]>();
    for (const cells of level.values())
      for (const [x, y] of cells)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (cells.some((c) => c[0] === x + dx && c[1] === y + dy)) continue;
          const grown = norm([...cells, [x + dx, y + dy]]);
          next.set(text(grown), grown);
        }
    level = next;
  }
  return [...level.values()];
}
const netText = (cells: Pt[], letters: boolean) => {
  const cols = Math.max(...cells.map((c) => c[0])) + 1,
    rows = Math.max(...cells.map((c) => c[1])) + 1;
  let next = 0;
  const grid = Array.from({ length: rows }, () => Array(cols).fill("."));
  for (const [x, y] of [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]))
    grid[y][x] = letters ? LETTERS[next++] : "#";
  return grid.map((r) => r.join("")).join("/");
};
let menuCache: MenuNet[] | null = null;
/**
 * The 11 nets that fold and the 24 that do not, found by enumeration (35 shapes up to turning and
 * turning over) and sorted by shape, each drawn wide side across. Names carry the squares per row.
 */
export function netMenu(): MenuNet[] {
  if (menuCache) return menuCache;
  const free = new Map<string, Pt[]>();
  for (const cells of fixedHexominoes()) free.set(canonicalKey(cells), cells);
  const turns: ((p: Pt) => Pt)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [-x, y],
    ([x, y]) => [x, -y],
    ([x, y]) => [-x, -y],
    ([x, y]) => [y, x],
    ([x, y]) => [-y, x],
    ([x, y]) => [y, -x],
    ([x, y]) => [-y, -x],
  ];
  const entries = [...free.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, cells]) => {
      const options = turns
        .map((m) => {
          const moved = cells.map(m);
          const x0 = Math.min(...moved.map((c) => c[0])),
            y0 = Math.min(...moved.map((c) => c[1]));
          return moved.map(([x, y]): Pt => [x - x0, y - y0]);
        })
        .filter((c) => {
          const w = Math.max(...c.map((p) => p[0])) + 1,
            h = Math.max(...c.map((p) => p[1])) + 1;
          return w >= h;
        })
        .map((c) => netText(c, false))
        .sort();
      const net = options[0];
      const rows = net
        .split("/")
        .map((r) => [...r].filter((c) => c === "#").length);
      return {
        net,
        valid: foldsToCube(cells).ok,
        profile: rows.join("-"),
      };
    });
  const seen = new Map<string, number>();
  menuCache = ["valid", "invalid"].flatMap((kind) =>
    entries
      .filter((e) => e.valid === (kind === "valid"))
      .map((e, i) => {
        const count = (seen.get(`${kind}${e.profile}`) ?? 0) + 1;
        seen.set(`${kind}${e.profile}`, count);
        return {
          id: `${kind === "valid" ? "v" : "x"}${i + 1}`,
          label: `${kind === "valid" ? "Folds" : "Does not fold"}: ${e.profile} squares per row (${count})`,
          net: e.net,
          valid: e.valid,
        };
      }),
  );
  return menuCache;
}
/** A menu net with letters A to F in reading order. */
const labelNet = (net: string) => {
  let next = 0;
  return net.replace(/#/g, () => LETTERS[next++]);
};

/* -------------------------------------- lesson steps -------------------------------------- */

const solidKinds = (solid: SolidId) => {
  const counts = new Map<string, number>();
  for (const f of catalogueNet(solid).faces) {
    const name = f.length === 3 ? "triangle" : "rectangle";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, n]) => `${n} ${name}${n === 1 ? "" : "s"}`)
    .join(" and ");
};

function steps(s: NetsSpec): Step[] {
  if (s.task === "check") {
    const idx = validNetIndex(s.nets);
    const asked = LETTERS[s.asked];
    const reason = whyReason(
      squareCells(parseNet(s.nets[s.asked]) as ParsedNet),
    )!;
    const texts: Record<string, string> = {
      overlap:
        "Two squares would land on one face, leaving another face empty.",
      corner:
        "Four squares would meet at one corner, but only three faces meet at a corner of a cube.",
      missing: "There are not enough squares, so the cube would have a hole.",
      turn: "The squares need to be turned round before the net can fold.",
    };
    return [
      exactStep(
        "count",
        "Count the faces",
        "How many squares are needed to make a net of a cube?",
        hints(
          "Picture a dice or a box shaped like a cube. Think about its flat sides.",
          "Count the top, the bottom and the sides.",
          "There are 4 sides, a top and a bottom.",
          "A cube has 6 faces, so its net needs 6 squares. Enter 6.",
        ),
      ),
      choiceStep(
        "valid",
        "Pick the net that folds",
        "Which of the four patterns folds up into a cube, with no gaps and no overlaps?",
        choices(
          LETTERS.slice(0, 4).map((l, i) => ({
            label: `Net ${l}`,
            meaning: `net:${i}`,
          })),
          idx + 1,
          true,
        ),
        hints(
          "Imagine folding each pattern in turn. Keep one square still as the floor.",
          "Fold the squares next to the floor up to make walls. Watch where each square lands.",
          "Look for the pattern where every square lands on a different face. Rule out the others one at a time.",
          `Net ${LETTERS[idx]} folds into a cube. Choose Net ${LETTERS[idx]}.`,
        ),
      ),
      choiceStep(
        "why",
        "Say why another does not",
        `Net ${asked} does not fold into a cube. Why not?`,
        choices(
          [
            { label: texts[reason], meaning: reason },
            { label: texts.missing, meaning: "missing" },
            { label: texts.turn, meaning: "turn" },
          ],
          s.asked + 1,
        ),
        hints(
          `Count the squares in Net ${asked}.`,
          `Imagine folding Net ${asked}. Follow where the squares go.`,
          reason === "corner"
            ? "Look at the block of four squares. Think about how many squares meet at one corner of a cube."
            : "Look for two squares that would end up on the same face of the cube.",
          `Choose: ${texts[reason]}`,
        ),
      ),
      reflectionStep(
        "What must be true for six joined squares to fold into a cube?",
        "Each square must land on a different face of the cube, with no overlaps.",
        [
          "The six squares must include a straight row of four squares somewhere.",
          "Any six squares joined edge to edge will fold up into a cube.",
        ],
        hints(
          "Think about the cube you would make.",
          "Some six-square patterns fold and some do not.",
          "A row of four is common, but not every cube net has one.",
          "Choose the explanation about each square landing on a different face.",
        ),
        idx + 2,
      ),
    ];
  }
  if (s.task === "opposite") {
    const net = parseNet(s.nets[0]) as ParsedNet;
    const opp = oppositeLetters(net)![s.face];
    const touching = touchingLetters(s);
    const pairs = pairOptions(s);
    const faceChoices = (rotate: number) =>
      choices(
        otherLetters(s.face).map((l) => ({
          label: `Face ${l}`,
          meaning: `face:${l}`,
        })),
        rotate,
        true,
      );
    return [
      choiceStep(
        "opposite",
        "Find the opposite face",
        `Fold the net into a cube. Which face is opposite face ${s.face}?`,
        faceChoices(LETTERS.indexOf(s.face)),
        hints(
          `Imagine face ${s.face} is the floor of the cube.`,
          "The squares joined to it fold up to make walls. Follow each fold.",
          `With face ${s.face} as the floor, four faces fold up as walls: ${list(touching)}. One face is left for the top.`,
          `Face ${opp} is opposite face ${s.face}. Choose Face ${opp}.`,
        ),
      ),
      multiStep(
        "touching",
        "Find the touching faces",
        `Which faces touch face ${s.face} along an edge when the cube is folded? Choose every face that touches it.`,
        faceChoices(LETTERS.indexOf(s.face) + 1),
        hints(
          "Two faces touch when they share an edge of the cube.",
          `Face ${s.face} touches every face except itself and the face opposite it.`,
          "Leave out the opposite face you found. The other faces all touch.",
          `Choose ${list(touching.map((l) => `Face ${l}`))}.`,
        ),
      ),
      choiceStep(
        "opposite-pair",
        "Spot an opposite pair",
        `Choose a pair of faces that are opposite each other. Do not use face ${s.face}.`,
        choices(
          pairs.map((p) => ({ label: pairLabel(p.pair), meaning: p.meaning })),
          LETTERS.indexOf(s.face) + 2,
        ),
        hints(
          "Opposite faces never share an edge.",
          "Imagine folding the cube and testing each pair: would the two faces touch?",
          "Only one of the three pairs is opposite. The other two pairs share an edge.",
          `Choose ${pairLabel(pairs[0].pair)}.`,
        ),
      ),
      reflectionStep(
        "What is true about two opposite faces of a cube?",
        "They do not share an edge; each touches the other four faces.",
        [
          "They share an edge on the cube, just like the floor and a wall do.",
          "They are always right next to each other when the net lies flat.",
        ],
        hints(
          "Picture the top and the bottom of a box.",
          "The top and the bottom never meet.",
          "Opposite faces can be far apart in the flat net as well as on the cube.",
          "Choose the explanation about not sharing an edge.",
        ),
        LETTERS.indexOf(s.face),
      ),
    ];
  }
  if (s.task === "fold") {
    const net = parseNet(s.nets[0]) as ParsedNet;
    const opp = oppositeLetters(net)!;
    const second = s.second ?? "";
    const top = opp[s.face];
    const walls = otherLetters(s.face).filter((l) => l !== top);
    const sides = otherLetters(second).filter((l) => l !== opp[second]);
    const faceChoices = (face: string, rotate: number) =>
      choices(
        otherLetters(face).map((l) => ({
          label: `Face ${l}`,
          meaning: `face:${l}`,
        })),
        rotate,
        true,
      );
    return [
      choiceStep(
        "fold-top",
        "Fold it and look at the top",
        `Keep face ${s.face} on the table as the floor and fold every crease. Which face is on top?`,
        faceChoices(s.face, LETTERS.indexOf(s.face) + 1),
        hints(
          `Use the crease buttons to fold the net, one crease at a time. Face ${s.face} stays flat on the table.`,
          "The squares joined to the floor stand up as walls. Turn the view to look down from above.",
          `Four faces become walls round face ${s.face}: ${list(walls)}. The face left over closes the top.`,
          `Face ${top} is on top, opposite face ${s.face}. Choose Face ${top}.`,
        ),
      ),
      choiceStep(
        "fold-opposite",
        "Find the opposite face",
        `Fold the net into a cube again. Which face is opposite face ${second}?`,
        faceChoices(second, LETTERS.indexOf(second) + 2),
        hints(
          `Fold every crease, then find face ${second} on the cube.`,
          `Opposite faces do not share an edge. Turn the view to see the face across the cube from face ${second}.`,
          `Face ${second} shares an edge with ${list(sides)}. The face it does not touch is opposite.`,
          `Face ${opp[second]} is opposite face ${second}. Choose Face ${opp[second]}.`,
        ),
      ),
      reflectionStep(
        "How can you find the face opposite another face of a cube?",
        "Fold the net: the opposite face never shares an edge with it.",
        [
          "It is always the square right next to it when the net is flat.",
          "It is always the square at the far end of the longest row.",
        ],
        hints(
          "Think about what you saw when the cube was folded.",
          "Opposite faces are across the cube from each other.",
          "Squares next to each other in the net share an edge on the cube, so they cannot be opposite.",
          "Choose the explanation about never sharing an edge.",
        ),
        LETTERS.indexOf(s.face),
      ),
    ];
  }
  if (s.task === "collide") {
    const net = parseNet(s.nets[0]) as ParsedNet;
    const pair = collisionLetters(net)[0];
    const across = uncoveredOppositeLetters(net)[0];
    return [
      choiceStep(
        "collide",
        "Find the squares that meet",
        "This net does not fold into a cube. Fold every crease. Which two squares land on the same place?",
        choices(
          [pair, ...collideDistractors(net)].map((p) => ({
            label: pairLabel(p),
            meaning: `pair:${p.join("")}`,
          })),
          LETTERS.indexOf(pair[1]),
        ),
        hints(
          "Fold the creases one at a time and watch where each square goes.",
          "When every crease is folded, two squares lie on top of each other. Their edges are drawn dashed.",
          "Squares that share a crease never land on the same place. Look at squares further apart in the net.",
          `${pairLabel(pair)} land on the same place. Choose ${pairLabel(pair)}.`,
        ),
      ),
      choiceStep(
        "missing",
        "Find the open face",
        "Because two squares meet, one face of the cube has no square on it. Which face is it?",
        choices(
          [across, ...missingDistractors(net)].map((l) => ({
            label: `The face opposite ${l}`,
            meaning: `opp:${l}`,
          })),
          LETTERS.indexOf(across),
        ),
        hints(
          "Fold every crease again and turn the view to look all round the shape.",
          "Five faces of the cube have a square. One face is open, like a box with no lid.",
          "Find the open face, then look at the face across the cube from it. Which letter is there?",
          `The face opposite ${across} has no square. Choose The face opposite ${across}.`,
        ),
      ),
      reflectionStep(
        "Why does this net not fold into a cube?",
        "Two squares land on the same face, so another face is left open.",
        [
          "It has the wrong number of squares, so it cannot cover every face.",
          "Its squares are not all joined to each other edge to edge in the net.",
        ],
        hints(
          "Count the squares first.",
          "Six squares joined edge to edge is the right start for a cube.",
          "Think about what happened when you folded every crease.",
          "Choose the explanation about two squares landing on the same face.",
        ),
        LETTERS.indexOf(pair[0]),
      ),
    ];
  }
  if (s.task === "fold-solid") {
    const solid = s.solid as SolidId;
    const name = SOLID_NAMES[solid];
    return [
      choiceStep(
        "fold-name",
        "Fold it and name it",
        "Fold every crease of the net. Which solid does it make?",
        choices(
          [solid, ...SOLID_DISTRACTORS[solid]].map((id) => ({
            label: `A ${SOLID_NAMES[id]}`,
            meaning: id,
          })),
          SOLID_IDS.indexOf(solid) + 2,
        ),
        hints(
          "Fold the creases one at a time. Watch the faces meet at their edges.",
          "Turn the view to see the folded shape from the side and from above.",
          `Look at the faces of the folded shape: this net has ${solidKinds(solid)}.`,
          `It makes a ${name}. Choose the ${name}.`,
        ),
      ),
      reflectionStep(
        "How did folding the net help you name the solid?",
        "I saw which faces met and the shape they closed up into.",
        [
          "The colours of the faces tell you which solid it is.",
          "Every net with five faces folds into a cube in the end.",
        ],
        hints(
          "Think about what changed as you folded.",
          "The faces met along their edges.",
          "Colours only help you tell the faces apart.",
          "Choose the explanation about the faces meeting and closing up.",
        ),
        SOLID_IDS.indexOf(solid) + 1,
      ),
    ];
  }
  if (s.task === "complete") {
    const net = parseNet(s.nets[0]) as ParsedNet;
    const yes = ["a", "b", "c", "d"].filter(
      (l) =>
        foldsToCube([
          ...net.cells.filter((c) => c.ch === "#").map((c): Pt => [c.x, c.y]),
          ...net.cells.filter((c) => c.ch === l).map((c): Pt => [c.x, c.y]),
        ]).ok,
    );
    return [
      multiStep(
        "spots",
        "Add the sixth square",
        "Five squares are joined. At which dashed spots would a sixth square make a net that folds into a cube? Choose every spot that works.",
        choices(
          ["a", "b", "c", "d"].map((l) => ({
            label: `Spot ${l.toUpperCase()}`,
            meaning: `spot:${l}`,
          })),
          yes.length,
          true,
        ),
        hints(
          "Try one spot at a time. Imagine adding a square there.",
          "Fold the six squares in your head. Does each one land on a different face?",
          "A spot can look fine and still make two squares land on the same face. Test every spot.",
          `Choose ${list(yes.map((l) => `Spot ${l.toUpperCase()}`))}.`,
        ),
      ),
      reflectionStep(
        "How can you test whether a spot works?",
        "Fold up all six squares: each must land on a different face.",
        [
          "A spot works if the new square touches any of the squares.",
          "A spot works if it makes the whole pattern look balanced.",
        ],
        hints(
          "Think about folding the pattern up.",
          "Touching a square is not enough.",
          "Looking balanced is not a test either.",
          "Choose the explanation about folding and different faces.",
        ),
        yes.length + 1,
      ),
    ];
  }
  const solid = s.solid as SolidId;
  const facts = solidFacts(solid);
  const sides = facts.edges * 2;
  const name = SOLID_NAMES[solid];
  return [
    exactStep(
      "faces",
      "Count the faces",
      "How many flat faces does the solid made by this net have?",
      hints(
        "Each flat shape in the net becomes one face of the solid.",
        "Count the shapes drawn, one by one.",
        "Count every shape, triangles and rectangles alike.",
        `The net has ${facts.faces} shapes, so the solid has ${facts.faces} faces. Enter ${facts.faces}.`,
      ),
    ),
    choiceStep(
      "solid",
      "Name the solid",
      "Which solid does this net make when it is folded up?",
      choices(
        [solid, ...SOLID_DISTRACTORS[solid]].map((id) => ({
          label: `A ${SOLID_NAMES[id]}`,
          meaning: id,
        })),
        SOLID_IDS.indexOf(solid) + 1,
      ),
      hints(
        "Look at the kinds of shapes in the net.",
        "Count how many of each kind there are.",
        `This net has ${solidKinds(solid)}. Think about which solid has faces like that.`,
        `Choose the ${name}.`,
      ),
    ),
    exactStep(
      "edges",
      "Count the edges",
      "How many edges does the solid have? An edge is where two faces meet.",
      hints(
        "Each shape in the net has sides. Every edge of the solid is made from two sides that fold together.",
        "Count the sides of every shape and add them up.",
        `The shapes have ${sides} sides in all. Two sides make one edge, so work out ${sides} ÷ 2.`,
        `${sides} ÷ 2 = ${facts.edges}. Enter ${facts.edges}.`,
      ),
    ),
    exactStep(
      "vertices",
      "Count the vertices",
      "How many vertices does the solid have? A vertex is a corner where edges meet.",
      hints(
        "Picture the folded solid and the corners you could point to.",
        "Count the corners one at a time, so you do not count any twice.",
        `A check: the number of faces plus the number of vertices is 2 more than the number of edges. You found ${facts.faces} faces and ${facts.edges} edges.`,
        `The solid has ${facts.vertices} vertices. Enter ${facts.vertices}.`,
      ),
    ),
    reflectionStep(
      "How does a net become a solid?",
      "The flat shapes become the faces and fold along the joined edges.",
      [
        "The flat shapes become the edges of the solid when the net is folded.",
        "Every net folds into a cube, whatever flat shapes it is made from.",
      ],
      hints(
        "Think about opening up a box and pressing it flat.",
        "Each flat piece of the box was one side of it.",
        "A net can make many different solids, not only a cube.",
        "Choose the explanation about shapes becoming faces.",
      ),
      SOLID_IDS.indexOf(solid),
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateNetsSpec, (lesson, step) =>
    netsAnswer(lesson.specification as unknown as NetsSpec, step),
  );
const STORY: Record<NetsSpec["task"], string> = {
  check: "Four flat patterns of squares are labelled A to D.",
  opposite: "A net of six labelled squares will be folded into a cube.",
  solid: "A flat net will be folded up into a solid.",
  complete: "Five squares are joined, with four dashed spots for a sixth.",
  fold: "A net of six labelled squares can be folded on screen, one crease at a time.",
  collide:
    "This net of six labelled squares can be folded on screen, but it will not make a cube.",
  "fold-solid":
    "The net of a solid can be folded on screen, one crease at a time.",
};
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateNetsSpec(next.specification).length) return next;
  const s = next.specification as unknown as NetsSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story = STORY[s.task];
  return derive(next);
}

const DEFAULTS: Record<NetsSpec["task"], NetsSpec> = {
  check: {
    task: "check",
    nets: ["#..#/####", "..#./####/#...", "#####/#....", "##./##./.##"],
    asked: 0,
    face: "",
    solid: "",
  },
  opposite: {
    task: "opposite",
    nets: ["A.../BCDE/..F."],
    asked: 0,
    face: "C",
    solid: "",
  },
  solid: {
    task: "solid",
    nets: [],
    asked: 0,
    face: "",
    solid: "triangular-prism",
  },
  complete: {
    task: "complete",
    nets: [".#.b./####c/a.d.."],
    asked: 0,
    face: "",
    solid: "",
  },
  fold: {
    task: "fold",
    nets: ["AB../.CDE/...F", ".A../BCDE/.F.."],
    asked: 0,
    face: "C",
    solid: "",
    demoFace: "B",
    second: "A",
  },
  collide: {
    task: "collide",
    nets: ["ABC./..DE/...F", "ABCD/.E../.F.."],
    asked: 0,
    face: "C",
    solid: "",
    demoFace: "B",
  },
  "fold-solid": {
    task: "fold-solid",
    nets: [],
    asked: 0,
    face: "",
    solid: "square-pyramid",
    demoSolid: "cuboid",
  },
};
const TITLES: Record<NetsSpec["task"], string> = {
  check: "Will it fold into a cube?",
  opposite: "Which face is opposite?",
  solid: "What solid does this make?",
  complete: "Add the last square",
  fold: "Fold it and see",
  collide: "Folds that collide",
  "fold-solid": "Fold a solid",
};
const OBJECTIVES: Record<NetsSpec["task"], string> = {
  check:
    "Tell which flat patterns of squares fold into a cube, and say why another does not.",
  opposite:
    "Use a cube net to name the face opposite another face and the faces that touch it.",
  solid: "Name a solid from its net and count its faces, edges and vertices.",
  complete: "Find every place where a sixth square makes a net of a cube.",
  fold: "Fold a cube net on screen and name the face on top and the face opposite another face.",
  collide:
    "Fold a six-square net that does not make a cube and find the squares that land in the same place.",
  "fold-solid":
    "Fold the net of a solid on screen and name the solid it makes.",
};
function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported nets form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: NetsSpec = structuredClone(DEFAULTS[task]);
  const lesson = rewrite({
    id,
    version: 1,
    topic: "nets",
    title: TITLES[task],
    subtitle: "P4 nets revision",
    level: "P4 candidate",
    minutes: ["fold", "collide", "fold-solid"].includes(task) ? 8 : 7,
    objective: OBJECTIVES[task],
    story: STORY[task],
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  return p4Package({
    lesson,
    form,
    family: "nets",
    author: "claude-p4-nets",
    taskLabel: task,
    specErrors: validateNetsSpec,
    sources: [
      "https://practicle.sg/primary-4-math/",
      "https://www.thelearninglab.com.sg/blog/tll-shares/new-changes-to-moe-primary-maths-syllabus",
    ],
    extraTags: ["fold", "collide", "fold-solid"].includes(task)
      ? ["level-unconfirmed", "workbench"]
      : ["level-unconfirmed"],
  });
}

/* ---------------------------------------- author ---------------------------------------- */

const NET_HELP =
  "(# for a square, . for empty, rows joined by /; trim empty outer rows and columns)";
export const netsAuthor: AuthorTopic = {
  id: "nets",
  forms: [
    {
      id: "p4-cube-net-check",
      label: "Will it fold into a cube?",
      description:
        "Four flat patterns of squares: pick the one that folds and say why another does not.",
    },
    {
      id: "p4-cube-opposite-faces",
      label: "Opposite faces of a cube",
      description:
        "Fold a labelled net in your head and name opposite and touching faces.",
    },
    {
      id: "p4-solid-from-net",
      label: "What solid does this make?",
      description:
        "A drawn net of a cube, cuboid, triangular prism or square pyramid: count faces, edges and vertices. Cuboid nets are laid on a square grid only.",
    },
    {
      id: "p4-complete-the-net",
      label: "Complete the net",
      description:
        "Five squares and four dashed spots: choose every spot that makes a cube net.",
    },
    {
      id: "p4-fold-a-cube-net",
      label: "Fold it and see (hands-on)",
      description:
        "Fold a labelled cube net on screen: name the face on top and a pair of opposite faces. A different net is demonstrated first.",
    },
    {
      id: "p4-fold-a-net-that-fails",
      label: "Folds that collide (hands-on)",
      description:
        "Fold a six-square net that does not make a cube: find the two squares that meet and the open face.",
    },
    {
      id: "p4-fold-a-solid",
      label: "Fold a solid (hands-on)",
      description:
        "Fold the catalogue net of a cuboid, triangular prism or square pyramid on screen and name the solid. A different solid is demonstrated first.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as NetsSpec;
    const nets = Array.isArray(s.nets) ? s.nets : [];
    const text = (key: string, label: string, value: unknown): TopicField => ({
      key,
      label,
      type: "text",
      value: String(value ?? ""),
    });
    const load = (key: string, label: string): TopicField => ({
      key,
      label,
      type: "select",
      value: "",
      options: [
        { value: "", label: "Keep what is typed" },
        ...netMenu().map((m) => ({ value: m.id, label: m.label })),
      ],
    });
    const fields: TopicField[] = [];
    if (s.task === "check") {
      LETTERS.slice(0, 4).forEach((letter, i) => {
        fields.push(text(`net:${i}`, `Net ${letter} ${NET_HELP}`, nets[i]));
        fields.push(
          load(`load:${letter}`, `Load a ready-made net into Net ${letter}`),
        );
      });
      fields.push({
        key: "asked",
        label: "Which net does the why step ask about",
        type: "select",
        value: String(s.asked),
        options: LETTERS.slice(0, 4).map((l, i) => ({
          value: String(i),
          label: `Net ${l}`,
        })),
      });
    } else if (s.task === "opposite") {
      fields.push(
        text(
          "net:0",
          "Labelled net (letters A to F once each, rows joined by /, . for empty)",
          nets[0],
        ),
        load(
          "load:valid",
          "Load a ready-made net (letters go in reading order)",
        ),
        {
          key: "face",
          label: "Face asked about",
          type: "select",
          value: s.face,
          options: LETTERS.map((l) => ({ value: l, label: `Face ${l}` })),
        },
      );
    } else if (s.task === "fold" || s.task === "collide") {
      const letter = (key: string, label: string, value: unknown) => ({
        key,
        label,
        type: "select" as const,
        value: String(value ?? ""),
        options: LETTERS.map((l) => ({ value: l, label: `Face ${l}` })),
      });
      fields.push(
        text(
          "net:0",
          "Labelled net (letters A to F once each, rows joined by /, . for empty)",
          nets[0],
        ),
        text(
          "net:1",
          "Demonstration net shown in Watch (a different shape, letters A to F once each)",
          nets[1],
        ),
        letter("face", "Floor face of the learner's net", s.face),
        letter("demoFace", "Floor face of the demonstration net", s.demoFace),
      );
      if (s.task === "fold")
        fields.push(
          letter(
            "second",
            "Face whose opposite the second step asks",
            s.second,
          ),
        );
    } else if (s.task === "fold-solid") {
      const pick = (key: string, label: string, value: unknown) => ({
        key,
        label,
        type: "select" as const,
        value: String(value ?? ""),
        options: SOLID_IDS.map((id) => ({ value: id, label: SOLID_NAMES[id] })),
      });
      fields.push(
        pick("solid", "Solid", s.solid),
        pick(
          "demoSolid",
          "Solid folded in Watch (a different one)",
          s.demoSolid,
        ),
      );
    } else if (s.task === "complete")
      fields.push(
        text(
          "net:0",
          "Net with five # squares and the spots a, b, c and d (rows joined by /, . for empty)",
          nets[0],
        ),
      );
    else
      fields.push({
        key: "solid",
        label: "Solid",
        type: "select",
        value: s.solid,
        options: SOLID_IDS.map((id) => ({ value: id, label: SOLID_NAMES[id] })),
      });
    return fields;
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const spec = next.specification as unknown as NetsSpec;
    const text = String(value);
    const nets = Array.isArray(spec.nets) ? [...spec.nets] : [];
    const clean = (t: string) => normaliseNet(t.replace(/\s+/g, ""));
    const slot = /^net:(\d)$/.exec(key);
    if (slot) {
      nets[Number(slot[1])] = clean(text);
      spec.nets = nets;
    } else if (key.startsWith("load:")) {
      const entry = netMenu().find((m) => m.id === text);
      if (entry) {
        const at = key === "load:valid" ? 0 : LETTERS.indexOf(key.slice(5));
        nets[at] = key === "load:valid" ? labelNet(entry.net) : entry.net;
        spec.nets = nets;
      }
    } else if (key === "asked")
      (spec as unknown as Record<string, unknown>).asked = /^\d+$/.test(text)
        ? Number(text)
        : value;
    else if (key === "face") spec.face = text;
    else if (key === "demoFace") spec.demoFace = text;
    else if (key === "second") spec.second = text;
    else if (key === "demoSolid") spec.demoSolid = text;
    else if (key === "solid") spec.solid = text as SolidId;
    return next;
  },
  derive,
  rewrite,
  template,
};
