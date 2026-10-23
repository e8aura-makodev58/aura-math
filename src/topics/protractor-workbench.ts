import type { Lesson, Step } from "../core/types";
import type {
  WorkbenchFactory,
  WorkbenchIO,
  WorkbenchHandle,
} from "../workbench/types";
import { BenchChrome } from "../workbench/chrome";
import type { AngleMeasureSpec } from "./angle-measure";
import {
  alignedPose,
  moveDial,
  wrap,
  type DialPose,
  type AngleFigure,
} from "./protractor-model";

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (x: number, y: number, d: number, r: number) => [
  x + Math.cos(rad(d)) * r,
  y - Math.sin(rad(d)) * r,
];
function picture(f: AngleFigure, p: DialPose): string {
  const first = pt(f.x, f.y, f.first, 135),
    second = pt(f.x, f.y, f.first + f.turn, 135);
  let marks = "";
  for (let a = 0; a <= 180; a += 5) {
    const q = pt(0, 0, a, 105),
      t = pt(0, 0, a, a % 10 === 0 ? 94 : 99);
    marks += `<line x1="${q[0]}" y1="${q[1]}" x2="${t[0]}" y2="${t[1]}" stroke="#52627b"/>`;
    if (a % 30 === 0) {
      const o = pt(0, 0, a, 120),
        i = pt(0, 0, a, 79);
      marks += `<text x="${o[0]}" y="${o[1]}" text-anchor="middle" dominant-baseline="central">${a}</text><text x="${i[0]}" y="${i[1]}" text-anchor="middle" dominant-baseline="central">${180 - a}</text>`;
    }
  }
  return `<svg viewBox="0 0 400 400" aria-hidden="true" class="bench-dial-svg"><g stroke="#3f5aa8" stroke-width="4"><line x1="${f.x}" y1="${f.y}" x2="${first[0]}" y2="${first[1]}"/><line x1="${f.x}" y1="${f.y}" x2="${second[0]}" y2="${second[1]}"/></g><g transform="translate(${p.x} ${p.y}) rotate(${-p.rot})" font-size="20" fill="#243b31"><path d="M -105 0 A 105 105 0 0 1 105 0 Z" fill="#dfe8fb" fill-opacity=".45" stroke="#52627b" stroke-width="2"/>${marks}<path d="M -7 0 H 7 M 0 -7 V 7" stroke="#243b31" stroke-width="2"/></g><circle cx="${f.x}" cy="${f.y}" r="4" fill="#3f5aa8"/></svg>`;
}
export function protractorFactory(
  lesson: Lesson,
  step: Step,
): WorkbenchFactory {
  return (host, io) => mount(host, io, lesson, step);
}
function mount(
  host: HTMLElement,
  io: WorkbenchIO,
  lesson: Lesson,
  step: Step,
): WorkbenchHandle {
  const s = lesson.specification as unknown as AngleMeasureSpec;
  const draw = s.task === "bench-draw";
  const figure: AngleFigure = {
    x: 200,
    y: 225,
    first: s.flip ? 155 : 25,
    turn: (s.flip ? -1 : 1) * s.degrees,
  };
  const start: DialPose = { x: 225, y: 260, rot: 0 };
  let pose = { ...start },
    arm = draw ? 45 : s.degrees,
    frame = 0,
    ready = false,
    locked = false,
    dead = false;
  const demo: AngleFigure = {
    x: 200,
    y: 225,
    first: 35,
    turn: draw ? 75 : 105,
  };
  const chrome = new BenchChrome(host, {
    io,
    step,
    captions: [
      "Watch a different angle. Find its corner and one arm.",
      "Move the centre mark onto the corner.",
      "Turn the baseline onto an arm. Start at that arm's zero and read towards the other arm.",
    ],
    instruction: draw
      ? `Build ${s.degrees}° with the arm control, then answer the adjacent-angle question. Construction is practice.`
      : "Move and turn the dial using the handles or buttons. Either arm can be used. Enter your reading below.",
    showFrame(i) {
      frame = i;
      paint();
    },
    phaseChanged() {
      paint();
    },
    reset() {
      change({ ...start }, draw ? 45 : s.degrees);
    },
  });
  chrome.stage.dataset.testid = "bench-stage";
  chrome.stage.classList.add("bench-dial");
  const drawing = document.createElement("div");
  chrome.stage.append(drawing);
  const make = (label: string, mode: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bench-button";
    b.textContent = label;
    b.dataset.dial = mode;
    return b;
  };
  const move = make("Move dial", "move"),
    turn = make("Turn dial", "turn");
  const armGrip = draw ? make("Turn angle arm", "arm") : null;
  for (const b of armGrip ? [move, turn, armGrip] : [move, turn]) {
    b.classList.add("bench-grip");
    chrome.stage.append(b);
  }
  const controls = document.createElement("div");
  controls.className = "bench-row";
  for (const [label, mode] of [
    ["Move left", "left"],
    ["Move right", "right"],
    ["Move up", "up"],
    ["Move down", "down"],
    ["Turn left 5°", "ccw"],
    ["Turn right 5°", "cw"],
    ["Flip 180°", "flip"],
  ])
    controls.append(make(label, mode));
  const helper = make("Alignment help (hint 3)", "align");
  helper.hidden = true;
  controls.append(helper);
  const input = (label: string, min: string, max: string, value: string) => {
    const l = document.createElement("label");
    l.className = "bench-range";
    l.textContent = label;
    const r = document.createElement("input");
    r.type = "range";
    r.min = min;
    r.max = max;
    r.step = "1";
    r.value = value;
    l.append(r);
    chrome.tools.append(l);
    return r;
  };
  chrome.tools.append(controls);
  const rotation = input("Turn the dial", "0", "359", "0");
  const armRange = draw
    ? input("Turn the angle arm (construction practice)", "5", "175", "45")
    : null;
  const answerLabel = document.createElement("label");
  answerLabel.className = "bench-range";
  answerLabel.textContent = draw
    ? "Adjacent angle in degrees"
    : "Your angle reading in degrees";
  const answer = document.createElement("input");
  answer.type = "text";
  answer.inputMode = "numeric";
  answer.setAttribute("aria-label", answerLabel.textContent);
  answer.value = io.currentAnswer()[0] ?? "";
  answerLabel.append(answer);
  chrome.tools.append(answerLabel);
  const setAnswer = () => io.setAnswer(answer.value);
  answer.addEventListener("input", setAnswer);
  const note = document.createElement("p");
  note.className = "bench-note";
  note.textContent =
    "The two scales run in opposite directions. Small marks are 5° apart; printed numbers are 30° apart. The controls are practice aids; the app checks your submitted answer, not your movement history. Non-visual users can operate the controls, but the diagram reading still needs visual or adult support.";
  chrome.tools.append(note);
  function shownFigure() {
    return chrome.phase === "watch"
      ? demo
      : { ...figure, turn: (s.flip ? -1 : 1) * arm };
  }
  function paint() {
    if (!ready || dead) return;
    const watch = chrome.phase === "watch",
      f = shownFigure(),
      p = watch
        ? frame === 0
          ? start
          : frame === 1
            ? { ...start, x: f.x, y: f.y }
            : alignedPose(f)
        : pose;
    drawing.innerHTML = picture(f, p);
    chrome.stage.dataset.pose = JSON.stringify(p);
    chrome.stage.dataset.arm = String(Math.abs(f.turn));
    for (const [b, x, y] of [
      [move, p.x - 35, p.y + 35],
      [turn, p.x + 55, p.y + 35],
    ] as const) {
      b.hidden = watch;
      b.style.left = `${Math.max(7, Math.min(93, x / 4))}%`;
      b.style.top = `${Math.max(7, Math.min(93, y / 4))}%`;
      b.disabled = locked;
    }
    if (armGrip) {
      const tip = pt(
        figure.x,
        figure.y,
        figure.first + (s.flip ? -arm : arm),
        150,
      );
      armGrip.hidden = watch;
      armGrip.disabled = locked;
      armGrip.style.left = `${Math.max(7, Math.min(93, tip[0] / 4))}%`;
      armGrip.style.top = `${Math.max(7, Math.min(93, tip[1] / 4))}%`;
    }
    rotation.value = String(pose.rot);
    rotation.setAttribute(
      "aria-valuetext",
      `Dial rotation ${pose.rot} degrees`,
    );
    rotation.disabled = locked;
    answer.disabled = locked || io.presentation() !== "trial";
    if (armRange) {
      armRange.value = String(arm);
      armRange.disabled = locked;
    }
    for (const b of controls.querySelectorAll("button")) b.disabled = locked;
  }
  function change(next: DialPose, nextArm = arm, record = true) {
    if (locked || dead) return;
    const previous = { ...pose },
      oldArm = arm;
    if (JSON.stringify(next) === JSON.stringify(pose) && nextArm === arm)
      return;
    if (record)
      chrome.record(() => {
        pose = previous;
        arm = oldArm;
        paint();
      });
    pose = next;
    arm = nextArm;
    paint();
    chrome.announce("Position changed.");
  }
  const click = (e: Event) => {
    const mode = (e.target as HTMLElement).closest<HTMLElement>("[data-dial]")
      ?.dataset.dial;
    if (!mode) return;
    const delta: Record<string, [number, number, number]> = {
      left: [-5, 0, 0],
      right: [5, 0, 0],
      up: [0, -5, 0],
      down: [0, 5, 0],
      ccw: [0, 0, 5],
      cw: [0, 0, -5],
      flip: [0, 0, 180],
    };
    if (mode === "align" && !helper.hidden) change(alignedPose(shownFigure()));
    else if (delta[mode]) change(moveDial(pose, ...delta[mode]));
  };
  const key = (e: KeyboardEvent) => {
    const b = e.target as HTMLElement;
    if (!b.classList.contains("bench-grip") || !e.key.startsWith("Arrow"))
      return;
    e.preventDefault();
    const n = e.shiftKey ? 5 : 1;
    if (b === armGrip)
      change(
        pose,
        Math.max(
          5,
          Math.min(
            175,
            arm + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? n : -n),
          ),
        ),
      );
    else if (b === turn)
      change(
        moveDial(
          pose,
          0,
          0,
          e.key === "ArrowLeft" || e.key === "ArrowUp" ? n : -n,
        ),
      );
    else
      change(
        moveDial(
          pose,
          e.key === "ArrowLeft" ? -n : e.key === "ArrowRight" ? n : 0,
          e.key === "ArrowUp" ? -n : e.key === "ArrowDown" ? n : 0,
        ),
      );
  };
  const rotate = () => change({ ...pose, rot: Number(rotation.value) }),
    setArm = () => change(pose, Number(armRange!.value));
  let drag: {
    id: number;
    mode: string;
    x: number;
    y: number;
    pose: DialPose;
    arm: number;
  } | null = null;
  const down = (e: PointerEvent) => {
    const b = e.target as HTMLElement;
    if (locked || drag || !b.classList.contains("bench-grip")) return;
    drag = {
      id: e.pointerId,
      mode: b.dataset.dial!,
      x: e.clientX,
      y: e.clientY,
      pose: { ...pose },
      arm,
    };
    const initial = { ...pose },
      initialArm = arm;
    chrome.record(() => {
      pose = initial;
      arm = initialArm;
      paint();
    });
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  };
  const pointer = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const box = chrome.stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    if (drag.mode === "move")
      change(
        moveDial(
          drag.pose,
          ((e.clientX - drag.x) * 400) / box.width,
          ((e.clientY - drag.y) * 400) / box.height,
        ),
        arm,
        false,
      );
    else if (drag.mode === "arm") {
      const x = box.left + (figure.x * box.width) / 400,
        y = box.top + (figure.y * box.height) / 400;
      const direction =
        (Math.atan2(y - e.clientY, e.clientX - x) * 180) / Math.PI;
      const angle = s.flip
        ? wrap(figure.first - direction)
        : wrap(direction - figure.first);
      change(pose, Math.max(5, Math.min(175, Math.round(angle))), false);
    } else {
      const centreX = box.left + (pose.x * box.width) / 400,
        centreY = box.top + (pose.y * box.height) / 400;
      change(
        {
          ...pose,
          rot: wrap(
            Math.round(
              (Math.atan2(centreY - e.clientY, e.clientX - centreX) * 180) /
                Math.PI,
            ),
          ),
        },
        arm,
        false,
      );
    }
  };
  const up = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) drag = null;
  };
  const listeners: [string, EventListener][] = [
    ["click", click],
    ["keydown", key as EventListener],
    ["pointerdown", down as EventListener],
    ["pointermove", pointer as EventListener],
    ["pointerup", up as EventListener],
    ["pointercancel", up as EventListener],
    ["lostpointercapture", up as EventListener],
  ];
  for (const [type, fn] of listeners) chrome.root.addEventListener(type, fn);
  rotation.addEventListener("input", rotate);
  armRange?.addEventListener("input", setArm);
  ready = true;
  paint();
  return {
    hint(rung) {
      helper.hidden = rung < 3;
      if (rung === 4 && io.presentation() === "trial") {
        chrome.setPhase("try");
        change(alignedPose(figure), s.degrees);
      }
      paint();
    },
    lock(value) {
      locked = value;
      chrome.lock(value);
      paint();
    },
    answerChanged(ids) {
      answer.value = ids[0] ?? "";
    },
    destroy() {
      if (dead) return;
      dead = true;
      drag = null;
      for (const [type, fn] of listeners)
        chrome.root.removeEventListener(type, fn);
      answer.removeEventListener("input", setAnswer);
      rotation.removeEventListener("input", rotate);
      armRange?.removeEventListener("input", setArm);
      chrome.destroy();
    },
  };
}
