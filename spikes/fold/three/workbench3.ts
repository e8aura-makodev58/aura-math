/** WP0a SPIKE (THROWAWAY): three.js viewport + HTML grips/buttons. This is the lazy chunk entry. */
import type { FoldModel, View } from "../fold";
import { Viewport3 } from "./viewport3";

export class Workbench3 {
  readonly vp: Viewport3;
  readonly grips: HTMLButtonElement[] = [];
  readonly fallback: HTMLElement;
  private cleanups: (() => void)[] = [];
  private drag: { h: number; x0: number; t0: number; id: number; yaw?: boolean; y0?: number } | null = null;
  private dragWin: (() => void) | null = null;
  log: string[] = [];
  settleTimer = 0;

  constructor(
    private host: HTMLElement,
    readonly model: FoldModel,
    opts: { ortho?: boolean; separate?: boolean } = {},
  ) {
    host.style.position = "relative";
    this.fallback = document.createElement("p");
    this.fallback.setAttribute("role", "status");
    this.fallback.hidden = true;
    host.after(this.fallback);
    this.vp = new Viewport3(host, model, {
      ...opts,
      onFallback: (r) => {
        this.fallback.hidden = r === "restored";
        this.fallback.textContent =
          r === "no-webgl"
            ? "The 3D view is not available on this device. Use the crease buttons below; each one folds or unfolds a crease."
            : "The 3D view stopped. A still picture is shown; the crease buttons still work.";
        this.grips.forEach((g) => (g.hidden = r === "no-webgl"));
      },
    });
    model.hinges.forEach((h, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "grip";
      b.dataset.hinge = String(i);
      b.setAttribute("role", "slider");
      b.setAttribute("aria-valuemin", "0");
      b.setAttribute("aria-valuemax", "8");
      b.setAttribute("aria-label", `Crease ${i + 1}, between ${model.labels[h.parent]} and ${model.labels[h.child]}`);
      b.style.cssText = "position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #0b57d0;background:#fff;touch-action:none;padding:0;font:600 13px sans-serif;cursor:grab;";
      b.textContent = String(i + 1);
      const ev: [string, (e: never) => void][] = [
        ["pointerdown", (e: PointerEvent) => this.onDown(e, i, b)],
        ["pointermove", (e: PointerEvent) => this.onMove(e)],
        ["pointerup", (e: PointerEvent) => this.onUp(e, false)],
        ["pointercancel", (e: PointerEvent) => this.onUp(e, true)],
        ["keydown", (e: KeyboardEvent) => this.onKey(e, i)],
      ];
      for (const [t, f] of ev) b.addEventListener(t, f as EventListener);
      this.cleanups.push(() => ev.forEach(([t, f]) => b.removeEventListener(t, f as EventListener)));
      host.append(b);
      this.grips.push(b);
    });
    // canvas drag: horizontal = yaw in 15 degree steps; vertical swipes belong to the page (pan-y)
    const cv = this.vp.renderer?.domElement;
    if (cv) {
      const d = (e: PointerEvent) => {
        if (e.target !== cv || this.drag) return;
        cv.setPointerCapture(e.pointerId);
        this.drag = { h: -1, x0: e.clientX, t0: this.vp.view.yaw, id: e.pointerId, yaw: true };
        this.log.push("canvas down");
      };
      const m = (e: PointerEvent) => {
        const g = this.drag;
        if (!g?.yaw || e.pointerId !== g.id) return;
        const yaw = Math.round((g.t0 + (e.clientX - g.x0) / 4) / 15) * 15;
        this.vp.setView({ yaw: ((yaw + 540) % 360) - 180, pitch: this.vp.view.pitch });
      };
      const u = (e: PointerEvent) => {
        if (this.drag?.yaw && e.pointerId === this.drag.id) {
          this.log.push(e.type === "pointercancel" ? "canvas cancel" : "canvas up");
          this.drag = null;
        }
      };
      cv.addEventListener("pointerdown", d);
      cv.addEventListener("pointermove", m);
      cv.addEventListener("pointerup", u);
      cv.addEventListener("pointercancel", u);
      this.cleanups.push(() => {
        cv.removeEventListener("pointerdown", d);
        cv.removeEventListener("pointermove", m);
        cv.removeEventListener("pointerup", u);
        cv.removeEventListener("pointercancel", u);
      });
    }
    this.placeGrips();
  }

  placeGrips() {
    this.model.hinges.forEach((_, i) => {
      const p = this.vp.hingeScreen(i);
      const { w, h } = this.vp.size;
      const cx = w / 2,
        cy = h / 2,
        dx = p.x - cx,
        dy = p.y - cy,
        L = Math.hypot(dx, dy) || 1;
      const b = this.grips[i];
      b.style.left = `${p.x + (dx / L) * 22}px`;
      b.style.top = `${p.y + (dy / L) * 22}px`;
      b.setAttribute("aria-valuenow", String(this.vp.t8[i]));
    });
  }
  settle() {
    this.placeGrips();
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.vp.captureStill(), 650);
  }
  set(t8: number[], ms?: number) {
    this.vp.setTarget(t8, ms);
    this.settle();
  }
  toggle(h: number) {
    const n = [...this.vp.t8];
    n[h] = n[h] > 4 ? 0 : 8;
    this.set(n);
  }
  foldAll(on: boolean) {
    this.set(this.vp.t8.map(() => (on ? 8 : 0)), 700);
  }
  camera(v: View) {
    this.vp.setView(v);
    this.placeGrips();
  }
  private onDown(e: PointerEvent, h: number, b: HTMLButtonElement) {
    if (this.drag) return;
    b.setPointerCapture(e.pointerId);
    this.drag = { h, x0: e.clientX, t0: this.vp.t8[h], id: e.pointerId };
    this.log.push(`down h=${h}`);
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
    if (!d || d.yaw || e.pointerId !== d.id) return;
    const t = [...this.vp.t8];
    t[d.h] = Math.max(0, Math.min(8, d.t0 + (e.clientX - d.x0) / 20)); // fractional: drawing only
    this.vp.setDrawing(t);
    this.placeGrips();
  }
  private onUp(e: PointerEvent, cancelled: boolean) {
    const d = this.drag;
    if (!d || d.yaw || e.pointerId !== d.id) return;
    this.drag = null;
    this.dragWin?.();
    this.dragWin = null;
    const t = [...this.vp.t8];
    if (cancelled) {
      this.log.push(`cancel h=${d.h}`);
      t[d.h] = d.t0;
      this.vp.setTarget(t, 0);
    } else {
      this.log.push(`up h=${d.h}`);
      const cur = this.vp["shown"][d.h] as number;
      t[d.h] = cur > 4 ? 8 : 0;
      this.vp.setTarget(t, 150);
    }
    this.settle();
  }
  private onKey(e: KeyboardEvent, h: number) {
    const t = [...this.vp.t8];
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowUp") t[h] += e.shiftKey ? 8 : 1;
    else if (k === "ArrowLeft" || k === "ArrowDown") t[h] -= e.shiftKey ? 8 : 1;
    else if (k === "Home") t[h] = 0;
    else if (k === "End") t[h] = 8;
    else if (k === "Enter" || k === " ") t[h] = t[h] > 4 ? 0 : 8;
    else return;
    e.preventDefault();
    this.set(t, 120);
  }
  destroy() {
    clearTimeout(this.settleTimer);
    this.dragWin?.();
    this.dragWin = null;
    this.drag = null;
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    for (const g of this.grips) g.remove();
    this.fallback.remove();
    this.vp.destroy();
  }
}
