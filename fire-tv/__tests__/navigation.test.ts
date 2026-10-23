import {buildTvCatalogue} from '../src/engine/catalogue';
import {moveHighlight, navigate, initialTvState, type TvState} from '../src/engine/tvState';
import {tvTopics} from '../src/engine/adapters';
import type {TvTopicGroup} from '../src/engine/catalogue';

const groups: TvTopicGroup[] = buildTvCatalogue();

describe('moveHighlight', () => {
  it('clamps at the first and last item instead of wrapping', () => {
    expect(moveHighlight(0, 3, 'up')).toBe(0);
    expect(moveHighlight(2, 3, 'down')).toBe(2);
  });

  it('moves between rows and columns in a grid', () => {
    expect(moveHighlight(0, 6, 'down', 2)).toBe(2);
    expect(moveHighlight(2, 6, 'up', 2)).toBe(0);
    expect(moveHighlight(0, 6, 'right', 2)).toBe(1);
    expect(moveHighlight(1, 6, 'right', 2)).toBe(2);
  });

  it('never traps focus on an empty list', () => {
    expect(moveHighlight(0, 0, 'down')).toBe(0);
  });
});

describe('TV navigation', () => {
  const press = (state: TvState, ...keys: Parameters<typeof navigate>[1][]): TvState =>
    keys.reduce((current, key) => navigate(current, key, groups), state);

  it('goes from home to the topic list and back', () => {
    const topics = press(initialTvState(), 'select');
    expect(topics.screen).toBe('topics');
    expect(press(topics, 'back').screen).toBe('home');
  });

  it('asks to exit when Back is pressed on home', () => {
    expect(press(initialTvState(), 'back').exitRequested).toBe(true);
  });

  it('starts a lesson from the lesson list with a fresh session', () => {
    const question = press(initialTvState(), 'select', 'select', 'select');
    expect(question.screen).toBe('question');
    expect(question.session?.stepIndex).toBe(0);
    expect(question.session?.completed).toBe(false);
  });

  it('answers a choice step by pressing select on the highlighted choice', () => {
    let state = press(initialTvState(), 'select', 'select', 'select');
    const step = groups[0].lessons[0].lesson.steps[0];
    const correctIndex = step.choices?.findIndex((choice) => choice.id === step.answer) ?? -1;
    for (let i = 0; i < correctIndex; i++) state = navigate(state, 'down', groups);
    state = navigate(state, 'select', groups);
    expect(state.session?.feedback?.outcome).toBe('correct');
  });

  it('keeps the learner on the question after a wrong answer and lets them try again', () => {
    let state = press(initialTvState(), 'select', 'select', 'select');
    const step = groups[0].lessons[0].lesson.steps[0];
    const wrongIndex = step.choices?.findIndex((choice) => choice.id !== step.answer) ?? -1;
    for (let i = 0; i < wrongIndex; i++) state = navigate(state, 'down', groups);
    state = navigate(state, 'select', groups);
    expect(state.session?.feedback?.outcome).toBe('incorrect');
    expect(state.screen).toBe('question');
  });

  it('uses Back to leave a lesson without crashing', () => {
    const lessons = press(initialTvState(), 'select', 'select', 'select', 'back');
    expect(lessons.screen).toBe('lessons');
    expect(lessons.session).toBeNull();
  });

  it('ignores presses that have no meaning on the current screen', () => {
    const home = initialTvState();
    expect(navigate(home, 'left', groups)).toEqual(home);
  });
});

describe('catalogue', () => {
  it('only includes lessons the TV can run and that use a runtime adapter', () => {
    const topicIds = new Set(tvTopics.map((topic) => topic.id));
    for (const group of groups) {
      expect(topicIds.has(group.topic.id)).toBe(true);
      for (const entry of group.lessons) {
        expect(entry.lesson.steps.every((step) => step.kind === 'choice' || step.kind === 'number')).toBe(true);
        expect(entry.lesson.topic).toBe(group.topic.id);
      }
    }
  });

  it('has at least one lesson per topic group and seventeen lessons in total', () => {
    expect(groups.every((group) => group.lessons.length > 0)).toBe(true);
    expect(groups.reduce((sum, group) => sum + group.lessons.length, 0)).toBe(17);
  });
});
