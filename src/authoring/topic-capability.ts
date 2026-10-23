import type { Lesson, TopicId } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
export interface TopicField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  value: string | number;
}
export interface AuthorTopic {
  id: TopicId;
  forms: { id: string; label: string; description: string }[];
  fields(lesson: Lesson): TopicField[];
  patch(lesson: Lesson, key: string, value: string | number): Lesson;
  derive(lesson: Lesson): Lesson;
  rewrite(lesson: Lesson): Lesson;
  template(form: string, id: string): LessonPackage;
}
