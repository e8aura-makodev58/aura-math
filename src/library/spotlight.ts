import type { LibraryRecord } from "./catalogue";

/**
 * Whole days since 1970-01-01 for the *local* calendar date, so the spotlight changes at the
 * learner's midnight and not at UTC midnight.
 */
export function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/**
 * Today's spotlight: one lesson chosen from the lessons the page is allowed to show.
 *
 * Deterministic. The topic advances by one each day through the topics in alphabetical order, and
 * the lesson inside a topic advances once per full pass through the topics, so consecutive days
 * always land on different topics (when there are at least two) and every lesson eventually comes
 * round. The same date gives the same lesson on every device. There is no randomness, no stored
 * history and nothing about the learner.
 */
export function pickSpotlight(
  records: readonly LibraryRecord[],
  date: Date,
): LibraryRecord | undefined {
  if (!records.length) return undefined;
  const topics = [...new Set(records.map((r) => r.topic))].sort();
  const day = dayNumber(date);
  const topic = topics[((day % topics.length) + topics.length) % topics.length];
  const lessons = records
    .filter((r) => r.topic === topic)
    .sort((a, b) => a.sequence - b.sequence);
  const pass = Math.floor(day / topics.length);
  return lessons[((pass % lessons.length) + lessons.length) % lessons.length];
}
