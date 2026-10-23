import type { Session } from "../core/types";
import { completionLabel } from "../core/runtime";

export type AttemptEnd = "completed" | "replay" | "restart" | "exit" | "next";
export interface PracticeIdentity {
  sourceId: string;
  lessonId: string;
  variant?: {
    seed: number;
    profileId: string;
    generatorVersion: string;
    ordinal: number;
    fingerprint: string;
    /** Opaque id of the adult-approved story slot set the variant used (preview only). */
    approvedStoryId?: string;
  };
}
export interface AttemptSummary extends PracticeIdentity {
  attemptId: number;
  repeatedExample: boolean;
  completed: boolean;
  label: string;
  submissions: number;
  hintsUsed: number;
  hadSupport: boolean;
  hadFacilitator: boolean;
  reason: AttemptEnd;
}

/** Temporary practice evidence, separate from the active adapter's event history. */
export function createPracticeJournal() {
  let sequence = 0;
  let active:
    | (PracticeIdentity & {
        attemptId: number;
        repeatedExample: boolean;
      })
    | null = null;
  const summaries: AttemptSummary[] = [];
  return {
    begin(identity: PracticeIdentity, repeatedExample = false) {
      active = {
        ...structuredClone(identity),
        attemptId: ++sequence,
        repeatedExample,
      };
    },
    record(session: Session, reason: AttemptEnd): AttemptSummary | null {
      if (!active || session.lessonId !== active.lessonId) return null;
      const summary: AttemptSummary = {
        ...structuredClone(active),
        completed: session.completed,
        label: completionLabel(session),
        submissions: session.submissions,
        hintsUsed: session.hintsUsed,
        hadSupport: session.hadSupport,
        hadFacilitator: session.hadFacilitator,
        reason,
      };
      const index = summaries.findIndex(
        (item) => item.attemptId === summary.attemptId,
      );
      if (index < 0) summaries.push(summary);
      else summaries[index] = summary;
      if (summaries.length > 20) summaries.shift();
      return structuredClone(summary);
    },
    getActive: () => (active ? structuredClone(active) : null),
    getSummaries: () => structuredClone(summaries),
  };
}
