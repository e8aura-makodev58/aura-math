/**
 * WP0a SPIKE (THROWAWAY): lazy three.js viewport. Render on demand, own camera (no OrbitControls),
 * context-loss and no-WebGL fallbacks, full dispose on destroy.
 */
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { basis, type FoldModel, type View } from "../fold";
import { Fold3 } from "./fold3";

export interface VOpts {
  ortho?: boolean;
  separate?: boolean;
  /** Pixel ratio cap. */
  maxDpr?: number;
  onFallback?: (reason: "no-webgl" | "context-lost" | "restored") => void;
}

export class Viewport3 {
  readonly fold: Fold3;
  readonly scene = new Scene();
  renderer: WebGLRenderer | null = null;
  readonly camera: OrthographicCamera | PerspectiveCamera;
  t8: number[];
  view: View = { yaw: 0, pitch: 0 };
  private shown: number[]; // fractional eighths currently drawn
  private dirty = false;
  private raf = 0;
  private tweenRaf = 0;
  private ro: ResizeObserver | null = null;
  private cleanups: (() => void)[] = [];
  private w = 300;
  private h = 300;
  private still: HTMLImageElement | null = null;
  private lost = false;
  reduced = false;
  frames = 0;
  renderMs: number[] = [];

  constructor(
    readonly host: HTMLElement,
    readonly model: FoldModel,
    private opts: VOpts = {},
  ) {
    this.scene.background = new Color("#ffffff");
    this.fold = new Fold3(model, { separate: opts.separate });
    this.scene.add(this.fold.group);
    this.t8 = model.hinges.map(() => 0);
    this.shown = [...this.t8];
    this.camera = opts.ortho
      ? new OrthographicCamera(-model.radius, model.radius, model.radius, -model.radius, 0.1, 100)
      : new PerspectiveCamera(30, 1, 0.1, 200);
    try {
      this.renderer = new WebGLRenderer({ antialias: true });
    } catch {
      this.renderer = null;
      opts.onFallback?.("no-webgl");
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2));
    const cv = r.domElement;
    cv.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y";
    host.append(cv);
    const lost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.tweenRaf);
      cancelAnimationFrame(this.raf);
      this.showStill();
      opts.onFallback?.("context-lost");
    };
    const restored = () => {
      this.lost = false;
      this.still?.remove();
      this.still = null;
      cv.style.visibility = "visible";
      opts.onFallback?.("restored");
      this.requestRender();
    };
    cv.addEventListener("webglcontextlost", lost);
    cv.addEventListener("webglcontextrestored", restored);
    this.cleanups.push(() => {
      cv.removeEventListener("webglcontextlost", lost);
      cv.removeEventListener("webglcontextrestored", restored);
    });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver((es) => {
        const c = es[0].contentRect;
        this.resize(c.width, c.height);
      });
      this.ro.observe(host);
    }
    if (typeof matchMedia === "function") {
      const mq = matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = mq.matches;
      const on = (e: MediaQueryListEvent) => (this.reduced = e.matches);
      mq.addEventListener("change", on);
      this.cleanups.push(() => mq.removeEventListener("change", on));
    }
    this.resize(host.clientWidth || 300, host.clientHeight || host.clientWidth || 300);
    this.apply();
  }

  private resize(w: number, h: number) {
    this.w = Math.max(1, Math.round(w));
    this.h = Math.max(1, Math.round(h));
    this.renderer?.setSize(this.w, this.h, false);
    if (this.camera instanceof PerspectiveCamera) this.camera.aspect = this.w / this.h;
    this.requestRender();
  }
  /** Camera for a view (15 degree yaw/pitch steps map to exact unit vectors). */
  private pose() {
    const b = basis(this.view);
    const c = this.model.centre;
    const D = this.camera instanceof PerspectiveCamera ? this.model.radius * 4.2 : 30;
    this.camera.position.set(c[0] + b.zv[0] * D, c[1] + b.zv[1] * D, c[2] + b.zv[2] * D);
    this.camera.up.set(b.up[0], b.up[1], b.up[2]);
    this.camera.lookAt(c[0], c[1], c[2]);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
  }
  private apply() {
    this.fold.setEighths(this.shown);
    this.pose();
    this.requestRender();
  }
  setView(v: View) {
    this.view = v;
    this.apply();
  }
  /** Integer state is the truth; drawing follows by tween or snap. */
  setTarget(t8: number[], ms = 450) {
    this.t8 = t8.map((x) => Math.max(0, Math.min(8, Math.round(x))));
    cancelAnimationFrame(this.tweenRaf);
    if (this.reduced || ms <= 0 || this.lost || !this.renderer) {
      this.shown = [...this.t8];
      this.apply();
      return;
    }
    const from = [...this.shown],
      t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms),
        e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.shown = from.map((f, i) => f + (this.t8[i] - f) * e);
      this.apply();
      if (k < 1) this.tweenRaf = requestAnimationFrame(step);
    };
    this.tweenRaf = requestAnimationFrame(step);
  }
  /** Drag: fractional eighths for drawing only. */
  setDrawing(t: number[]) {
    this.shown = [...t];
    this.apply();
  }
  requestRender() {
    if (this.dirty || !this.renderer || this.lost) return;
    this.dirty = true;
    this.raf = requestAnimationFrame(() => {
      this.dirty = false;
      this.renderNow();
    });
  }
  renderNow() {
    if (!this.renderer || this.lost) return;
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.renderMs.push(performance.now() - t0);
    if (this.renderMs.length > 2000) this.renderMs.shift();
  }
  /** Last settled picture for a context-loss fallback. */
  private showStill() {
    if (!this.renderer) return;
    try {
      const img = document.createElement("img");
      img.alt = "Still picture of the fold (3D view unavailable)";
      img.src = this.lastStill ?? "";
      img.style.cssText = "display:block;width:100%;height:100%;position:absolute;inset:0";
      this.host.append(img);
      this.still = img;
    } catch {
      /* ignore */
    }
  }
  lastStill: string | null = null;
  /** Capture a still right after a render (called when the picture settles). */
  captureStill() {
    if (!this.renderer || this.lost) return;
    this.renderNow();
    this.lastStill = this.renderer.domElement.toDataURL("image/png");
  }
  /** Screen position (css px inside the host) of the crease midpoint of hinge i. */
  hingeScreen(i: number): { x: number; y: number } {
    const h = this.model.hinges[i];
    const v = new Vector3(h.p[0] - (h.u[0] * h.len) / 2, h.p[1] - (h.u[1] * h.len) / 2, 0).applyMatrix4(this.fold.faces[h.parent].matrixWorld);
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }
  get size() {
    return { w: this.w, h: this.h };
  }

  /** Test aid: render face ids (red channel = id + 1) into a 64 by 64 target for an orthographic camera. */
  idPass(N: number, shiftX: number, shiftY: number): Uint8Array {
    const r = this.renderer!;
    const cam = this.camera as OrthographicCamera;
    const R = this.model.radius;
    const step = (2 * R) / N;
    cam.left = -R + shiftX * step;
    cam.right = R + shiftX * step;
    cam.bottom = -R + shiftY * step;
    cam.top = R + shiftY * step;
    cam.updateProjectionMatrix();
    const ids = this.model.polys.map((_, f) => new MeshBasicMaterial({ color: new Color((f + 1) / 255, 0, 0), side: DoubleSide }));
    this.fold.setIdMode(true, ids);
    const rt = new WebGLRenderTarget(N, N, { samples: 0 });
    const oldBg = this.scene.background;
    this.scene.background = new Color(0, 0, 0);
    const oldCm = r.outputColorSpace;
    r.setRenderTarget(rt);
    r.render(this.scene, cam);
    const buf = new Uint8Array(N * N * 4);
    r.readRenderTargetPixels(rt, 0, 0, N, N, buf);
    r.setRenderTarget(null);
    void oldCm;
    this.scene.background = oldBg;
    this.fold.setIdMode(false);
    ids.forEach((m) => m.dispose());
    rt.dispose();
    cam.left = -R;
    cam.right = R;
    cam.bottom = -R;
    cam.top = R;
    cam.updateProjectionMatrix();
    const out = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) out[p] = buf[p * 4];
    return out;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.tweenRaf);
    this.dirty = false;
    this.ro?.disconnect();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    this.fold.dispose();
    this.still?.remove();
    if (this.renderer) {
      const cv = this.renderer.domElement;
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      cv.remove();
      this.renderer = null;
    }
  }
}
