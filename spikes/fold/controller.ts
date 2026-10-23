/**
 * WP0a SPIKE (THROWAWAY): workbench controller with HTML grips over the SVG.
 * Pointer handling lives on the grip button (pointer capture) plus short-lived window listeners
 * during a drag. destroy() must leave no listener and no running frame.
 */
import { apply, type FoldModel, type View } from "./fold";
import { FoldView } from "./view";

export interface Opts {
  separate?: boolean;
  /** false = snap between 0 and fully folded without intermediate frames */
  tween: boolean;
}

export class Workbench {
  readonly view: FoldView;
  readonly t: number[];
  readonly grips: HTMLButtonElement[] = [];
  private cam: View = { yaw: 0, pitch: 0 };
  private raf = 0;
  private mq: MediaQueryList | null = null;
  private reduced = false;
  private cleanups: (() => void)[] = [];
  private drag: { h: number; x0: number; t0: number; id: number } | null = null;
  private dragWin: (() => void) | null = null;
  frames = 0;
  log: string[] = [];

  constructor(
    private host: HTMLElement,
    readonly model: FoldModel,
    readonly opts: Opts,
  ) {
    host.style.position = "relative";
    this.view = new FoldView(host, model, { separate: opts.separate });
    this.t = model.hinges.map(() => 0);
    model.hinges.forEach((h, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "grip";
      b.dataset.hinge = String(i);
      b.setAttribute("aria-label", `Crease ${i + 1}, between ${model.labels[h.parent]} and ${model.labels[h.child]}: drag or use arrow keys`);
      b.setAttribute("role", "slider");
      b.setAttribute("aria-valuemin", "0");
      b.setAttribute("aria-valuemax", "8");
      b.style.cssText =
        "position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #0b57d0;background:#fff;touch-action:none;padding:0;font:600 13px sans-serif;cursor:grab;";
      b.textContent = String(i + 1);
      const down = (e: PointerEvent) => this.onDown(e, i, b);
      const move = (e: PointerEvent) => this.onMove(e);
      const up = (e: PointerEvent) => this.onUp(e, false);
      const cancel = (e: PointerEvent) => this.onUp(e, true);
      const key = (e: KeyboardEvent) => this.onKey(e, i);
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointermove", move);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", cancel);
      b.addEventListener("keydown", key);
      this.cleanups.push(() => {
        b.removeEventListener("pointerdown", down);
        b.removeEventListener("pointermove", move);
        b.removeEventListener("pointerup", up);
        b.removeEventListener("pointercancel", cancel);
        b.removeEventListener("keydown", key);
      });
      host.append(b);
      this.grips.push(b);
    });
    if (typeof matchMedia === "function") {
      this.mq = matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = this.mq.matches;
      const on = (e: MediaQueryListEvent) => (this.reduced = e.matches);
      this.mq.addEventListener("change", on);
      this.cleanups.push(() => this.mq!.removeEventListener("change", on));
    }
    this.draw();
  }

  get angles() {
    return this.model.hinges.map((h, i) => this.t[i] * h.max);
  }
  setCamera(v: View) {
    this.cam = v;
    this.draw();
  }
  get camera() {
    return this.cam;
  }
  draw() {
    this.view.setState(this.angles, this.cam);
    this.frames++;
    // place grips from the matrices just written (no layout reads)
    const size = this.view.svg.viewBox.baseVal.width;
    const P = this.view.lastPose;
    this.model.hinges.forEach((h, i) => {
      const mid: [number, number] = [h.p[0] - (h.u[0] * h.len) / 2, h.p[1] - (h.u[1] * h.len) / 2];
      const w = apply(P[h.parent], mid);
      const mm = this.view.lastMats[h.parent];
      // screen position of the crease midpoint through the PARENT's matrix (local coordinates)
      let x = mm[0] * mid[0] + mm[2] * mid[1] + mm[4],
        y = mm[1] * mid[0] + mm[3] * mid[1] + mm[5];
      void w;
      // offset handle: push 0.35 unit-lengths away from the picture centre, never on the crease itself
      const dx = x - size / 2,
        dy = y - size / 2,
        L = Math.hypot(dx, dy) || 1;
      x += (dx / L) * 22;
      y += (dy / L) * 22;
      const b = this.grips[i];
      b.style.left = `${((x / size) * 100).toFixed(3)}%`;
      b.style.top = `${((y / size) * 100).toFixed(3)}%`;
      b.setAttribute("aria-valuenow", String(Math.round(this.t[i] * 8)));
    });
  }
  setT(h: number, t: number) {
    this.t[h] = Math.min(1, Math.max(0, t));
    this.draw();
  }
  /** Animate to target t values (or snap when tween is off / reduced motion). */
  animateTo(target: number[], ms = 500) {
    cancelAnimationFrame(this.raf);
    if (!this.opts.tween || this.reduced || ms <= 0) {
      target.forEach((v, i) => (this.t[i] = v));
      this.draw();
      return;
    }
    const from = [...this.t];
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      target.forEach((v, i) => (this.t[i] = from[i] + (v - from[i]) * e));
      this.draw();
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  toggle(h: number) {
    const next = [...this.t];
    next[h] = this.t[h] > 0.5 ? 0 : 1;
    this.animateTo(next);
  }
  foldAll(on: boolean) {
    this.animateTo(this.t.map(() => (on ? 1 : 0)), 700);
  }

  private onDown(e: PointerEvent, h: number, b: HTMLButtonElement) {
    if (this.drag) return;
    b.setPointerCapture(e.pointerId);
    cancelAnimationFrame(this.raf);
    this.drag = { h, x0: e.clientX, t0: this.t[h], id: e.pointerId };
    this.log.push(`down h=${h}`);
    // belt and braces if capture is lost: window-level listeners only while dragging
    const wu = (ev: PointerEvent) => this.onUp(ev, ev.type === "pointercancel");
    window.addEventListener("pointerup", wu);
    window.addEventListener("pointercancel", wu);
    this.dragWin = () => {
      window.removeEventListener("pointerup", wu);
      window.removeEventListener("pointercancel", wu);
    };
  }
  private onMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.setT(d.h, d.t0 + (e.clientX - d.x0) / 160);
  }
  private onUp(e: PointerEvent, cancelled: boolean) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.endDrag();
    if (cancelled) {
      this.log.push(`cancel h=${d.h}`);
      this.setT(d.h, d.t0);
      return;
    }
    this.log.push(`up h=${d.h}`);
    const next = [...this.t];
    next[d.h] = this.t[d.h] > 0.5 ? 1 : 0;
    this.animateTo(next, 150);
  }
  private endDrag() {
    this.drag = null;
    this.dragWin?.();
    this.dragWin = null;
  }
  private onKey(e: KeyboardEvent, h: number) {
    const k = e.key;
    let t = this.t[h];
    if (k === "ArrowRight" || k === "ArrowUp") t += e.shiftKey ? 1 : 1 / 8;
    else if (k === "ArrowLeft" || k === "ArrowDown") t -= e.shiftKey ? 1 : 1 / 8;
    else if (k === "Home") t = 0;
    else if (k === "End") t = 1;
    else if (k === "Enter" || k === " ") t = this.t[h] > 0.5 ? 0 : 1;
    else return;
    e.preventDefault();
    this.setT(h, t);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.endDrag();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    for (const g of this.grips) g.remove();
    this.view.destroy();
  }
}
