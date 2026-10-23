// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../src/content/lessons";
import { adapters } from "../src/topics/registry";
import { mountLessonView } from "../src/ui/lesson-view";
import type { Lesson, Step } from "../src/core/types";
import type { WorkbenchFactory, WorkbenchIO } from "../src/workbench/types";

const lesson = lessons.find((l) => l.id === "p4-fold-a-cube-net")!;
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="canvas"></div>';
  root = document.querySelector<HTMLElement>("#canvas")!;
});
afterEach(() => vi.restoreAllMocks());

interface Instance {
  id: number;
  step: string;
  hints: number[];
  locks: boolean[];
  changed: string[][];
  destroyed: boolean;
  io: WorkbenchIO;
}
/** A stub workbench: records notifications and holds a window listener until destroyed. */
function stub() {
  const made: Instance[] = [];
  const factory = (_l: Lesson, step: Step): WorkbenchFactory | null =>
    step.goal === "reflection"
      ? null
      : (host, io) => {
          const inst: Instance = {
            id: made.length + 1,
            step: step.id,
            hints: [],
            locks: [],
            changed: [],
            destroyed: false,
            io,
          };
          made.push(inst);
          const onResize = () => {};
          window.addEventListener("resize", onResize);
          host.textContent = `stub ${inst.id}`;
          return {
            hint: (r) => inst.hints.push(r),
            lock: (v) => inst.locks.push(v),
            answerChanged: (v) => inst.changed.push(v),
            destroy() {
              window.removeEventListener("resize", onResize);
              inst.destroyed = true;
            },
          };
        };
  return { made, factory };
}
const click = (selector: string) =>
  root.querySelector<HTMLElement>(selector)!.click();
const check = () =>
  root
    .querySelector<HTMLFormElement>("#answer-form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
const live = (made: Instance[]) => made.filter((i) => !i.destroyed);
const wrongId = (step: Step) =>
  step.choices!.find((c) => c.id !== step.answer)!.id;

describe("workbench host lifecycle", () => {
  it("mounts one workbench per trial step, rebuilds on replay, Try another and next step", () => {
    const { made, factory } = stub();
    const next = structuredClone(lesson);
    next.id = "another-fold";
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
      onTryAnother: () => ({ lesson: next }),
    });
    expect(made).toHaveLength(1); // edit presentation
    view.startTrial(lesson);
    expect(made).toHaveLength(2);
    expect(made[0].destroyed).toBe(true);
    expect(made[1].io.presentation()).toBe("trial");
    // the list version wraps the answer controls for workbench steps only
    expect(root.querySelector(".bench-list .answer-options")).not.toBeNull();
    expect(root.querySelector<HTMLDetailsElement>(".bench-list")!.open).toBe(
      false,
    );
    expect(
      root.querySelector<HTMLElement>('[data-region="visual"]')!.hidden,
    ).toBe(true);
    for (const step of lesson.steps) {
      if (step.goal !== "reflection")
        expect(
          live(made)
            .at(-1)!
            .io.setAnswer(step.answer as string),
        ).toBe(true);
      else click(`input[value="${step.answer}"]`);
      check();
      click('[data-action="next"]');
      if (step.goal === "fold-top") {
        expect(made).toHaveLength(3);
        expect(made[2].step).toBe("fold-opposite");
      }
      if (step.goal === "fold-opposite") {
        expect(live(made)).toHaveLength(0);
        expect(root.querySelector(".bench-list")).toBeNull();
        expect(root.querySelector(".answer-options")!.parentElement!.id).toBe(
          "answer-form",
        );
      }
    }
    expect(view.getSession()!.completed).toBe(true);
    click('[data-action="replay"]');
    expect(made).toHaveLength(4);
    expect(live(made).map((i) => i.id)).toEqual([4]);
    // complete again and take another example: a fresh instance
    for (const step of lesson.steps) {
      if (step.goal !== "reflection")
        live(made)
          .at(-1)!
          .io.setAnswer(step.answer as string);
      else click(`input[value="${step.answer}"]`);
      check();
      click('[data-action="next"]');
    }
    click('[data-action="another"]');
    expect(live(made)).toHaveLength(1);
    expect(made.at(-1)!.id).toBe(6);
    view.destroy();
    expect(live(made)).toHaveLength(0);
  });
  it("sends hint rungs 1 to 4 once each and keeps the instance across a mode switch", () => {
    const { made, factory } = stub();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
    });
    view.startTrial(lesson);
    const inst = made.at(-1)!;
    for (let i = 0; i < 4; i++) click('[data-action="hint"]');
    expect(inst.hints).toEqual([1, 2, 3, 4]);
    expect(inst.io.hintRung()).toBe(4);
    click('[data-mode="guided"]');
    click('[data-mode="independent"]');
    expect(made.at(-1)).toBe(inst);
    expect(inst.destroyed).toBe(false);
    expect(inst.hints).toEqual([1, 2, 3, 4]);
    expect(view.getSession()!.hadSupport).toBe(true);
    view.destroy();
  });
  it("wrong check then Undo: the workbench clears its choice, the next check is a new submission", () => {
    const { made, factory } = stub();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
    });
    view.startTrial(lesson);
    const inst = made.at(-1)!;
    const step = lesson.steps[0];
    inst.io.setAnswer(wrongId(step));
    check();
    expect(view.getSession()!.feedback!.outcome).toBe("incorrect");
    expect(inst.locks.at(-1)).toBe(false);
    // Undo in a workbench restores the previous answer through the same io
    expect(inst.io.setAnswer(null)).toBe(true);
    expect(inst.io.currentAnswer()).toEqual([]);
    inst.io.setAnswer(step.answer as string);
    check();
    const s = view.getSession()!;
    expect(s.history.map((h) => h.outcome)).toEqual(["incorrect", "correct"]);
    expect(inst.locks.at(-1)).toBe(true);
    // locked after a correct check: the workbench cannot change the answer
    expect(inst.io.setAnswer(wrongId(step))).toBe(false);
    expect(made.at(-1)).toBe(inst);
    view.destroy();
  });
  it("reports list-version changes to the workbench", () => {
    const { made, factory } = stub();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
    });
    view.startTrial(lesson);
    const input = root.querySelector<HTMLInputElement>(
      `input[value="${lesson.steps[0].answer}"]`,
    )!;
    input.click();
    expect(made.at(-1)!.changed).toEqual([[lesson.steps[0].answer]]);
    view.destroy();
  });
  it("edit typing rebuilds only when the specification or step changes", () => {
    const { made, factory } = stub();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
    });
    expect(made).toHaveLength(1);
    const edited = structuredClone(lesson);
    edited.title = "Fold it and look";
    edited.steps[0].prompt += " Take your time.";
    view.update(edited);
    expect(made).toHaveLength(1);
    expect(made[0].io.setAnswer("k10")).toBe(false); // nothing recorded in edit
    edited.specification = { ...edited.specification, face: "D" };
    view.update(edited);
    expect(made).toHaveLength(2);
    expect(made[0].destroyed).toBe(true);
    view.update(edited, { stepIndex: 2, hintRung: 0 });
    expect(live(made)).toHaveLength(0);
    view.destroy();
  });
});

describe("listener leaks", () => {
  function counting() {
    const added = new Map<string, number>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((t, l, o) => {
      added.set(t, (added.get(t) ?? 0) + 1);
      add(t, l, o);
    });
    vi.spyOn(window, "removeEventListener").mockImplementation((t, l, o) => {
      added.set(t, (added.get(t) ?? 0) - 1);
      remove(t, l, o);
    });
    let media = 0;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => media++,
      removeEventListener: () => media--,
    })) as unknown as typeof window.matchMedia;
    return { added, media: () => media };
  }
  it("a stub workbench leaves no window listener after destroy", () => {
    const { added } = counting();
    const { factory } = stub();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.nets,
      workbench: factory,
    });
    view.startTrial(lesson);
    view.destroy();
    expect([...added.values()].every((n) => n === 0)).toBe(true);
  });
  it("the real nets workbench falls back without WebGL, folds and answers by buttons, and leaks nothing", async () => {
    const { added, media } = counting();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const view = mountLessonView(root, { lesson, adapter: adapters.nets });
    view.startTrial(lesson);
    await vi.waitFor(() =>
      expect(root.querySelector(".bench-stage")).not.toBeNull(),
    );
    const stage = root.querySelector<HTMLElement>(".bench-stage")!;
    expect(stage.dataset.renderer).toBe("fallback");
    expect(media()).toBe(1);
    click('[data-bench="phase-try"]');
    click('[data-crease="0"]');
    expect(stage.dataset.fold).toBe("1");
    click('[data-fold="all"]');
    expect(stage.dataset.fold).toBe("31");
    click('[data-bench="undo"]');
    expect(stage.dataset.fold).toBe("1");
    const step = lesson.steps[0];
    click(`.bench-chip[data-choice="${wrongId(step)}"]`);
    expect(
      root.querySelector<HTMLInputElement>(`input[value="${wrongId(step)}"]`)!
        .checked,
    ).toBe(true);
    check();
    expect(view.getSession()!.feedback!.outcome).toBe("incorrect");
    click('[data-bench="undo"]'); // undoes the wrong choice
    expect(
      [...root.querySelectorAll<HTMLInputElement>('input[name="answer"]')].some(
        (i) => i.checked,
      ),
    ).toBe(false);
    click(`.bench-chip[data-choice="${step.answer}"]`);
    check();
    expect(view.getSession()!.history.map((h) => h.outcome)).toEqual([
      "incorrect",
      "correct",
    ]);
    expect(root.querySelector<HTMLButtonElement>(".bench-chip")!.disabled).toBe(
      true,
    );
    view.destroy();
    expect(media()).toBe(0);
    expect([...added.values()].every((n) => n === 0)).toBe(true);
  });
});
