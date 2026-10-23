import type { LessonPackage } from "../content/package-validation";
import type { Adapter, Lesson, Step, TopicId } from "../core/types";
import type { WorkbenchFactory } from "../workbench/types";
export interface RuntimeTopic {
  id: TopicId;
  label: string;
  visualTitle: string;
  adapter: Adapter;
  validateSpec(spec: unknown): string[];
  validateSteps(lesson: Lesson): string[];
  answer(lesson: Lesson, step: Step): Step["answer"];
  render(lesson: Lesson): string;
  interpretation?(lesson: Lesson): LessonPackage["interpretation"];
  /**
   * Optional hands-on workbench for a step: a factory the shared lesson view mounts in its own
   * persistent host, or null when the step has none. Additive; topics without it are unchanged.
   */
  workbench?(lesson: Lesson, step: Step): WorkbenchFactory | null;
}
