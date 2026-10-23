import {
  renderPlan,
  type AnnotationCatalogue,
  type AnnotationFeature,
  type AnnotationNote,
  type AnnotationPlan,
} from "../annotation/plan";
import { viewBoxFor, type Box, type Side } from "../ui/dimensions";

/** The measurable part of an area-perimeter specification, kept independent of the topic module. */
export interface FigureSpec {
  task: "missing-side" | "composite-area" | "composite-perimeter" | "practice";
  width: number;
  height: number;
  cutWidth: number;
  cutHeight: number;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  unknownSide: "width" | "height";
  knownMeasure: "area" | "perimeter";
  unit: string;
}
export interface FigureGeometry {
  scale: number;
  w: number;
  h: number;
  cw: number;
  ch: number;
  outline: string;
  /** Dashed outline of the removed corner, or undefined for a plain rectangle. */
  cut?: { x: number; y: number; width: number; height: number };
  figure: Box;
}

export function figureGeometry(s: FigureSpec): FigureGeometry {
  const scale = Math.max(
    4,
    Math.min(30, Math.floor(220 / Math.max(s.width, s.height))),
  );
  const w = s.width * scale,
    h = s.height * scale,
    cw = s.cutWidth * scale,
    ch = s.cutHeight * scale;
  const right = s.corner.endsWith("right"),
    top = s.corner.startsWith("top");
  const outline =
    s.task === "missing-side"
      ? `M0 0 H${w} V${h} H0 Z`
      : s.corner === "top-left"
        ? `M${cw} 0 H${w} V${h} H0 V${ch} H${cw} Z`
        : s.corner === "top-right"
          ? `M0 0 H${w - cw} V${ch} H${w} V${h} H0 Z`
          : s.corner === "bottom-left"
            ? `M0 0 H${w} V${h} H${cw} V${h - ch} H0 Z`
            : `M0 0 H${w} V${h - ch} H${w - cw} V${h} H0 Z`;
  const cut =
    s.task === "missing-side"
      ? undefined
      : {
          x: right ? w - cw : 0,
          y: top ? 0 : h - ch,
          width: cw,
          height: ch,
        };
  return {
    scale,
    w,
    h,
    cw,
    ch,
    outline,
    cut,
    figure: { minX: 0, minY: 0, maxX: w, maxY: h },
  };
}

const sq = (n: number) => `${n} cm²`;

/** Everything about the figure that could be dimensioned, with what the learner may be told. */
export function annotationCatalogue(s: FigureSpec): AnnotationCatalogue {
  const g = figureGeometry(s);
  const { w, h, cw, ch } = g;
  const right = s.corner.endsWith("right"),
    top = s.corner.startsWith("top");
  const features: AnnotationFeature[] = [
    {
      id: "outer-width",
      description: s.task === "missing-side" ? "the width" : "the outer width",
      value: s.width,
      unit: s.unit,
      disclosure:
        s.task === "missing-side" && s.unknownSide === "width"
          ? "unknown"
          : "given",
      needed: true,
      placements: {
        bottom: { from: { x: 0, y: h }, to: { x: w, y: h } },
        top: { from: { x: 0, y: 0 }, to: { x: w, y: 0 } },
      },
    },
    {
      id: "outer-height",
      description:
        s.task === "missing-side" ? "the height" : "the outer height",
      value: s.height,
      unit: s.unit,
      disclosure:
        s.task === "missing-side" && s.unknownSide === "height"
          ? "unknown"
          : "given",
      needed: true,
      placements: {
        left: { from: { x: 0, y: 0 }, to: { x: 0, y: h } },
        right: { from: { x: w, y: 0 }, to: { x: w, y: h } },
      },
    },
  ];
  const notes: AnnotationNote[] = [];
  if (s.task === "missing-side") {
    const measure =
      s.knownMeasure === "area"
        ? `area ${sq(s.width * s.height)}`
        : `perimeter ${2 * (s.width + s.height)} ${s.unit}`;
    notes.push({
      kind: "known-measure",
      description: "the given area or perimeter",
      text: measure,
      target: { x: w * 0.5, y: h * 0.5 },
      placements: { top: { x: w * 0.5, y: -24 } },
      needed: false,
    });
  } else {
    const cutSide: Side = top ? "top" : "bottom";
    const edgeY = top ? ch : h - ch;
    const sideY = top ? 0 : h;
    const cutX0 = right ? w - cw : 0,
      cutX1 = right ? w : cw;
    features.push({
      id: "cut-width",
      description: "the width of the removed corner",
      value: s.cutWidth,
      unit: s.unit,
      disclosure: "given",
      needed: true,
      placements: {
        [cutSide]: {
          from: { x: cutX0, y: edgeY },
          to: { x: cutX1, y: edgeY },
        },
      },
    });
    const edgeX = right ? w - cw : cw;
    const cutY0 = top ? 0 : h - ch,
      cutY1 = top ? ch : h;
    const cutHeightSide: Side = right ? "right" : "left";
    features.push({
      id: "cut-height",
      description: "the height of the removed corner",
      value: s.cutHeight,
      unit: s.unit,
      disclosure: "given",
      needed: true,
      placements: {
        [cutHeightSide]: {
          from: { x: edgeX, y: cutY0 },
          to: { x: edgeX, y: cutY1 },
        },
      },
    });
    if (s.task === "composite-perimeter") {
      features.push({
        id: "remaining-width",
        description: "the outside edge next to the removed corner (across)",
        value: s.width - s.cutWidth,
        unit: s.unit,
        disclosure: "derived",
        needed: false,
        placements: {
          [cutSide]: {
            from: { x: right ? 0 : cw, y: sideY },
            to: { x: right ? w - cw : w, y: sideY },
          },
        },
      });
      features.push({
        id: "remaining-height",
        description: "the outside edge next to the removed corner (up)",
        value: s.height - s.cutHeight,
        unit: s.unit,
        disclosure: "derived",
        needed: false,
        placements: {
          [cutHeightSide]: {
            from: { x: right ? w : 0, y: top ? ch : 0 },
            to: { x: right ? w : 0, y: top ? h : h - ch },
          },
        },
      });
    }
  }
  return { figure: g.figure, features, notes };
}

/** The deterministic baseline: every given dimension shown, every unknown or derived edge marked "?". */
export function defaultAnnotationPlan(s: FigureSpec): AnnotationPlan {
  const catalogue = annotationCatalogue(s);
  const right = s.corner.endsWith("right");
  const dimensions: AnnotationPlan["dimensions"] = catalogue.features.map(
    (feature) => {
      const side: Side =
        feature.id === "outer-width"
          ? "bottom"
          : feature.id === "outer-height"
            ? s.task === "missing-side" || !right
              ? "right"
              : "left"
            : (Object.keys(feature.placements)[0] as Side);
      return {
        feature: feature.id,
        side,
        show: feature.disclosure === "given" ? "value" : "unknown",
      };
    },
  );
  return {
    dimensions,
    notes: catalogue.notes.map((note) => ({
      kind: note.kind,
      placement: Object.keys(note.placements)[0] as Side,
    })),
  };
}

/** SVG for the figure and its annotation layer. Ink colours match the existing diagram palette. */
export function renderFigureSvg(
  s: FigureSpec,
  plan: AnnotationPlan = defaultAnnotationPlan(s),
): string {
  const g = figureGeometry(s);
  const { markup, layout } = renderPlan(annotationCatalogue(s), plan);
  const dashed = g.cut
    ? `<path d="M${g.cut.x} ${g.cut.y} h${g.cut.width} v${g.cut.height} h${-g.cut.width} Z" fill="none" stroke="#35634b" stroke-width="1.5" stroke-dasharray="5 4" opacity=".6"/>`
    : "";
  const viewBox = viewBoxFor(layout.bounds);
  const naturalWidth = Number(viewBox.split(" ")[2]);
  // Natural width keeps annotation text at a steady size; max-width lets narrow screens shrink it.
  return `<svg viewBox="${viewBox}" style="display:block;margin-inline:auto;width:${naturalWidth}px;max-width:100%;height:auto" aria-hidden="true" focusable="false"><path d="${g.outline}" fill="#f9d7ad" stroke="#35634b" stroke-width="3" stroke-linejoin="round"/>${dashed}${markup}</svg>`;
}
