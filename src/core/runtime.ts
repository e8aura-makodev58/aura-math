import type { Action, Adapter, Lesson, Mode, Session } from "./types";

export function createSession(
  lesson: Lesson,
  adapter: Adapter,
  mode: Mode = "independent",
): Session {
  if (adapter.id !== lesson.topic)
    throw new Error("Lesson and adapter topics must match.");
  return {
    lessonId: lesson.id,
    mode,
    state: adapter.initialState(lesson),
    stepIndex: 0,
    hintsUsed: 0,
    hintRung: 0,
    submissions: 0,
    hadSupport: false,
    hadFacilitator: mode === "guided",
    completed: false,
    feedback: null,
    history: [],
    events: [],
  };
}

export function submit(
  session: Session,
  lesson: Lesson,
  adapter: Adapter,
  action: Action,
): Session {
  if (session.completed || session.feedback?.outcome === "correct")
    return session;
  if (lesson.id !== session.lessonId || adapter.id !== lesson.topic)
    throw new Error("Session lesson mismatch.");
  const step = lesson.steps[session.stepIndex];
  if (!step) throw new Error("Session step is outside this lesson.");
  const applied = adapter.apply(
    structuredClone(session.state),
    structuredClone(action),
  );
  if (applied.outcome !== "applied")
    return {
      ...session,
      feedback: {
        outcome: "unassessable",
        feedbackKey: "answer.unsupported",
        matchedAlternative: null,
        feedback: "Choose or enter an answer for this step.",
      },
    };
  const feedback = adapter.evaluate(applied.state, step, {
    step,
    previousState: structuredClone(session.state),
    action: structuredClone(action),
    events: structuredClone(session.events),
  });
  if (feedback.outcome === "unassessable" || feedback.outcome === "incomplete")
    return { ...session, feedback };
  return {
    ...session,
    state: applied.state,
    feedback,
    submissions: session.submissions + 1,
    events: [
      ...session.events,
      {
        type: "submission",
        stepIndex: session.stepIndex,
        stepId: step.id,
        action: structuredClone(action),
        outcome: feedback.outcome,
        feedbackKey: feedback.feedbackKey ?? `answer.${feedback.outcome}`,
        matchedAlternative: feedback.matchedAlternative ?? null,
      },
    ],
    history: [
      ...session.history,
      {
        stepId: step.id,
        action: structuredClone(action),
        outcome: feedback.outcome,
      },
    ],
  };
}

export function nextStep(
  session: Session,
  lesson: Lesson,
  adapter: Adapter,
): Session {
  if (session.lessonId !== lesson.id || adapter.id !== lesson.topic)
    throw new Error("Session lesson mismatch.");
  if (session.completed || session.feedback?.outcome !== "correct")
    return session;
  if (session.stepIndex === lesson.steps.length - 1)
    return { ...session, completed: true };
  return {
    ...session,
    stepIndex: session.stepIndex + 1,
    hintRung: 0,
    feedback: null,
    state: adapter.resetStep(
      structuredClone(session.state),
      lesson.steps[session.stepIndex],
      lesson.steps[session.stepIndex + 1],
    ),
  };
}

export function useHint(session: Session): Session {
  if (
    session.completed ||
    session.hintRung >= 4 ||
    session.feedback?.outcome === "correct"
  )
    return session;
  return {
    ...session,
    hintRung: session.hintRung + 1,
    hintsUsed: session.hintsUsed + 1,
    hadSupport: true,
    events: [
      ...session.events,
      {
        type: "hint",
        stepIndex: session.stepIndex,
        rung: session.hintRung + 1,
      },
      ...(session.hintRung === 3
        ? [
            {
              type: "reveal" as const,
              stepIndex: session.stepIndex,
              rung: 4 as const,
            },
          ]
        : []),
    ],
  };
}

export function switchMode(session: Session, mode: Mode): Session {
  if (session.completed || session.mode === mode) return session;
  return {
    ...session,
    mode,
    events: [
      ...session.events,
      {
        type: "mode",
        stepIndex: session.stepIndex,
        from: session.mode,
        to: mode,
      },
    ],
    hadFacilitator: session.hadFacilitator || mode === "guided",
  };
}

export function completionLabel(session: Session): string {
  if (!session.completed) return "In progress";
  if (session.hadFacilitator) return "Completed with facilitator";
  return session.hadSupport
    ? "Completed with support"
    : "Completed without app support";
}

/** Adult worked answers are explicit support, including when viewed after completion. */
export function useWorkedSolution(session: Session): Session {
  return {
    ...session,
    hadSupport: true,
    events: [
      ...session.events,
      { type: "worked-solution", stepIndex: session.stepIndex },
    ],
  };
}
