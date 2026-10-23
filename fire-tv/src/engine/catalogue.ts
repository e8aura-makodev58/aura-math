import type {Lesson, Step} from '../../../src/core/types';
import generated from '../generated/lessons.json';
import {tvTopics, type TvTopic} from './adapters';

export interface GeneratedLesson {
  file: string;
  evidenceStatus: string;
  lesson: Lesson;
}

export interface TvLessonEntry {
  lesson: Lesson;
  topic: TvTopic;
  evidenceStatus: string;
}

export interface TvTopicGroup {
  topic: TvTopic;
  lessons: TvLessonEntry[];
}

/** The TV runs choice and number steps only; exact and multi-part steps need a remote-friendly input. */
const TV_STEP_KINDS: ReadonlySet<Step['kind']> = new Set<Step['kind']>(['choice', 'number']);

export function isTvLesson(lesson: Lesson): boolean {
  if (lesson.steps.length === 0) return false;
  if (!lesson.steps.every((step) => TV_STEP_KINDS.has(step.kind))) return false;
  return lesson.steps.every(
    (step) => step.kind !== 'number' || numberAnswerInRange(step),
  );
}

/** The digit picker shows three digits, so larger expected numbers cannot be entered. */
export const TV_MAX_DIGITS = 3;

function numberAnswerInRange(step: Step): boolean {
  return typeof step.answer === 'number' && Number.isSafeInteger(step.answer) && step.answer >= 0 && step.answer < 10 ** TV_MAX_DIGITS;
}

/** Lessons the TV can run, grouped by topic in the order of tvTopics. */
export function buildTvCatalogue(
  entries: readonly GeneratedLesson[] = generated as unknown as GeneratedLesson[],
  topics: readonly TvTopic[] = tvTopics,
): TvTopicGroup[] {
  const groups: TvTopicGroup[] = [];
  for (const topic of topics) {
    const lessons = entries
      .filter((entry) => entry.lesson.topic === topic.id && isTvLesson(entry.lesson))
      .map((entry) => ({lesson: entry.lesson, topic, evidenceStatus: entry.evidenceStatus}));
    if (lessons.length > 0) groups.push({topic, lessons});
  }
  return groups;
}
