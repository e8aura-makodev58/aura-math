import type { Step } from "../core/types";
import { kindOfAngle, type AngleMeasureSpec } from "../topics/angle-measure";
import {
  choices,
  choiceStep,
  exactStep,
  hints,
  reflectionStep,
} from "../topics/p4-kit";

export function protractorSteps(s: AngleMeasureSpec): Step[] {
  const draw = s.task === "bench-draw";
  return [
    exactStep(
      draw ? "supplement" : "read",
      draw ? "Build, then reason" : "Line up and read",
      draw
        ? `Practise building a ${s.degrees}° angle. What is the size of the adjacent angle that completes a straight line? Construction is practice; your derived answer is checked.`
        : "Move the centre to the corner and turn the baseline onto either arm. Read the angle in degrees. Alignment is practice; your reading is checked. Open the list version to enter your number.",
      hints(
        "Find the corner and a side of the angle.",
        draw
          ? "Angles on a straight line add to 180 degrees."
          : "Read the scale that begins at zero on the arm you use.",
        "Use the alignment help to centre and turn the dial.",
        draw
          ? `The adjacent angle is 180 − ${s.degrees} = ${180 - s.degrees}°. Enter ${180 - s.degrees}.`
          : `The angle is ${s.degrees}°. Enter ${s.degrees}.`,
      ),
    ),
    choiceStep(
      "classify",
      "Compare with a right angle",
      "Is the original angle acute, right or obtuse? This question has no movable preview.",
      choices(
        [
          { label: "Acute: smaller than 90°", meaning: "acute" },
          { label: "Right angle: exactly 90°", meaning: "right" },
          { label: "Obtuse: between 90° and 180°", meaning: "obtuse" },
        ],
        s.degrees / 5,
      ),
      hints(
        "Use a right angle as a reference.",
        "A right angle is 90°.",
        `The original angle is ${s.degrees}°. Compare it with 90°.`,
        `Choose ${kindOfAngle(s.degrees)}.`,
      ),
    ),
    reflectionStep(
      "Why does the choice of zero matter?",
      "Start at zero on the arm you line up with, then measure to the other arm.",
      [
        "Always choose the larger of the two printed numbers on the dial for the angle.",
        "Use the same named scale for every pose, wherever the two arms happen to point.",
      ],
      hints(
        "Think about where the measured turn begins.",
        "The two scales run in opposite directions.",
        "Turning the dial may change which scale you use.",
        "Choose the explanation about starting at zero on the aligned arm.",
      ),
      s.degrees / 5 + 2,
    ),
  ];
}
