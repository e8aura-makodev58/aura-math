// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { angleMeasureAuthor } from "../src/authoring/angle-measure";
import { symmetryAuthor } from "../src/authoring/symmetry";
import { protractorFactory } from "../src/topics/protractor-workbench";
import { symmetryFactory } from "../src/topics/symmetry-workbench";
import type { WorkbenchHandle, WorkbenchIO } from "../src/workbench/types";
let host: HTMLElement, handle: WorkbenchHandle | null;
const click = (selector: string) =>
  host.querySelector<HTMLElement>(selector)!.click();
function io() {
  let ids: string[] = [];
  const bridge: WorkbenchIO = {
    presentation: () => "trial",
    hintRung: () => 0,
    currentAnswer: () => [...ids],
    setAnswer: (v) => {
      ids = v === null ? [] : Array.isArray(v) ? [...v] : [v];
      return true;
    },
  };
  return bridge;
}
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  handle = null;
});
afterEach(() => {
  handle?.destroy();
  host.remove();
  vi.restoreAllMocks();
});
describe("real 2D workbench controls", () => {
  it("moves/turns the dial, supports Undo, aligns only through hint help, locks and disposes", () => {
    const l = angleMeasureAuthor.template(
        "p4-protractor-bench-read",
        "read",
      ).lesson,
      b = io();
    handle = protractorFactory(l, l.steps[0])(host, b);
    click('[data-bench="phase-try"]');
    const stage = host.querySelector<HTMLElement>(".bench-stage")!,
      initial = stage.dataset.pose;
    expect(host.querySelector<HTMLElement>('[data-dial="align"]')!.hidden).toBe(
      true,
    );
    click('[data-dial="left"]');
    expect(stage.dataset.pose).not.toBe(initial);
    click('[data-bench="undo"]');
    expect(stage.dataset.pose).toBe(initial);
    handle.hint!(3);
    click('[data-dial="align"]');
    expect(JSON.parse(stage.dataset.pose!).x).toBe(200);
    expect(JSON.parse(stage.dataset.pose!).y).toBe(225);
    const field = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    field.value = "65";
    field.dispatchEvent(new Event("input"));
    expect(b.currentAnswer()).toEqual(["65"]);
    handle.answerChanged!(["70"]);
    expect(field.value).toBe("70");
    handle.lock!(true);
    expect(field.disabled).toBe(true);
    const pose = stage.dataset.pose;
    click('[data-dial="right"]');
    expect(stage.dataset.pose).toBe(pose);
    handle.destroy();
    handle.destroy();
    expect(host.children).toHaveLength(0);
  });
  it("construction changes the drawn arm without silently setting an assessed answer", () => {
    const l = angleMeasureAuthor.template(
        "p4-protractor-bench-draw",
        "draw",
      ).lesson,
      b = io();
    handle = protractorFactory(l, l.steps[0])(host, b);
    click('[data-bench="phase-try"]');
    const slider = host.querySelector<HTMLInputElement>('input[max="175"]')!;
    slider.value = "115";
    slider.dispatchEvent(new Event("input"));
    expect(host.querySelector<HTMLElement>(".bench-stage")!.dataset.arm).toBe(
      "115",
    );
    expect(b.currentAnswer()).toEqual([]);
    click('[data-bench="undo"]');
    expect(slider.value).toBe("45");
  });
  it("mirror selection synchronises list choices and shows a ghost only at hint 2", () => {
    const l = symmetryAuthor.template("p4-mirror-line-bench", "mirror").lesson,
      b = io();
    handle = symmetryFactory(l, l.steps[0])(host, b);
    click('[data-bench="phase-try"]');
    click(`[data-choice="${l.steps[0].choices![0].id}"]`);
    expect(b.currentAnswer()).toHaveLength(1);
    expect(host.querySelector('[data-ghost="true"]')).toBeNull();
    handle.hint!(2);
    expect(host.querySelector('[data-ghost="true"]')).not.toBeNull();
    handle.hint!(0);
    expect(host.querySelector('[data-ghost="true"]')).toBeNull();
    click('[data-bench="undo"]');
    expect(b.currentAnswer()).toEqual([]);
  });
  it("shade toggles and Undo preserve answers, reveal does not leak before support, locks cells", () => {
    const l = symmetryAuthor.template(
        "p4-shade-to-complete-bench",
        "shade",
      ).lesson,
      b = io();
    handle = symmetryFactory(l, l.steps[0])(host, b);
    click('[data-bench="phase-try"]');
    click('[data-cell="0,3"]');
    expect(b.currentAnswer()).toHaveLength(1);
    expect(host.querySelector('[data-ghost="true"]')).toBeNull();
    handle.hint!(2);
    expect(host.querySelector('[data-ghost="true"]')).not.toBeNull();
    click('[data-bench="undo"]');
    expect(b.currentAnswer()).toEqual([]);
    handle.hint!(4);
    expect(b.currentAnswer()).toEqual(l.steps[0].answer);
    handle.lock!(true);
    expect(
      host.querySelector<HTMLButtonElement>('[data-cell="0,3"]')!.disabled,
    ).toBe(true);
  });
  it("keyboard cell navigation skips the given half, reset is undoable", () => {
    const l = symmetryAuthor.template(
      "p4-shade-to-complete-bench",
      "shade",
    ).lesson;
    handle = symmetryFactory(l, l.steps[0])(host, io());
    click('[data-bench="phase-try"]');
    const cell = host.querySelector<HTMLElement>('[data-cell="0,3"]')!;
    cell.focus();
    cell.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect((document.activeElement as HTMLElement).dataset.cell).toBe("0,4");
    click('[data-cell="0,3"]');
    click('[data-bench="reset"]');
    expect(
      host.querySelector('[data-cell="0,3"]')!.getAttribute("aria-pressed"),
    ).toBe("false");
    click('[data-bench="undo"]');
    expect(
      host.querySelector('[data-cell="0,3"]')!.getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

// Exercise the real presentation/runtime bridge as well as isolated controls.
import { mountLessonView } from "../src/ui/lesson-view";
import { adapters } from "../src/topics/registry";
import type { Lesson } from "../src/core/types";

describe("2D workbenches in a real lesson session", () => {
  for (const form of [
    "p4-protractor-bench-read",
    "p4-protractor-bench-draw",
    "p4-mirror-line-bench",
    "p4-shade-to-complete-bench",
  ]) {
    it(`${form}: wrong check, Undo, completion and replay use fresh state`, () => {
      const isAngle = form.includes("protractor"),
        l = (isAngle ? angleMeasureAuthor : symmetryAuthor).template(
          form,
          form,
        ).lesson;
      const factory = (lesson: Lesson, step: Lesson["steps"][number]) =>
        ["read", "supplement", "place", "shade"].includes(step.goal ?? "")
          ? (isAngle ? protractorFactory : symmetryFactory)(lesson, step)
          : null;
      const view = mountLessonView(host, {
        lesson: l,
        adapter: adapters[l.topic],
        workbench: factory,
      });
      view.startTrial(l);
      click('[data-bench="phase-try"]');
      const check = () =>
        host
          .querySelector<HTMLFormElement>("#answer-form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          );
      if (isAngle) {
        const f = host.querySelector<HTMLInputElement>(
          '.bench input[type="text"]',
        )!;
        f.value = "1";
        f.dispatchEvent(new Event("input"));
      } else if (form.includes("mirror-line")) {
        click(
          `[data-choice="${l.steps[0].choices!.find((c) => c.id !== l.steps[0].answer)!.id}"]`,
        );
      } else click('[data-cell="0,4"]');
      check();
      expect(view.getSession()!.feedback?.outcome).toBe("incorrect");
      const count = view.getSession()!.history.length;
      click('[data-bench="undo"]');
      expect(view.getSession()!.history.length).toBe(count);
      for (const [i, step] of l.steps.entries()) {
        if (i === 0 && isAngle) {
          const f = host.querySelector<HTMLInputElement>(
            '.bench input[type="text"]',
          )!;
          f.value = String(step.answer);
          f.dispatchEvent(new Event("input"));
        } else if (i === 0 && form.includes("mirror-line"))
          click(`[data-choice="${step.answer}"]`);
        else if (i === 0) {
          for (const id of step.answer as string[]) {
            const c = step.choices!.find((c) => c.id === id)!;
            const b = host.querySelector<HTMLButtonElement>(
              `[data-cell="${c.meaning!.replace("cell:", "")}"]`,
            )!;
            if (b.getAttribute("aria-pressed") !== "true") b.click();
          }
        } else if (step.kind === "exact") {
          const f = host.querySelector<HTMLInputElement>(
            '[data-testid="answer-input"]',
          )!;
          f.value = String(step.answer);
        } else
          for (const id of Array.isArray(step.answer)
            ? step.answer
            : [String(step.answer)]) {
            const input = host.querySelector<HTMLInputElement>(
              `.answer-options input[value="${id}"]`,
            )!;
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        check();
        expect(view.getSession()!.feedback?.outcome).toBe("correct");
        click('[data-action="next"]');
        if (i === 0)
          expect(
            host.querySelector<HTMLElement>('[data-region="workbench"]')!
              .hidden,
          ).toBe(true);
      }
      expect(view.getSession()!.completed).toBe(true);
      expect(host.querySelector(".completion-note")!.textContent).toContain(
        "practice aids",
      );
      click('[data-action="replay"]');
      click('[data-bench="phase-try"]');
      expect(view.getSession()!.history).toHaveLength(0);
      expect(
        host.querySelector(".bench-stage")!.getAttribute("data-preview"),
      ).not.toBe("true");
      view.destroy();
      expect(host.querySelector(".bench")).toBeNull();
    });
  }
});

describe("pointer geometry and cleanup", () => {
  const pointer = (
    element: HTMLElement,
    type: string,
    x: number,
    y: number,
  ) => {
    const e = new Event(type, { bubbles: true });
    Object.defineProperties(e, {
      pointerId: { value: 1 },
      clientX: { value: x },
      clientY: { value: y },
    });
    element.dispatchEvent(e);
  };
  it("one dial drag is one undoable move and cancellation ends the gesture", () => {
    const l = angleMeasureAuthor.template(
      "p4-protractor-bench-read",
      "p",
    ).lesson;
    handle = protractorFactory(l, l.steps[0])(host, io());
    click('[data-bench="phase-try"]');
    const stage = host.querySelector<HTMLElement>(".bench-stage")!,
      grip = host.querySelector<HTMLElement>('[data-dial="move"]')!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    });
    const start = stage.dataset.pose;
    pointer(grip, "pointerdown", 200, 250);
    pointer(grip, "pointermove", 230, 230);
    pointer(grip, "pointermove", 240, 240);
    expect(stage.dataset.pose).not.toBe(start);
    pointer(grip, "pointercancel", 240, 240);
    const end = stage.dataset.pose;
    pointer(grip, "pointermove", 300, 300);
    expect(stage.dataset.pose).toBe(end);
    click('[data-bench="undo"]');
    expect(stage.dataset.pose).toBe(start);
  });
  it("construction arm drag matches a computed bearing and restores in one Undo", () => {
    const l = angleMeasureAuthor.template(
      "p4-protractor-bench-draw",
      "p",
    ).lesson;
    handle = protractorFactory(l, l.steps[0])(host, io());
    click('[data-bench="phase-try"]');
    const stage = host.querySelector<HTMLElement>(".bench-stage")!,
      grip = host.querySelector<HTMLElement>('[data-dial="arm"]')!;
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    });
    pointer(grip, "pointerdown", 250, 200);
    const a = (140 * Math.PI) / 180;
    pointer(
      grip,
      "pointermove",
      200 + 150 * Math.cos(a),
      225 - 150 * Math.sin(a),
    );
    pointer(grip, "pointerup", 0, 0);
    expect(stage.dataset.arm).toBe("115");
    click('[data-bench="undo"]');
    expect(stage.dataset.arm).toBe("45");
  });
});
