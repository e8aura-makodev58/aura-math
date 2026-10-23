import type { Adapter, Lesson, Mode, Session } from "../core/types";
import {
  completionLabel,
  createSession,
  nextStep,
  submit,
  switchMode,
  useHint,
  useWorkedSolution,
} from "../core/runtime";
import { lessonVisual, topicIcon } from "./visuals";
import {
  runtimeTopics,
  topicLabel,
  topicVisualTitle,
} from "../topics/registry";
import type {
  WorkbenchFactory,
  WorkbenchHandle,
  WorkbenchIO,
} from "../workbench/types";
import {
  activityChoiceDiagram,
  p4ActivityKind,
  p4Expression,
  renderP4Activity,
} from "./p4-activity";

export interface LessonViewPosition {
  stepIndex: number;
  hintRung: number;
}
export interface LessonViewOptions {
  lesson: Lesson;
  adapter: Adapter;
  mode?: Mode;
  onExit?: () => void;
  onRender?: () => void;
  onNextLesson?: () => void;
  nextLessonLabel?: string;
  onTryAnother?: () => { lesson: Lesson } | { error: string };
  onRestartVariants?: () => { lesson: Lesson } | { error: string };
  onAttemptEnd?: (
    session: Session,
    reason: "completed" | "replay" | "restart" | "exit" | "next",
  ) => void;
  /** Overrides the registry lookup of a step's workbench (tests and composition). */
  workbench?: (
    lesson: Lesson,
    step: Lesson["steps"][number],
  ) => WorkbenchFactory | null;
}

/*
 * Workbench lifecycle (R-95). The workbench lives in its own persistent host
 * `[data-region="workbench"]`, outside the innerHTML-replaced visual region. Its mount key is
 * `trial counter : presentation : lesson id : step index : step id : choice ids`, plus the
 * specification text in edit presentation, so it is rebuilt exactly when one of those changes.
 *
 * | Event (call site)                          | Key changes? | Effect on the workbench                        |
 * | ------------------------------------------ | ------------ | ---------------------------------------------- |
 * | first render, `startTrial` (start, replay,  | yes (trial   | old one destroyed, new one created by the     |
 * |   Restart lesson, Try another, restart set) |  counter +1) |   topic factory with fresh state               |
 * | `nextStep` (Next little step)              | yes (step)   | destroyed; created again if the step has one   |
 * | completion screen                          | key cleared  | destroyed                                      |
 * | `useHint` (hint button)                    | no           | `hint(rung)` sent once per change; rung 4      |
 * |                                            |              |   plays the reveal on the learner's instance   |
 * | edit "Inspect hint" select                 | no           | `hint(rung)` sent (preview only)               |
 * | `switchMode` (independent / guided)        | no           | nothing: state is kept                         |
 * | check (submit)                             | no           | `lock(true)` after a correct answer; a wrong   |
 * |                                            |              |   answer leaves it live (Undo still works)     |
 * | list-version radio changed by the learner  | no           | `answerChanged(ids)`                           |
 * | edit `update` (author typing)              | only if spec,| rebuilt only when the specification, step or  |
 * |                                            |  step, choices|  choices change, not for wording edits        |
 * | `showEdit` / trial to edit                 | yes          | destroyed and created in edit presentation     |
 * | worked solutions, step rail (edit)         | rail: yes    | rail changes the step index; worked: nothing   |
 * | view `destroy()`                           | -            | destroyed (rAF, timers, matchMedia, window     |
 * |                                            |              |   listeners, WebGL resources released)         |
 *
 * Creator: `syncWorkbench` in `render`. Destroyer: `syncWorkbench` on a key change or completion,
 * and `destroy()`. A workbench drives the existing answer controls through `io.setAnswer`, which
 * looks the controls up by choice id at call time; the controls of a workbench step are moved
 * into a collapsed "List version" disclosure, and moved back for every other step.
 */

/** Shared rich lesson canvas. Edit navigation has no assessment session. */
export function mountLessonView(root: HTMLElement, options: LessonViewOptions) {
  let working = structuredClone(options.lesson);
  let frozen = working;
  let session: Session | null = null;
  let position: LessonViewPosition = { stepIndex: 0, hintRung: 0 };
  let destroyed = false;
  let answerSignature = "";
  let visualSignature = "";
  let workedOpen = false;
  let variantError = "";
  let trialCounter = 0;
  let bench: WorkbenchHandle | null = null;
  let benchKey = "";
  let benchRung = -1;
  let benchLocked: boolean | null = null;
  root.innerHTML = `<div class="lesson-canvas">
    <div class="workspace-heading"><button class="back-button" data-action="exit" data-testid="lesson-home">← All lessons</button><div class="mode-switch" role="group" aria-label="Learning mode"><button data-mode="independent">On my own</button><button data-mode="guided" data-testid="mode-guided">Learn together</button></div></div>
    <div class="lesson-title"><p class="eyebrow" data-slot="level"></p><h1 data-region="title"></h1><p data-region="objective"></p></div>
    <ol class="step-rail" aria-label="Lesson steps"></ol>
    <div class="workspace-grid"><section class="visual-panel"><div class="panel-heading"><span class="topic-icon"></span><p class="eyebrow" data-slot="visual-title"></p></div><p class="story" data-region="story"></p><div data-region="visual"></div><div data-region="workbench" class="bench-host" hidden></div><p class="sr-only" data-slot="description"></p></section>
    <section class="question-panel"><p class="eyebrow" data-region="step-title"></p><h2 id="step-heading" tabindex="-1" data-region="prompt"></h2>
    <form id="answer-form"><div class="answer-options"></div><p class="input-note" hidden>Choose all that fit, then check your answer.</p><div class="feedback" aria-live="polite" role="status"></div><button type="submit" class="primary-button full" data-testid="check-answer">Check my answer →</button><button type="button" class="primary-button full" data-action="next" data-testid="next-step" hidden></button></form>
    <div class="hint-area"><div class="hint-copy" aria-live="polite" data-region="hint" hidden><strong></strong><p></p></div><button class="hint-button" data-action="hint" data-testid="hint-button"></button><label data-slot="edit-hint">Inspect hint <select aria-label="Inspect hint"><option value="0">No hint</option><option value="1">Hint 1</option><option value="2">Hint 2</option><option value="3">Hint 3</option><option value="4">Worked step · reveal</option></select></label></div>
    <aside class="facilitator-note" hidden><strong>For your learning partner</strong><p>Ask: “What do you notice? How could you check?” Give thinking time, then use the hints together. Spoken explanations are not assessed.</p></aside></section></div>
    <div class="lesson-bottom"><span>Take your time. Thinking is part of learning.</span><button class="text-button" data-action="reset">Restart lesson</button></div>
    </div><section class="completion" hidden><span class="completion-flower" aria-hidden="true">✳</span><p class="eyebrow">ONE MORE DISCOVERY</p><h1 tabindex="-1">You worked it out.</h1><p data-slot="completed-title"></p><p class="activity-expression" data-slot="completed-expression" hidden></p><strong class="completion-label"></strong><p class="completion-note"></p><p class="variant-feedback" role="status" aria-live="polite"></p><div class="completion-actions"><button class="primary-button" data-action="another" data-testid="try-another" hidden>Try another · same skill →</button><button class="text-button" data-action="restart-variants" hidden>Restart this practice set</button><button class="primary-button" data-action="replay">Try this lesson again</button><button class="primary-button" data-action="next-lesson" hidden>Next lesson in this topic →</button><button class="text-button" data-action="exit">Back to topic</button></div></section>`;
  const worked = document.createElement("section");
  worked.className = "worked-solutions";
  worked.innerHTML =
    '<button type="button" data-action="worked" aria-expanded="false">For adults: reveal worked solutions (uses support)</button><div data-slot="solutions" hidden></div>';
  root.append(worked);
  const node = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const text = (selector: string, value: string) => {
    const target = node(selector);
    if (target.textContent !== value) target.textContent = value;
  };
  const active = () => (session ? frozen : working);
  const benchList = document.createElement("details");
  benchList.className = "bench-list";
  benchList.innerHTML = "<summary>List version of this answer</summary>";
  const answerInputs = () => [
    ...root.querySelectorAll<HTMLInputElement>(
      '.answer-options input[name="answer"]',
    ),
  ];
  const benchIO = (): WorkbenchIO => {
    const key = benchKey;
    const live = () => !destroyed && key === benchKey;
    return {
      presentation: () => (session ? "trial" : "edit"),
      hintRung: () => session?.hintRung ?? position.hintRung,
      currentAnswer: () =>
        answerInputs()
          .filter((input) => input.type === "text" || input.checked)
          .map((input) => input.value)
          .filter(Boolean),
      setAnswer(value) {
        if (!live() || !session) return false;
        const inputs = answerInputs();
        if (!inputs.length || inputs.some((i) => i.disabled || i.readOnly))
          return false;
        const ids = value == null ? [] : Array.isArray(value) ? value : [value];
        for (const input of inputs)
          if (input.type === "text") input.value = ids[0] ?? "";
          else input.checked = ids.includes(input.value);
        return true;
      },
    };
  };
  function syncWorkbench(
    lesson: Lesson,
    stepIndex: number,
    rung: number,
    locked: boolean,
    complete: boolean,
  ) {
    const step = lesson.steps[stepIndex];
    const factory = complete
      ? null
      : options.workbench
        ? options.workbench(lesson, step)
        : (runtimeTopics[lesson.topic]?.workbench?.(lesson, step) ?? null);
    const key = factory
      ? [
          trialCounter,
          session ? "trial" : "edit",
          lesson.id,
          stepIndex,
          step.id,
          step.choices?.map((c) => `${c.id}=${c.meaning ?? ""}`).join("|"),
          session ? "" : JSON.stringify(lesson.specification),
        ].join(":")
      : "";
    const host = node('[data-region="workbench"]');
    if (key !== benchKey) {
      bench?.destroy();
      bench = null;
      host.replaceChildren();
      benchKey = key;
      benchRung = -1;
      benchLocked = null;
      benchList.open = false;
      if (factory) bench = factory(host, benchIO());
    }
    host.hidden = !bench;
    node('[data-region="visual"]').hidden = !!bench;
    if (bench && rung !== benchRung) {
      if (rung || benchRung > 0) bench.hint?.(rung);
      benchRung = rung;
    }
    if (bench && locked !== benchLocked) {
      bench.lock?.(locked);
      benchLocked = locked;
    }
  }
  function capture(
    reason: Parameters<NonNullable<LessonViewOptions["onAttemptEnd"]>>[1],
  ) {
    if (session) options.onAttemptEnd?.(structuredClone(session), reason);
  }
  function render(moveFocus = false) {
    if (destroyed) return;
    const lesson = active();
    const stepIndex = session?.stepIndex ?? position.stepIndex;
    const rung = session?.hintRung ?? position.hintRung;
    const step = lesson.steps[stepIndex];
    const correct = session?.feedback?.outcome === "correct";
    const complete = session?.completed ?? false;
    const activityKind = p4ActivityKind(lesson);
    syncWorkbench(lesson, stepIndex, rung, correct || !session, complete);
    root.classList.toggle("p4-lesson", /^P4\b/.test(lesson.level));
    root.classList.toggle("p4-rich", !!activityKind);
    text(".variant-feedback", variantError);
    worked.hidden = !/^P4\b/.test(lesson.level);
    node('[data-slot="solutions"]').hidden = !workedOpen;
    node('[data-action="worked"]').setAttribute(
      "aria-expanded",
      String(workedOpen),
    );
    if (workedOpen) {
      const solutions = node('[data-slot="solutions"]');
      solutions.replaceChildren();
      const title = document.createElement("h2");
      title.textContent = "Worked solutions for a learning partner";
      solutions.append(title);
      const list = document.createElement("ol");
      for (const item of lesson.steps) {
        const li = document.createElement("li");
        const heading = document.createElement("strong");
        heading.textContent = item.prompt;
        const explanation = document.createElement("p");
        explanation.textContent = item.hints[3];
        li.append(heading, explanation);
        list.append(li);
      }
      solutions.append(list);
    }
    root.dataset.stepIndex = String(stepIndex);
    root.dataset.hintRung = String(rung);
    root.dataset.presentation = session ? "trial" : "edit";
    node(".lesson-canvas").hidden = complete;
    node(".completion").hidden = !complete;
    const lessonBack = node<HTMLButtonElement>(
      ".workspace-heading [data-action=exit]",
    );
    const completedBack = node<HTMLButtonElement>(
      ".completion [data-action=exit]",
    );
    (complete ? lessonBack : completedBack).removeAttribute("data-testid");
    (complete ? completedBack : lessonBack).dataset.testid = "lesson-home";
    if (complete && session) {
      capture("completed");
      text('[data-slot="completed-title"]', lesson.title);
      node('[data-slot="completed-expression"]').hidden = !activityKind;
      text(
        '[data-slot="completed-expression"]',
        activityKind
          ? `${p4Expression(lesson)} = ${String(lesson.steps.find((item) => item.goal === "calculate")?.answer ?? "")}`
          : "",
      );
      text(".completion-label", completionLabel(session));
      text(
        ".completion-note",
        session.hadFacilitator
          ? "You explored this lesson with a facilitator."
          : session.hadSupport
            ? "Hints helped you along the way. Keep exploring at your own pace."
            : "No app hints were used. The app cannot observe help from another person.",
      );
      if (
        ["bench-read", "bench-draw", "place", "shade"].includes(
          String(lesson.specification.task),
        )
      ) {
        node(".completion-note").textContent +=
          " Movement, Undo and alignment controls were practice aids. This result describes your submitted answers; it does not verify construction or manipulation.";
      }
      node('[data-action="next-lesson"]').hidden = !options.onNextLesson;
      node('[data-action="another"]').hidden = !options.onTryAnother;
      const replay = node<HTMLButtonElement>('[data-action="replay"]');
      replay.classList.toggle("primary-button", !options.onTryAnother);
      replay.classList.toggle("text-button", !!options.onTryAnother);
      replay.textContent = "Try this example again";
      node('[data-action="restart-variants"]').hidden =
        !variantError || !options.onRestartVariants;
      text(
        '[data-action="next-lesson"]',
        options.nextLessonLabel ?? "Next lesson in this topic →",
      );
      if (moveFocus) node(".completion h1").focus();
      options.onRender?.();
      return;
    }
    root.dataset.presentation = session ? "trial" : "edit";
    text(
      '[data-slot="level"]',
      `${lesson.level} · ${topicLabel(lesson.topic).toUpperCase()}`,
    );
    text('[data-region="title"]', lesson.title);
    text('[data-region="objective"]', lesson.objective);
    text('[data-region="story"]', lesson.story);
    text(
      '[data-region="step-title"]',
      `STEP ${stepIndex + 1} OF ${lesson.steps.length} · ${step.title}`,
    );
    text('[data-region="prompt"]', step.prompt);
    const solvedGoals = session
      ? lesson.steps
          .filter((item) =>
            session!.history.some(
              (event) =>
                event.stepId === item.id && event.outcome === "correct",
            ),
          )
          .map((item) => item.goal ?? item.id)
      : [];
    const activity = renderP4Activity(lesson, {
      stepIndex,
      hintRung: rung,
      solvedGoals,
      workedOpen,
    });
    const visual = activity
      ? `${activity}<details class="activity-reference"><summary>${activityKind === "decimal" ? "Place-value reference" : "Fraction reference"}</summary>${lessonVisual(lesson)}</details>`
      : lessonVisual(lesson);
    if (visual !== visualSignature) {
      const referenceOpen = root.querySelector<HTMLDetailsElement>(
        ".activity-reference",
      )?.open;
      node('[data-region="visual"]').innerHTML = visual;
      const reference = root.querySelector<HTMLDetailsElement>(
        ".activity-reference",
      );
      if (reference && referenceOpen) reference.open = true;
      visualSignature = visual;
    }
    node(".topic-icon").innerHTML = topicIcon(lesson.topic);
    text('[data-slot="visual-title"]', topicVisualTitle(lesson.topic));
    text(
      '[data-slot="description"]',
      options.adapter.describe(
        session?.state ?? options.adapter.initialState(lesson),
      ),
    );
    const rail = node(".step-rail");
    while (rail.children.length > lesson.steps.length)
      rail.lastElementChild!.remove();
    lesson.steps.forEach((item, i) => {
      let li = rail.children[i] as HTMLLIElement | undefined;
      if (!li) {
        li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        const number = document.createElement("span");
        li.append(number, button);
        rail.append(li);
      }
      li.className = session && i < stepIndex ? "done" : "";
      if (i === stepIndex) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
      const number = li.firstElementChild as HTMLSpanElement;
      number.textContent = session && i < stepIndex ? "✓" : String(i + 1);
      const button = li.lastElementChild as HTMLButtonElement;
      button.dataset.editStep = String(i);
      button.disabled = !!session;
      button.textContent = item.title;
    });
    const signature = `${session ? "trial" : "edit"}:${activityKind ?? ""}:${step.id}:${step.kind}:${step.choices?.map((choice) => choice.id).join("|") ?? ""}`;
    const answers = node(".answer-options");
    if (signature !== answerSignature) {
      answers.replaceChildren();
      if (step.kind === "number" || step.kind === "exact") {
        const label = document.createElement("label");
        label.className = "number-label";
        label.htmlFor = "answer-input";
        label.textContent = "Your answer";
        const input = document.createElement("input");
        input.id = "answer-input";
        input.dataset.testid = "answer-input";
        input.name = "answer";
        input.type = "text";
        input.inputMode =
          step.kind === "exact"
            ? lesson.topic === "decimals"
              ? "decimal"
              : [
                    "whole-numbers",
                    "line-graphs",
                    "symmetry",
                    "nets",
                    "pie-charts",
                    "bar-charts",
                    "angle-measure",
                  ].includes(lesson.topic)
                ? "numeric"
                : "text"
            : "numeric";
        input.autocomplete = "off";
        input.placeholder =
          step.kind === "exact" && lesson.topic === "fraction-calculations"
            ? "For example: 3/5 or 2 3/5"
            : "Type a number";
        input.maxLength = 64;
        input.required = true;
        answers.append(label, input);
      } else
        step.choices?.forEach((choice) => {
          const label = document.createElement("label");
          label.className = "answer-choice";
          const wrap = document.createElement("div");
          wrap.className = "answer-choice-region";
          wrap.dataset.region = `choice:${choice.id}`;
          const input = document.createElement("input");
          input.name = "answer";
          input.type = step.kind === "multi" ? "checkbox" : "radio";
          input.value = choice.id;
          const span = document.createElement("span");
          label.append(input, span);
          if (step.goal === "relation") {
            const diagram = activityChoiceDiagram(lesson, choice);
            if (diagram) label.insertAdjacentHTML("beforeend", diagram);
          }
          wrap.append(label);
          answers.append(wrap);
        });
      answerSignature = signature;
    }
    if (bench && answers.parentElement !== benchList) {
      answers.before(benchList);
      benchList.open = false;
      benchList.append(answers);
    } else if (!bench && answers.parentElement === benchList) {
      benchList.before(answers);
      benchList.remove();
    }
    step.choices?.forEach((choice, i) => {
      const span = answers.children[i]?.querySelector(".answer-choice > span");
      if (span) span.textContent = choice.label;
      if (step.goal === "relation") {
        const old = answers.children[i]?.querySelector(".alignment-sample");
        const diagram = activityChoiceDiagram(lesson, choice);
        if (old && diagram) old.outerHTML = diagram;
      }
    });
    answers.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      if (input.type === "text") input.readOnly = correct || !session;
      else input.disabled = correct || !session;
    });
    node(".input-note").hidden = step.kind !== "multi";
    const feedback = node(".feedback");
    feedback.className = `feedback ${session?.feedback?.outcome ?? ""}`;
    feedback.replaceChildren();
    if (session?.feedback) {
      const strong = document.createElement("strong");
      strong.textContent = correct
        ? "✓ Nice thinking."
        : "Let’s take another look.";
      const p = document.createElement("p");
      p.textContent = session.feedback.feedback;
      feedback.append(strong, p);
    }
    node('[data-testid="check-answer"]').hidden = !session || correct;
    node('[data-action="next"]').hidden = !session || !correct;
    text(
      '[data-action="next"]',
      stepIndex === lesson.steps.length - 1
        ? "Finish lesson →"
        : "Next little step →",
    );
    node('[data-region="hint"]').hidden = rung === 0;
    text(
      '[data-region="hint"] strong',
      rung === 4 ? "Worked step" : `A little help · ${rung} of 4`,
    );
    text('[data-region="hint"] p', rung ? step.hints[rung - 1] : "");
    const hint = node<HTMLButtonElement>('[data-action="hint"]');
    hint.hidden = !session;
    hint.disabled = rung >= 4 || correct;
    hint.textContent =
      rung === 3
        ? "Reveal worked step (uses support)"
        : rung >= 4
          ? "All hints shown"
          : rung
            ? "Show another hint"
            : "I’d like a little hint";
    node('[data-slot="edit-hint"]').hidden = !!session;
    node<HTMLSelectElement>('[data-slot="edit-hint"] select').value =
      String(rung);
    node(".mode-switch").hidden = !session;
    root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(session?.mode === button.dataset.mode),
        ),
      );
    node(".facilitator-note").hidden = session?.mode !== "guided";
    node('[data-action="reset"]').hidden = !session;
    node('[data-action="exit"]').hidden = !options.onExit;
    if (moveFocus) node("#step-heading").focus();
    options.onRender?.();
  }
  function startTrial(
    lesson: Lesson,
    mode: Mode = options.mode ?? "independent",
  ) {
    frozen = structuredClone(lesson);
    session = createSession(frozen, options.adapter, mode);
    trialCounter++;
    workedOpen = false;
    variantError = "";
    answerSignature = "";
    render(true);
  }
  function click(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || !root.contains(button)) return;
    if (button.dataset.editStep !== undefined && !session) {
      position.stepIndex = Number(button.dataset.editStep);
      position.hintRung = 0;
      render();
    }
    if (button.dataset.mode && session) {
      session = switchMode(session, button.dataset.mode as Mode);
      render();
    }
    switch (button.dataset.action) {
      case "worked":
        workedOpen = !workedOpen;
        if (workedOpen && session) session = useWorkedSolution(session);
        render();
        break;
      case "next-lesson":
        capture("next");
        options.onNextLesson?.();
        break;
      case "exit":
        capture("exit");
        options.onExit?.();
        break;
      case "next":
        if (session) {
          session = nextStep(session, frozen, options.adapter);
          render(true);
        }
        break;
      case "hint":
        if (session) {
          session = useHint(session);
          render();
          const hint = node('[data-region="hint"]');
          hint.tabIndex = -1;
          hint.focus();
        }
        break;
      case "reset":
        if (
          session &&
          window.confirm(
            "Restart this lesson? Your current attempt will be cleared.",
          )
        ) {
          capture("restart");
          startTrial(frozen, session.mode);
        }
        break;
      case "replay":
        capture("replay");
        startTrial(frozen, session?.mode);
        break;
      case "another":
      case "restart-variants": {
        if (!session?.completed) break;
        const continuation =
          button.dataset.action === "another"
            ? options.onTryAnother
            : options.onRestartVariants;
        if (!continuation) break;
        try {
          const result = continuation();
          if ("error" in result) {
            variantError = result.error;
            render();
          } else if (
            result.lesson.topic !== options.adapter.id ||
            !result.lesson.steps.length
          ) {
            throw new Error("Invalid practice variant");
          } else {
            capture(button.dataset.action === "another" ? "next" : "restart");
            startTrial(result.lesson, session.mode);
          }
        } catch {
          variantError =
            "We couldn’t prepare another example. Your completed example is still here. Try again or return to the topic.";
          render();
        }
        break;
      }
    }
  }
  function change(event: Event) {
    if (!session && event.target === node('[data-slot="edit-hint"] select')) {
      position.hintRung = Number((event.target as HTMLSelectElement).value);
      render();
    }
    const target = event.target as HTMLInputElement;
    if (bench && target.name === "answer" && target.closest(".answer-options"))
      bench.answerChanged?.(benchIO().currentAnswer());
  }
  function check(event: SubmitEvent) {
    if (event.target !== node("#answer-form")) return;
    event.preventDefault();
    if (!session) return;
    const step = frozen.steps[session.stepIndex];
    const data = new FormData(node<HTMLFormElement>("#answer-form"));
    session = submit(session, frozen, options.adapter, {
      type: "answer",
      value:
        step.kind === "multi"
          ? data.getAll("answer").map(String)
          : String(data.get("answer") ?? "").trim(),
    });
    render();
    node(
      session.feedback?.outcome === "unassessable" &&
        (step.kind === "exact" || step.kind === "number")
        ? "#answer-input"
        : session.feedback?.outcome === "correct"
          ? '[data-action="next"]'
          : '[data-testid="check-answer"]',
    ).focus();
  }
  root.addEventListener("click", click);
  root.addEventListener("change", change);
  root.addEventListener("submit", check);
  render();
  return {
    update(lesson: Lesson, view?: LessonViewPosition) {
      working = structuredClone(lesson);
      if (view) position = { ...view };
      position.stepIndex = Math.max(
        0,
        Math.min(position.stepIndex, working.steps.length - 1),
      );
      position.hintRung = Math.max(0, Math.min(position.hintRung, 4));
      render();
    },
    showEdit(view: LessonViewPosition) {
      session = null;
      workedOpen = false;
      variantError = "";
      position = { ...view };
      position.stepIndex = Math.max(
        0,
        Math.min(position.stepIndex, working.steps.length - 1),
      );
      position.hintRung = Math.max(0, Math.min(position.hintRung, 4));
      render();
    },
    startTrial,
    getSession: () => (session ? structuredClone(session) : null),
    destroy() {
      destroyed = true;
      bench?.destroy();
      bench = null;
      benchKey = "";
      root.removeEventListener("click", click);
      root.removeEventListener("change", change);
      root.removeEventListener("submit", check);
      root.replaceChildren();
    },
  };
}
