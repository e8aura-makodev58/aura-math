// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../src/content/lessons";
import { adapters } from "../src/topics/registry";
import { mountLessonView } from "../src/ui/lesson-view";
import type { Mode } from "../src/core/types";

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="canvas"></div><input id="inspector" />';
  root = document.querySelector<HTMLElement>("#canvas")!;
});

describe("new-example continuation and attempt evidence", () => {
  const lesson = lessons.find((item) => item.id === "p4-decimal-add-subtract")!;
  function complete() {
    for (const step of lesson.steps) {
      if (step.kind === "exact")
        root.querySelector<HTMLInputElement>("#answer-input")!.value = String(
          step.answer,
        );
      else click(`input[value="${step.answer}"]`);
      check();
      click('[data-action="next"]');
    }
  }
  it("isolates new variables, clears hint/input state and preserves the selected mode", () => {
    const next = structuredClone(lesson);
    next.id = "another-decimal";
    next.specification.a = { coefficient: 814, scale: 2 };
    next.specification.b = { coefficient: 37, scale: 1 };
    next.steps[1].answer = "4.44";
    const capture = vi.fn();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.decimals,
      onTryAnother: () => ({ lesson: next }),
      onAttemptEnd: capture,
    });
    view.startTrial(lesson, "guided");
    click('[data-action="hint"]');
    complete();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ completed: true, hadSupport: true }),
      "completed",
    );
    click('[data-action="another"]');
    expect(view.getSession()).toMatchObject({
      lessonId: next.id,
      mode: "guided",
      stepIndex: 0,
      hintRung: 0,
      completed: false,
      hadSupport: false,
      hadFacilitator: true,
    });
    expect(view.getSession()?.history).toEqual([]);
    expect(
      root.querySelector('[data-testid="activity-expression"]')!.textContent,
    ).toContain("8.14 − 3.7");
    expect(document.activeElement).toBe(root.querySelector("#step-heading"));
  });

  it("keeps completed evidence and mathematical state after failed generation", () => {
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.decimals,
      onTryAnother: () => ({ error: "All examples tried." }),
      onRestartVariants: () => ({ lesson }),
    });
    view.startTrial(lesson);
    complete();
    const previous = view.getSession();
    click('[data-action="another"]');
    expect(view.getSession()).toEqual(previous);
    expect(root.querySelector(".variant-feedback")!.textContent).toBe(
      "All examples tried.",
    );
    expect(
      root.querySelector<HTMLElement>('[data-action="restart-variants"]')!
        .hidden,
    ).toBe(false);
    click('[data-action="restart-variants"]');
    expect(view.getSession()?.completed).toBe(false);
    expect(root.querySelector(".variant-feedback")!.textContent).toBe("");
  });

  it("updates completed support evidence if an adult reveals answers afterwards", () => {
    const capture = vi.fn();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.decimals,
      onAttemptEnd: capture,
    });
    view.startTrial(lesson);
    complete();
    click('[data-action="worked"]');
    expect(capture).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true, hadSupport: true }),
      "completed",
    );
    click('[data-action="replay"]');
    expect(capture).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true, hadSupport: true }),
      "replay",
    );
    expect(view.getSession()?.hadSupport).toBe(false);
  });

  it("captures an in-progress attempt before exit and never exposes generation in author trials", () => {
    const capture = vi.fn();
    const exit = vi.fn();
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.decimals,
      onAttemptEnd: capture,
      onExit: exit,
    });
    view.startTrial(lesson);
    click('[data-action="exit"]');
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ completed: false }),
      "exit",
    );
    expect(exit).toHaveBeenCalledOnce();
    complete();
    expect(
      root.querySelector<HTMLElement>('[data-action="another"]')!.hidden,
    ).toBe(true);
  });
});
function click(selector: string) {
  root.querySelector<HTMLElement>(selector)!.click();
}
function check() {
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

const compatibility = [
  ["ribbon-collection", "comparison", 3],
  ["garden-pots", "comparison", 3],
  ["shell-discovery", "comparison", 3],
  ["corner-detective", "angles", 2],
  ["angle-opening", "angles", 2],
  ["right-angle-hunt", "angles", 2],
] as const;

describe("shared rich lesson canvas compatibility", () => {
  for (const mode of ["independent", "guided"] as Mode[]) {
    for (const lesson of lessons) {
      it(`${lesson.id} preserves rich presentation and completion in ${mode} mode`, async () => {
        // Hundreds of synchronous DOM cases can starve Vitest worker reporting.
        // Yield once per case so RPC messages are processed without weakening assertions.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        // Fixed identity/task-count baseline plus all authored teaching output.
        const baseline = compatibility.find(([id]) => id === lesson.id);
        if (baseline)
          expect([lesson.id, lesson.topic, lesson.steps.length]).toEqual(
            baseline,
          );
        else {
          expect(lesson.steps.length).toBeGreaterThanOrEqual(2);
          expect(lesson.steps.length).toBeLessThanOrEqual(8); // the validator's own limit
        }
        const view = mountLessonView(root, {
          lesson,
          adapter: adapters[lesson.topic],
        });
        expect(view.getSession()).toBeNull();
        view.startTrial(lesson, mode);
        if (!/^P4\b/.test(lesson.level))
          expect({
            title: root.querySelector('[data-region="title"]')!.textContent,
            story: root.querySelector('[data-region="story"]')!.textContent,
            prompt: root.querySelector('[data-region="prompt"]')!.textContent,
            choices: [...root.querySelectorAll(".answer-choice span")].map(
              (node) => node.textContent,
            ),
            guided:
              !root.querySelector<HTMLElement>(".facilitator-note")!.hidden,
          }).toMatchSnapshot();
        expect(root.querySelector(".workspace-grid")).not.toBeNull();
        expect(
          root.querySelector(".visual-panel svg, .visual-panel table"),
        ).not.toBeNull();
        expect(root.querySelector('[data-region="story"]')!.textContent).toBe(
          lesson.story,
        );
        expect(
          root.querySelector<HTMLElement>(".facilitator-note")!.hidden,
        ).toBe(mode !== "guided");
        for (const step of lesson.steps) {
          expect(
            root.querySelector('[data-region="prompt"]')!.textContent,
          ).toBe(step.prompt);
          expect(root.querySelectorAll(".step-rail li")).toHaveLength(
            lesson.steps.length,
          );
          const answers = Array.isArray(step.answer)
            ? step.answer
            : [String(step.answer)];
          if (step.kind === "number" || step.kind === "exact")
            root.querySelector<HTMLInputElement>("#answer-input")!.value =
              String(step.answer);
          else answers.forEach((answer) => click(`input[value="${answer}"]`));
          check();
          expect(view.getSession()?.feedback?.outcome).toBe("correct");
          click('[data-action="next"]');
        }
        expect(view.getSession()?.completed).toBe(true);
        expect(root.querySelector(".completion-label")!.textContent).toBe(
          mode === "guided"
            ? "Completed with facilitator"
            : "Completed without app support",
        );
        view.destroy();
        expect(root.children).toHaveLength(0);
      });
    }
  }

  it("supports free Edit navigation and hint inspection without support/completion events", () => {
    const lesson = lessons[0];
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.comparison,
    });
    click('[data-edit-step="2"]');
    const select = root.querySelector<HTMLSelectElement>(
      'select[aria-label="Inspect hint"]',
    )!;
    select.value = "4";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector('[data-region="hint"] p')!.textContent).toBe(
      lesson.steps[2].hints[3],
    );
    expect(view.getSession()).toBeNull();
    view.startTrial(lesson);
    expect(view.getSession()?.stepIndex).toBe(0);
    expect(view.getSession()?.events).toEqual([]);
    click('[data-edit-step="2"]');
    expect(view.getSession()?.stepIndex).toBe(0);
  });

  it("patches stable canvas regions without disrupting an external focused inspector or selection", () => {
    const lesson = structuredClone(lessons[0]);
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.comparison,
    });
    const story = root.querySelector('[data-region="story"]');
    const choice = root.querySelector('[data-region^="choice:"]');
    const inspector = document.querySelector<HTMLInputElement>("#inspector")!;
    inspector.value = "Composing revised text";
    inspector.focus();
    inspector.setSelectionRange(4, 8);
    inspector.dispatchEvent(new CompositionEvent("compositionstart"));
    lesson.story = '<img src=x onerror="alert(1)">';
    lesson.steps[0].choices![0].label = "Changed explanation";
    view.update(lesson);
    expect(root.querySelector('[data-region="story"]')).toBe(story);
    expect(root.querySelector('[data-region^="choice:"]')).toBe(choice);
    expect(story!.textContent).toBe(lesson.story);
    expect(story!.querySelector("img")).toBeNull();
    expect(document.activeElement).toBe(inspector);
    expect([
      inspector.selectionStart,
      inspector.selectionEnd,
      inspector.value,
    ]).toEqual([4, 8, "Composing revised text"]);
  });

  it("preserves a focused numeric input and its caret through hints, mode changes and updates", () => {
    const lesson = lessons[0];
    const view = mountLessonView(root, {
      lesson,
      adapter: adapters.comparison,
    });
    view.startTrial(lesson);
    click(`input[value="${lesson.steps[0].answer}"]`);
    check();
    click('[data-action="next"]');
    const input = root.querySelector<HTMLInputElement>("#answer-input")!;
    input.value = "18";
    input.focus();
    input.setSelectionRange(1, 1);
    view.update({ ...lesson, title: "Frozen trial keeps original title" });
    expect(root.querySelector("#answer-input")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    click('[data-action="hint"]');
    click('[data-mode="guided"]');
    expect(root.querySelector("#answer-input")).toBe(input);
    expect(input.value).toBe("18");
    expect(view.getSession()?.hadSupport).toBe(true);
    expect(root.querySelector('[data-region="title"]')!.textContent).toBe(
      lesson.title,
    );
    view.showEdit({ stepIndex: 1, hintRung: 0 });
    expect(view.getSession()).toBeNull();
    expect(root.querySelector('[data-region="title"]')!.textContent).toBe(
      "Frozen trial keeps original title",
    );
  });
});
