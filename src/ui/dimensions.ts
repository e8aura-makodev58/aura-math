/**
 * Deterministic engineering-style dimensioning for SVG diagrams.
 *
 * Pure functions only: the same inputs always produce the same geometry and markup, so tests can
 * assert exact positions and an agentic layer can propose *what* to annotate without ever drawing.
 *
 * Drafting terms used here:
 * - extension lines project from the feature to the dimension line;
 * - the dimension line carries the measurement, ended by arrowheads (or ticks when space is tight);
 * - a leader line joins a note to a specific point on the figure.
 */
export interface Point {
  x: number;
  y: number;
}
export interface Segment {
  a: Point;
  b: Point;
}
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export type Side = "top" | "bottom" | "left" | "right";
export type Terminator = "arrow" | "tick";

export interface LinearDimension {
  id: string;
  /** Endpoints of the measured feature, in diagram units. */
  from: Point;
  to: Point;
  /** Side of the feature on which the dimension line sits. */
  side: Side;
  /** Distance from the feature to the dimension line. Omit to stack automatically. */
  offset?: number;
  /** Text shown on the dimension line, for example "12 cm" or "?". */
  label: string;
  /** An unknown (to be found) dimension is drawn with the emphasised "?" style. */
  unknown?: boolean;
}
export interface Leader {
  id: string;
  /** Point on the figure the note refers to; drawn with a small dot. */
  target: Point;
  /** Where the leader meets the note. */
  anchor: Point;
  text: string;
}
export const DIMENSION_STYLE = {
  fontSize: 15,
  charWidth: 0.58,
  arrowLength: 9,
  arrowHalfWidth: 3.2,
  extensionGap: 4,
  extensionOvershoot: 5,
  baseOffset: 26,
  stackStep: 24,
  tickLength: 10,
  minArrowSpan: 30,
  textPad: 4,
  margin: 8,
  leaderLanding: 10,
} as const;

export interface LaidOutDimension {
  id: string;
  extension: [Segment, Segment];
  line: Segment;
  terminator: Terminator;
  arrows: Point[][];
  ticks: Segment[];
  label: {
    text: string;
    x: number;
    y: number;
    anchor: "start" | "middle" | "end";
    box: Box;
    unknown: boolean;
  };
  bounds: Box;
}
export interface LaidOutLeader {
  id: string;
  target: Point;
  line: Point[];
  text: {
    text: string;
    x: number;
    y: number;
    anchor: "start" | "end";
    box: Box;
  };
  bounds: Box;
}
export interface DimensionLayout {
  dimensions: LaidOutDimension[];
  leaders: LaidOutLeader[];
  bounds: Box;
}

const SIDE_VECTOR: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const round = (value: number) => Math.round(value * 100) / 100;
const point = (x: number, y: number): Point => ({ x: round(x), y: round(y) });
const add = (p: Point, v: Point, k: number): Point =>
  point(p.x + v.x * k, p.y + v.y * k);

export function boxOf(points: Point[]): Box {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function unionBox(boxes: Box[]): Box {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}
export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return (
    a.minX < b.maxX + gap &&
    b.minX < a.maxX + gap &&
    a.minY < b.maxY + gap &&
    b.minY < a.maxY + gap
  );
}
/** Width estimate: layout must not depend on browser font metrics, to stay deterministic. */
export function textWidth(text: string): number {
  return (
    Math.ceil(
      [...text].length * DIMENSION_STYLE.fontSize * DIMENSION_STYLE.charWidth,
    ) +
    DIMENSION_STYLE.textPad * 2
  );
}
const textHeight = () => Math.ceil(DIMENSION_STYLE.fontSize * 1.3);

function normalFor(from: Point, to: Point, side: Side): Point {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy);
  if (!(length > 0)) throw new Error("A dimension needs two distinct points.");
  const perpendicular = { x: dy / length, y: -dx / length };
  const wanted = SIDE_VECTOR[side];
  const dot = perpendicular.x * wanted.x + perpendicular.y * wanted.y;
  if (Math.abs(dot) < 1e-9)
    throw new Error(`Side ${side} is parallel to the measured feature.`);
  return dot > 0
    ? point(perpendicular.x, perpendicular.y)
    : point(-perpendicular.x, -perpendicular.y);
}

export function layoutDimension(
  spec: LinearDimension,
  offset: number,
): LaidOutDimension {
  const S = DIMENSION_STYLE;
  const n = normalFor(spec.from, spec.to, spec.side);
  const length = Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y);
  const u = point(
    (spec.to.x - spec.from.x) / length,
    (spec.to.y - spec.from.y) / length,
  );
  const extension: [Segment, Segment] = [spec.from, spec.to].map((p) => ({
    a: add(p, n, S.extensionGap),
    b: add(p, n, offset + S.extensionOvershoot),
  })) as [Segment, Segment];
  const p1 = add(spec.from, n, offset),
    p2 = add(spec.to, n, offset);
  const terminator: Terminator = length < S.minArrowSpan ? "tick" : "arrow";
  const arrows: Point[][] = [];
  const ticks: Segment[] = [];
  if (terminator === "arrow") {
    const wing = { x: -u.y, y: u.x };
    for (const [tip, direction] of [
      [p1, 1],
      [p2, -1],
    ] as const) {
      const base = add(tip, u, direction * S.arrowLength);
      arrows.push([
        tip,
        add(base, wing, S.arrowHalfWidth),
        add(base, wing, -S.arrowHalfWidth),
      ]);
    }
  } else {
    const slash = point(u.x - u.y, u.y + u.x);
    const half = S.tickLength / 2 / Math.SQRT2;
    for (const tip of [p1, p2])
      ticks.push({ a: add(tip, slash, -half), b: add(tip, slash, half) });
  }
  const mid = point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  const width = textWidth(spec.label),
    height = textHeight();
  const horizontal = Math.abs(n.y) >= Math.abs(n.x);
  let label: LaidOutDimension["label"];
  if (horizontal) {
    const y = mid.y + n.y * (height / 2 + 3);
    label = {
      text: spec.label,
      x: mid.x,
      y,
      anchor: "middle",
      unknown: !!spec.unknown,
      box: {
        minX: mid.x - width / 2,
        maxX: mid.x + width / 2,
        minY: y - height / 2,
        maxY: y + height / 2,
      },
    };
  } else {
    const gap = 7;
    const anchor = n.x > 0 ? "start" : "end";
    const x = mid.x + n.x * gap;
    label = {
      text: spec.label,
      x,
      y: mid.y,
      anchor,
      unknown: !!spec.unknown,
      box: {
        minX: anchor === "start" ? x : x - width,
        maxX: anchor === "start" ? x + width : x,
        minY: mid.y - height / 2,
        maxY: mid.y + height / 2,
      },
    };
  }
  const bounds = unionBox([
    boxOf([...extension.flatMap((e) => [e.a, e.b]), p1, p2]),
    label.box,
  ]);
  return {
    id: spec.id,
    extension,
    line: { a: p1, b: p2 },
    terminator,
    arrows,
    ticks,
    label,
    bounds,
  };
}

export function layoutLeader(spec: Leader): LaidOutLeader {
  const S = DIMENSION_STYLE;
  const toRight = spec.anchor.x >= spec.target.x;
  const landing = point(
    spec.anchor.x + (toRight ? S.leaderLanding : -S.leaderLanding),
    spec.anchor.y,
  );
  const width = textWidth(spec.text),
    height = textHeight();
  const x = landing.x + (toRight ? 4 : -4);
  const anchor = toRight ? "start" : "end";
  const box: Box = {
    minX: anchor === "start" ? x : x - width,
    maxX: anchor === "start" ? x + width : x,
    minY: spec.anchor.y - height / 2,
    maxY: spec.anchor.y + height / 2,
  };
  const line = [spec.target, spec.anchor, landing];
  return {
    id: spec.id,
    target: spec.target,
    line,
    text: { text: spec.text, x, y: spec.anchor.y, anchor, box },
    bounds: unionBox([boxOf(line), box]),
  };
}

/**
 * Offset that puts an axis-aligned dimension at `distance` outside the figure edge on its side.
 * The offset is measured from the measured feature itself.
 */
function offsetAt(figure: Box, d: LinearDimension, distance: number): number {
  const S = DIMENSION_STYLE;
  const line =
    d.side === "top"
      ? figure.minY - distance
      : d.side === "bottom"
        ? figure.maxY + distance
        : d.side === "left"
          ? figure.minX - distance
          : figure.maxX + distance;
  const coordinate =
    d.side === "top" || d.side === "bottom" ? d.from.y : d.from.x;
  const sign = d.side === "top" || d.side === "left" ? -1 : 1;
  return Math.max((line - coordinate) * sign, S.extensionGap * 2);
}
const axisAligned = (d: LinearDimension) =>
  d.from.y === d.to.y || d.from.x === d.to.x;
/** Interval a dimension occupies along its side's axis, including its label. */
function occupiedRange(d: LinearDimension): [number, number] {
  const horizontal = d.side === "top" || d.side === "bottom";
  const a = horizontal ? d.from.x : d.from.y,
    b = horizontal ? d.to.x : d.to.y;
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  const mid = (lo + hi) / 2;
  const half = (horizontal ? textWidth(d.label) : textHeight()) / 2;
  return [Math.min(lo, mid - half), Math.max(hi, mid + half)];
}

/**
 * Lays out dimensions and leaders. Dimensions without an explicit offset are assigned tiers per
 * side: shorter spans sit nearest the figure and spans that do not overlap share a tier, so a chain
 * of adjacent dimensions forms one continuous line while nested ones never cross.
 */
export function layoutDimensions(
  figure: Box,
  dimensions: LinearDimension[],
  leaders: Leader[] = [],
): DimensionLayout {
  const S = DIMENSION_STYLE;
  const ids = new Set<string>();
  for (const item of [...dimensions, ...leaders]) {
    if (ids.has(item.id))
      throw new Error(`Duplicate annotation id ${item.id}.`);
    ids.add(item.id);
  }
  const offsets = new Map<string, number>();
  for (const side of Object.keys(SIDE_VECTOR) as Side[]) {
    const group = dimensions
      .filter((d) => d.side === side && d.offset === undefined)
      .sort(
        (a, b) =>
          Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) -
            Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y) ||
          a.id.localeCompare(b.id),
      );
    const tiers: [number, number][][] = [];
    const assigned: { d: LinearDimension; tier: number }[] = [];
    group.forEach((d, index) => {
      if (!axisAligned(d)) {
        offsets.set(d.id, S.baseOffset + index * S.stackStep);
        return;
      }
      const range = occupiedRange(d);
      let tier = tiers.findIndex((used) =>
        used.every(([lo, hi]) => range[1] <= lo || range[0] >= hi),
      );
      if (tier < 0) {
        tier = tiers.length;
        tiers.push([]);
      }
      tiers[tier].push(range);
      assigned.push({ d, tier });
    });
    // Horizontal labels sit above or below their line, so a fixed step clears them. Vertical
    // labels extend sideways, so each tier is spaced by the widest label of the tier inside it.
    const vertical = side === "left" || side === "right";
    const distances: number[] = [];
    let distance: number = S.baseOffset;
    for (let t = 0; t < tiers.length; t++) {
      distances.push(distance);
      const widest = Math.max(
        0,
        ...assigned
          .filter((x) => x.tier === t)
          .map((x) => textWidth(x.d.label)),
      );
      distance += vertical ? Math.max(S.stackStep, widest + 16) : S.stackStep;
    }
    for (const { d, tier } of assigned)
      offsets.set(d.id, offsetAt(figure, d, distances[tier]));
  }
  const laid = dimensions.map((d) =>
    layoutDimension(d, d.offset ?? offsets.get(d.id)!),
  );
  const laidLeaders = leaders.map(layoutLeader);
  const bounds = unionBox([
    figure,
    ...laid.map((d) => d.bounds),
    ...laidLeaders.map((l) => l.bounds),
  ]);
  return { dimensions: laid, leaders: laidLeaders, bounds };
}

/** Pairs of label or note boxes that would overlap (a layout defect the caller must fix). */
export function labelCollisions(layout: DimensionLayout): [string, string][] {
  const boxes: [string, Box][] = [
    ...layout.dimensions.map((d) => [d.id, d.label.box] as [string, Box]),
    ...layout.leaders.map((l) => [l.id, l.text.box] as [string, Box]),
  ];
  const result: [string, string][] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxesOverlap(boxes[i][1], boxes[j][1], 2))
        result.push([boxes[i][0], boxes[j][0]]);
  return result;
}

/** SVG viewBox covering the figure and every annotation, with a small margin. */
export function viewBoxFor(bounds: Box): string {
  const m = DIMENSION_STYLE.margin;
  const minX = Math.floor(bounds.minX - m),
    minY = Math.floor(bounds.minY - m);
  const width = Math.ceil(bounds.maxX + m) - minX,
    height = Math.ceil(bounds.maxY + m) - minY;
  return `${minX} ${minY} ${width} ${height}`;
}

const escapeText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const n2 = (p: Point) => `${p.x},${p.y}`;
const seg = (s: Segment, cls: string) =>
  `<line class="${cls}" x1="${s.a.x}" y1="${s.a.y}" x2="${s.b.x}" y2="${s.b.y}"/>`;

/** Markup for the annotation layer. Colours are presentation attributes so the layer is self-contained. */
export function renderDimensionLayer(layout: DimensionLayout): string {
  const S = DIMENSION_STYLE;
  const ink = "#3b5a4a";
  const halo =
    'stroke="#fffdf8" stroke-width="4" stroke-linejoin="round" paint-order="stroke"';
  const text = (
    t: string,
    x: number,
    y: number,
    anchor: string,
    unknown: boolean,
    cls: string,
  ) =>
    `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${S.fontSize}" font-weight="${unknown ? 700 : 600}" fill="${unknown ? "#9a3b24" : "#243b31"}" ${halo}>${escapeText(t)}</text>`;
  const parts: string[] = [];
  for (const d of layout.dimensions) {
    parts.push(
      `<g class="dimension" data-dimension="${escapeText(d.id)}">`,
      seg(d.extension[0], "dim-extension"),
      seg(d.extension[1], "dim-extension"),
      seg(d.line, "dim-line"),
      ...d.arrows.map(
        (a) =>
          `<polygon class="dim-arrow" points="${a.map(n2).join(" ")}" fill="${ink}" stroke="none"/>`,
      ),
      ...d.ticks.map((t) => seg(t, "dim-tick")),
      text(
        d.label.text,
        d.label.x,
        d.label.y,
        d.label.anchor,
        d.label.unknown,
        "dim-text",
      ),
      "</g>",
    );
  }
  for (const l of layout.leaders)
    parts.push(
      `<g class="leader" data-leader="${escapeText(l.id)}">`,
      `<polyline class="leader-line" points="${l.line.map(n2).join(" ")}" fill="none"/>`,
      `<circle class="leader-dot" cx="${l.target.x}" cy="${l.target.y}" r="3" fill="${ink}" stroke="none"/>`,
      text(
        l.text.text,
        l.text.x,
        l.text.y,
        l.text.anchor,
        false,
        "leader-text",
      ),
      "</g>",
    );
  return `<g class="dimension-layer" aria-hidden="true" stroke="${ink}" stroke-width="1.3" stroke-linecap="round">${parts.join("")}</g>`;
}
