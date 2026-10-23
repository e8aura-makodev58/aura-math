import type { Lesson, TopicId } from "../core/types";
import type { AuthorTopic } from "./topic-capability";
import { decimalsAuthor } from "./decimals";
import { fractionCalculationsAuthor } from "./fraction-calculations";
import { areaPerimeterAuthor } from "./area-perimeter";
import { wholeNumbersAuthor } from "./whole-numbers";
import { lineGraphsAuthor } from "./line-graphs";
import { symmetryAuthor } from "./symmetry";
import { netsAuthor } from "./nets";
import { pieChartsAuthor } from "./pie-charts";
import { barChartsAuthor } from "./bar-charts";
import { angleMeasureAuthor } from "./angle-measure";
import { placeValueAuthor } from "./place-value";
import { equalGroupsAuthor } from "./equal-groups";
import { fractionsAuthor } from "./fractions";
import { pictureGraphsAuthor } from "./picture-graphs";
export const authorTopics: Partial<Record<TopicId, AuthorTopic>> = {
  decimals: decimalsAuthor,
  "fraction-calculations": fractionCalculationsAuthor,
  "area-perimeter": areaPerimeterAuthor,
  "whole-numbers": wholeNumbersAuthor,
  "line-graphs": lineGraphsAuthor,
  symmetry: symmetryAuthor,
  nets: netsAuthor,
  "pie-charts": pieChartsAuthor,
  "bar-charts": barChartsAuthor,
  "angle-measure": angleMeasureAuthor,
  "place-value": placeValueAuthor,
  "equal-groups": equalGroupsAuthor,
  fractions: fractionsAuthor,
  "picture-graphs": pictureGraphsAuthor,
};
export function topicFields(lesson: Lesson) {
  return authorTopics[lesson.topic]?.fields(lesson) ?? [];
}
export function allTopicForms() {
  const legacy = [
    ...["larger", "smaller", "difference"].map((id) => ({
      topic: "comparison" as const,
      id,
      label: `Comparison · ${id}`,
      description: "Compare two quantities and find a missing amount.",
    })),
    ...["identify", "classify", "select"].map((id) => ({
      topic: "angles" as const,
      id,
      label: `Right angles · ${id}`,
      description: "Explore openings using the reference square corner.",
    })),
  ];
  return [
    ...legacy,
    ...Object.values(authorTopics).flatMap((t) =>
      t!.forms.map((f) => ({ ...f, topic: t!.id })),
    ),
  ];
}
