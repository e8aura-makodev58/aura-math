import {createSession, nextStep, submit} from '../../src/core/runtime';
import type {Lesson, Step} from '../../src/core/types';
import {buildTvCatalogue, type TvLessonEntry} from '../src/engine/catalogue';

/**
 * Drives every Fire TV lesson through the shared core runtime with each topic's
 * own answer oracle, then checks the same lesson rejects a wrong first answer.
 * This exercises the real session transitions, not a copy of them.
 */
const entries: TvLessonEntry[] = buildTvCatalogue().flatMap((group) => group.lessons);

function answerFor(entry: TvLessonEntry, lesson: Lesson, step: Step): unknown {
  return entry.topic.answer(lesson, step);
}

function wrongValue(step: Step, correct: unknown): unknown {
  if (step.kind === 'number') return (correct as number) === 0 ? 1 : 0;
  return step.choices?.find((choice) => choice.id !== correct)?.id;
}

describe.each(entries.map((entry) => [entry.lesson.id, entry] as const))('lesson %s', (_id, entry) => {
  const {lesson, topic} = entry;

  it('completes with each topic oracle answer', () => {
    let session = createSession(lesson, topic.adapter, 'independent');
    for (const step of lesson.steps) {
      const correct = answerFor(entry, lesson, step);
      session = submit(session, lesson, topic.adapter, {type: 'answer', value: correct as never});
      expect(session.feedback?.outcome).toBe('correct');
      session = nextStep(session, lesson, topic.adapter);
    }
    expect(session.completed).toBe(true);
    expect(session.history.filter((item) => item.outcome === 'correct')).toHaveLength(lesson.steps.length);
  });

  it('marks a wrong first answer as incorrect and keeps the step open', () => {
    const step = lesson.steps[0];
    const correct = answerFor(entry, lesson, step);
    const wrong = wrongValue(step, correct);
    expect(wrong).not.toBe(correct);
    const session = submit(
      createSession(lesson, topic.adapter, 'independent'),
      lesson,
      topic.adapter,
      {type: 'answer', value: wrong as never},
    );
    expect(session.feedback?.outcome).toBe('incorrect');
    expect(session.stepIndex).toBe(0);
  });
});
