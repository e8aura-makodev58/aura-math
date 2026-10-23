import type { Step } from "../core/types";
import {
  axisCount,
  candidateLines,
  matchOptions,
  type SymmetrySpec,
} from "../topics/symmetry";
import {
  choices,
  choiceStep,
  exactStep,
  multiStep,
  hints,
  reflectionStep,
} from "../topics/p4-kit";

export function symmetryBenchSteps(s: SymmetrySpec): Step[] {
  const place = s.task === "place";
  const first = place
    ? choiceStep(
        "place",
        "Place the mirror",
        "Choose a line to move the mirror. Which line reflects the shape onto itself? Undo and the optional hint preview are practice aids.",
        choices(
          candidateLines(s.shape).map((c) => ({
            label: `Line ${c.id}: ${c.words}`,
            meaning: `line:${c.id}`,
          })),
          2,
          true,
        ),
        hints(
          "Imagine folding the shape along the line.",
          "The hint preview shows a reflected outline; compare it by eye.",
          "Try the line through the matching left and right halves.",
          `Choose line ${candidateLines(s.shape).find((c) => c.symmetric)!.id}.`,
        ),
      )
    : multiStep(
        "shade",
        "Shade the far half",
        "Tap every square needed on the other side of the mirror. Tap again to clear. The preview is available through hints; it does not mark mistakes.",
        choices(
          Array.from({ length: s.rows * s.cols }, (_, i) => [
            Math.floor(i / s.cols),
            i % s.cols,
          ])
            .filter(([r, c]) =>
              s.mirror === "vertical" ? c >= s.cols / 2 : r >= s.rows / 2,
            )
            .map(([r, c]) => ({
              label: `Row ${r + 1}, column ${c + 1}`,
              meaning: `cell:${r},${c}`,
            })),
          3,
          true,
        ),
        hints(
          "Match the distance of each square from the mirror.",
          "The hint preview reflects your selections back onto the given side.",
          "A reflected square stays in the same row for a vertical mirror, or the same column for a horizontal mirror.",
          "The worked step shades every required reflected square.",
        ),
      );
  const transfer = place
    ? exactStep(
        "count",
        "Another way to check",
        "Without the preview, how many lines of symmetry does this shape have altogether?",
        hints(
          "Imagine each possible fold.",
          "Only exact matches count.",
          "Do not count a line twice.",
          `Enter ${axisCount(s.shape)}.`,
        ),
      )
    : choiceStep(
        "transfer",
        "Match a new square",
        "The movable preview is off. Which labelled square matches X across the mirror?",
        choices(
          matchOptions(s).map((o) => ({
            label: `Square ${o.id}`,
            meaning: o.meaning,
          })),
          s.cells.length,
        ),
        hints(
          "Find the marked square X.",
          "Keep the same distance from the mirror.",
          "Check its row or column as well as its distance.",
          `Choose square ${matchOptions(s).find((o) => o.meaning === "mirror")!.id}.`,
        ),
      );
  return [
    first,
    transfer,
    reflectionStep(
      "What must a reflection preserve?",
      "Matching points are the same distance from the mirror, on opposite sides.",
      [
        "Every point moves one square to the right, so the shape keeps its look.",
        "Any line through the middle of a shape makes a mirror image of it.",
      ],
      hints(
        "Look at matching points.",
        "The mirror lies between each matching pair.",
        "Both points are the same distance from it.",
        "Choose the explanation about equal distances on opposite sides.",
      ),
      s.cells.length,
    ),
  ];
}
