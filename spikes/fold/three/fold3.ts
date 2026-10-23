/**
 * WP0a SPIKE (THROWAWAY): three.js fold scene. Faces are meshes in a hinge tree.
 * The fold state is integer eighths (0..8) per hinge; angles are floats only for drawing.
 * Needs no WebGL context for the Object3D / Matrix4 maths (textures are optional).
 */
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineDashedMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from "three";
import { TINTS, centreOf, type FoldModel, type P2, type V3 } from "../fold";

export const SLIDE = 0.8; // fraction of an edge by which the later coincident face is slid
export const LIFT = 0.02; // paper-layer lift along its own normal (world units)

function faceCanvas(letter: string, tint: string, back: boolean, c: P2, bb: [number, number, number, number]) {
  const S = 128,
    cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = back ? "#e9e9e9" : tint;
  g.fillRect(0, 0, S, S);
  g.fillStyle = tint;
  if (back) {
    g.globalAlpha = 0.85;
    g.fillRect(0, 0, S, S);
    g.globalAlpha = 1;
    g.strokeStyle = "#444";
    g.lineWidth = 2;
    for (let k = -S; k < S * 2; k += 14) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + S, S);
      g.stroke();
    }
  }
  const [x0, y0, w, h] = bb;
  const u = ((c[0] - x0) / w) * S,
    v = (1 - (c[1] - y0) / h) * S;
  g.save();
  g.translate(u, v);
  // (no mirroring needed: three flips the u axis on back faces already)
  g.fillStyle = "#111";
  g.font = "bold 56px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(letter, 0, 0);
  g.restore();
  return cv;
}

export class Fold3 {
  readonly group = new Group();
  readonly faces: Group[] = [];
  private slides: Group[] = [];
  private pivots: Group[] = [];
  private geos: BufferGeometry[] = [];
  private mats: (MeshBasicMaterial | LineDashedMaterial)[] = [];
  private texs: Texture[] = [];
  readonly front: Mesh[] = [];
  readonly back: Mesh[] = [];
  readonly lines: LineLoop[] = [];

  constructor(
    readonly model: FoldModel,
    private opts: { separate?: boolean; textures?: boolean } = {},
  ) {
    const tex = opts.textures ?? typeof document !== "undefined";
    model.polys.forEach((poly, f) => {
      const g = new Group();
      const slide = new Group();
      g.add(slide);
      const geo = new BufferGeometry();
      const pos: number[] = [],
        uv: number[] = [];
      const xs = poly.map((p) => p[0]),
        ys = poly.map((p) => p[1]);
      const bb: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
      for (const p of poly) {
        pos.push(p[0], p[1], 0);
        uv.push((p[0] - bb[0]) / bb[2], (p[1] - bb[1]) / bb[3]);
      }
      const idx: number[] = [];
      for (let k = 1; k + 1 < poly.length; k++) idx.push(0, k, k + 1);
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      this.geos.push(geo);
      const mk = (side: typeof FrontSide, back: boolean) => {
        const m = new MeshBasicMaterial({ color: tex ? 0xffffff : TINTS[f % 6], side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        if (tex) {
          const t = new CanvasTexture(faceCanvas(model.labels[f], TINTS[f % 6], back, centreOf(poly), bb));
          t.colorSpace = SRGBColorSpace;
          m.map = t;
          this.texs.push(t);
        } else if (back) m.color.set("#bbbbbb");
        this.mats.push(m);
        return m;
      };
      const fm = new Mesh(geo, mk(FrontSide, false)),
        bm = new Mesh(geo, mk(BackSide, true));
      const lm = new LineDashedMaterial({ color: 0x222222, dashSize: 1e6, gapSize: 0.08 }); // solid unless later coincident face
      this.mats.push(lm);
      const lg = new BufferGeometry();
      lg.setAttribute("position", new Float32BufferAttribute(pos, 3));
      this.geos.push(lg);
      const line = new LineLoop(lg, lm);
      line.computeLineDistances();
      slide.add(fm, bm, line);
      this.front.push(fm);
      this.back.push(bm);
      this.lines.push(line);
      this.faces.push(g);
      this.slides.push(slide);
    });
    // hinge tree: parent face > pivot (at the crease) > inner (offset back) > child face
    this.group.add(this.faces[model.root]);
    model.hinges.forEach((h) => {
      const pivot = new Group();
      pivot.position.set(h.p[0], h.p[1], 0);
      const inner = new Group();
      inner.position.set(-h.p[0], -h.p[1], 0);
      this.faces[h.parent].add(pivot);
      pivot.add(inner);
      inner.add(this.faces[h.child]);
      this.pivots.push(pivot);
    });
  }

  /** Set angles from integer eighths (or fractional eighths while tweening: drawing only). */
  setEighths(t8: number[]) {
    this.model.hinges.forEach((h, i) => {
      this.pivots[i].quaternion.setFromAxisAngle(new Vector3(h.u[0], h.u[1], 0), (t8[i] / 8) * h.max);
    });
    this.group.updateMatrixWorld(true);
    if (this.opts.separate) this.separate();
  }
  /** Raw angles in radians (for the oracle test). */
  setAngles(ang: number[]) {
    this.model.hinges.forEach((h, i) => this.pivots[i].quaternion.setFromAxisAngle(new Vector3(h.u[0], h.u[1], 0), ang[i]));
    this.group.updateMatrixWorld(true);
  }
  world(f: number): Matrix4 {
    return this.faces[f].matrixWorld;
  }
  corners(f: number): V3[] {
    return this.model.polys[f].map((p) => {
      const v = new Vector3(p[0], p[1], 0).applyMatrix4(this.faces[f].matrixWorld);
      return [v.x, v.y, v.z];
    });
  }
  coincident(tol = 1e-6): [number, number][] {
    const out: [number, number][] = [];
    const cs = this.model.polys.map((_, f) => this.corners(f));
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++)
        if (cs[i].length === cs[j].length && cs[i].every((a) => cs[j].some((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol))) out.push([i, j]);
    return out;
  }
  /** Coincident faces: slide the later one sideways in its plane and lift it a paper layer. */
  private separate() {
    this.slides.forEach((s) => s.position.set(0, 0, 0));
    const pairs = this.coincident();
    this.lines.forEach((l) => {
      (l.material as LineDashedMaterial).dashSize = 1e6; // solid by default (dash longer than the edge)
    });
    for (const [, j] of pairs) {
      const poly = this.model.polys[j];
      this.slides[j].position.set(SLIDE * (poly[1][0] - poly[0][0]), SLIDE * (poly[1][1] - poly[0][1]), LIFT);
      (this.lines[j].material as LineDashedMaterial).dashSize = 0.12;
    }
    this.group.updateMatrixWorld(true);
  }
  setIdMode(on: boolean, ids: MeshBasicMaterial[] = []) {
    this.back.forEach((b) => (b.visible = !on));
    this.lines.forEach((l) => (l.visible = !on));
    this.front.forEach((m, f) => {
      if (on) {
        (m.userData.orig ??= m.material) as unknown;
        m.material = ids[f];
      } else if (m.userData.orig) m.material = m.userData.orig;
    });
  }
  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
    this.group.removeFromParent();
  }
}
