import type { Lesson, TopicId } from "../core/types";
import type { LessonPackage } from "../content/package-validation";
export interface PreparationCollection {
  id: string;
  label: string;
  description: string;
  level: "P4";
  lessonIds: string[];
  practiceIds: string[];
}
export interface LibraryIndex {
  collections?: PreparationCollection[];
  schemaVersion: 1;
  topics: {
    id: TopicId;
    label: string;
    strand: string;
    description: string;
    skills: { id: string; label: string }[];
  }[];
  lessons: {
    lessonId: string;
    examples?: string[];
    topic: TopicId;
    level: "P2" | "P3" | "P4";
    skillId: string;
    sequence: number;
    prerequisites: string[];
    blurb?: string;
  }[];
}
export interface LibraryRecord {
  lesson: Lesson;
  level: "P2" | "P3" | "P4";
  strand: string;
  topic: TopicId;
  topicLabel: string;
  skillId: string;
  skillLabel: string;
  sequence: number;
  prerequisites: string[];
  tags: string[];
  blurb?: string;
  topicDescription?: string;
}
const topicIds = [
  "comparison",
  "angles",
  "place-value",
  "equal-groups",
  "fractions",
  "picture-graphs",
  "decimals",
  "fraction-calculations",
  "area-perimeter",
  "whole-numbers",
  "line-graphs",
  "symmetry",
  "nets",
  "pie-charts",
  "bar-charts",
  "angle-measure",
];
const id = (v: unknown) =>
  typeof v === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(v);
function object(v: unknown, keys: string[]): Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    throw new Error("Invalid library index object.");
  return v as Record<string, unknown>;
}
function label(v: unknown) {
  if (typeof v !== "string" || !v.trim() || v.length > 300 || /[<>]/.test(v))
    throw new Error("Invalid library label.");
}
export function validateLibraryIndex(input: unknown): LibraryIndex {
  if (JSON.stringify(input).length > 100000)
    throw new Error("Library index too large.");
  const root = object(input, [
    "schemaVersion",
    "topics",
    "lessons",
    "collections",
  ]);
  if (
    root.schemaVersion !== 1 ||
    !Array.isArray(root.topics) ||
    root.topics.length > 20 ||
    !Array.isArray(root.lessons) ||
    root.lessons.length > 300
  )
    throw new Error("Unsupported library index.");
  const topics = new Set<string>(),
    skills = new Map<string, string>();
  for (const value of root.topics) {
    const t = object(value, ["id", "label", "strand", "description", "skills"]);
    if (!topicIds.includes(String(t.id)) || topics.has(String(t.id)))
      throw new Error("Duplicate or unknown library topic.");
    topics.add(String(t.id));
    label(t.label);
    label(t.strand);
    label(t.description);
    if (!Array.isArray(t.skills) || t.skills.length > 40)
      throw new Error("Invalid library skills.");
    for (const v of t.skills) {
      const s = object(v, ["id", "label"]);
      if (!id(s.id) || skills.has(String(s.id)))
        throw new Error("Duplicate or invalid skill.");
      label(s.label);
      skills.set(String(s.id), String(t.id));
    }
  }
  const exampleIds = new Set<string>();
  const ids = new Set<string>(),
    edges = new Map<string, string[]>();
  for (const value of root.lessons) {
    const l = object(value, [
      "lessonId",
      "examples",
      "topic",
      "level",
      "skillId",
      "sequence",
      "prerequisites",
      "blurb",
    ]);
    if (
      !id(l.lessonId) ||
      ids.has(String(l.lessonId)) ||
      skills.get(String(l.skillId)) !== l.topic ||
      !["P2", "P3", "P4"].includes(String(l.level)) ||
      !Number.isSafeInteger(l.sequence) ||
      Number(l.sequence) < 0
    )
      throw new Error("Invalid library placement.");
    if (
      !Array.isArray(l.prerequisites) ||
      l.prerequisites.length > 10 ||
      new Set(l.prerequisites).size !== l.prerequisites.length ||
      l.prerequisites.some((v) => !skills.has(String(v)))
    )
      throw new Error("Invalid library prerequisites.");
    if (l.examples !== undefined) {
      if (
        !Array.isArray(l.examples) ||
        l.examples.length > 30 ||
        l.examples.some(
          (v) => !id(v) || v === l.lessonId || exampleIds.has(String(v)),
        ) ||
        new Set(l.examples).size !== l.examples.length
      )
        throw new Error("Invalid or duplicate example link.");
      for (const value of l.examples) exampleIds.add(String(value));
    }
    if (l.blurb !== undefined) label(l.blurb);
    ids.add(String(l.lessonId));
    edges.set(String(l.skillId), [
      ...new Set([
        ...(edges.get(String(l.skillId)) ?? []),
        ...(l.prerequisites as string[]),
      ]),
    ]);
  }
  if ([...exampleIds].some((v) => ids.has(v)))
    throw new Error("An example cannot be a library parent.");
  if (root.collections !== undefined) {
    if (!Array.isArray(root.collections) || root.collections.length > 10)
      throw new Error("Invalid preparation collections.");
    const seen = new Set<string>();
    for (const value of root.collections) {
      const c = object(value, [
        "id",
        "label",
        "description",
        "level",
        "lessonIds",
        "practiceIds",
      ]);
      if (!id(c.id) || seen.has(String(c.id)) || c.level !== "P4")
        throw new Error("Invalid preparation collection.");
      seen.add(String(c.id));
      label(c.label);
      label(c.description);
      if (
        !Array.isArray(c.lessonIds) ||
        !c.lessonIds.length ||
        c.lessonIds.length > 100 ||
        new Set(c.lessonIds).size !== c.lessonIds.length ||
        c.lessonIds.some(
          (v) =>
            !ids.has(String(v)) ||
            !(root.lessons as Record<string, unknown>[]).some(
              (l) => l.lessonId === v && l.level === c.level,
            ),
        )
      )
        throw new Error("Invalid collection membership.");
      if (
        !Array.isArray(c.practiceIds) ||
        new Set(c.practiceIds).size !== c.practiceIds.length ||
        c.practiceIds.some((v) => !(c.lessonIds as unknown[]).includes(v))
      )
        throw new Error("Invalid practice membership.");
    }
  }
  const visited = new Set<string>();
  const visit = (skill: string, path: Set<string>) => {
    if (path.has(skill)) throw new Error("Cyclic library prerequisites.");
    if (visited.has(skill)) return;
    for (const child of edges.get(skill) ?? [])
      visit(child, new Set([...path, skill]));
    visited.add(skill);
  };
  for (const key of edges.keys()) visit(key, new Set());
  return structuredClone(input) as LibraryIndex;
}
export function pruneLibraryIndex(
  input: LibraryIndex,
  packages: readonly LessonPackage[],
): LibraryIndex {
  const index = validateLibraryIndex(input),
    ids = new Set(packages.map((p) => p.lesson.id)),
    availableSkills = new Set(
      packages
        .map(
          (p) =>
            p.library?.skillId ??
            index.lessons.find((l) => l.lessonId === p.lesson.id)?.skillId,
        )
        .filter(Boolean),
    );
  index.lessons = index.lessons
    .filter((l) => ids.has(l.lessonId))
    .map((l) => ({
      ...l,
      ...(l.examples
        ? { examples: l.examples.filter((id) => ids.has(id)) }
        : {}),
      prerequisites: l.prerequisites.filter((s) => availableSkills.has(s)),
    }));
  const topics = new Set(packages.map((p) => p.lesson.topic));
  index.topics = index.topics
    .filter((t) => topics.has(t.id))
    .map((t) => ({
      ...t,
      skills: t.skills.filter((s) => availableSkills.has(s.id)),
    }));
  if (index.collections)
    index.collections = index.collections
      .map((c) => ({
        ...c,
        lessonIds: c.lessonIds.filter((id) => ids.has(id)),
        practiceIds: c.practiceIds.filter((id) => ids.has(id)),
      }))
      .filter((c) => c.lessonIds.length);
  return validateLibraryIndex(index);
}
export function buildLibraryRecords(
  packages: readonly LessonPackage[],
  input?: LibraryIndex,
): LibraryRecord[] {
  const index = input ? validateLibraryIndex(input) : undefined;
  const identities = new Set<string>();
  const linkedExamples = new Set(
    index?.lessons.flatMap((l) => l.examples ?? []) ?? [],
  );
  for (const parent of index?.lessons ?? [])
    for (const id of parent.examples ?? []) {
      const example = packages.find((p) => p.lesson.id === id);
      if (
        example &&
        (example.lesson.topic !== parent.topic ||
          example.library?.level !== parent.level ||
          example.library?.skillId !== parent.skillId)
      )
        throw new Error("Example placement contradicts parent.");
    }
  return packages
    .filter((p) => !linkedExamples.has(p.lesson.id))
    .map((p) => {
      const l = p.lesson;
      if (identities.has(l.id))
        throw new Error("Duplicate library lesson identity.");
      identities.add(l.id);
      const placement = index?.lessons.find((v) => v.lessonId === l.id),
        topic = index?.topics.find((t) => t.id === l.topic);
      if (
        placement &&
        (placement.topic !== l.topic ||
          (p.library &&
            (placement.level !== p.library.level ||
              placement.skillId !== p.library.skillId)))
      )
        throw new Error("Library placement contradicts package.");
      const level = p.library?.level ?? placement?.level ?? parseLevel(l.level);
      const skillId =
        p.library?.skillId ?? placement?.skillId ?? `general-${l.topic}`;
      const skill = topic?.skills.find((s) => s.id === skillId);
      return {
        lesson: l,
        level,
        strand:
          topic?.strand ??
          (l.topic === "angles"
            ? "Geometry"
            : l.topic === "picture-graphs"
              ? "Data"
              : "Numbers and operations"),
        topic: l.topic,
        topicLabel: topic?.label ?? l.topic.replace(/-/g, " "),
        skillId,
        skillLabel: skill?.label ?? "General practice",
        sequence: placement?.sequence ?? 999,
        prerequisites: placement?.prerequisites ?? [],
        tags: p.library?.tags ?? [],
        ...(placement?.blurb !== undefined ? { blurb: placement.blurb } : {}),
        ...(topic?.description !== undefined
          ? { topicDescription: topic.description }
          : {}),
      };
    })
    .sort(
      (a, b) =>
        a.level.localeCompare(b.level) ||
        a.topicLabel.localeCompare(b.topicLabel) ||
        a.sequence - b.sequence ||
        a.lesson.title.localeCompare(b.lesson.title),
    );
}
export function intrinsicLibrary(
  p: LessonPackage,
): NonNullable<LessonPackage["library"]> {
  if (p.library) return structuredClone(p.library);
  const skills: Record<string, string> = {
    "ribbon-collection": "comparison-larger",
    "garden-pots": "comparison-smaller",
    "shell-discovery": "comparison-difference",
    "corner-detective": "angle-identify",
    "angle-opening": "angle-classify",
    "right-angle-hunt": "angle-select",
  };
  return {
    level: parseLevel(p.lesson.level),
    skillId: skills[p.lesson.id] ?? `general-${p.lesson.topic}`,
    tags: [],
  };
}

function parseLevel(value: string): "P2" | "P3" | "P4" {
  const level = value.match(/^P[234]\b/)?.[0];
  if (level !== "P2" && level !== "P3" && level !== "P4")
    throw new Error("Unsupported lesson level.");
  return level;
}
