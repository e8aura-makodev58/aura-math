// Writes release/unreviewed-release.json: every P4 lesson placed in content/library.json and all
// of its saved examples, with exact digests, published WITHOUT teacher review under the user's
// home-release decision (handover decision 25). It never writes review or approval records.
//
//   node scripts/publish-unreviewed.mjs --level P4           write the list
//   node scripts/publish-unreviewed.mjs --level P4 --check   exit 1 if the list is stale
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createServer } from "vite";
import { UNREVIEWED_RELEASE_PATH } from "./build-learner.mjs";

export const DECISION =
  'Handover decision 25 (2026-10-11), "Unreviewed home release": the user chose that "for home use, P4 draft lessons and their saved examples may be published without the two-reviewer approval." No review or approval record is created or implied; any content change needs a fresh publish.';
export const LABEL =
  "Not reviewed by a teacher. Published by a parent for home use.";

async function packageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return packageFiles(path);
        return entry.name.endsWith(".json") ? [path] : [];
      }),
    )
  ).flat();
}

export async function buildUnreviewedRelease(level = "P4") {
  if (level !== "P4")
    throw new Error("Only P4 lessons may be published unreviewed.");
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const { parsePackage } = await server.ssrLoadModule(
      "/src/content/package-validation.ts",
    );
    const { digest } = await server.ssrLoadModule("/src/content-release.ts");
    const { validateLibraryIndex } = await server.ssrLoadModule(
      "/src/library/catalogue.ts",
    );
    const manifest = JSON.parse(
      await readFile("release/manifest.json", "utf8"),
    );
    const library = JSON.parse(await readFile(manifest.library.path, "utf8"));
    if ((await digest(library)) !== manifest.library.digest)
      throw new Error(
        "Library index digest does not match release/manifest.json; run node scripts/bind-library.mjs.",
      );
    const index = validateLibraryIndex(library);
    const reviewed = new Set(manifest.entries.map((entry) => entry.id));
    const wanted = new Set(
      index.lessons
        .filter((placement) => placement.level === level)
        .flatMap((placement) => [
          placement.lessonId,
          ...(placement.examples ?? []),
        ])
        .filter((id) => !reviewed.has(id)),
    );
    const found = new Map();
    for (const directory of ["content/lessons", "content/examples"])
      for (const file of await packageFiles(directory)) {
        const result = parsePackage(await readFile(file, "utf8"));
        const id = result.package?.lesson.id;
        if (!wanted.has(id)) continue;
        if (found.has(id))
          throw new Error(`Lesson ${id} is stored in more than one file.`);
        found.set(id, {
          id,
          version: result.package.lesson.version,
          digest: await digest(result.package),
          path: relative(resolve("."), resolve(file)).split("\\").join("/"),
        });
      }
    const missing = [...wanted].filter((id) => !found.has(id));
    if (missing.length)
      throw new Error(`Missing or invalid packages: ${missing.join(", ")}`);
    const entries = [...found.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    const examples = new Set(
      index.lessons.flatMap((placement) => placement.examples ?? []),
    );
    return {
      file: {
        schemaVersion: 1,
        decision: DECISION,
        decidedBy: "user (parent), home use",
        decidedOn: "2026-10-11",
        label: LABEL,
        entries,
      },
      parents: entries.filter((entry) => !examples.has(entry.id)).length,
      examples: entries.filter((entry) => examples.has(entry.id)).length,
    };
  } finally {
    await server.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/publish-unreviewed.mjs")
) {
  const args = process.argv.slice(2);
  const levelAt = args.indexOf("--level");
  const level = levelAt >= 0 ? args[levelAt + 1] : undefined;
  (async () => {
    if (!level)
      throw new Error("Usage: publish-unreviewed --level P4 [--check]");
    const { file, parents, examples } = await buildUnreviewedRelease(level);
    const text = `${JSON.stringify(file, null, 2)}\n`;
    let current = "";
    try {
      current = await readFile(UNREVIEWED_RELEASE_PATH, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (args.includes("--check")) {
      if (current !== text)
        throw new Error(
          `${UNREVIEWED_RELEASE_PATH} is stale: content changed since it was published. Run npm run content:publish-unreviewed.`,
        );
      console.log(
        `Unreviewed release is current: ${parents} lessons and ${examples} examples (${file.entries.length} packages), not reviewed by a teacher.`,
      );
      return;
    }
    if (current !== text) await writeFile(UNREVIEWED_RELEASE_PATH, text);
    console.log(
      `${current === text ? "Unchanged" : "Wrote"} ${UNREVIEWED_RELEASE_PATH}: ${parents} lessons and ${examples} examples (${file.entries.length} packages), not reviewed by a teacher.`,
    );
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
