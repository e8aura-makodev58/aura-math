/** WP0a SPIKE (THROWAWAY) demo for the three.js route. The viewport is a LAZY chunk (dynamic import). */
import { catalogueNet, type SolidId } from "../../src/topics/nets";
import { cellModel, classify, fixedOrientations, freeHexominoes, solidModel } from "./nets-model";
import type { FoldModel } from "./fold";
import type { Workbench3 } from "./three/workbench3";

interface Entry { name: string; make: (root: number) => FoldModel; faces: number; separate: boolean }
const entries: Entry[] = [];
freeHexominoes().forEach((free, i) => {
  const cls = classify(free);
  if (cls !== "cube" && cls !== "collide1") return;
  const cells = fixedOrientations(free)[0];
  entries.push({ name: `${cls === "cube" ? "cube net" : "collision net"} #${i}`, make: (r) => cellModel(cells, r), faces: 6, separate: cls !== "cube" });
});
for (const s of ["cuboid", "triangular-prism", "square-pyramid"] as SolidId[])
  entries.push({ name: s, make: (r) => solidModel(s, r), faces: catalogueNet(s).faces.length, separate: false });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shape = $<HTMLSelectElement>("shape"), rootSel = $<HTMLSelectElement>("root"), stage = $("stage"), creases = $("creases");
entries.forEach((e, i) => shape.append(new Option(e.name, String(i))));
let wb: Workbench3 | null = null;
let gen = 0;
const params = new URLSearchParams(location.search);
async function mount() {
  const my = ++gen;
  wb?.destroy();
  wb = null;
  creases.replaceChildren();
  const e = entries[Number(shape.value)];
  const mod = await import("./three/workbench3"); // lazy chunk: only pages with a workbench pay
  if (my !== gen) return;
  const m = e.make(Number(rootSel.value) || 0);
  wb = new mod.Workbench3(stage, m, { ortho: params.get("persp") !== "1", separate: e.separate });
  m.hinges.forEach((h, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = `${i + 1}: ${m.labels[h.parent]}-${m.labels[h.child]}`;
    b.addEventListener("click", () => wb!.toggle(i));
    creases.append(b);
  });
}
function fillRoots() {
  rootSel.replaceChildren();
  for (let i = 0; i < entries[Number(shape.value)].faces; i++) rootSel.append(new Option("ABCDEF"[i], String(i)));
}
shape.addEventListener("change", () => { fillRoots(); void mount(); });
rootSel.addEventListener("change", () => void mount());
$("foldall").addEventListener("click", () => wb?.foldAll(true));
$("unfoldall").addEventListener("click", () => wb?.foldAll(false));
document.querySelectorAll<HTMLButtonElement>("[data-cam]").forEach((b) =>
  b.addEventListener("click", () => {
    const [dy, dp] = b.dataset.cam!.split(",").map(Number);
    const c = wb!.vp.view;
    wb!.camera({ yaw: ((c.yaw + dy + 540) % 360) - 180, pitch: Math.max(0, Math.min(75, c.pitch + dp)) });
  }),
);
fillRoots();
const w = window as unknown as { __s3: unknown };
w.__s3 = {
  entries: entries.map((e) => e.name),
  async select(i: number, root = 0) {
    shape.value = String(i);
    fillRoots();
    rootSel.value = String(root);
    await mount();
  },
  get wb() { return wb; },
  async destroy() { gen++; wb?.destroy(); wb = null; },
  mount,
  async mountCells(cells: [number, number][], root: number) {
    gen++;
    wb?.destroy();
    creases.replaceChildren();
    const mod = await import("./three/workbench3");
    wb = new mod.Workbench3(stage, cellModel(cells, root), { ortho: true, separate: false });
  },
  async mountSolid(name: SolidId, root: number) {
    gen++;
    wb?.destroy();
    creases.replaceChildren();
    const mod = await import("./three/workbench3");
    wb = new mod.Workbench3(stage, solidModel(name, root), { ortho: true, separate: false });
  },
  /** Batch of face-id renders (orthographic, 64 by 64, samples aligned with the test-side grid). */
  idBatch(jobs: { t8: number[]; view: { yaw: number; pitch: number } }[], N = 64) {
    const v = wb!.vp;
    return jobs.map((j) => {
      v.setView(j.view);
      v.setDrawing(j.t8);
      return Array.from(v.idPass(N, 0.137, 0.291));
    });
  },
};
void mount();
