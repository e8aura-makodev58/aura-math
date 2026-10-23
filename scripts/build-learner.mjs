import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer, build } from "vite";

export const UNREVIEWED_RELEASE_PATH = "release/unreviewed-release.json";

/**
 * The user's 2026-10-11 home-release decision (handover decision 25): listed P4 drafts and
 * their saved examples may be published without reviewer approval. The list is separate from
 * the manifest, carries the decision text and exact digests, and never creates or implies an
 * approval record. A missing file means nothing is published unreviewed.
 */
export async function readUnreviewedRelease(path = UNREVIEWED_RELEASE_PATH) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  const file = JSON.parse(text);
  const nonEmpty = (value) => typeof value === "string" && !!value.trim();
  if (
    !file ||
    file.schemaVersion !== 1 ||
    !nonEmpty(file.decision) ||
    !nonEmpty(file.decidedBy) ||
    !nonEmpty(file.decidedOn) ||
    !nonEmpty(file.label) ||
    !Array.isArray(file.entries)
  )
    throw new Error("Unsupported unreviewed release file.");
  return file;
}

export async function prepareRelease(options = {}) {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const { parsePackage } = await server.ssrLoadModule(
      "/src/content/package-validation.ts",
    );
    const { digest, assertApprovals } = await server.ssrLoadModule(
      "/src/content-release.ts",
    );
    const read = async (path) => JSON.parse(await readFile(path, "utf8"));
    const manifest = await read(
      options.manifestPath ?? "release/manifest.json",
    );
    const reviewers = await read(
      options.reviewersPath ?? "release/reviewers.json",
    );
    const records = await read(options.recordsPath ?? "release/reviews.json");
    const unreviewed = await readUnreviewedRelease(
      options.unreviewedPath ?? UNREVIEWED_RELEASE_PATH,
    );
    if (
      manifest.schemaVersion !== 2 ||
      manifest.canonicalVersion !== 1 ||
      manifest.applicationContract !== 3 ||
      typeof manifest.contentImpactDecision !== "string" ||
      !manifest.contentImpactDecision.trim() ||
      !Array.isArray(manifest.entries)
    )
      throw new Error(
        "Unsupported release manifest or missing content-impact decision.",
      );
    if (!Array.isArray(reviewers) || !Array.isArray(records))
      throw new Error("Invalid trusted review register.");
    const { validateLibraryIndex, buildLibraryRecords } =
      await server.ssrLoadModule("/src/library/catalogue.ts");
    if (!manifest.library || typeof manifest.library.path !== "string")
      throw new Error("Missing bound library index.");
    const libraryBase = await realpath("content");
    const libraryPath = await realpath(resolve(manifest.library.path));
    if (!libraryPath.startsWith(libraryBase + sep))
      throw new Error("Library index path must remain within content/.");
    const index = validateLibraryIndex(await read(libraryPath));
    if ((await digest(index)) !== manifest.library.digest)
      throw new Error("Library index digest mismatch.");
    const ids = new Set();
    const lessons = [];
    const base = await realpath("content");
    const unreviewedEntries = unreviewed?.entries ?? [];
    const unreviewedIds = new Set(unreviewedEntries.map((entry) => entry?.id));
    if (manifest.entries.some((entry) => unreviewedIds.has(entry?.id)))
      throw new Error(
        "A lesson ID cannot be listed as both reviewed and unreviewed.",
      );
    const p4Placed = (id) =>
      index.lessons.some(
        (placement) =>
          placement.level === "P4" &&
          (placement.lessonId === id || placement.examples?.includes(id)),
      );
    for (const [entry, reviewed] of [
      ...manifest.entries.map((entry) => [entry, true]),
      ...unreviewedEntries.map((entry) => [entry, false]),
    ]) {
      if (!entry || typeof entry.path !== "string")
        throw new Error("Invalid release entry.");
      const path = await realpath(resolve(entry.path));
      if (!path.startsWith(base + sep))
        throw new Error("Release path must remain within content/.");
      const result = parsePackage(await readFile(path, "utf8"));
      if (!result.package)
        throw new Error(
          `Invalid release package ${entry.path}: ${JSON.stringify(result.issues)}`,
        );
      const payload = result.package;
      if (
        payload.library?.level === "P4" &&
        !index.lessons.some(
          (placement) =>
            placement.lessonId === payload.lesson.id ||
            placement.examples?.includes(payload.lesson.id),
        )
      )
        throw new Error(
          "P4 release requires explicit bound library placement.",
        );
      const hash = await digest(payload);
      if (
        payload.lesson.id !== entry.id ||
        payload.lesson.version !== entry.version ||
        hash !== entry.digest
      )
        throw new Error(`Release digest/identity mismatch: ${entry.path}`);
      if (ids.has(entry.id)) throw new Error("Duplicate release lesson ID.");
      ids.add(entry.id);
      if (reviewed)
        assertApprovals(
          hash,
          payload.authors,
          result.issues
            .filter((issue) => issue.severity === "warning")
            .map((issue) => issue.path),
          reviewers,
          records,
        );
      // Unreviewed publication is limited to P4 lessons and examples placed in the bound index.
      else if (!p4Placed(entry.id))
        throw new Error(
          `Unreviewed release is limited to placed P4 lessons: ${entry.id}`,
        );
      lessons.push({
        id: entry.id,
        version: entry.version,
        digest: hash,
        reviewed,
        payload,
      });
    }
    for (const parent of index.lessons) {
      if (ids.has(parent.lessonId)) continue;
      const released = parent.examples?.filter((id) => ids.has(id)) ?? [];
      if (released.some((id) => !unreviewedIds.has(id)))
        throw new Error("Approved examples require an approved parent.");
      if (released.length)
        throw new Error("Unreviewed examples require a released parent.");
    }
    buildLibraryRecords(
      lessons.map((e) => e.payload),
      index,
    );
    return lessons;
  } finally {
    await server.close();
  }
}
export async function buildLearner() {
  const lessons = await prepareRelease();
  const label = (await readUnreviewedRelease())?.label ?? "";
  const manifest = JSON.parse(await readFile("release/manifest.json", "utf8"));
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  let releasedLibrary;
  try {
    const { pruneLibraryIndex } = await server.ssrLoadModule(
      "/src/library/catalogue.ts",
    );
    const { digest } = await server.ssrLoadModule("/src/content-release.ts");
    const full = JSON.parse(await readFile(manifest.library.path, "utf8"));
    if ((await digest(full)) !== manifest.library.digest)
      throw new Error("Library index changed during build.");
    const index = pruneLibraryIndex(
      full,
      lessons.map((e) => e.payload),
    );
    releasedLibrary = {
      index,
      digest: await digest(index),
      sourceDigest: manifest.library.digest,
    };
  } finally {
    await server.close();
  }
  await build({
    // Served by the development server at /app/ (scripts/learner-static-plugin.ts).
    base: "/app/",
    build: {
      outDir: "dist-learner",
      emptyOutDir: true,
      rollupOptions: {
        input: resolve("learner.html"),
        // Embedded lesson data lives in its own chunk so the main logic budget stays meaningful.
        output: {
          manualChunks: (id) =>
            id === "\0approved-lessons" ? "lesson-data" : undefined,
        },
      },
    },
    plugins: [
      {
        name: "approved-content-only",
        resolveId(id) {
          if (id === "virtual:approved-lessons") return "\0approved-lessons";
        },
        load(id) {
          if (id === "\0approved-lessons")
            return `export const releasedLibrary=${JSON.stringify(releasedLibrary)}; export const unreviewedLabel=${JSON.stringify(label)}; export default ${JSON.stringify(lessons)};`;
        },
      },
    ],
  });
  const reviewedCount = lessons.filter((lesson) => lesson.reviewed).length;
  console.log(
    `Learner build contains ${reviewedCount} reviewed and ${lessons.length - reviewedCount} unreviewed lessons.`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/build-learner.mjs")
) {
  (process.argv.includes("--check") ? prepareRelease() : buildLearner()).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
