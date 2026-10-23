import { readFile, writeFile, mkdir } from "node:fs/promises";
import { packages } from "../src/content/lessons";
import { exampleCandidates } from "../src/content/example-domains";
import {
  buildExample,
  selectExamples,
  answerKey,
} from "../src/content/example-builder";
import { canonicalJson, digest } from "../src/content-release";
import { validateLibraryIndex } from "../src/library/catalogue";
export async function run(args: string[]): Promise<number> {
  for (let i = 0; i < args.length; i++) {
    if (["--lesson", "--count"].includes(args[i])) {
      i++;
      continue;
    }
    if (!["--check", "--force"].includes(args[i]))
      throw new Error(`Unknown argument ${args[i]}`);
  }
  const check = args.includes("--check"),
    force = args.includes("--force");
  const option = (name: string, fallback: string) => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    if (!args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error(`${name} requires a value`);
    return args[i + 1];
  };
  const count = Number(option("--count", "5")),
    only = option("--lesson", "");
  if (!Number.isSafeInteger(count) || count < 5 || count > 30)
    throw new Error("Count must be an integer from 5 to 30.");
  const index = validateLibraryIndex(
    JSON.parse(await readFile("content/library.json", "utf8")),
  );
  const parents = index.lessons.filter(
    (l) => l.level === "P4" && (!only || l.lessonId === only),
  );
  if (!parents.length) throw new Error("No matching P4 parent.");
  const reviews = JSON.parse(await readFile("release/reviews.json", "utf8"));
  const writes: { path: string; text: string }[] = [];
  let drift = false,
    total = 0;
  for (const placement of parents) {
    if ((placement.examples?.length ?? 0) > count)
      throw new Error(
        `${placement.lessonId}: refusing to shrink an existing example set; archive extra packages explicitly first.`,
      );
    const parent = packages.find((p) => p.lesson.id === placement.lessonId)!;
    const specs = selectExamples(parent, count),
      ids: string[] = [],
      answers = new Set([answerKey(parent.lesson)]);
    for (const [i, spec] of specs.entries()) {
      const payload = buildExample(parent, spec, i + 1),
        path = `content/examples/p4/${payload.lesson.id}.json`;
      ids.push(payload.lesson.id);
      answers.add(answerKey(payload.lesson));
      total++;
      const oldText = await readFile(path, "utf8").catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      if (
        oldText &&
        canonicalJson(JSON.parse(oldText)) === canonicalJson(payload)
      )
        continue;
      drift = true;
      if (oldText && !check) {
        const old = JSON.parse(oldText),
          hash = await digest(old);
        if (
          old.lesson.reviewStatus !== "draft" ||
          reviews.some((r: { digest: string }) => r.digest === hash)
        )
          throw new Error(`${path} has been reviewed; refuse overwrite.`);
        if (!force)
          throw new Error(
            `${path} differs; use --force for an unreviewed draft.`,
          );
      }
      writes.push({ path, text: JSON.stringify(payload, null, 2) + "\n" });
    }
    if (canonicalJson(placement.examples ?? []) !== canonicalJson(ids))
      drift = true;
    placement.examples = ids;
    console.log(
      `${placement.lessonId}: domain ${exampleCandidates(parent).length}; files ${ids[0]}..${ids.at(-1)}; ${count} saved examples; ${answers.size} distinct answer sets including starter${answers.size < count + 1 ? " (finite/conceptual answers repeat)" : ""}`,
    );
  }
  if (check) {
    console.log(
      `${total} examples checked; ${drift ? "drift detected" : "reproducible"}.`,
    );
    return drift ? 1 : 0;
  }
  // Complete planning first: reviewed conflicts leave packages and links untouched.
  await mkdir("content/examples/p4", { recursive: true });
  for (const { path, text } of writes) await writeFile(path, text);
  await writeFile(
    "content/library.json",
    JSON.stringify(index, null, 2) + "\n",
  );
  console.log(
    `${total} draft examples linked. The command binds the library digest after saving.`,
  );
  return 0;
}
