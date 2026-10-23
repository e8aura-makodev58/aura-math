import type { Lesson, Step } from "../core/types";
import type {
  WorkbenchFactory,
  WorkbenchIO,
  WorkbenchHandle,
} from "../workbench/types";
import { BenchChrome } from "../workbench/chrome";
import {
  shapePoints,
  candidateLines,
  mirrorCell,
  type Pt,
  type SymmetrySpec,
} from "./symmetry";

/** Reflect through the infinite line a→b, with no shape or answer knowledge. */
export function reflectPoint(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  if (!length) throw new Error("A mirror needs two different points");
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length;
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
}
export function symmetryFactory(lesson: Lesson, step: Step): WorkbenchFactory {
  return (host, io) => mount(host, io, lesson, step);
}
function mount(
  host: HTMLElement,
  io: WorkbenchIO,
  lesson: Lesson,
  step: Step,
): WorkbenchHandle {
  const s = lesson.specification as unknown as SymmetrySpec,
    shade = s.task === "shade";
  let ready = false,
    dead = false,
    locked = false,
    rung = io.hintRung(),
    watch = 0;
  const demoShape =
    s.shape === "isosceles-triangle" ? "kite" : "isosceles-triangle";
  const demoCells =
    s.mirror === "vertical" ? ["0,0", "1,1", "2,0"] : ["0,0", "1,1", "0,2"];
  const chrome = new BenchChrome(host, {
    io,
    step,
    captions: shade
      ? [
          "Watch a different pattern. The given squares are on one side of the mirror.",
          "Each matching square goes the same distance across the mirror, in the same row.",
          "Complete the matching half. Your turn uses a different pattern.",
        ]
      : [
          "Watch a different shape. Imagine folding it along a line.",
          "Place the mirror through the matching halves.",
          "A reflection keeps corresponding points equally far from the mirror.",
        ],
    instruction: shade
      ? "Tap squares on the far half to shade them; tap again to clear. Arrow keys move between squares. The hint preview is off until hint 2."
      : "Use the line buttons to move the mirror. Choose the line that makes the two halves match. The hint preview is off until hint 2.",
    showFrame(i) {
      watch = i;
      paint();
    },
    phaseChanged() {
      paint();
    },
    reset() {
      const before = io.currentAnswer();
      if (io.setAnswer(shade ? [] : null)) {
        chrome.record(() => {
          io.setAnswer(shade ? before : (before[0] ?? null));
          chrome.sync(before);
          paint();
        });
        chrome.sync([]);
        paint();
      }
    },
  });
  chrome.stage.dataset.testid = "bench-stage";
  chrome.stage.classList.add(
    shade ? "bench-shade-stage" : "bench-mirror-stage",
  );
  const picture = document.createElement("div");
  picture.className = "bench-mirror-picture";
  chrome.stage.append(picture);
  const grid = document.createElement("div");
  grid.className = "bench-cell-grid";
  grid.style.gridTemplateColumns = `repeat(${s.cols},minmax(0,1fr))`;
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Mirror picture grid");
  if (shade) chrome.stage.append(grid);
  const cellButtons: HTMLButtonElement[] = [];
  if (shade) {
    for (let r = 0; r < s.rows; r++)
      for (let c = 0; c < s.cols; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bench-cell";
        b.dataset.cell = `${r},${c}`;
        b.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
        grid.append(b);
        cellButtons.push(b);
      }
    chrome.root.querySelector<HTMLElement>(".bench-answer")!.hidden = true;
  }
  const note = document.createElement("p");
  note.className = "bench-note";
  note.textContent = shade
    ? "The given half stays fixed. The optional hint outline reflects your selections; it does not mark correctness. Small grid squares also have full-size controls in the list version below. These are practice aids, not proof of independent understanding."
    : "The mirror choices are bounded lines shown on the figure. The optional hint outline is support, not an independent assessment. Non-visual learners can use the labelled list; visual matching may require adult support.";
  chrome.tools.append(note);
  function paint() {
    if (!ready || dead) return;
    const isWatch = chrome.phase === "watch",
      ids = io.currentAnswer();
    chrome.stage.dataset.preview = String(!isWatch && rung >= 2);
    chrome.stage.dataset.frame = String(watch);
    if (shade) {
      picture.hidden = true;
      const given = new Set(isWatch ? demoCells : s.cells);
      const selected =
        isWatch && watch >= 1
          ? new Set(
              demoCells.map((t) => {
                const [r, c] = t.split(",").map(Number);
                return mirrorCell(s, r, c).join(",");
              }),
            )
          : new Set(
              ids.map((id) =>
                step.choices
                  ?.find((c) => c.id === id)
                  ?.meaning?.replace("cell:", ""),
              ),
            );
      const ghost = new Set(
        !isWatch && rung >= 2
          ? [...selected].map((t) => {
              const [r, c] = t!.split(",").map(Number);
              return mirrorCell(s, r, c).join(",");
            })
          : [],
      );
      for (const b of cellButtons) {
        const text = b.dataset.cell!,
          [r, c] = text.split(",").map(Number),
          first = s.mirror === "vertical" ? c < s.cols / 2 : r < s.rows / 2;
        b.disabled =
          isWatch || locked || first || io.presentation() !== "trial";
        b.dataset.given = String(given.has(text));
        b.dataset.shaded = String(selected.has(text));
        b.dataset.ghost = String(ghost.has(text));
        b.dataset.mirror =
          s.mirror === "vertical" && c === s.cols / 2 - 1
            ? "right"
            : s.mirror === "horizontal" && r === s.rows / 2 - 1
              ? "bottom"
              : "";
        b.setAttribute(
          "aria-pressed",
          String(given.has(text) || selected.has(text)),
        );
        b.setAttribute(
          "aria-label",
          `Row ${r + 1}, column ${c + 1}${given.has(text) ? ", given shaded square" : ""}${first ? ", given half" : ""}`,
        );
        b.textContent = given.has(text) || selected.has(text) ? "●" : "";
      }
    } else {
      const shape = isWatch ? demoShape : s.shape,
        points = shapePoints(shape, isWatch ? 0 : s.rotation),
        lines = candidateLines(shape, isWatch ? 0 : s.rotation);
      const choice = step.choices?.find((c) => ids.includes(c.id)),
        selected = isWatch
          ? watch >= 1
            ? lines.find((c) => c.symmetric)
            : lines.find((c) => !c.symmetric)
          : lines.find((c) => choice?.meaning === `line:${c.id}`);
      const X = (x: number) => 65 + x * 19,
        Y = (y: number) => 325 - y * 19;
      const polygon = points.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
      let body = `<polygon points="${polygon}" fill="#f6e4ee" stroke="#8a3a68" stroke-width="3"/>`;
      for (const c of lines) {
        const active = selected?.id === c.id;
        body += `<line x1="${X(c.a[0])}" y1="${Y(c.a[1])}" x2="${X(c.b[0])}" y2="${Y(c.b[1])}" stroke="${active ? "#8a3a68" : "#526259"}" stroke-width="${active ? 4 : 1}" stroke-dasharray="8 5"/><text x="${X(c.b[0]) + 10}" y="${Y(c.b[1]) - 5}" font-size="20" fill="#243b31">${c.id}</text>`;
      }
      if (selected && ((isWatch && watch >= 1) || (!isWatch && rung >= 2))) {
        const reflected = points.map((p) =>
          reflectPoint(p, selected.a, selected.b),
        );
        body += `<polygon data-ghost="true" points="${reflected.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="none" stroke="#3f5aa8" stroke-width="3" stroke-dasharray="5 4"/>`;
      }
      picture.innerHTML = `<svg viewBox="0 0 400 400" aria-hidden="true">${body}</svg>`;
    }
    chrome.sync(ids);
  }
  const click = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-cell]",
    );
    if (b && !b.disabled) {
      const choice = step.choices?.find(
        (c) => c.meaning === `cell:${b.dataset.cell}`,
      );
      if (choice) chrome.choose(choice.id);
    }
    paint();
  };
  const key = (e: KeyboardEvent) => {
    const b = e.target as HTMLButtonElement,
      index = cellButtons.indexOf(b);
    if (index < 0 || !e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const direction =
      e.key === "ArrowLeft"
        ? -1
        : e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowUp"
            ? -s.cols
            : s.cols;
    let next = index + direction;
    while (next >= 0 && next < cellButtons.length) {
      if (!cellButtons[next].disabled) {
        cellButtons[next].focus();
        break;
      }
      next += direction;
    }
  };
  chrome.root.addEventListener("click", click);
  grid.addEventListener("keydown", key);
  ready = true;
  paint();
  return {
    hint(value) {
      rung = value;
      if (value === 4 && io.presentation() === "trial") {
        chrome.setPhase("try");
        io.setAnswer(
          Array.isArray(step.answer) ? step.answer : String(step.answer),
        );
        chrome.sync(io.currentAnswer());
      }
      paint();
    },
    lock(value) {
      locked = value;
      chrome.lock(value);
      paint();
    },
    answerChanged() {
      paint();
    },
    destroy() {
      if (dead) return;
      dead = true;
      chrome.root.removeEventListener("click", click);
      grid.removeEventListener("keydown", key);
      chrome.destroy();
    },
  };
}
