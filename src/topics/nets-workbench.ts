/**
 * The hands-on net folder for the `fold` and `collide` nets tasks (lazily loaded chunk with
 * three.js). Watch folds a different demonstration net; Your turn folds the learner's net with one
 * button per crease. Answers are chosen with buttons that drive the existing answer controls; the
 * judged answer never depends on the picture.
 */
import type { Lesson, Step } from "../core/types";
import { BenchChrome } from "../workbench/chrome";
import type {
  WorkbenchFactory,
  WorkbenchHandle,
  WorkbenchIO,
} from "../workbench/types";
import {
  demoScript,
  foldReducer,
  foldedCount,
  isFolded,
  netFoldModel,
  solidFoldModel,
  solidScript,
  type FoldModel,
  type FoldMove,
  type FoldState,
} from "./nets-bench";
import { DEFAULT_VIEW, NetViewport } from "./nets-viewport";
import type { NetsSpec, SolidId } from "./nets";

const INSTRUCTION: Record<string, string> = {
  "fold-top":
    "Your turn: fold your net with the crease buttons, turn the view, then choose your answer.",
  "fold-opposite":
    "Your turn: fold your net, find the face across the cube, then choose your answer.",
  collide:
    "Your turn: fold every crease of your net and look for two squares in the same place.",
  missing:
    "Your turn: fold your net and look all round it for the face with no square.",
  "fold-name":
    "Your turn: fold the net with the crease buttons, turn the view, then name the solid.",
};
const SVG_NS = "http://www.w3.org/2000/svg";

/** Flat picture of the net with crease numbers: the still shown when WebGL is unavailable. */
function flatSvg(model: FoldModel): SVGSVGElement {
  const all = model.polys.flat();
  const x0 = Math.min(...all.map((p) => p[0])),
    x1 = Math.max(...all.map((p) => p[0])),
    y0 = Math.min(...all.map((p) => p[1])),
    y1 = Math.max(...all.map((p) => p[1]));
  const unit = 48,
    pad = 16;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute(
    "viewBox",
    `0 0 ${(x1 - x0) * unit + 2 * pad} ${(y1 - y0) * unit + 2 * pad}`,
  );
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("bench-flat");
  const X = (x: number) => pad + (x - x0) * unit,
    Y = (y: number) => pad + (y1 - y) * unit;
  let body = "";
  model.polys.forEach((poly, f) => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length,
      cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    body += `<polygon points="${poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="#cfe9e2" stroke="#1b6b5c" stroke-width="2"/><text x="${X(cx)}" y="${Y(cy)}" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="#143f36">${model.labels[f]}</text>`;
  });
  model.hinges.forEach((h, i) => {
    const mx = (h.a[0] + h.b[0]) / 2,
      my = (h.a[1] + h.b[1]) / 2;
    body += `<circle cx="${X(mx)}" cy="${Y(my)}" r="11" fill="#fffdf8" stroke="#1b6b5c" stroke-width="2"/><text x="${X(mx)}" y="${Y(my)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#143f36">${i + 1}</text>`;
  });
  svg.innerHTML = body;
  return svg;
}

export function mountNetsBench(
  host: HTMLElement,
  io: WorkbenchIO,
  lesson: Lesson,
  step: Step,
): WorkbenchHandle {
  const spec = lesson.specification as unknown as NetsSpec;
  const goal = step.goal ?? step.id;
  const solid = spec.task === "fold-solid";
  const learner = solid
    ? solidFoldModel(spec.solid as SolidId, spec.rotation)!
    : netFoldModel(spec.nets[0], spec.face)!;
  const demo = solid
    ? solidFoldModel(spec.demoSolid as SolidId)!
    : netFoldModel(spec.nets[1], spec.demoFace ?? "")!;
  const frames = solid
    ? solidScript(spec.demoSolid as SolidId)
    : demoScript(goal, spec.nets[1], spec.demoFace ?? "");
  let state: FoldState = 0;
  let viewport: NetViewport | null = null;
  const badges: HTMLSpanElement[] = [];
  const creaseButtons: HTMLButtonElement[] = [];
  const turns = (model: FoldModel, s: FoldState) =>
    model.hinges.map((h, i) => (isFolded(s, i) ? h.max : 0));
  const animate = () => !chrome.reducedMotion;
  let ready = false;

  const chrome: BenchChrome = new BenchChrome(host, {
    io,
    step,
    captions: frames.map((f) => f.caption),
    instruction: INSTRUCTION[goal] ?? INSTRUCTION["fold-top"],
    showFrame(index, smooth) {
      viewport?.setTarget("demo", turns(demo, frames[index].state), smooth);
      paint();
    },
    phaseChanged(phase) {
      viewport?.show(phase === "watch" ? "demo" : "learner");
      paint();
    },
    reset() {
      setFold({ type: "unfold-all" }, true);
    },
  });
  const stage = chrome.stage;
  stage.dataset.testid = "bench-stage";
  const fallback = document.createElement("div");
  fallback.className = "bench-fallback";
  fallback.hidden = true;
  const fallbackText = document.createElement("p");
  fallback.append(fallbackText);
  const showFallback = (reason: "none" | "lost" | "ok") => {
    stage.dataset.renderer = reason === "ok" ? "webgl" : "fallback";
    fallback.hidden = reason === "ok";
    if (reason === "none") {
      fallback.prepend(flatSvg(learner));
      fallbackText.textContent =
        "The 3D view is not available on this device. This is your flat net with its creases numbered. The crease buttons still fold it, and the folded creases are listed here.";
    } else if (reason === "lost")
      fallbackText.textContent =
        "The 3D view stopped, so a still picture is shown. The buttons still work.";
  };
  try {
    viewport = new NetViewport(stage, (lost) =>
      showFallback(lost ? "lost" : "ok"),
    );
    viewport.addModel("learner", learner);
    viewport.addModel("demo", demo);
    viewport.show("demo");
    stage.dataset.renderer = "webgl";
  } catch {
    viewport = null;
    showFallback("none");
  }
  stage.append(fallback);
  const status = document.createElement("p");
  status.className = "bench-state";
  if (!viewport) chrome.tools.before(status);

  // crease number badges follow the creases on screen (decoration; the buttons are the controls)
  const badgeLayer = document.createElement("div");
  badgeLayer.className = "bench-badges";
  badgeLayer.setAttribute("aria-hidden", "true");
  if (viewport) stage.append(badgeLayer);
  const placeBadges = () => {
    if (!viewport) return;
    const model = learner;
    model.hinges.forEach((_, i) => {
      let badge = badges[i];
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "bench-badge";
        badge.textContent = String(i + 1);
        badges[i] = badge;
        badgeLayer.append(badge);
      }
      const at = viewport!.creaseScreen(i);
      // numbers mark the creases still flat in Your turn; folded ones are shown by the buttons
      badge.hidden = !at || chrome.phase === "watch" || isFolded(state, i);
      if (at) {
        badge.style.left = `${at.x}px`;
        badge.style.top = `${at.y}px`;
      }
    });
    for (let i = model.hinges.length; i < badges.length; i++)
      badges[i].hidden = true;
  };
  if (viewport)
    viewport.onFrame = () => {
      // test hook: the crease turns drawn in the last frame (radians, 3 places)
      stage.dataset.shown = viewport!
        .angles(chrome.phase === "watch" ? "demo" : "learner")
        .map((a) => a.toFixed(3))
        .join(",");
      placeBadges();
    };

  // crease buttons, fold all and unfold all
  const creaseList = document.createElement("ol");
  creaseList.className = "bench-creases";
  creaseList.setAttribute("aria-label", "Creases");
  learner.hinges.forEach((h, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bench-crease";
    b.dataset.crease = String(i);
    b.textContent = `Crease ${i + 1}: ${learner.labels[h.parent]} and ${learner.labels[h.child]}`;
    b.setAttribute("aria-pressed", "false");
    creaseButtons.push(b);
    li.append(b);
    creaseList.append(li);
  });
  const allRow = document.createElement("div");
  allRow.className = "bench-row";
  const mk = (label: string, data: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bench-button";
    b.dataset.fold = data;
    b.textContent = label;
    return b;
  };
  allRow.append(mk("Fold all", "all"), mk("Unfold all", "none"));
  chrome.tools.append(creaseList, allRow);

  // view buttons
  const viewButtons: [string, string, number, number][] = [
    ["Turn left", "left", -15, 0],
    ["Turn right", "right", 15, 0],
    ["Tilt up", "up", 0, -15],
    ["Tilt down", "down", 0, 15],
  ];
  for (const [label, key] of viewButtons) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bench-button";
    b.dataset.view = key;
    b.textContent = label;
    b.disabled = !viewport;
    chrome.view.append(b);
  }
  const resetView = document.createElement("button");
  resetView.type = "button";
  resetView.className = "bench-button";
  resetView.dataset.view = "reset";
  resetView.textContent = "Reset view";
  resetView.disabled = !viewport;
  chrome.view.append(resetView);

  function paint() {
    if (!ready) return;
    for (const [i, b] of creaseButtons.entries())
      b.setAttribute("aria-pressed", String(isFolded(state, i)));
    stage.dataset.fold = String(state);
    stage.dataset.phase = chrome.phase;
    const folded = learner.hinges
      .map((_, i) => i)
      .filter((i) => isFolded(state, i))
      .map((i) => i + 1);
    status.textContent = folded.length
      ? `Folded creases: ${folded.join(", ")}.`
      : "No creases folded.";
    viewport?.requestRender();
  }
  function setFold(move: FoldMove, record: boolean, text?: string) {
    const before = state;
    const result = foldReducer(learner, state, move);
    if (result.rejected || result.state === before) return;
    state = result.state;
    if (record)
      chrome.record(() => {
        state = before;
        viewport?.setTarget("learner", turns(learner, state), animate());
        paint();
      });
    viewport?.setTarget(
      "learner",
      turns(learner, state),
      animate(),
      move.type === "toggle" ? 450 : 800,
    );
    chrome.announce(
      text ??
        `${foldedCount(state)} of ${learner.hinges.length} creases folded.`,
    );
    paint();
  }

  const click = (event: MouseEvent) => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button",
    );
    if (!b || !chrome.root.contains(b)) return;
    if (b.dataset.crease !== undefined) {
      const i = Number(b.dataset.crease);
      setFold(
        { type: "toggle", crease: i },
        true,
        `Crease ${i + 1} ${isFolded(state, i) ? "unfolded" : "folded"}. ${foldedCount(state ^ (1 << i))} of ${learner.hinges.length} creases folded.`,
      );
    } else if (b.dataset.fold === "all")
      setFold({ type: "fold-all" }, true, "Every crease folded.");
    else if (b.dataset.fold === "none")
      setFold({ type: "unfold-all" }, true, "Every crease unfolded.");
    else if (b.dataset.view && viewport) {
      const v = viewport.view;
      const entry = viewButtons.find((x) => x[1] === b.dataset.view);
      viewport.setView(
        entry
          ? { yaw: v.yaw + entry[2], pitch: v.pitch + entry[3] }
          : { ...DEFAULT_VIEW },
      );
      chrome.announce("View turned.");
    }
  };
  chrome.root.addEventListener("click", click);

  // optional drag to turn the view, on the canvas only (touch-action: none there, not the page)
  let drag: {
    id: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null = null;
  const canvas = viewport?.canvas;
  const down = (e: PointerEvent) => {
    if (drag || !viewport) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      yaw: viewport.view.yaw,
      pitch: viewport.view.pitch,
    };
    try {
      canvas!.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || !viewport) return;
    viewport.setView({
      yaw: drag.yaw - (e.clientX - drag.x) * 0.5,
      pitch: drag.pitch - (e.clientY - drag.y) * 0.5,
    });
  };
  const up = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  const pointerEvents: [string, (e: PointerEvent) => void][] = [
    ["pointerdown", down],
    ["pointermove", move],
    ["pointerup", up],
    ["pointercancel", up],
    ["lostpointercapture", up],
  ];
  for (const [type, fn] of pointerEvents)
    canvas?.addEventListener(type, fn as EventListener);

  ready = true;
  viewport?.setTarget("demo", turns(demo, frames[0].state), false);
  paint();
  placeBadges();
  return {
    hint(rung) {
      if (rung === 4 && io.presentation() === "trial") {
        chrome.setPhase("try");
        setFold(
          { type: "fold-all" },
          true,
          "Worked step: every crease of your net is folded.",
        );
      }
    },
    lock(locked) {
      chrome.lock(locked);
    },
    answerChanged(ids) {
      chrome.sync(ids);
    },
    destroy() {
      for (const [type, fn] of pointerEvents)
        canvas?.removeEventListener(type, fn as EventListener);
      chrome.root.removeEventListener("click", click);
      viewport?.destroy();
      viewport = null;
      chrome.destroy();
    },
  };
}

/** Workbench factory for a nets lesson step (the default export loaded by `import()`). */
export function netsBenchFactory(lesson: Lesson, step: Step): WorkbenchFactory {
  return (host, io) => mountNetsBench(host, io, lesson, step);
}
