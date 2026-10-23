/**
 * WP0a SPIKE (THROWAWAY): persistent-node SVG fold view and HTML grips.
 * Per frame it only sets `transform`/attribute values and re-appends nodes when the draw order
 * changes. It never reads layout (no getBBox, getBoundingClientRect, offsetWidth).
 */
import {
  chooseShift,
  PX,
  TINTS,
  basis,
  centreOf,
  coincidentPairs,
  faceMatrix,
  isBack,
  letterAttr,
  pose,
  sortOrder,
  type FoldModel,
  type P2,
  type View,
} from "./fold";

const NS = "http://www.w3.org/2000/svg";
const f4 = (x: number) => (Math.round(x * 10000) / 10000).toString();

export class FoldView {
  readonly svg: SVGSVGElement;
  private groups: SVGGElement[] = [];
  private texts: SVGTextElement[] = [];
  private hatches: SVGPolygonElement[] = [];
  private outlines: SVGPolygonElement[] = [];
  private backState: boolean[] = [];
  private letterAttrs: string[] = [];
  private lastOrder: number[] = [];
  private size: number;
  /** Last matrices written, for placing grips (no layout reads). */
  lastMats: number[][] = [];
  lastPose: ReturnType<typeof pose> = [];
  lastView: View = { yaw: 0, pitch: 0 };

  constructor(
    host: HTMLElement,
    readonly model: FoldModel,
    private opts: { separate?: boolean; px?: number } = {},
  ) {
    const scale = opts.px ?? PX;
    this.size = Math.ceil(2 * model.radius * scale);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${this.size} ${this.size}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("data-spike", "throwaway");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<pattern id="hatch" width="0.2" height="0.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.2" stroke="#444" stroke-width="0.04"/></pattern>`;
    svg.append(defs);
    model.polys.forEach((poly, f) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("data-face", String(f));
      const pts = poly.map((p) => `${f4(p[0])},${f4(p[1])}`).join(" ");
      const o = document.createElementNS(NS, "polygon");
      o.setAttribute("points", pts);
      o.setAttribute("fill", TINTS[f % 6]);
      o.setAttribute("stroke", "#222");
      o.setAttribute("stroke-width", "0.05");
      o.setAttribute("stroke-linejoin", "round");
      const h = document.createElementNS(NS, "polygon");
      h.setAttribute("points", pts);
      h.setAttribute("fill", "url(#hatch)");
      h.setAttribute("stroke", "none");
      h.setAttribute("display", "none");
      const t = document.createElementNS(NS, "text");
      const c: P2 = centreOf(poly);
      t.setAttribute("font-size", "0.5");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("font-family", "sans-serif");
      t.setAttribute("font-weight", "700");
      t.setAttribute("fill", "#111");
      t.textContent = model.labels[f];
      t.setAttribute("transform", `translate(${f4(c[0])} ${f4(c[1])}) scale(1 -1)`);
      g.append(o, h, t);
      svg.append(g);
      this.groups.push(g);
      this.outlines.push(o);
      this.hatches.push(h);
      this.texts.push(t);
      this.backState.push(false);
    });
    host.append(svg);
    this.svg = svg;
  }

  /** Draw one frame. Returns the face order drawn (back to front). */
  setState(ang: number[], view: View): number[] {
    const m = this.model;
    const P = pose(m, ang);
    const b = basis(view);
    const scale = this.opts.px ?? PX;
    const half = this.size / 2;
    const mats: number[][] = [];
    for (let f = 0; f < P.length; f++) mats.push(faceMatrix(P[f], b, scale, half, half, m.centre));
    const shifts: P2[] = m.polys.map(() => [0, 0]);
    const dashed = new Set<number>();
    const order = sortOrder(m, P, b, "centroid");
    if (this.opts.separate)
      for (const [i, j] of coincidentPairs(m, P)) {
        shifts[j] = chooseShift(m, mats, order, i, j);
        dashed.add(j);
      }
    for (let f = 0; f < P.length; f++) {
      const mm = mats[f];
      this.groups[f].setAttribute(
        "transform",
        `matrix(${f4(mm[0])} ${f4(mm[1])} ${f4(mm[2])} ${f4(mm[3])} ${f4(mm[4] + shifts[f][0])} ${f4(mm[5] + shifts[f][1])})`,
      );
      const back = isBack(mm[0], mm[1], mm[2], mm[3]);
      if (back !== this.backState[f]) {
        this.backState[f] = back;
        this.hatches[f].setAttribute("display", back ? "inline" : "none");
      }
      const lt = letterAttr(mm, back, centreOf(m.polys[f]));
      if (lt !== this.letterAttrs[f]) {
        this.letterAttrs[f] = lt;
        this.texts[f].setAttribute("transform", lt);
      }
      const d = dashed.has(f);
      this.outlines[f].setAttribute("stroke-dasharray", d ? "0.12 0.08" : "none");
      this.outlines[f].setAttribute("stroke", this.opts.separate && shifts[f] ? "#222" : "#222");
    }
    let changed = order.length !== this.lastOrder.length;
    for (let i = 0; !changed && i < order.length; i++) changed = order[i] !== this.lastOrder[i];
    if (changed) {
      for (const f of order) this.svg.append(this.groups[f]);
      this.lastOrder = order;
    }
    this.lastMats = mats;
    this.lastPose = P;
    this.lastView = view;
    return order;
  }
  destroy() {
    this.svg.remove();
  }
}
