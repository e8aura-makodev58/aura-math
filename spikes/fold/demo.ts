/** WP0a SPIKE (THROWAWAY) demo page. Exposes window.__spike for the Playwright checks. */
import { catalogueNet, type SolidId } from "../../src/topics/nets";
import { Workbench } from "./controller";
import { cellModel, classify, fixedOrientations, freeHexominoes, solidModel } from "./nets-model";
import type { FoldModel } from "./fold";

interface Entry {
  name: string;
  make: (root: number) => FoldModel;
  faces: number;
  separate: boolean;
}
const entries: Entry[] = [];
freeHexominoes().forEach((free, i) => {
  const cls = classify(free);
  if (cls !== "cube" && cls !== "collide1") return;
  const cells = fixedOrientations(free)[0];
  entries.push({
    name: `${cls === "cube" ? "cube net" : "collision net"} #${i} ${cells.map((c) => c.join("")).join(" ")}`,
    make: (root) => cellModel(cells, root),
    faces: 6,
    separate: cls !== "cube",
  });
});
for (const s of ["cuboid", "triangular-prism", "square-pyramid"] as SolidId[])
  entries.push({ name: s, make: (root) => solidModel(s, root), faces: catalogueNet(s).faces.length, separate: false });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shape = $<HTMLSelectElement>("shape"),
  rootSel = $<HTMLSelectElement>("root"),
  tweenBox = $<HTMLInputElement>("tween"),
  stage = $("stage"),
  creases = $("creases"),
  out = $("out");
entries.forEach((e, i) => shape.append(new Option(e.name, String(i))));

let wb: Workbench | null = null;
let btns: HTMLButtonElement[] = [];
function mount() {
  wb?.destroy();
  creases.replaceChildren();
  const e = entries[Number(shape.value)];
  if (rootSel.options.length !== e.faces) {
    rootSel.replaceChildren();
    for (let i = 0; i < e.faces; i++) rootSel.append(new Option("ABCDEF"[i], String(i)));
  }
  const m = e.make(Number(rootSel.value) || 0);
  wb = new Workbench(stage, m, { separate: e.separate, tween: tweenBox.checked });
  btns = m.hinges.map((h, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.textContent = `${i + 1}: ${m.labels[h.parent]}-${m.labels[h.child]}`;
    b.addEventListener("click", () => {
      wb!.toggle(i);
      b.setAttribute("aria-pressed", String(wb!.t[i] < 0.5));
    });
    creases.append(b);
    return b;
  });
}
shape.addEventListener("change", () => {
  rootSel.replaceChildren();
  mount();
});
rootSel.addEventListener("change", mount);
tweenBox.addEventListener("change", mount);
$("foldall").addEventListener("click", () => wb!.foldAll(true));
$("unfoldall").addEventListener("click", () => wb!.foldAll(false));
$("corner").addEventListener("click", () => wb!.setCamera({ yaw: -30, pitch: 45 }));
$("front").addEventListener("click", () => wb!.setCamera({ yaw: 0, pitch: 0 }));
document.querySelectorAll<HTMLButtonElement>("[data-cam]").forEach((b) =>
  b.addEventListener("click", () => {
    const [dy, dp] = b.dataset.cam!.split(",").map(Number);
    const c = wb!.camera;
    wb!.setCamera({ yaw: ((c.yaw + dy + 540) % 360) - 180, pitch: Math.max(0, Math.min(75, c.pitch + dp)) });
  }),
);
shape.value = "0";
mount();

/* test hooks */
const w = window as unknown as { __spike: unknown };
w.__spike = {
  entries: entries.map((e) => e.name),
  select(i: number, root = 0, tween = false) {
    shape.value = String(i);
    rootSel.replaceChildren();
    for (let k = 0; k < entries[i].faces; k++) rootSel.append(new Option("ABCDEF"[k], String(k)));
    rootSel.value = String(root);
    tweenBox.checked = tween;
    mount();
  },
  get wb() {
    return wb;
  },
  mount,
  destroy() {
    wb?.destroy();
    wb = null;
  },
  /** Call setState for `n` frames of a fold-all tween; returns per-frame ms. */
  bench(n: number) {
    const m = wb!;
    const times: number[] = [];
    for (let f = 0; f <= n; f++) {
      const k = f / n;
      const t0 = performance.now();
      m.t.forEach((_, i) => (m.t[i] = k));
      m.draw();
      times.push(performance.now() - t0);
    }
    return times;
  },
  /** Real rAF-driven fold-all, n frames; resolves with per-frame script ms measured inside the callback. */
  rafBench(n: number) {
    return new Promise<number[]>((resolve) => {
      const m = wb!;
      const times: number[] = [];
      let f = 0;
      const step = () => {
        const k = f / n;
        const t0 = performance.now();
        m.t.forEach((_, i) => (m.t[i] = k));
        m.draw();
        times.push(performance.now() - t0);
        if (++f <= n) requestAnimationFrame(step);
        else resolve(times);
      };
      requestAnimationFrame(step);
    });
  },
};
out.textContent = "ready";
