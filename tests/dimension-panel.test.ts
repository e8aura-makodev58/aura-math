// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createAuthorModel } from "../src/authoring/model";
import { createDimensionPanel } from "../src/authoring/dimension-panel";
import { annotationTopics } from "../src/annotation/topics";
import { validatePackage } from "../src/content/package-validation";
import { packages } from "../src/content/lessons";
import { areaPerimeterAuthor } from "../src/authoring/area-perimeter";
import {
  annotationCatalogue,
  defaultAnnotationPlan,
  type FigureSpec,
} from "../src/topics/area-perimeter-figure";
import type { ProposalResult } from "../src/annotation/proposer";
import type { AnnotationPlan } from "../src/annotation/plan";

const topic = annotationTopics["area-perimeter"]!;
const template = () =>
  areaPerimeterAuthor.template("p4-composite-perimeter", "layout-test");
const figure = (p = template()) =>
  p.lesson.specification as unknown as FigureSpec;
const flush = () => new Promise((r) => setTimeout(r, 0));
const ok = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

function panelWith(
  routes: Record<string, () => Response | Promise<Response>>,
  apply = vi.fn(),
  current?: AnnotationPlan,
) {
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
    const route = routes[String(url)];
    if (!route) throw new Error("no route");
    return route();
  }) as unknown as typeof fetch;
  const spec = template().lesson.specification;
  const panel = createDimensionPanel({
    topic,
    specification: spec,
    current,
    apply,
    fetchImpl,
  });
  document.body.replaceChildren(panel);
  return { panel, apply, fetchImpl, spec };
}
const button = (panel: HTMLElement, action: string) =>
  panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

describe("dimension panel", () => {
  it("disables suggestions and explains why without credentials or a dev server", async () => {
    const noKey = panelWith({
      "/__annotation/status": () => ok({ configured: false }),
    });
    await flush();
    expect(button(noKey.panel, "suggest-dimensions").disabled).toBe(true);
    expect(noKey.panel.textContent).toMatch(/ANTHROPIC_API_KEY/);
    const noServer = panelWith({});
    await flush();
    expect(button(noServer.panel, "suggest-dimensions").disabled).toBe(true);
    expect(noServer.panel.textContent).toMatch(/development server/);
  });

  it("previews an accepted model proposal and applies it only on request", async () => {
    const spec = figure();
    const plan = defaultAnnotationPlan(spec);
    const result: ProposalResult = {
      plan,
      source: "model",
      rounds: 2,
      attempts: [],
    };
    const { panel, apply, fetchImpl } = panelWith({
      "/__annotation/status": () => ok({ configured: true }),
      "/__annotation/propose": () => ok(result),
    });
    await flush();
    const suggest = button(panel, "suggest-dimensions");
    expect(suggest.disabled).toBe(false);
    suggest.click();
    await flush();
    expect(panel.querySelector(".dimension-preview svg")).not.toBeNull();
    expect(panel.textContent).toMatch(/after 2 rounds/);
    expect(apply).not.toHaveBeenCalled();
    const sent = (
      fetchImpl as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls.find((c) => c[0] === "/__annotation/propose")!;
    expect((sent[1] as RequestInit).headers).toMatchObject({
      "x-aura-annotation": "1",
    });
    button(panel, "use-dimensions").click();
    expect(apply).toHaveBeenCalledWith(JSON.stringify(plan));
  });

  it("will not offer a fallback layout as a suggestion and shows the reason", async () => {
    const plan = defaultAnnotationPlan(figure());
    const { panel, apply } = panelWith({
      "/__annotation/status": () => ok({ configured: true }),
      "/__annotation/propose": () =>
        ok({
          plan,
          source: "default",
          rounds: 3,
          attempts: [],
          failure: "The model declined this request (cyber).",
        }),
    });
    await flush();
    button(panel, "suggest-dimensions").click();
    await flush();
    expect(button(panel, "use-dimensions").disabled).toBe(true);
    expect(panel.textContent).toMatch(/declined/);
    expect(apply).not.toHaveBeenCalled();
  });

  it("shows server errors as plain text and offers reset only for a custom layout", async () => {
    const { panel } = panelWith({
      "/__annotation/status": () => ok({ configured: true }),
      "/__annotation/propose": () => ok({ error: "<b>Too many</b>" }, 429),
    });
    await flush();
    button(panel, "suggest-dimensions").click();
    await flush();
    expect(panel.textContent).toContain("<b>Too many</b>");
    expect(panel.querySelector(".dimension-message b")).toBeNull();
    expect(button(panel, "reset-dimensions").hidden).toBe(true);
    const custom = panelWith(
      { "/__annotation/status": () => ok({ configured: false }) },
      vi.fn(),
      defaultAnnotationPlan(figure()),
    );
    expect(button(custom.panel, "reset-dimensions").hidden).toBe(false);
    button(custom.panel, "reset-dimensions").click();
    expect(custom.apply).toHaveBeenCalledWith("");
  });
});

describe("storing a layout through the author model", () => {
  const plan = (s: FigureSpec): AnnotationPlan => {
    const p = defaultAnnotationPlan(s);
    // A different but valid choice: put the outer width above the figure.
    return {
      ...p,
      dimensions: p.dimensions.map((d) =>
        d.feature === "outer-width" ? { ...d, side: "top" as const } : d,
      ),
    };
  };

  it("stores a valid layout in the package, undoably, without raising wording checks", () => {
    const model = createAuthorModel(template());
    const before = model.pending.length;
    const chosen = plan(figure(model.working as never));
    const catalogue = annotationCatalogue(
      model.working.lesson.specification as unknown as FigureSpec,
    );
    expect(catalogue.features.length).toBeGreaterThan(0);
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(chosen),
    });
    expect(model.working.lesson.specification.annotations).toEqual(chosen);
    expect(model.pending.length).toBe(before);
    expect(
      validatePackage(model.working).issues.filter(
        (i) => i.severity === "error",
      ),
    ).toEqual([]);
    model.undo();
    expect(model.working.lesson.specification.annotations).toBeUndefined();
  });

  it("changes the content digest basis: the layout is part of the reviewed package", () => {
    const model = createAuthorModel(template());
    const without = JSON.stringify(model.working);
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(plan(figure(model.working as never))),
    });
    expect(JSON.stringify(model.working)).not.toBe(without);
  });

  it("refuses an invalid layout and keeps the lesson unchanged", () => {
    const model = createAuthorModel(template());
    const leaking = defaultAnnotationPlan(figure(model.working as never));
    leaking.dimensions.find((d) => d.feature === "remaining-width")!.show =
      "value";
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(leaking),
    });
    expect(model.working.lesson.specification.annotations).toBeUndefined();
    model.patch({ kind: "topic", key: "annotations", value: "not json" });
    expect(model.working.lesson.specification.annotations).toBeUndefined();
  });

  it("returns to automatic when a model edit makes the stored layout stale, and on reset", () => {
    const model = createAuthorModel(template());
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(plan(figure(model.working as never))),
    });
    // Moving the removed corner to the bottom makes top-side placements for the cut stale.
    model.patch({ kind: "topic", key: "corner", value: "bottom-left" });
    expect(model.working.lesson.specification.annotations).toBeUndefined();
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(plan(figure(model.working as never))),
    });
    expect(model.working.lesson.specification.annotations).toBeDefined();
    model.patch({ kind: "topic", key: "annotations", value: "" });
    expect(model.working.lesson.specification.annotations).toBeUndefined();
  });

  it("keeps the stored layout valid after a size change and exports exactly", () => {
    const model = createAuthorModel(template());
    model.patch({
      kind: "topic",
      key: "annotations",
      value: JSON.stringify(plan(figure(model.working as never))),
    });
    model.patch({ kind: "topic", key: "width", value: 15 });
    expect(model.working.lesson.specification.annotations).toBeDefined();
    const reparsed = validatePackage(JSON.parse(JSON.stringify(model.working)));
    expect(reparsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(packages.length).toBeGreaterThan(0);
  });
});
