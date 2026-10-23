import type { Lesson } from "./core/types";
import { digest } from "./content-release";
import {
  validatePackage,
  type LessonPackage,
} from "./content/package-validation";
export interface ReleasedPackage {
  id: string;
  version: number;
  digest: string;
  /** False for lessons published under the user's unreviewed home-release decision. */
  reviewed?: boolean;
  payload: LessonPackage;
}
/** Supplementary runtime check of publisher-verified embedded packages. */
export async function loadReleasedContent(
  entries: ReleasedPackage[],
): Promise<Lesson[]> {
  const lessons: Lesson[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    const result = validatePackage(entry.payload);
    if (
      !result.package ||
      result.package.lesson.id !== entry.id ||
      result.package.lesson.version !== entry.version ||
      (await digest(result.package)) !== entry.digest ||
      ids.has(entry.id)
    )
      throw new Error(
        "Released lesson identity, structure or digest is invalid.",
      );
    ids.add(entry.id);
    lessons.push(result.package.lesson);
  }
  return lessons;
}

export interface ReleasedLibrary {
  index: import("./library/catalogue").LibraryIndex;
  digest: string;
  sourceDigest: string;
}
/** The publisher verifies the full index; the bundle carries only its permitted subset. */
export async function verifyReleasedLibrary(
  library: ReleasedLibrary,
  entries: ReleasedPackage[],
): Promise<void> {
  const { validateLibraryIndex, buildLibraryRecords, pruneLibraryIndex } =
    await import("./library/catalogue");
  const index = validateLibraryIndex(library.index);
  if (
    !/^[a-f0-9]{64}$/.test(library.sourceDigest) ||
    (await digest(index)) !== library.digest
  )
    throw new Error("Released library integrity mismatch.");
  const ids = new Set(entries.map((e) => e.id)),
    topics = new Set(entries.map((e) => e.payload.lesson.topic));
  if (
    index.lessons.some((l) => !ids.has(l.lessonId)) ||
    index.topics.some((t) => !topics.has(t.id)) ||
    (await digest(
      pruneLibraryIndex(
        index,
        entries.map((e) => e.payload),
      ),
    )) !== library.digest
  )
    throw new Error("Released library contains unapproved material.");
  buildLibraryRecords(
    entries.map((e) => e.payload),
    index,
  );
}
