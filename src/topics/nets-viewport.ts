/**
 * The 3D viewport of the net folder (three.js, WebGL), loaded lazily with the workbench chunk.
 * Renders on demand only (no continuous loop), tweens crease turns with requestAnimationFrame
 * (stepwise stills with reduced motion), and falls back to a still picture when WebGL is
 * unavailable or the context is lost. `destroy()` cancels frames and listeners and disposes
 * every geometry, material, texture and the renderer.
 */
import {
  Color,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { FoldScene } from "./nets-scene";
import type { FoldModel } from "./nets-bench";

export interface View {
  /** Degrees round the vertical; pitch 0 looks straight down on the flat net. */
  yaw: number;
  pitch: number;
}
export const DEFAULT_VIEW: View = { yaw: -25, pitch: 55 };
export const PITCH_MIN = 0;
export const PITCH_MAX = 85;
const D2R = Math.PI / 180;

interface Shown {
  fold: FoldScene;
  /** Turns drawn now, and the turns of the exact state being moved to. */
  angles: number[];
  target: number[];
}

export class NetViewport {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private models = new Map<string, Shown>();
  private current = "";
  view: View = { ...DEFAULT_VIEW };
  private frame = 0;
  private tween = 0;
  private resizeObserver: ResizeObserver | null = null;
  private cleanups: (() => void)[] = [];
  private width = 300;
  private height = 300;
  private lost = false;
  private still: HTMLImageElement | null = null;
  private stillUrl = "";
  private stillTimer = 0;
  /** Called after every drawn frame (badges follow the creases). */
  onFrame: (() => void) | null = null;

  /** Throws when WebGL is unavailable; the caller shows the fallback. */
  constructor(
    private host: HTMLElement,
    private onLost: (lost: boolean) => void,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: false,
    });
    this.scene.background = new Color("#fffdf8");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.className = "bench-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    host.append(this.canvas);
    const lost = (event: Event) => {
      event.preventDefault();
      this.lost = true;
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.tween);
      this.showStill();
      this.onLost(true);
    };
    const restored = () => {
      this.lost = false;
      this.still?.remove();
      this.still = null;
      this.onLost(false);
      this.requestRender();
    };
    this.canvas.addEventListener("webglcontextlost", lost);
    this.canvas.addEventListener("webglcontextrestored", restored);
    this.cleanups.push(() => {
      this.canvas.removeEventListener("webglcontextlost", lost);
      this.canvas.removeEventListener("webglcontextrestored", restored);
    });
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver((entries) => {
        const box = entries[0].contentRect;
        this.resize(box.width, box.height);
      });
      this.resizeObserver.observe(host);
    }
    this.resize(host.clientWidth || 300, host.clientHeight || 300);
  }

  /** Adds a model under a key (the learner's net, the demonstration net). */
  addModel(key: string, model: FoldModel) {
    const fold = new FoldScene(model);
    fold.group.visible = false;
    this.scene.add(fold.group);
    const zero = model.hinges.map(() => 0);
    this.models.set(key, { fold, angles: [...zero], target: [...zero] });
    fold.setAngles(zero);
  }
  show(key: string) {
    this.current = key;
    for (const [k, m] of this.models) m.fold.group.visible = k === key;
    this.pose();
    this.requestRender();
  }
  get shown(): Shown | undefined {
    return this.models.get(this.current);
  }
  /** Turns drawn now for a model (test hook and badges). */
  angles(key: string): number[] {
    return [...(this.models.get(key)?.angles ?? [])];
  }
  /**
   * Moves a model to the turns of an exact fold state. With `animate` the turns ease over `ms`;
   * otherwise (reduced motion, a jump) the picture changes in one still.
   */
  setTarget(key: string, target: number[], animate: boolean, ms = 450) {
    const m = this.models.get(key);
    if (!m) return;
    m.target = [...target];
    cancelAnimationFrame(this.tween);
    this.tween = 0;
    // other models settle at once so no tween is left half-way when the phase changes
    for (const [k, other] of this.models)
      if (k !== key && other.angles.some((a, i) => a !== other.target[i])) {
        other.angles = [...other.target];
        this.applyAngles(other);
      }
    if (!animate || this.lost) {
      m.angles = [...target];
      this.applyAngles(m);
      this.requestRender();
      this.settled();
      return;
    }
    const from = [...m.angles];
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.angles = from.map((a, i) => a + (m.target[i] - a) * e);
      this.applyAngles(m);
      this.renderNow();
      if (k < 1) this.tween = requestAnimationFrame(step);
      else {
        this.tween = 0;
        this.settled();
      }
    };
    this.tween = requestAnimationFrame(step);
  }
  get animating() {
    return this.tween !== 0;
  }
  private applyAngles(m: Shown) {
    m.fold.setAngles(m.angles);
    m.fold.markCoincident(m.fold.coincident(1e-4));
    if (m === this.shown) this.pose();
  }
  setView(view: View) {
    this.view = {
      yaw: ((((view.yaw + 180) % 360) + 360) % 360) - 180,
      pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, view.pitch)),
    };
    this.pose();
    this.requestRender();
    this.settled();
  }
  private resize(w: number, h: number) {
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    this.renderer.setSize(this.width, this.height, false);
    this.pose();
    this.requestRender();
  }
  private pose() {
    const fold = this.shown?.fold;
    if (!fold) return;
    // frame what is drawn now: the flat net is wide, the folded solid small
    const points = fold.model.polys.flatMap((_, f) => fold.corners(f));
    const lo = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
    const [cx, cy, cz] = lo.map((v, k) => (v + hi[k]) / 2);
    const r = Math.max(
      1.4,
      1.12 *
        Math.max(
          ...points.map((p) => Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz)),
        ),
    );
    const aspect = this.width / this.height;
    const halfW = aspect >= 1 ? r * aspect : r;
    const halfH = aspect >= 1 ? r : r / aspect;
    Object.assign(this.camera, {
      left: -halfW,
      right: halfW,
      top: halfH,
      bottom: -halfH,
    });
    const yaw = this.view.yaw * D2R,
      pitch = this.view.pitch * D2R;
    const ahead = new Vector3(Math.sin(yaw), Math.cos(yaw), 0);
    const towards = new Vector3(
      -Math.sin(pitch) * ahead.x,
      -Math.sin(pitch) * ahead.y,
      Math.cos(pitch),
    );
    const up = new Vector3(
      Math.cos(pitch) * ahead.x,
      Math.cos(pitch) * ahead.y,
      Math.sin(pitch),
    );
    const distance = 50;
    this.camera.position.set(
      cx + towards.x * distance,
      cy + towards.y * distance,
      cz + towards.z * distance,
    );
    this.camera.up.copy(up);
    this.camera.lookAt(cx, cy, cz);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }
  requestRender() {
    if (this.frame || this.lost) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderNow();
    });
  }
  private renderNow() {
    if (this.lost) return;
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }
  /** Screen position (CSS px inside the host) of a crease midpoint of the shown model. */
  creaseScreen(i: number): { x: number; y: number; front: boolean } | null {
    const m = this.shown;
    if (!m || i >= m.fold.model.hinges.length) return null;
    const v = m.fold.creaseMidpoint(i).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.width,
      y: ((1 - v.y) / 2) * this.height,
      front: v.z < 1,
    };
  }
  /** After the picture settles, keep a still for the context-loss fallback. */
  private settled() {
    clearTimeout(this.stillTimer);
    this.stillTimer = window.setTimeout(() => {
      if (this.lost) return;
      try {
        this.renderNow();
        this.stillUrl = this.canvas.toDataURL("image/png");
      } catch {
        this.stillUrl = "";
      }
    }, 300);
  }
  private showStill() {
    if (!this.stillUrl || this.still) return;
    const img = document.createElement("img");
    img.className = "bench-still";
    img.alt = "";
    img.src = this.stillUrl;
    this.host.append(img);
    this.still = img;
  }
  /** Test aid: lose the context on purpose (WEBGL_lose_context). */
  loseContext() {
    this.renderer.forceContextLoss();
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.tween);
    clearTimeout(this.stillTimer);
    this.frame = this.tween = 0;
    this.resizeObserver?.disconnect();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    for (const m of this.models.values()) m.fold.dispose();
    this.models.clear();
    this.still?.remove();
    this.onFrame = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
