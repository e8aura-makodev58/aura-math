/** WP0a SPIKE (throwaway): read faces back out of the SVG TEXT the renderer produced. */
import type { P2, V3 } from "../fold";
import { PX } from "../fold";

export interface ReadFace {
  face: number;
  back: boolean;
  m: number[];
  /** local polygon points of the outline polygon */
  poly: P2[];
  textFlipDet: number;
  font: number;
  letter: string;
  rot: number;
  centre: P2;
  fragClip?: P2[];
}
export interface ReadSvg {
  size: number;
  faces: ReadFace[]; // document order = painter's order (back to front)
}
const num = (s: string) => s.trim().split(/[ ,]+/).map(Number);

export function readSvg(svg: string): ReadSvg {
  const size = Number(/viewBox="0 0 (\d+) /.exec(svg)![1]);
  const faces: ReadFace[] = [];
  const re =
    /(?:<clipPath id="(c\d+)"><polygon points="([^"]*)"\/><\/clipPath>)?<g data-face="(\d+)" data-back="(\d)" transform="matrix\(([^)]*)\)"[^>]*>(.*?)<\/g>/g;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(svg))) {
    const body = mt[6];
    const pts = /<polygon points="([^"]*)"/.exec(body)![1]
      .trim()
      .split(" ")
      .map((p): P2 => {
        const [x, y] = p.split(",").map(Number);
        return [x, y];
      });
    const tt = /<text[^>]*transform="translate\(([^)]*)\) rotate\(([-\d.]+)\) (scale\([^)]*\))"[^>]*font-size="([\d.]+)"[^>]*>(.)<\/text>/.exec(body)!;
    const [cx, cy] = num(tt[1]);
    const sc = num(/scale\(([^)]*)\)/.exec(tt[3])![1]);
    faces.push({
      face: Number(mt[3]),
      back: mt[4] === "1",
      m: num(mt[5]),
      poly: pts,
      textFlipDet: sc[0] * sc[1],
      font: Number(tt[4]),
      letter: tt[5],
      rot: Number(tt[2]),
      centre: [cx, cy],
      fragClip: mt[2]
        ? mt[2].trim().split(" ").map((p): P2 => {
            const [x, y] = p.split(",").map(Number);
            return [x, y];
          })
        : undefined,
    });
  }
  return { size, faces };
}
export const applyMat = (m: number[], p: P2): P2 => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];

/**
 * 3D corners recovered from two read-backs: a view from straight above (x, y) and one from the
 * side (pitch 90: x, z). Both are pure projections, so no model arithmetic is reused.
 */
export function corners3d(top: ReadSvg, side: ReadSvg, centre: V3, scale = PX): Map<number, V3[]> {
  const out = new Map<number, V3[]>();
  for (const ft of top.faces) {
    const fs = side.faces.find((f) => f.face === ft.face)!;
    const cs = ft.poly.map((p, k): V3 => {
      const a = applyMat(ft.m, p),
        b = applyMat(fs.m, fs.poly[k]);
      return [
        (a[0] - top.size / 2) / scale + centre[0],
        -(a[1] - top.size / 2) / scale + centre[1],
        -(b[1] - side.size / 2) / scale + centre[2],
      ];
    });
    out.set(ft.face, cs);
  }
  return out;
}
