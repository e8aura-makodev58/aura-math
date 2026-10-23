import {
  completionLabel,
  createSession,
  nextStep,
  submit,
  useHint,
} from '../../../src/core/runtime';
import type {Action, Session, Step} from '../../../src/core/types';
import type {TvLessonEntry, TvTopicGroup} from './catalogue';
import {changeDigit, digitsToNumber, emptyDigits, moveCursor, type DigitPicker} from './digits';
import type {RemoteKey} from './remote';

export type Screen = 'home' | 'topics' | 'lessons' | 'question' | 'summary';

export interface TvState {
  screen: Screen;
  /** Highlighted item on list screens, and highlighted choice on choice steps. */
  focus: number;
  topicIndex: number;
  lessonIndex: number;
  session: Session | null;
  picker: DigitPicker;
  /** Set when Back is pressed on the home screen; the app then exits. */
  exitRequested: boolean;
}

export const TOPIC_COLUMNS = 2;
export const SUMMARY_ACTIONS = ['again', 'lessons', 'home'] as const;

export function initialTvState(): TvState {
  return {
    screen: 'home',
    focus: 0,
    topicIndex: 0,
    lessonIndex: 0,
    session: null,
    picker: emptyDigits(),
    exitRequested: false,
  };
}

export function currentEntry(state: TvState, groups: readonly TvTopicGroup[]): TvLessonEntry | null {
  return groups[state.topicIndex]?.lessons[state.lessonIndex] ?? null;
}

/** Moves a highlight within `count` items, laid out in `columns` columns, clamping at every edge. */
export function moveHighlight(focus: number, count: number, key: RemoteKey, columns = 1): number {
  if (count <= 0) return 0;
  const last = count - 1;
  switch (key) {
    case 'up':
      return Math.max(0, focus - columns);
    case 'down':
      return Math.min(last, focus + columns);
    case 'left':
      return columns > 1 ? Math.max(0, focus - 1) : focus;
    case 'right':
      return columns > 1 ? Math.min(last, focus + 1) : focus;
    default:
      return focus;
  }
}

function startLesson(state: TvState, groups: readonly TvTopicGroup[], lessonIndex: number): TvState {
  const group = groups[state.topicIndex];
  const entry = group?.lessons[lessonIndex];
  if (!entry) return state;
  return {
    ...state,
    screen: 'question',
    lessonIndex,
    focus: 0,
    session: createSession(entry.lesson, entry.topic.adapter, 'independent'),
    picker: emptyDigits(),
  };
}

/** Routes one remote press to the screen it lands on. Pure: returns the next state. */
export function navigate(state: TvState, key: RemoteKey, groups: readonly TvTopicGroup[]): TvState {
  switch (state.screen) {
    case 'home':
      if (key === 'select') return {...state, screen: 'topics', focus: 0};
      if (key === 'back') return {...state, exitRequested: true};
      return state;

    case 'topics': {
      if (key === 'back') return {...state, screen: 'home', focus: 0};
      if (key === 'select') {
        return {...state, screen: 'lessons', topicIndex: state.focus, lessonIndex: 0, focus: 0};
      }
      return {...state, focus: moveHighlight(state.focus, groups.length, key, TOPIC_COLUMNS)};
    }

    case 'lessons': {
      const count = groups[state.topicIndex]?.lessons.length ?? 0;
      if (key === 'back') return {...state, screen: 'topics', focus: state.topicIndex};
      if (key === 'select') return startLesson({...state, focus: state.focus}, groups, state.focus);
      return {...state, focus: moveHighlight(state.focus, count, key)};
    }

    case 'question':
      return navigateQuestion(state, key, groups);

    case 'summary':
      return navigateSummary(state, key, groups);
  }
}

function navigateQuestion(state: TvState, key: RemoteKey, groups: readonly TvTopicGroup[]): TvState {
  const entry = currentEntry(state, groups);
  const session = state.session;
  if (!entry || !session) return {...state, screen: 'lessons'};
  if (key === 'back') return {...state, screen: 'lessons', session: null, focus: state.lessonIndex};

  const step = entry.lesson.steps[session.stepIndex];
  const solved = session.feedback?.outcome === 'correct';

  if (solved) {
    if (key !== 'select') return state;
    const next = nextStep(session, entry.lesson, entry.topic.adapter);
    if (next.completed) return {...state, session: next, screen: 'summary', focus: 0};
    return {...state, session: next, focus: 0, picker: emptyDigits()};
  }

  if (key === 'hint') return {...state, session: useHint(session)};

  if (step.kind === 'number') {
    if (key === 'up') return {...state, picker: changeDigit(state.picker, 1)};
    if (key === 'down') return {...state, picker: changeDigit(state.picker, -1)};
    if (key === 'left') return {...state, picker: moveCursor(state.picker, -1)};
    if (key === 'right') return {...state, picker: moveCursor(state.picker, 1)};
    if (key === 'select') {
      return {...state, session: answer(session, entry, {type: 'answer', value: digitsToNumber(state.picker)})};
    }
    return state;
  }

  const choices = step.choices ?? [];
  if (key === 'up' || key === 'down') {
    return {...state, focus: moveHighlight(state.focus, choices.length, key)};
  }
  if (key === 'select') {
    const choice = choices[state.focus];
    if (!choice) return state;
    return {...state, session: answer(session, entry, {type: 'answer', value: choice.id})};
  }
  return state;
}

function answer(session: Session, entry: TvLessonEntry, action: Action): Session {
  return submit(session, entry.lesson, entry.topic.adapter, action);
}

function navigateSummary(state: TvState, key: RemoteKey, groups: readonly TvTopicGroup[]): TvState {
  if (key === 'back') return {...state, screen: 'lessons', session: null, focus: state.lessonIndex};
  if (key === 'up' || key === 'down') {
    return {...state, focus: moveHighlight(state.focus, SUMMARY_ACTIONS.length, key)};
  }
  if (key !== 'select') return state;

  const action = SUMMARY_ACTIONS[state.focus];
  if (action === 'again') return startLesson({...state, session: null}, groups, state.lessonIndex);
  if (action === 'lessons') return {...state, screen: 'lessons', session: null, focus: state.lessonIndex};
  return {...initialTvState()};
}

/** The step the learner is on, or null when no session is active. */
export function currentStep(state: TvState, groups: readonly TvTopicGroup[]): Step | null {
  const entry = currentEntry(state, groups);
  if (!entry || !state.session) return null;
  return entry.lesson.steps[state.session.stepIndex] ?? null;
}

export interface SessionSummary {
  lessonTitle: string;
  topicLabel: string;
  stepsCompleted: number;
  stepsTotal: number;
  firstTryCorrect: number;
  hintsUsed: number;
  completion: string;
}

/**
 * Only values the session produced: step counts come from the core session
 * state and history, never from assumptions about the lesson.
 */
export function summarise(session: Session, entry: TvLessonEntry): SessionSummary {
  const stepsTotal = entry.lesson.steps.length;
  const firstOutcome = new Map<string, string>();
  for (const item of session.history) {
    if (!firstOutcome.has(item.stepId)) firstOutcome.set(item.stepId, item.outcome);
  }
  const firstTryCorrect = Array.from(firstOutcome.values()).filter((outcome) => outcome === 'correct').length;
  return {
    lessonTitle: entry.lesson.title,
    topicLabel: entry.topic.label,
    stepsCompleted: session.completed ? stepsTotal : session.stepIndex,
    stepsTotal,
    firstTryCorrect,
    hintsUsed: session.hintsUsed,
    completion: completionLabel(session),
  };
}
