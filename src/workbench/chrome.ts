import type { Step } from "../core/types";
import { KeyframePlayer, type PlayerClock } from "./player";
import type { WorkbenchIO } from "./types";

/**
 * Shared Watch / Your turn chrome for a workbench (topic-agnostic): the phase switch, caption,
 * stage, Watch controls, Undo and Start again, answer buttons that drive the existing answer
 * controls, and one polite live region with neutral text. The topic fills `stage` and `tools`.
 */
export type Phase = "watch" | "try";
export interface ChromeOptions {
  io: WorkbenchIO;
  step: Step;
  /** Watch captions, one per keyframe. */
  captions: string[];
  /** Short instruction shown in Your turn. */
  instruction: string;
  /** Shows Watch keyframe `index` (animate false for a still). */
  showFrame(index: number, animate: boolean): void;
  /** The phase changed. */
  phaseChanged(phase: Phase): void;
  /** Start again: return the manipulative to its first state (recorded for Undo by the topic). */
  reset(): void;
  clock?: PlayerClock;
  frameMs?: number;
}
const button = (label: string, data: string, cls = "bench-button") => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.dataset.bench = data;
  b.textContent = label;
  return b;
};

export class BenchChrome {
  readonly root = document.createElement("div");
  readonly stage = document.createElement("div");
  readonly tools = document.createElement("div");
  readonly view = document.createElement("div");
  phase: Phase = "watch";
  private caption = document.createElement("p");
  private live = document.createElement("p");
  private watchBar = document.createElement("div");
  private tryPanel = document.createElement("div");
  private chips: HTMLButtonElement[] = [];
  private undoButton: HTMLButtonElement;
  private playButton: HTMLButtonElement;
  private history: (() => void)[] = [];
  private locked = false;
  private reduced = false;
  private media: MediaQueryList | null = null;
  private lastAnnounce = 0;
  private cleanups: (() => void)[] = [];
  readonly player: KeyframePlayer;

  constructor(
    host: HTMLElement,
    private o: ChromeOptions,
  ) {
    const trial = o.io.presentation() === "trial";
    this.root.className = "bench";
    this.root.dataset.phase = "watch";
    const phases = document.createElement("div");
    phases.className = "bench-phases";
    phases.setAttribute("role", "group");
    phases.setAttribute("aria-label", "Hands-on model");
    phases.append(
      button("Watch", "phase-watch", "bench-phase"),
      button("Your turn", "phase-try", "bench-phase"),
    );
    this.caption.className = "bench-caption";
    this.caption.dataset.slot = "bench-caption";
    this.stage.className = "bench-stage";
    this.view.className = "bench-row bench-view";
    this.view.setAttribute("role", "group");
    this.view.setAttribute("aria-label", "Turn the view");
    this.watchBar.className = "bench-row bench-watch";
    this.playButton = button("Play", "play");
    this.watchBar.append(
      button("Back", "back"),
      this.playButton,
      button("Next", "next"),
    );
    this.tryPanel.className = "bench-try";
    this.tools.className = "bench-tools";
    const history = document.createElement("div");
    history.className = "bench-row";
    this.undoButton = button("Undo", "undo");
    history.append(this.undoButton, button("Start again", "reset"));
    const answer = document.createElement("div");
    answer.className = "bench-answer";
    answer.setAttribute("role", "group");
    answer.setAttribute("aria-label", "Your answer");
    const legend = document.createElement("p");
    legend.className = "bench-answer-title";
    legend.textContent = "Your answer";
    answer.append(legend);
    for (const choice of o.step.choices ?? []) {
      const chip = button(choice.label, "answer", "bench-chip");
      chip.dataset.choice = choice.id;
      chip.setAttribute("aria-pressed", "false");
      chip.disabled = !trial;
      this.chips.push(chip);
      answer.append(chip);
    }
    this.tryPanel.append(this.tools, history, answer);
    this.live.className = "sr-only";
    this.live.setAttribute("aria-live", "polite");
    this.root.append(
      phases,
      this.caption,
      this.stage,
      this.view,
      this.watchBar,
      this.tryPanel,
      this.live,
    );
    host.append(this.root);
    if (typeof matchMedia === "function") {
      this.media = matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = this.media.matches;
      const onMedia = (event: MediaQueryListEvent) => {
        this.reduced = event.matches;
        if (this.reduced) this.player.pause();
        this.paint();
      };
      this.media.addEventListener("change", onMedia);
      this.cleanups.push(() =>
        this.media?.removeEventListener("change", onMedia),
      );
    }
    this.player = new KeyframePlayer({
      count: o.captions.length,
      ms: o.frameMs ?? 1100,
      clock: o.clock ?? {
        schedule: (run, ms) => window.setTimeout(run, ms),
        cancel: (id) => window.clearTimeout(id),
      },
      reducedMotion: () => this.reduced,
      show: (index, animate) => {
        o.showFrame(index, animate);
        this.say(o.captions[index]);
        this.paint();
      },
      changed: () => this.paint(),
    });
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-bench]",
      );
      if (!target || !this.root.contains(target)) return;
      switch (target.dataset.bench) {
        case "phase-watch":
          this.setPhase("watch");
          break;
        case "phase-try":
          this.setPhase("try");
          break;
        case "back":
          this.player.back();
          break;
        case "next":
          this.player.next();
          break;
        case "play":
          if (this.player.playing) this.player.pause();
          else this.player.play();
          break;
        case "undo":
          this.undo();
          break;
        case "reset":
          this.o.reset();
          this.choose(null);
          this.announce("Started again.");
          break;
        case "answer":
          this.choose(target.dataset.choice ?? null);
          break;
      }
    };
    this.root.addEventListener("click", click);
    this.cleanups.push(() => this.root.removeEventListener("click", click));
    o.showFrame(0, false);
    this.paint();
  }

  get reducedMotion() {
    return this.reduced;
  }
  /** Records how to undo one move (a fold, a view-independent change, an answer choice). */
  record(undo: () => void) {
    this.history.push(undo);
    if (this.history.length > 50) this.history.shift();
    this.paint();
  }
  undo() {
    const step = this.history.pop();
    if (step) {
      step();
      this.announce("Undone.");
    }
    this.paint();
  }
  setPhase(phase: Phase) {
    if (phase === this.phase) return;
    this.player.pause();
    this.phase = phase;
    this.o.phaseChanged(phase);
    if (phase === "watch") this.o.showFrame(this.player.index, false);
    this.say(
      phase === "watch"
        ? this.o.captions[this.player.index]
        : this.o.instruction,
    );
    this.paint();
  }
  /** Chooses an answer through the existing controls; recorded for Undo. */
  choose(id: string | null) {
    if (this.locked || this.o.io.presentation() !== "trial") return;
    const before = this.o.io.currentAnswer();
    const ids = id === null ? [] : this.multi ? toggle(before, id) : [id];
    if (same(before, ids)) return;
    if (!this.o.io.setAnswer(this.multi ? ids : (ids[0] ?? null))) return;
    this.record(() => {
      this.o.io.setAnswer(this.multi ? before : (before[0] ?? null));
      this.sync(this.o.io.currentAnswer());
    });
    this.sync(ids);
    if (id !== null)
      this.announce(
        `${this.o.step.choices?.find((c) => c.id === id)?.label ?? ""} chosen.`,
      );
  }
  private get multi() {
    return this.o.step.kind === "multi";
  }
  /** Reflects the answer held by the existing controls on the answer buttons. */
  sync(ids: string[]) {
    for (const chip of this.chips)
      chip.setAttribute(
        "aria-pressed",
        String(ids.includes(chip.dataset.choice ?? "")),
      );
  }
  lock(locked: boolean) {
    this.locked = locked;
    const trial = this.o.io.presentation() === "trial";
    for (const chip of this.chips) chip.disabled = locked || !trial;
  }
  /** Neutral text for the live region, at most one message per 400 ms (the latest wins). */
  announce(text: string) {
    const now = Date.now();
    if (now - this.lastAnnounce < 400 && this.live.textContent) {
      this.live.textContent = text;
      return;
    }
    this.lastAnnounce = now;
    this.live.textContent = text;
  }
  private say(text: string) {
    this.caption.textContent = text;
    if (this.phase === "watch") this.announce(text);
  }
  private paint() {
    this.root.dataset.phase = this.phase;
    this.root.dataset.motion = this.reduced ? "reduced" : "full";
    for (const b of this.root.querySelectorAll<HTMLButtonElement>(
      ".bench-phase",
    ))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.bench === `phase-${this.phase}`),
      );
    this.watchBar.hidden = this.phase !== "watch";
    this.tryPanel.hidden = this.phase !== "try";
    if (this.phase === "try") this.caption.textContent = this.o.instruction;
    const last = this.player.index >= this.player.last;
    this.playButton.hidden = this.reduced;
    this.playButton.textContent = this.player.playing
      ? "Pause"
      : last
        ? "Play again"
        : "Play";
    const back = this.watchBar.querySelector<HTMLButtonElement>(
      '[data-bench="back"]',
    )!;
    const next = this.watchBar.querySelector<HTMLButtonElement>(
      '[data-bench="next"]',
    )!;
    back.disabled = this.player.index === 0;
    next.disabled = last;
    this.undoButton.disabled = !this.history.length;
  }
  destroy() {
    this.player.destroy();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    this.history.length = 0;
    this.root.remove();
  }
}
const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));
const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
