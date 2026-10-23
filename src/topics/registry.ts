import type { Adapter, Lesson, Step, TopicId } from "../core/types";
import { anglesAdapter, anglesAnswer, type AnglesSpec } from "./angles";
import {
  comparisonAdapter,
  comparisonAnswer,
  type ComparisonSpec,
} from "./comparison";

import { decimalsTopic } from "./decimals";
import { fractionCalculationsTopic } from "./fraction-calculations";
import { areaPerimeterTopic } from "./area-perimeter";
import { wholeNumbersTopic } from "./whole-numbers";
import { lineGraphsTopic } from "./line-graphs";
import { symmetryTopic } from "./symmetry";
import { netsTopic } from "./nets";
import { pieChartsTopic } from "./pie-charts";
import { barChartsTopic } from "./bar-charts";
import { angleMeasureTopic } from "./angle-measure";
import { placeValueTopic } from "./place-value";
import { equalGroupsTopic } from "./equal-groups";
import { fractionsTopic } from "./fractions";
import { pictureGraphsTopic } from "./picture-graphs";
import type { RuntimeTopic } from "./capability";
export const runtimeTopics: Partial<Record<TopicId, RuntimeTopic>> = {
  decimals: decimalsTopic,
  "fraction-calculations": fractionCalculationsTopic,
  "area-perimeter": areaPerimeterTopic,
  "whole-numbers": wholeNumbersTopic,
  "line-graphs": lineGraphsTopic,
  symmetry: symmetryTopic,
  nets: netsTopic,
  "pie-charts": pieChartsTopic,
  "bar-charts": barChartsTopic,
  "angle-measure": angleMeasureTopic,
  "place-value": placeValueTopic,
  "equal-groups": equalGroupsTopic,
  fractions: fractionsTopic,
  "picture-graphs": pictureGraphsTopic,
};
export function topicLabel(id: TopicId): string {
  return (
    runtimeTopics[id]?.label ??
    (id === "comparison" ? "Comparing quantities" : "Right angles")
  );
}
export function topicVisualTitle(id: TopicId): string {
  return (
    runtimeTopics[id]?.visualTitle ??
    (id === "comparison" ? "Picture the story" : "Take a closer look")
  );
}
export function renderTopic(lesson: Lesson): string {
  const topic = runtimeTopics[lesson.topic];
  if (!topic) throw new Error("Unsupported topic renderer");
  return topic.render(lesson);
}

// Application composition owns topic selection; the shared session runtime
// receives an adapter and remains independent of concrete topic modules.
export const adapters: Record<TopicId, Adapter> = {
  decimals: decimalsTopic.adapter,
  "fraction-calculations": fractionCalculationsTopic.adapter,
  "area-perimeter": areaPerimeterTopic.adapter,
  "whole-numbers": wholeNumbersTopic.adapter,
  "line-graphs": lineGraphsTopic.adapter,
  symmetry: symmetryTopic.adapter,
  nets: netsTopic.adapter,
  "pie-charts": pieChartsTopic.adapter,
  "bar-charts": barChartsTopic.adapter,
  "angle-measure": angleMeasureTopic.adapter,
  comparison: comparisonAdapter,
  angles: anglesAdapter,
  "place-value": placeValueTopic.adapter,
  "equal-groups": equalGroupsTopic.adapter,
  fractions: fractionsTopic.adapter,
  "picture-graphs": pictureGraphsTopic.adapter,
};

export function answerFor(lesson: Lesson, step: Step): Step["answer"] {
  const registered = runtimeTopics[lesson.topic];
  if (registered) return registered.answer(lesson, step);
  switch (lesson.topic) {
    case "comparison":
      return comparisonAnswer(
        lesson.specification as unknown as ComparisonSpec,
        step,
      );
    case "angles":
      return anglesAnswer(lesson.specification as unknown as AnglesSpec, step);
  }
  throw new Error("Unsupported topic answer");
}
