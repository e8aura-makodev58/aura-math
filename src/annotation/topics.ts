import type { TopicId } from "../core/types";
import {
  annotationCatalogue,
  defaultAnnotationPlan,
  renderFigureSvg,
  type FigureSpec,
} from "../topics/area-perimeter-figure";
import { validateAreaPerimeterSpec } from "../topics/area-perimeter";
import type { AnnotationCatalogue, AnnotationPlan } from "./plan";

/** A topic whose diagram supports dimension annotations. Author-side; the learner build does not import this. */
export interface AnnotationTopic {
  id: TopicId;
  label: string;
  /** Describes the figure and task without any numbers, for the model prompt. */
  taskDescription(specification: Record<string, unknown>): string;
  validateSpec(specification: unknown): string[];
  catalogue(specification: Record<string, unknown>): AnnotationCatalogue;
  defaultPlan(specification: Record<string, unknown>): AnnotationPlan;
  render(specification: Record<string, unknown>, plan: AnnotationPlan): string;
}

const asFigure = (s: Record<string, unknown>) => s as unknown as FigureSpec;

export const annotationTopics: Partial<Record<TopicId, AnnotationTopic>> = {
  "area-perimeter": {
    id: "area-perimeter",
    label: "Area and perimeter",
    taskDescription: (s) => {
      const f = asFigure(s);
      return f.task === "missing-side"
        ? `A rectangle where one side is missing and the area or perimeter is given. The learner finds the missing side. The ${f.unknownSide} is the unknown.`
        : `A rectangle with a rectangular corner removed, forming an L-shape (${f.corner.replace("-", " ")} corner). The learner works with area or perimeter of the L-shape${f.task === "composite-perimeter" ? " and finds the outside edges next to the removed corner" : ""}.`;
    },
    validateSpec: validateAreaPerimeterSpec,
    catalogue: (s) => annotationCatalogue(asFigure(s)),
    defaultPlan: (s) => defaultAnnotationPlan(asFigure(s)),
    render: (s, plan) => renderFigureSvg(asFigure(s), plan),
  },
};
