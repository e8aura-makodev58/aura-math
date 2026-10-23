import { describe, expect, it } from "vitest";
import {
  DIMENSION_STYLE,
  labelCollisions,
  layoutDimension,
  layoutDimensions,
  renderDimensionLayer,
  textWidth,
  viewBoxFor,
  type LinearDimension,
} from "../src/ui/dimensions";
import { validatePlan, type AnnotationPlan } from "../src/annotation/plan";
import {
  annotationCatalogue,
  defaultAnnotationPlan,
  renderFigureSvg,
  type FigureSpec,
} from "../src/topics/area-perimeter-figure";

const horizontal: LinearDimension = {
  id: "w",
  from: { x: 0, y: 100 },
  to: { x: 200, y: 100 },
  side: "bottom",
  label: "12 cm",
};

describe("deterministic dimension engine", () => {
  it("places extension lines, dimension line and arrowheads exactly", () => {
    const d = layoutDimension(horizontal, 30);
    const S = DIMENSION_STYLE;
    expect(d.line).toEqual({ a: { x: 0, y: 130 }, b: { x: 200, y: 130 } });
    expect(d.extension[0]).toEqual({
      a: { x: 0, y: 100 + S.extensionGap },
      b: { x: 0, y: 130 + S.extensionOvershoot },
    });
    expect(d.extension[1].a.x).toBe(200);
    expect(d.terminator).toBe("arrow");
    expect(d.arrows).toHaveLength(2);
    // Arrow tips sit on the dimension line ends and point outwards.
    expect(d.arrows[0][0]).toEqual({ x: 0, y: 130 });
    expect(d.arrows[1][0]).toEqual({ x: 200, y: 130 });
    expect(d.arrows[0][1].x).toBeCloseTo(S.arrowLength);
    expect(d.arrows[1][1].x).toBeCloseTo(200 - S.arrowLength);
    // Label sits on the outer side of the line, centred.
    expect(d.label.anchor).toBe("middle");
    expect(d.label.x).toBe(100);
    expect(d.label.y).toBeGreaterThan(130);
  });

  it("is deterministic: identical input gives identical geometry and markup", () => {
    const run = () => {
      const layout = layoutDimensions(
        { minX: 0, minY: 0, maxX: 200, maxY: 100 },
        [horizontal],
      );
      return JSON.stringify(layout) + renderDimensionLayer(layout);
    };
    expect(run()).toBe(run());
  });

  it("puts vertical labels beside the line and switches to ticks on short spans", () => {
    const vertical = layoutDimension(
      {
        id: "h",
        from: { x: 200, y: 0 },
        to: { x: 200, y: 100 },
        side: "right",
        label: "8 cm",
      },
      30,
    );
    expect(vertical.label.anchor).toBe("start");
    expect(vertical.label.x).toBeGreaterThan(230);
    const short = layoutDimension(
      {
        id: "s",
        from: { x: 0, y: 0 },
        to: { x: 20, y: 0 },
        side: "top",
        label: "1",
      },
      30,
    );
    expect(short.terminator).toBe("tick");
    expect(short.arrows).toHaveLength(0);
    expect(short.ticks).toHaveLength(2);
  });

  it("rejects degenerate input: zero length, parallel side, duplicate ids", () => {
    expect(() =>
      layoutDimension({ ...horizontal, to: horizontal.from }, 30),
    ).toThrow();
    expect(() => layoutDimension({ ...horizontal, side: "left" }, 30)).toThrow(
      /parallel/,
    );
    expect(() =>
      layoutDimensions({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, [
        horizontal,
        horizontal,
      ]),
    ).toThrow(/Duplicate/);
  });

  it("nests overlapping dimensions on separate tiers and chains disjoint ones on one line", () => {
    const figure = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const chain = layoutDimensions(figure, [
      {
        ...horizontal,
        id: "a",
        from: { x: 0, y: 100 },
        to: { x: 120, y: 100 },
        side: "bottom",
      },
      {
        ...horizontal,
        id: "b",
        from: { x: 120, y: 100 },
        to: { x: 200, y: 100 },
        side: "bottom",
      },
    ]);
    expect(chain.dimensions[0].line.a.y).toBe(chain.dimensions[1].line.a.y);
    const nested = layoutDimensions(figure, [
      { ...horizontal, id: "all" },
      { ...horizontal, id: "part", to: { x: 80, y: 100 } },
    ]);
    const all = nested.dimensions.find((d) => d.id === "all")!;
    const part = nested.dimensions.find((d) => d.id === "part")!;
    // The shorter span is nearer the figure.
    expect(part.line.a.y).toBeLessThan(all.line.a.y);
    expect(labelCollisions(nested)).toEqual([]);
  });

  it("fits the viewBox around every annotation so nothing clips", () => {
    const layout = layoutDimensions(
      { minX: 0, minY: 0, maxX: 200, maxY: 100 },
      [
        horizontal,
        {
          id: "h",
          from: { x: 200, y: 0 },
          to: { x: 200, y: 100 },
          side: "right",
          label: "outer height 80 cm",
        },
      ],
    );
    const [x, y, w, h] = viewBoxFor(layout.bounds).split(" ").map(Number);
    for (const d of layout.dimensions) {
      expect(d.label.box.minX).toBeGreaterThanOrEqual(x);
      expect(d.label.box.maxX).toBeLessThanOrEqual(x + w);
      expect(d.label.box.minY).toBeGreaterThanOrEqual(y);
      expect(d.label.box.maxY).toBeLessThanOrEqual(y + h);
    }
    expect(textWidth("outer height 80 cm")).toBeGreaterThan(textWidth("8 cm"));
  });

  it("escapes label text", () => {
    const layout = layoutDimensions(
      { minX: 0, minY: 0, maxX: 200, maxY: 100 },
      [{ ...horizontal, label: '<img src=x onerror="1">' }],
    );
    const markup = renderDimensionLayer(layout);
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;img");
  });
});

const corners = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
const tasks = [
  "missing-side",
  "composite-area",
  "composite-perimeter",
  "practice",
] as const;
function spec(
  task: FigureSpec["task"],
  corner: FigureSpec["corner"],
  width: number,
  height: number,
  cutWidth: number,
  cutHeight: number,
  unknownSide: FigureSpec["unknownSide"] = "width",
  knownMeasure: FigureSpec["knownMeasure"] = "area",
): FigureSpec {
  return {
    task,
    corner,
    width,
    height,
    cutWidth: task === "missing-side" ? 0 : cutWidth,
    cutHeight: task === "missing-side" ? 0 : cutHeight,
    unknownSide,
    knownMeasure,
    unit: "cm",
  };
}
const labelsOf = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("area-perimeter dimensioning", () => {
  it("default plans validate, never collide and keep hidden values out of the drawing", () => {
    const sizes: [number, number, number, number][] = [
      [14, 8, 4, 3],
      [12, 8, 4, 3],
      [30, 30, 29, 29],
      [2, 2, 1, 1],
      [30, 3, 29, 2],
      [3, 30, 2, 29],
      [11, 10, 3, 2],
    ];
    let checked = 0;
    for (const task of tasks)
      for (const corner of corners)
        for (const [w, h, cw, ch] of sizes)
          for (const unknownSide of ["width", "height"] as const)
            for (const knownMeasure of ["area", "perimeter"] as const) {
              const s = spec(
                task,
                corner,
                w,
                h,
                cw,
                ch,
                unknownSide,
                knownMeasure,
              );
              const catalogue = annotationCatalogue(s);
              const plan = defaultAnnotationPlan(s);
              expect(
                validatePlan(plan, catalogue),
                `${task} ${corner} ${w}x${h} cut ${cw}x${ch}`,
              ).toEqual([]);
              const svg = renderFigureSvg(s, plan);
              const labels = labelsOf(svg);
              // Every given needed dimension is drawn with its value.
              for (const f of catalogue.features)
                if (f.disclosure === "given" && f.needed)
                  expect(labels).toContain(`${f.value} cm`);
              // Unknown and derived edges are only ever drawn as "?".
              for (const f of catalogue.features)
                if (f.disclosure !== "given") {
                  const given = new Set(
                    catalogue.features
                      .filter((g) => g.disclosure === "given")
                      .map((g) => `${g.value} cm`),
                  );
                  if (!given.has(`${f.value} cm`))
                    expect(labels).not.toContain(`${f.value} cm`);
                  expect(labels).toContain("?");
                }
              checked++;
            }
    expect(checked).toBe(tasks.length * corners.length * sizes.length * 4);
  });

  it("matches the specification: the unknown side is masked and the measure is a leader note", () => {
    const s = spec("missing-side", "top-right", 12, 7, 0, 0, "width", "area");
    const svg = renderFigureSvg(s);
    expect(labelsOf(svg)).toEqual(
      expect.arrayContaining(["7 cm", "?", "area 84 cm²"]),
    );
    expect(labelsOf(svg)).not.toContain("12 cm");
    expect(svg).toContain('class="leader"');
    expect(svg).toContain('class="dim-arrow"');
    expect(svg).toContain('class="dim-extension"');
    expect(svg).not.toContain("<rect");
  });

  it("chains the derived-edge marks with the cut dimensions for composite perimeter", () => {
    const s = spec("composite-perimeter", "top-right", 12, 8, 4, 3);
    const svg = renderFigureSvg(s);
    expect(labelsOf(svg).filter((t) => t === "?")).toHaveLength(2);
    expect(labelsOf(svg)).toEqual(
      expect.arrayContaining(["12 cm", "8 cm", "4 cm", "3 cm"]),
    );
  });

  describe("plan validator", () => {
    const s = spec("composite-perimeter", "top-right", 12, 8, 4, 3);
    const catalogue = annotationCatalogue(s);
    const base = defaultAnnotationPlan(s);
    const edit = (change: (plan: AnnotationPlan) => void): unknown => {
      const copy = structuredClone(base);
      change(copy);
      return copy;
    };
    it("rejects revealing a derived or unknown value", () => {
      const errors = validatePlan(
        edit((p) => {
          p.dimensions.find((d) => d.feature === "remaining-width")!.show =
            "value";
        }),
        catalogue,
      );
      expect(errors.join(" ")).toMatch(/must stay hidden/);
    });
    it("rejects hiding a given value, unknown features, bad sides and missing needed dimensions", () => {
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions.find((d) => d.feature === "cut-width")!.show =
              "unknown";
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/is given/);
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions.push({
              feature: "diagonal",
              side: "top",
              show: "value",
            });
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/unknown feature/);
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions[0].side = "left";
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/cannot be dimensioned/);
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions = p.dimensions.filter(
              (d) => d.feature !== "cut-height",
            );
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/Missing needed dimension/);
    });
    it("rejects extra keys, free text, numbers and malformed shapes", () => {
      expect(
        validatePlan({ dimensions: [], notes: [], extra: 1 }, catalogue),
      ).not.toEqual([]);
      expect(validatePlan("nonsense", catalogue)).not.toEqual([]);
      expect(
        validatePlan(
          edit((p) => {
            (p.dimensions[0] as unknown as Record<string, unknown>).label =
              "99 cm";
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/expected feature, side and show only/);
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions[0].side = "up" as never;
          }),
          catalogue,
        ),
      ).not.toEqual([]);
    });
    it("limits size and rejects duplicates", () => {
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions.push(structuredClone(p.dimensions[0]));
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/twice/);
      expect(
        validatePlan(
          edit((p) => {
            p.dimensions = Array.from({ length: 9 }, () =>
              structuredClone(p.dimensions[0]),
            );
          }),
          catalogue,
        ).join(" "),
      ).toMatch(/at most/);
    });
  });
});
