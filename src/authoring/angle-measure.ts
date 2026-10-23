import { protractorSteps } from "./protractor-bench";
import type { Lesson, Step } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
import type { AuthorTopic, TopicField } from "./topic-capability";
import {
  HEADINGS,
  HEADING_NAME,
  angleMeasureAnswer,
  estimateOptions,
  headingAfter,
  kindOfAngle,
  turnName,
  validateAngleMeasureSpec,
  type AngleMeasureSpec,
  type Heading,
} from "../topics/angle-measure";
import {
  choiceStep,
  choices,
  deriveAnswers,
  exactStep,
  hints,
  p4Package,
  reflectionStep,
} from "../topics/p4-kit";

const FORMS = [
  "p4-protractor-bench-read",
  "p4-protractor-bench-draw",
  "p4-read-protractor",
  "p4-estimate-then-measure",
  "p4-turns",
  "p4-angle-practice",
] as const;
const TASK_OF: Record<(typeof FORMS)[number], AngleMeasureSpec["task"]> = {
  "p4-protractor-bench-read": "bench-read",
  "p4-protractor-bench-draw": "bench-draw",
  "p4-read-protractor": "read",
  "p4-estimate-then-measure": "estimate",
  "p4-turns": "turns",
  "p4-angle-practice": "practice",
};
const nearestTen = (d: number) => Math.floor(d / 10) * 10;
const readHints = (s: AngleMeasureSpec): Step["hints"] =>
  hints(
    "Read where the second arm crosses the scale that starts at 0 on the base arm.",
    "Long marks are every 10 degrees and short marks are every 5 degrees. Count along from 0.",
    `The arm crosses just after ${nearestTen(s.degrees)}${s.degrees % 10 === 5 ? ", at the short mark halfway to the next long mark" : ", exactly on that long mark"}.`,
    `The angle is ${s.degrees} degrees. Enter ${s.degrees}.`,
  );

function steps(s: AngleMeasureSpec): Step[] {
  if (s.task === "bench-read" || s.task === "bench-draw")
    return protractorSteps(s);
  if (s.task === "read") {
    const end = s.flip ? "left" : "right";
    return [
      choiceStep(
        "scale",
        "Choose the scale",
        `The base arm of this angle lies along the ${end} end of the baseline. Which scale should you read?`,
        choices(
          [
            { label: "The outer scale", meaning: "outer" },
            { label: "The inner scale", meaning: "inner" },
            { label: "Either scale", meaning: "either" },
          ],
          s.degrees / 5,
        ),
        hints(
          "Find the 0 on each scale. One 0 is at the right end and the other is at the left end.",
          "Read the scale whose 0 is on the same end as the base arm.",
          `The base arm is on the ${end}, so use the scale that starts with 0 on the ${end}.`,
          `Choose the ${s.flip ? "inner" : "outer"} scale.`,
        ),
      ),
      exactStep(
        "read",
        "Read the angle",
        "What is the size of the angle in degrees? Enter the number.",
        readHints(s),
      ),
      choiceStep(
        "classify",
        "Name the angle",
        "Is the angle acute, a right angle or obtuse?",
        choices(
          [
            { label: "Acute: smaller than 90°", meaning: "acute" },
            { label: "Right angle: exactly 90°", meaning: "right" },
            {
              label: "Obtuse: between 90° and 180°",
              meaning: "obtuse",
            },
          ],
          s.degrees / 5 + 1,
        ),
        hints(
          "Compare with a right angle, which is exactly 90 degrees.",
          "Is your reading smaller than 90, equal to 90, or larger than 90?",
          `The angle is ${s.degrees}°, which is ${s.degrees < 90 ? "less than" : s.degrees === 90 ? "equal to" : "more than"} 90°.`,
          `Choose ${kindOfAngle(s.degrees)}.`,
        ),
      ),
      reflectionStep(
        "Why must you start reading from the 0 on the base arm?",
        "The angle opens from its base arm, so the count must start at 0 there.",
        [
          "Both scales count the same turn, so either one gives the right size.",
          "The angle is always the bigger of the two numbers printed on the scales.",
        ],
        hints(
          "Think about where the angle starts.",
          "An angle is measured from one arm to the other.",
          "The two scales give different numbers for the same arm.",
          "Choose the explanation about starting from 0 on the base arm.",
        ),
        s.degrees / 5 + 2,
      ),
    ];
  }
  if (s.task === "estimate") {
    const o = estimateOptions(s.degrees);
    return [
      choiceStep(
        "estimate",
        "Estimate first",
        "Before you measure, which is the best estimate for this angle?",
        choices(
          [
            { label: `About ${o.close}°`, meaning: "close" },
            { label: `About ${o.low}°`, meaning: "low" },
            { label: `About ${o.high}°`, meaning: "high" },
          ],
          s.degrees / 5,
        ),
        hints(
          "Compare the angle with a right angle, 90 degrees, and with half a right angle, 45 degrees.",
          "Is the angle smaller or larger than a right angle?",
          `The angle is ${s.degrees < 90 ? "smaller" : s.degrees === 90 ? "the same as" : "larger"} than a right angle, so some estimates are far too ${s.degrees < 90 ? "big" : "small"}.`,
          `Choose about ${o.close}°.`,
        ),
      ),
      exactStep(
        "read",
        "Now measure it",
        "Now measure the angle with the protractor. What is its size in degrees?",
        readHints(s),
      ),
      reflectionStep(
        "Why is it helpful to estimate before you measure?",
        "It helps you spot a reading that is far off, like one from the wrong scale.",
        [
          "A good estimate is close enough, so you can skip measuring the angle at all.",
          "It tells you the exact size, so the protractor reading must match it exactly.",
        ],
        hints(
          "Think about checking your answer.",
          "An estimate tells you roughly what to expect.",
          "If your reading is very different, something went wrong.",
          "Choose the explanation about noticing a reading that is far off.",
        ),
        s.degrees / 5 + 1,
      ),
    ];
  }
  if (s.task === "turns") {
    const after = headingAfter(s);
    const name = turnName(s.quarters);
    return [
      choiceStep(
        "fraction",
        "What fraction of a turn?",
        `The robot turns ${s.direction}, as the curved arrow shows. What fraction of a full turn is this?`,
        choices(
          [
            { label: "1/4 of a turn", meaning: "quarter" },
            { label: "1/2 of a turn", meaning: "half" },
            { label: "3/4 of a turn", meaning: "three-quarter" },
          ],
          s.quarters + HEADINGS.indexOf(s.from),
        ),
        hints(
          "A full turn goes all the way round the circle and back to the start.",
          "Look at how much of the circle the curved arrow covers.",
          "A quarter of the circle is one compass step, like north to east.",
          `Choose ${{ quarter: "1/4", half: "1/2", "three-quarter": "3/4" }[name]} of a turn.`,
        ),
      ),
      exactStep(
        "degrees",
        "How many degrees?",
        "A full turn is 360°. How many degrees is this turn? Enter the number.",
        hints(
          "A full turn is 360 degrees, and a quarter turn is one quarter of that.",
          "Work out 360 ÷ 4 for one quarter turn.",
          `One quarter turn is 90°. This turn is ${s.quarters} quarter turn${s.quarters === 1 ? "" : "s"}.`,
          `${s.quarters} × 90 = ${s.quarters * 90}. Enter ${s.quarters * 90}.`,
        ),
      ),
      choiceStep(
        "facing",
        "Where is it facing now?",
        "Which direction is the robot facing after the turn?",
        choices(
          HEADINGS.map((h) => ({
            label: HEADING_NAME[h][0].toUpperCase() + HEADING_NAME[h].slice(1),
            meaning: `heading:${h}`,
          })),
          HEADINGS.indexOf(s.from) + s.quarters,
        ),
        hints(
          "Start from the direction the robot faces now and follow the arrow.",
          `Turn ${s.direction} one quarter turn at a time: north, east, south, west go clockwise.`,
          `${s.quarters} quarter turn${s.quarters === 1 ? "" : "s"} ${s.direction} from ${HEADING_NAME[s.from]}.`,
          `The robot faces ${HEADING_NAME[after]}.`,
        ),
      ),
      reflectionStep(
        "How can you find the degrees in a part of a turn?",
        "Take that fraction of 360°: a quarter turn is 90° and a half turn is 180°.",
        [
          "Every part-turn is 90°, whether it is a quarter, a half or a three-quarter turn.",
          "Count every compass point that you pass as 45°, so a half turn is only 90°.",
        ],
        hints(
          "Start from the whole turn.",
          "A full turn is 360 degrees.",
          "Take a fraction of 360 for each part-turn.",
          "Choose the explanation that starts from 360 degrees.",
        ),
        s.quarters,
      ),
    ];
  }
  return [
    exactStep(
      "read",
      "Measure the angle",
      "Measure the angle with the protractor. What is its size in degrees?",
      readHints(s),
    ),
    reflectionStep(
      "How did you decide which scale to read?",
      "I read the scale that starts at 0 on the base arm of the angle.",
      [
        "I always read the outer scale, since it is the easier one to see.",
        "I read the bigger of the two numbers where the arm crosses.",
      ],
      hints(
        "Think about where the angle starts.",
        "The base arm lines up with one 0.",
        "Always using the same scale gives the wrong answer for some angles.",
        "Choose the explanation about the 0 on the base arm.",
      ),
      s.degrees / 5,
    ),
  ];
}

const derive = (l: Lesson) =>
  deriveAnswers(l, validateAngleMeasureSpec, (lesson, step) =>
    angleMeasureAnswer(
      lesson.specification as unknown as AngleMeasureSpec,
      step,
    ),
  );
function rewrite(lesson: Lesson): Lesson {
  const next = structuredClone(lesson);
  if (validateAngleMeasureSpec(next.specification).length) return next;
  const s = next.specification as unknown as AngleMeasureSpec;
  const old = next.steps.find((st) => st.goal === "reflection");
  next.steps = steps(s).map((st) =>
    st.goal === "reflection" && old ? old : st,
  );
  next.story =
    s.task === "turns"
      ? `A robot faces ${HEADING_NAME[s.from]} and turns ${s.direction}.`
      : s.task === "practice"
        ? next.steps[0].prompt
        : "An angle is drawn on a protractor.";
  return derive(next);
}

function template(form: string, id: string): LessonPackage {
  if (!(FORMS as readonly string[]).includes(form))
    throw new Error("Unsupported angle form");
  const task = TASK_OF[form as (typeof FORMS)[number]];
  const spec: AngleMeasureSpec = {
    task,
    degrees: {
      "bench-read": 65,
      "bench-draw": 115,
      read: 70,
      estimate: 130,
      turns: 90,
      practice: 125,
    }[task],
    flip: task === "practice",
    from: "N",
    direction: "clockwise",
    quarters: 3,
  };
  const lesson = rewrite({
    id,
    version: 1,
    topic: "angle-measure",
    title: {
      "bench-read": "Line it up, then read",
      "bench-draw": "Build an angle, then reason",
      read: "Read the protractor",
      estimate: "Estimate, then measure",
      turns: "Quarter, half and three-quarter turns",
      practice: "A fresh angle question",
    }[task],
    subtitle: "P4 angle revision",
    level: "P4 candidate",
    minutes: task === "practice" ? 3 : 7,
    objective: {
      "bench-read":
        "Practise aligning a protractor and assess the angle reading.",
      "bench-draw":
        "Practise constructing an angle and find its supplementary angle.",
      read: "Choose the right scale and read an angle in degrees.",
      estimate:
        "Estimate an angle by comparing it with 90 degrees, then measure it.",
      turns:
        "Connect quarter, half and three-quarter turns to degrees and directions.",
      practice: "Measure an angle with a protractor.",
    }[task],
    story: "Look at the picture.",
    reviewStatus: "draft",
    specification: spec as unknown as Record<string, unknown>,
    steps: steps(spec),
  });
  return p4Package({
    lesson,
    form,
    family: "angle-measure",
    author: task.startsWith("bench-")
      ? "codex-p4-protractor-bench"
      : "claude-p4-angle-measure",
    taskLabel: task,
    specErrors: validateAngleMeasureSpec,
    extraTags: task.startsWith("bench-")
      ? ["level-unconfirmed", "workbench"]
      : [],
  });
}

const sel = (
  key: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
): TopicField => ({ key, label, type: "select", value, options });
export const angleMeasureAuthor: AuthorTopic = {
  id: "angle-measure",
  forms: [
    {
      id: "p4-protractor-bench-read",
      label: "Hands-on protractor reading",
      description: "Move and turn the dial, then read the angle.",
    },
    {
      id: "p4-protractor-bench-draw",
      label: "Build and reason about an angle",
      description: "Construct a target angle and find its supplement.",
    },
    {
      id: "p4-read-protractor",
      label: "Read a protractor",
      description: "Choose the right scale, read the angle and name it.",
    },
    {
      id: "p4-estimate-then-measure",
      label: "Estimate, then measure",
      description: "Estimate an angle against 90 degrees, then measure it.",
    },
    {
      id: "p4-turns",
      label: "Quarter, half and three-quarter turns",
      description: "Link part-turns to degrees and compass directions.",
    },
    {
      id: "p4-angle-practice",
      label: "Angle practice",
      description: "One fresh protractor reading.",
    },
  ],
  fields: (l) => {
    const s = l.specification as unknown as AngleMeasureSpec;
    if (s.task === "turns")
      return [
        sel(
          "from",
          "Starts facing",
          s.from,
          HEADINGS.map((h) => ({
            value: h,
            label: HEADING_NAME[h as Heading],
          })),
        ),
        sel(
          "direction",
          "Turns",
          s.direction,
          ["clockwise", "anticlockwise"].map((v) => ({ value: v, label: v })),
        ),
        sel(
          "quarters",
          "Quarter turns",
          String(s.quarters),
          [1, 2, 3].map((n) => ({ value: String(n), label: turnName(n) })),
        ),
      ];
    return [
      {
        key: "degrees",
        label: "Angle in degrees (multiple of 5)",
        type: "number",
        value: s.degrees,
      },
      ...(s.task === "estimate"
        ? []
        : [
            sel("flip", "Base arm lies along the", s.flip ? "left" : "right", [
              { value: "right", label: "right end (read the outer scale)" },
              { value: "left", label: "left end (read the inner scale)" },
            ]),
          ]),
    ];
  },
  patch: (l, key, value) => {
    const next = structuredClone(l);
    const text = String(value);
    if (key === "degrees" || key === "quarters")
      next.specification[key] = /^\d+$/.test(text) ? Number(text) : value;
    else if (key === "flip") next.specification.flip = text === "left";
    else if (key === "from" || key === "direction")
      next.specification[key] = value;
    return next;
  },
  derive,
  rewrite,
  template,
};
