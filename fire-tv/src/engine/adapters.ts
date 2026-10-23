/**
 * Topic adapters shared with the web app. Only modules that are free of DOM,
 * three.js and workbench code are imported here, so the TV bundle stays small
 * and loads on the Vega runtime. Nets, symmetry, area/perimeter and angle
 * measure need workbenches and are not yet supported on Fire TV.
 */
import type {Adapter, Lesson, Step, TopicId} from '../../../src/core/types';
import {anglesAdapter, anglesAnswer, type AnglesSpec} from '../../../src/topics/angles';
import {comparisonAdapter, comparisonAnswer, type ComparisonSpec} from '../../../src/topics/comparison';
import {barChartsTopic} from '../../../src/topics/bar-charts';
import {decimalsTopic} from '../../../src/topics/decimals';
import {equalGroupsTopic} from '../../../src/topics/equal-groups';
import {fractionCalculationsTopic} from '../../../src/topics/fraction-calculations';
import {fractionsTopic} from '../../../src/topics/fractions';
import {lineGraphsTopic} from '../../../src/topics/line-graphs';
import {pictureGraphsTopic} from '../../../src/topics/picture-graphs';
import {pieChartsTopic} from '../../../src/topics/pie-charts';
import {placeValueTopic} from '../../../src/topics/place-value';
import {wholeNumbersTopic} from '../../../src/topics/whole-numbers';

export interface TvTopic {
  id: TopicId;
  label: string;
  adapter: Adapter;
  /** The expected answer for a step, used only to reveal it after the hint ladder. */
  answer(lesson: Lesson, step: Step): Step['answer'];
}

const fromRuntime = (topic: {
  id: TopicId;
  label: string;
  adapter: Adapter;
  answer(lesson: Lesson, step: Step): Step['answer'];
}): TvTopic => ({
  id: topic.id,
  label: topic.label,
  adapter: topic.adapter,
  answer: (lesson, step) => topic.answer(lesson, step),
});

export const tvTopics: TvTopic[] = [
  {
    id: 'comparison',
    label: 'Comparison',
    adapter: comparisonAdapter,
    answer: (lesson, step) =>
      comparisonAnswer(lesson.specification as unknown as ComparisonSpec, step),
  },
  {
    id: 'angles',
    label: 'Angles',
    adapter: anglesAdapter,
    answer: (lesson, step) => anglesAnswer(lesson.specification as unknown as AnglesSpec, step),
  },
  fromRuntime(pictureGraphsTopic),
  fromRuntime(fractionsTopic),
  fromRuntime(placeValueTopic),
  fromRuntime(equalGroupsTopic),
  fromRuntime(decimalsTopic),
  fromRuntime(wholeNumbersTopic),
  fromRuntime(fractionCalculationsTopic),
  fromRuntime(lineGraphsTopic),
  fromRuntime(pieChartsTopic),
  fromRuntime(barChartsTopic),
];

export function tvTopicFor(id: TopicId): TvTopic | undefined {
  return tvTopics.find((topic) => topic.id === id);
}
