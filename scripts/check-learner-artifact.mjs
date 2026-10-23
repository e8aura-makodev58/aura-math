import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readUnreviewedRelease } from "./build-learner.mjs";
async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(path, entry.name))
          : [join(path, entry.name)],
      ),
    )
  ).flat();
}
async function packageIds(directory) {
  const ids = [];
  for (const path of (await files(directory)).filter((p) =>
    p.endsWith(".json"),
  ))
    try {
      const id = JSON.parse(await readFile(path, "utf8"))?.lesson?.id;
      if (typeof id === "string") ids.push(id);
    } catch {
      // Not a lesson package.
    }
  return ids;
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Verifies the built learner artifact. Draft lesson IDs may appear only when they are listed in
 * the reviewed manifest or the separate unreviewed home-release list (decision 25).
 */
export async function checkLearnerArtifact(options = {}) {
  const dir = options.dir ?? "dist-learner";
  const manifest = JSON.parse(
    await readFile(options.manifestPath ?? "release/manifest.json", "utf8"),
  );
  const unreviewed = await readUnreviewedRelease(
    options.unreviewedPath ?? "release/unreviewed-release.json",
  );
  const reviewedIds = manifest.entries.map((entry) => entry.id);
  const unreviewedIds = (unreviewed?.entries ?? []).map((entry) => entry.id);
  const allowed = new Set([...reviewedIds, ...unreviewedIds]);
  const built = await files(dir);
  const text = (
    await Promise.all(built.map((path) => readFile(path, "utf8")))
  ).join("\n");
  // Saved examples are prebuilt packages whose provenance names the generator version that
  // produced them. Only that data value is exempt; generator code and every other occurrence of
  // a generator identifier are still rejected.
  const scanned = (
    await Promise.all(
      built.map(async (path) => {
        const body = await readFile(path, "utf8");
        return /[\\/]lesson-data-[^/\\]+\.js$/.test(path)
          ? body.replace(/"?generatorVersion"?:"[^"]*"/g, "")
          : body;
      }),
    )
  ).join("\n");
  for (const sentinel of [
    "Local author workspace",
    "aura-author-preview",
    "aura-author-draft:",
    "Proposed wording replacement",
    "Contributor ID",
    "Number (0–999)",
    "Shared whole width (12–240, divisible by every part count)",
    "Number of groups (2–10)",
    "Items represented by one full symbol (2 or 5)",
    "First / available value",
    "Whole-number factor / number of pieces (1–9)",
    "Original P4 candidate task using exact decimal units.",
    // Author-only field labels and descriptions of the expansion families.
    "Hands-on protractor reading",
    "Hands-on mirror shading",
    "Number to compare with",
    "Labels along the bottom (comma separated, 4–7)",
    "Shaded squares as row,column pairs",
    "Angle in degrees (multiple of 5)",
    "Round two numbers, then add to estimate a total.",
    // Author-only field labels of the nets, pie-chart and bar-chart families.
    "Labels (comma separated, 3–5, up to 8 characters each)",
    "Slices per category (comma separated, adding up to the slices)",
    "Items in the whole pie (shared equally by the slices)",
    "Labels (comma separated, 3–6)",
    "Values, one per label (comma separated, whole numbers)",
    "Series names (two, comma separated)",
    "Which net does the why step ask about",
    // Author-only field labels of the nets workbench lessons.
    "Demonstration net shown in Watch (a different shape, letters A to F once each)",
    "Floor face of the learner's net",
    "Floor face of the demonstration net",
    "Face whose opposite the second step asks",
    "Solid folded in Watch (a different one)",
    "new-task-preview",
    "author.html",
    // Dimension-line suggestions are an author-only, development-server feature.
    "__annotation",
    "x-aura-annotation",
    "Suggest a layout",
    "api.anthropic.com",
    // Fresh variants are development-preview only until generator publication is designed.
    "p4-bounded-v1",
    "p4-bounded-v2",
    "p4-bounded-v3",
    "p4-bounded-v4",
    "p4-examples-v1",
    // Admin model settings are author-side and development-server only (R-123).
    "/api/admin/settings",
    "aura-admin-token",
    "Unlock settings",
    "TEST_MAY_COST",
    "provider-credentials",
    "admin.token",
    "api.openai.com",
    "openrouter.ai",
    "@anthropic-ai",
    "anthropic-version",
    "max_completion_tokens",
    // Model-suggested, adult-approved story words are development-preview only (Phase B2/B3).
    "/api/stories/approved",
    "stories-generate",
    "story-slots-v1",
    "stories.json",
    "Story words suggested by a computer helper",
    "approvedStoryId",
    "suggest words for maths word problems",
  ])
    if (scanned.includes(sentinel))
      throw new Error(`Author code leaked into learner artifact: ${sentinel}`);
  // Key-shaped strings, without the false positives of a bare "sk-" (R-123).
  if (/\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/.test(text))
    throw new Error("Key-shaped string found in learner artifact.");
  const draftIds = new Set([
    ...(await packageIds("content/lessons")),
    ...(await packageIds("content/examples")),
    ...(options.extraDraftIds ?? []),
  ]);
  // Lesson and release-entry identities (id followed by version; step ids may reuse a lesson
  // id), library placements, and example and collection links.
  const linked = new Set();
  for (const match of text.matchAll(
    /"?(?:examples|lessonIds|practiceIds)"?:\[([^\]]*)\]/g,
  ))
    for (const value of match[1].matchAll(/"([^"]*)"/g)) linked.add(value[1]);
  for (const sentinel of draftIds) {
    if (allowed.has(sentinel)) continue;
    if (
      linked.has(sentinel) ||
      new RegExp(
        `(?:^|[^A-Za-z0-9_$])(?:"?id"?:"${escape(sentinel)}","?version"?:|"?lessonId"?:"${escape(sentinel)}")`,
      ).test(text)
    )
      throw new Error(`Draft leaked into learner artifact: ${sentinel}`);
  }
  if (!allowed.size && !text.includes("Your lessons are on their way"))
    throw new Error("Missing explicit empty-release state.");
  if (unreviewedIds.length && !text.includes(unreviewed.label))
    throw new Error("Unreviewed lessons are missing their visible label.");
  console.log("Learner artifact separation verified.");
  console.log(
    `Learner build contains ${reviewedIds.length} reviewed and ${unreviewedIds.length} unreviewed lessons.`,
  );

  // Original phase baseline: 192,966 main JS bytes and 43,465 CSS bytes (R-105).
  // The user-directed WebGL chunk and the 2D workbenches are separately lazy-loaded.
  const mainJs = built.filter((path) => /[\\/]learner-[^/\\]+\.js$/.test(path));
  const css = built.filter((path) => path.endsWith(".css"));
  const bytes = async (paths) =>
    (
      await Promise.all(
        paths.map(async (path) => (await readFile(path)).length),
      )
    ).reduce((a, b) => a + b, 0);
  const mainBytes = await bytes(mainJs),
    cssBytes = await bytes(css);
  if (mainJs.length !== 1 || mainBytes > 222966 || cssBytes > 49465)
    throw new Error(
      `Learner main bundle budget exceeded: JS ${mainBytes}/222966; CSS ${cssBytes}/49465.`,
    );
  const twoD = built.filter((path) =>
    /\/(?:protractor|symmetry)-workbench-[^/]+\.js$/.test(path),
  );
  const twoDBytes = await bytes(twoD);
  if (twoDBytes > 30000)
    throw new Error(`2D lazy workbench budget exceeded: ${twoDBytes}/30000.`);
  // Embedded lesson packages (reviewed and unreviewed) live in their own chunk. The 2026-10-11
  // home release of 46 P4 lessons and 230 examples measured 864,394 bytes.
  const dataBytes = await bytes(
    built.filter((path) => /\/lesson-data-[^/]+\.js$/.test(path)),
  );
  if (dataBytes > 1200000)
    throw new Error(`Lesson data budget exceeded: ${dataBytes}/1200000.`);
  console.log(
    `Learner bundle bytes: main JS ${mainBytes}; CSS ${cssBytes}; 2D lazy workbenches ${twoDBytes}; lesson data ${dataBytes}.`,
  );
  return {
    reviewed: reviewedIds.length,
    unreviewed: unreviewedIds.length,
    mainBytes,
    cssBytes,
    dataBytes,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/check-learner-artifact.mjs")
)
  checkLearnerArtifact().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
