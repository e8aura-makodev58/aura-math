/**
 * three.js scene graph of a folding net: one group per face in a hinge tree (parent face, pivot
 * on the crease, child face). Works without a WebGL context (only the matrices are needed in
 * tests); face pictures are canvas textures when a 2D canvas is available. Part of the lazily
 * loaded workbench chunk. Drawing only: nothing judged is read from here.
 */
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Texture,
} from "three";
import type { FoldModel, P2, V3 } from "./nets-bench";

/** Light tints, one per face; letters are near-black on them (contrast well above 4.5:1). */
export const FACE_TINTS = [
  "#f6d2cd",
  "#cfe2f6",
  "#d6edc9",
  "#f6e6b0",
  "#e3d5f1",
  "#cdebe6",
];
const OUTLINE = 0x24443d;
const MEET = 0xa1271b;
/** Paper-layer lift (net units) for the later of two faces that land on the same place. */
export const LIFT = 0.05;

const centreOf = (poly: P2[]): P2 => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
];

function faceTexture(
  letter: string,
  tint: string,
  back: boolean,
  at: [number, number],
  scale: number,
  seeThrough = false,
): Texture | null {
  if (typeof document === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  let g: CanvasRenderingContext2D | null = null;
  try {
    g = canvas.getContext("2d");
  } catch {
    g = null;
  }
  if (!g) return null;
  // a see-through face (the upper of two that meet) keeps an opaque letter on a pale wash
  if (seeThrough) g.globalAlpha = 0.45;
  g.fillStyle = tint;
  g.fillRect(0, 0, size, size);
  if (back) {
    // the outside of the paper: paler, with sparse hatching, so "which side" is not colour alone
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(60,60,60,0.35)";
    g.lineWidth = 3;
    for (let k = -size; k < 2 * size; k += 28) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + size, size);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.save();
  g.translate(at[0] * size, (1 - at[1]) * size);
  // seen from behind, the picture is mirrored, so the glyph is drawn mirrored to read normally
  if (back) g.scale(-1, 1);
  g.font = `700 ${Math.round(size * scale)}px "Atkinson Hyperlegible Next", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = size * 0.04;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.strokeText(letter, 0, size * 0.02);
  g.fillStyle = "#111111";
  g.fillText(letter, 0, size * 0.02);
  g.restore();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface FacePictures {
  front: Texture | null;
  back: Texture | null;
  /** Pictures with the letter moved off centre, made when two faces first meet. */
  frontShifted: Texture | null;
  backShifted: Texture | null;
  shiftedAt: [number, number];
  /** Picture position (0 to 1 across the face's box) to the face's own flat coordinates. */
  local(at: [number, number]): [number, number];
  scale: number;
  make(
    back: boolean,
    at: [number, number],
    scale: number,
    seeThrough?: boolean,
  ): Texture | null;
}

export class FoldScene {
  readonly group = new Group();
  readonly faces: Group[] = [];
  private lifts: Group[] = [];
  private pivots: Group[] = [];
  private fronts: Mesh[] = [];
  private backs: Mesh[] = [];
  private lines: LineLoop[] = [];
  private pictures: FacePictures[] = [];
  private geometries: BufferGeometry[] = [];
  private materials: Material[] = [];
  private textures: Texture[] = [];
  private solid: LineBasicMaterial;
  private dashed: LineDashedMaterial;
  private marked = "";

  constructor(
    readonly model: FoldModel,
    options: { textures?: boolean } = {},
  ) {
    const textures = options.textures ?? typeof document !== "undefined";
    this.solid = new LineBasicMaterial({ color: OUTLINE });
    this.dashed = new LineDashedMaterial({
      color: MEET,
      dashSize: 0.09,
      gapSize: 0.06,
    });
    this.materials.push(this.solid, this.dashed);
    model.polys.forEach((poly, f) => {
      const xs = poly.map((p) => p[0]),
        ys = poly.map((p) => p[1]);
      const x0 = Math.min(...xs),
        y0 = Math.min(...ys),
        w = Math.max(...xs) - x0,
        h = Math.max(...ys) - y0;
      const positions: number[] = [],
        uvs: number[] = [];
      for (const [x, y] of poly) {
        positions.push(x, y, 0);
        uvs.push((x - x0) / w, (y - y0) / h);
      }
      const index: number[] = [];
      for (let k = 1; k + 1 < poly.length; k++) index.push(0, k, k + 1);
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      geometry.setIndex(index);
      const outline = new BufferGeometry();
      outline.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      this.geometries.push(geometry, outline);
      const c = centreOf(poly);
      const at: [number, number] = [(c[0] - x0) / w, (c[1] - y0) / h];
      // letters are about half the face; faces of the larger solids get proportionally smaller ones
      const scale = Math.min(0.55, 0.55 / Math.max(1, Math.min(w, h) / 1.6));
      const shifted: [number, number] = [at[0] + 0.2, at[1] + 0.2];
      const tint = FACE_TINTS[f % FACE_TINTS.length];
      const make = (
        back: boolean,
        where: [number, number],
        s: number,
        seeThrough = false,
      ) => {
        const t = textures
          ? faceTexture(model.labels[f], tint, back, where, s, seeThrough)
          : null;
        if (t) this.textures.push(t);
        return t;
      };
      const pictures: FacePictures = {
        front: make(false, at, scale),
        back: make(true, at, scale),
        frontShifted: null,
        backShifted: null,
        shiftedAt: shifted,
        local: ([u, v]) => [x0 + u * w, y0 + v * h],
        scale,
        make,
      };
      this.pictures.push(pictures);
      const material = (back: boolean) => {
        const m = new MeshBasicMaterial({
          color: pictures.front ? 0xffffff : tint,
          map: back ? pictures.back : pictures.front,
          side: back ? BackSide : FrontSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
        this.materials.push(m);
        return m;
      };
      const face = new Group();
      const lift = new Group();
      face.add(lift);
      const front = new Mesh(geometry, material(false));
      const back = new Mesh(geometry, material(true));
      const line = new LineLoop(outline, this.solid);
      lift.add(front, back, line);
      this.faces.push(face);
      this.lifts.push(lift);
      this.fronts.push(front);
      this.backs.push(back);
      this.lines.push(line);
    });
    this.group.add(this.faces[model.root]);
    model.hinges.forEach((h) => {
      const pivot = new Group();
      pivot.position.set(h.a[0], h.a[1], 0);
      const inner = new Group();
      inner.position.set(-h.a[0], -h.a[1], 0);
      this.faces[h.parent].add(pivot);
      pivot.add(inner);
      inner.add(this.faces[h.child]);
      this.pivots.push(pivot);
    });
    this.group.updateMatrixWorld(true);
  }

  /** Sets every crease turn (radians) and updates world matrices. */
  setAngles(angles: number[]) {
    const axis = new Vector3();
    this.model.hinges.forEach((h, i) => {
      axis.set(h.u[0], h.u[1], 0);
      this.pivots[i].quaternion.setFromAxisAngle(axis, angles[i]);
    });
    this.group.updateMatrixWorld(true);
  }
  /** World corners of face f (read back from the scene graph). */
  corners(f: number): V3[] {
    const v = new Vector3();
    return this.model.polys[f].map(([x, y]) => {
      v.set(x, y, 0).applyMatrix4(this.faces[f].matrixWorld);
      return [v.x, v.y, v.z];
    });
  }
  /** World point of a crease midpoint (for the crease number badges). */
  creaseMidpoint(i: number): Vector3 {
    const h = this.model.hinges[i];
    return new Vector3(
      (h.a[0] + h.b[0]) / 2,
      (h.a[1] + h.b[1]) / 2,
      0,
    ).applyMatrix4(this.faces[h.parent].matrixWorld);
  }
  /** Pairs of faces whose corners coincide within `tolerance` in the current picture. */
  coincident(tolerance = 1e-6): [number, number][] {
    const all = this.model.polys.map((_, f) => this.corners(f));
    const out: [number, number][] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (
          all[i].length === all[j].length &&
          all[i].every((a) =>
            all[j].some(
              (b) =>
                Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tolerance,
            ),
          )
        )
          out.push([i, j]);
    return out;
  }
  /**
   * Faces that land on the same place stay distinguishable: the later one is lifted a paper layer
   * and both get dashed red outlines and letters moved apart, so both letters stay readable.
   */
  markCoincident(pairs: [number, number][]) {
    const key = JSON.stringify(pairs);
    if (key === this.marked) return;
    this.marked = key;
    const involved = new Set(pairs.flat());
    const later = new Set(pairs.map((p) => p[1]));
    // the earlier face's letter goes to the corner of its picture farthest from the later letter
    const spot = new Map<number, [number, number]>();
    const world = (f: number, at: [number, number]) =>
      new Vector3(...this.pictures[f].local(at), 0).applyMatrix4(
        this.faces[f].matrixWorld,
      );
    for (const [i, j] of pairs) {
      spot.set(j, this.pictures[j].shiftedAt);
      const target = world(j, this.pictures[j].shiftedAt);
      const options: [number, number][] = [
        [0.3, 0.3],
        [0.3, 0.7],
        [0.7, 0.3],
        [0.7, 0.7],
      ];
      spot.set(
        i,
        options.reduce((best, o) =>
          world(i, o).distanceTo(target) > world(i, best).distanceTo(target)
            ? o
            : best,
        ),
      );
    }
    const all = this.model.polys.flatMap((_, f) => this.corners(f));
    const mid = new Vector3(
      ...[0, 1, 2].map((k) => all.reduce((t, p) => t + p[k], 0) / all.length),
    );
    this.model.polys.forEach((_, f) => {
      // the later face is lifted outwards, away from the middle of the folded shape
      let sign = 0;
      if (later.has(f)) {
        const c = this.corners(f);
        const centre = new Vector3(
          ...[0, 1, 2].map((k) => c.reduce((t, p) => t + p[k], 0) / c.length),
        );
        const normal = new Vector3()
          .setFromMatrixColumn(this.faces[f].matrixWorld, 2)
          .normalize();
        sign = normal.dot(centre.sub(mid)) >= 0 ? 1 : -1;
      }
      this.lifts[f].position.set(0, 0, sign * LIFT);
      const line = this.lines[f];
      line.material = involved.has(f) ? this.dashed : this.solid;
      if (involved.has(f)) line.computeLineDistances();
      const p = this.pictures[f];
      const front = this.fronts[f].material as MeshBasicMaterial;
      const back = this.backs[f].material as MeshBasicMaterial;
      if (involved.has(f) && p.front) {
        const shift = spot.get(f) ?? p.shiftedAt;
        p.frontShifted ??= p.make(false, shift, p.scale * 0.7, later.has(f));
        p.backShifted ??= p.make(true, shift, p.scale * 0.7, later.has(f));
        front.map = p.frontShifted;
        back.map = p.backShifted;
      } else {
        front.map = p.front;
        back.map = p.back;
      }
      // both faces of a meeting pair are see-through so both letters stay visible
      for (const m of [front, back]) {
        m.transparent = later.has(f);
        m.opacity = later.has(f) && !p.front ? 0.6 : 1;
        m.depthWrite = !later.has(f);
      }
      front.needsUpdate = back.needsUpdate = true;
    });
    this.group.updateMatrixWorld(true);
  }
  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.group.removeFromParent();
  }
}
