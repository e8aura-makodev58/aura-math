/**
 * Contracts between the shared lesson view (the host) and a topic's workbench. The shared view
 * imports only these types; a concrete topic registers a factory through `RuntimeTopic.workbench`,
 * so the runtime never imports a concrete topic. Nothing here reaches `src/core/`.
 */

/** Answer value in the form the existing controls take: a choice id, several ids, or text. */
export type WorkbenchAnswer = string | string[] | null;

/** What the host gives a workbench. Every call is safe after the host has moved on. */
export interface WorkbenchIO {
  /** `trial` while a learner session runs; `edit` in the author preview (nothing is recorded). */
  presentation(): "edit" | "trial";
  /** The hint rung shown for this step (0 to 4). */
  hintRung(): number;
  /**
   * Writes the existing answer controls (radios, checkboxes or the text input) by choice id. The
   * controls are looked up at call time, so a rebuild of the answer list cannot leave a stale
   * reference. Returns false (and changes nothing) when the controls are locked or absent.
   */
  setAnswer(value: WorkbenchAnswer): boolean;
  /** The answer currently held by the existing controls. */
  currentAnswer(): string[];
}

/** What a workbench gives back. Optional members are notifications the host may send. */
export interface WorkbenchHandle {
  /** The hint rung changed (also sent once on mount when it is not 0). Rung 4 is the reveal. */
  hint?(rung: number): void;
  /** The answer controls were locked (a correct check) or unlocked. */
  lock?(locked: boolean): void;
  /** The learner changed the list-version controls directly. */
  answerChanged?(value: string[]): void;
  /** Cancel every frame, timer and listener and free graphics resources. Idempotent. */
  destroy(): void;
}

export type WorkbenchFactory = (
  host: HTMLElement,
  io: WorkbenchIO,
) => WorkbenchHandle;
