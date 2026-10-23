import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { prepareRelease } from "./build-learner.mjs";
import { checkLearnerArtifact } from "./check-learner-artifact.mjs";
const directory = await mkdtemp(join(tmpdir(), "aura-release-test-"));
const libraryDirectory = await mkdtemp(join("content", ".release-test-"));
const paths = {
  manifestPath: join(directory, "manifest.json"),
  reviewersPath: join(directory, "reviewers.json"),
  recordsPath: join(directory, "reviews.json"),
  // Reviewed-gate cases run without the real unreviewed home-release list.
  unreviewedPath: join(directory, "no-unreviewed-release.json"),
};
const legacyFiles = (await readdir("content/lessons")).filter(
  (name) => name.endsWith(".json") && !name.startsWith("p4-"),
);
assert.equal(legacyFiles.length, 18);
const originalBytes = new Map(
  await Promise.all(
    legacyFiles.map(async (name) => [
      name,
      await readFile(join("content/lessons", name)),
    ]),
  ),
);
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { digest } = await server.ssrLoadModule("/src/content-release.ts");
  const { validatePackage } = await server.ssrLoadModule(
    "/src/content/package-validation.ts",
  );
  const payload = JSON.parse(
    await readFile("content/lessons/ribbon-collection.json", "utf8"),
  );
  const legacyHash = await digest(payload);
  const hash = legacyHash;
  const warningPaths = validatePackage(payload)
    .issues.filter((issue) => issue.severity === "warning")
    .map((issue) => issue.path);
  const manifest = {
    schemaVersion: 2,
    canonicalVersion: 1,
    applicationContract: 3,
    library: {
      path: "content/library.json",
      digest: await digest(
        JSON.parse(await readFile("content/library.json", "utf8")),
      ),
    },
    contentImpactDecision: "Synthetic integration fixture only",
    entries: [
      {
        path: "content/lessons/ribbon-collection.json",
        id: payload.lesson.id,
        version: payload.lesson.version,
        digest: hash,
      },
    ],
  };
  const reviewers = [
    {
      id: "synthetic-maths",
      kind: "human",
      qualifications: "Test fixture",
      roles: ["mathematical"],
    },
    {
      id: "synthetic-teaching",
      kind: "human",
      qualifications: "Test fixture",
      roles: ["pedagogical"],
    },
  ];
  const records = reviewers.map((r) => ({
    reviewerId: r.id,
    role: r.roles[0],
    digest: hash,
    decision: "approve",
    evidence: "Synthetic test evidence only",
    warningDispositions: warningPaths,
  }));
  const write = async () => {
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    await writeFile(paths.reviewersPath, JSON.stringify(reviewers));
    await writeFile(paths.recordsPath, JSON.stringify(records));
  };
  await write();
  assert.equal((await prepareRelease(paths)).length, 1);
  const decimalPayload = JSON.parse(
    await readFile("content/lessons/p4-decimal-practice.json", "utf8"),
  );
  const decimalHash = await digest(decimalPayload);
  const oldEntry = structuredClone(manifest.entries[0]);
  manifest.entries[0] = {
    path: "content/lessons/p4-decimal-practice.json",
    id: decimalPayload.lesson.id,
    version: decimalPayload.lesson.version,
    digest: decimalHash,
  };
  for (const record of records) record.digest = decimalHash;
  await write();
  const exactApproved = await prepareRelease(paths);
  assert.equal(exactApproved.length, 1);
  assert.equal(exactApproved[0].payload.schemaVersion, 3);
  // Saved examples are approved by their own digest, never by their parent's approval.
  const examplePayload = JSON.parse(
    await readFile("content/examples/p4/p4-decimal-practice-ex1.json", "utf8"),
  );
  const exampleHash = await digest(examplePayload);
  const exampleWarnings = validatePackage(examplePayload)
    .issues.filter((i) => i.severity === "warning")
    .map((i) => i.path);
  const exampleRecords = reviewers.map((r) => ({
    reviewerId: r.id,
    role: r.roles[0],
    digest: exampleHash,
    decision: "approve",
    evidence: "Synthetic example fixture only",
    warningDispositions: exampleWarnings,
  }));
  const exampleEntry = {
    path: "content/examples/p4/p4-decimal-practice-ex1.json",
    id: examplePayload.lesson.id,
    version: 1,
    digest: exampleHash,
  };
  manifest.entries.push(exampleEntry);
  await write();
  await assert.rejects(prepareRelease(paths), /approval/i);
  records.push(...exampleRecords);
  await write();
  const savedApproved = await prepareRelease(paths);
  assert.equal(savedApproved.length, 2);
  const { pruneLibraryIndex, buildLibraryRecords } = await server.ssrLoadModule(
    "/src/library/catalogue.ts",
  );
  const savedIndex = pruneLibraryIndex(
    JSON.parse(await readFile("content/library.json", "utf8")),
    savedApproved.map((e) => e.payload),
  );
  assert.deepEqual(savedIndex.lessons[0].examples, [examplePayload.lesson.id]);
  assert.equal(
    buildLibraryRecords(
      savedApproved.map((e) => e.payload),
      savedIndex,
    ).length,
    1,
  );
  const parentEntry = manifest.entries.shift();
  await write();
  await assert.rejects(prepareRelease(paths), /approved parent/i);
  manifest.entries = [parentEntry];
  records.splice(records.length - exampleRecords.length, exampleRecords.length);
  await write();
  const unplacedIndex = JSON.parse(
    await readFile("content/library.json", "utf8"),
  );
  unplacedIndex.lessons = unplacedIndex.lessons.filter(
    (row) => row.lessonId !== decimalPayload.lesson.id,
  );
  unplacedIndex.collections = (unplacedIndex.collections ?? [])
    .map((collection) => ({
      ...collection,
      lessonIds: collection.lessonIds.filter(
        (id) => id !== decimalPayload.lesson.id,
      ),
      practiceIds: collection.practiceIds.filter(
        (id) => id !== decimalPayload.lesson.id,
      ),
    }))
    .filter((collection) => collection.lessonIds.length);
  const boundLibrary = structuredClone(manifest.library);
  manifest.library = {
    path: join(libraryDirectory, "index.json"),
    digest: await digest(unplacedIndex),
  };
  await writeFile(manifest.library.path, JSON.stringify(unplacedIndex));
  await write();
  await assert.rejects(
    prepareRelease(paths),
    /P4 release requires explicit bound library placement/,
  );
  manifest.library = boundLibrary;
  manifest.entries[0] = oldEntry;
  for (const record of records) record.digest = legacyHash;
  await write();
  const libraryDigest = manifest.library.digest;
  manifest.library.digest = "0".repeat(64);
  await write();
  await assert.rejects(prepareRelease(paths), /Library index digest mismatch/);
  manifest.library.digest = libraryDigest;
  manifest.library.path = paths.recordsPath;
  await write();
  await assert.rejects(prepareRelease(paths), /within content/);
  manifest.library.path = "content/library.json";
  for (const unsupported of [1, 2, 4]) {
    manifest.applicationContract = unsupported;
    await write();
    await assert.rejects(prepareRelease(paths), /Unsupported release manifest/);
  }
  manifest.applicationContract = 3;
  manifest.entries[0].digest = "edited";
  await write();
  await assert.rejects(prepareRelease(paths), /mismatch/);
  manifest.entries[0].digest = hash;
  records[0].reviewerId = "forged";
  await write();
  await assert.rejects(prepareRelease(paths), /Missing qualified/);
  records[0].reviewerId = reviewers[0].id;
  manifest.entries[0].path = paths.recordsPath;
  await write();
  await assert.rejects(prepareRelease(paths), /within content/);
  manifest.entries[0].path = "content/lessons/ribbon-collection.json";
  await write();
  assert.equal((await prepareRelease(paths)).length, 1);
  // A reviewer holding both roles cannot supply both approvals.
  const dual = { ...reviewers[0], roles: ["mathematical", "pedagogical"] };
  await writeFile(paths.reviewersPath, JSON.stringify([dual]));
  await writeFile(
    paths.recordsPath,
    JSON.stringify([
      { ...records[0], reviewerId: dual.id, role: "mathematical" },
      { ...records[1], reviewerId: dual.id, role: "pedagogical" },
    ]),
  );
  await assert.rejects(prepareRelease(paths), /distinct humans/);
  // An author cannot approve their own package.
  await write();
  const author = JSON.parse(await readFile(oldEntry.path, "utf8")).authors[0];
  await writeFile(
    paths.reviewersPath,
    JSON.stringify([{ ...reviewers[0], id: author }, reviewers[1]]),
  );
  await writeFile(
    paths.recordsPath,
    JSON.stringify([{ ...records[0], reviewerId: author }, records[1]]),
  );
  await assert.rejects(prepareRelease(paths), /Missing qualified/);

  // Unreviewed home release (handover decision 25): no approval records at all.
  const unreviewedPath = join(directory, "unreviewed.json");
  const upaths = { ...paths, unreviewedPath };
  const parentU = {
    path: "content/lessons/p4-decimal-practice.json",
    id: decimalPayload.lesson.id,
    version: decimalPayload.lesson.version,
    digest: decimalHash,
  };
  const exampleU = { ...exampleEntry };
  const unreviewedFile = {
    schemaVersion: 1,
    decision: "Synthetic fixture only",
    decidedBy: "test",
    decidedOn: "2026-10-11",
    label: "Not reviewed by a teacher. Published by a parent for home use.",
    entries: [parentU, exampleU],
  };
  const writeU = async (entries = []) => {
    manifest.entries = entries;
    await writeFile(paths.manifestPath, JSON.stringify(manifest));
    await writeFile(paths.reviewersPath, "[]");
    await writeFile(paths.recordsPath, "[]");
    await writeFile(unreviewedPath, JSON.stringify(unreviewedFile));
  };
  await writeU();
  const home = await prepareRelease(upaths);
  assert.deepEqual(
    home.map((e) => [e.id, e.reviewed]),
    [
      [parentU.id, false],
      [exampleU.id, false],
    ],
  );
  const homeIndex = pruneLibraryIndex(
    JSON.parse(await readFile("content/library.json", "utf8")),
    home.map((e) => e.payload),
  );
  assert.deepEqual(homeIndex.lessons[0].examples, [exampleU.id]);
  // The trusted registers in release/ remain empty.
  assert.equal(await readFile("release/reviewers.json", "utf8"), "[]\n");
  assert.equal(await readFile("release/reviews.json", "utf8"), "[]\n");
  // A missing unreviewed file means nothing is released unreviewed.
  assert.equal(
    (
      await prepareRelease({
        ...paths,
        unreviewedPath: join(directory, "absent.json"),
      })
    ).length,
    0,
  );
  // A modified package no longer matches its published digest.
  const editedPath = join(libraryDirectory, "edited.json");
  const edited = structuredClone(decimalPayload);
  edited.lesson.steps[0].hints[0] = "Changed hint";
  await writeFile(editedPath, JSON.stringify(edited));
  unreviewedFile.entries = [{ ...parentU, path: editedPath }];
  await writeU();
  await assert.rejects(prepareRelease(upaths), /digest\/identity mismatch/);
  // An ID in both lists, an unreviewed example without its parent and a non-P4 lesson fail.
  unreviewedFile.entries = [parentU, exampleU];
  await writeU([parentU]);
  await assert.rejects(prepareRelease(upaths), /both reviewed and unreviewed/);
  unreviewedFile.entries = [exampleU];
  await writeU();
  await assert.rejects(prepareRelease(upaths), /released parent/);
  unreviewedFile.entries = [oldEntry];
  await writeU();
  await assert.rejects(prepareRelease(upaths), /limited to placed P4/);
  unreviewedFile.entries = [parentU, parentU];
  await writeU();
  await assert.rejects(prepareRelease(upaths), /Duplicate release lesson ID/);
  // Unreviewed entries never excuse missing approvals for manifest entries.
  unreviewedFile.entries = [parentU];
  await writeU([oldEntry]);
  await assert.rejects(prepareRelease(upaths), /Missing qualified/);
  unreviewedFile.schemaVersion = 2;
  await writeU();
  await assert.rejects(prepareRelease(upaths), /Unsupported unreviewed/);
  unreviewedFile.schemaVersion = 1;

  // Artifact check: listed drafts are allowed, any other draft id is rejected.
  const dist = join(directory, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  manifest.entries = [];
  await writeFile(paths.manifestPath, JSON.stringify(manifest));
  unreviewedFile.entries = [parentU, exampleU];
  await writeFile(unreviewedPath, JSON.stringify(unreviewedFile));
  const artifact = async (logic, data) => {
    await writeFile(join(dist, "assets", "learner-a.js"), logic);
    await writeFile(join(dist, "assets", "lesson-data-a.js"), data);
    return checkLearnerArtifact({
      dir: dist,
      manifestPath: paths.manifestPath,
      unreviewedPath,
    });
  };
  const label = `const l=${JSON.stringify(unreviewedFile.label)};`;
  const listed = `export default[{id:"${parentU.id}",version:1,payload:{provenance:{generatorVersion:"p4-examples-v1"},lesson:{id:"${exampleU.id}",version:1}}}];const x={lessonId:"${parentU.id}",examples:["${exampleU.id}"]};`;
  const counts = await artifact(label, listed);
  assert.equal(counts.unreviewed, 2);
  assert.equal(counts.reviewed, 0);
  await assert.rejects(
    artifact(label, `${listed}const y={id:"ribbon-collection",version:1};`),
    /Draft leaked into learner artifact: ribbon-collection/,
  );
  await assert.rejects(
    artifact(label, `${listed}const y={examples:["p4-decimal-practice-ex2"]};`),
    /Draft leaked into learner artifact: p4-decimal-practice-ex2/,
  );
  await assert.rejects(
    artifact(label, `${listed}const y={lessonId:"p4-angle-practice"};`),
    /Draft leaked into learner artifact: p4-angle-practice/,
  );
  await assert.rejects(artifact("", listed), /visible label/);
  await assert.rejects(
    artifact(`${label}const g="p4-examples-v1";`, listed),
    /Author code leaked/,
  );
  await assert.rejects(
    artifact(label, `${listed}const z="Local author workspace";`),
    /Author code leaked/,
  );

  for (const [name, before] of originalBytes)
    assert.deepEqual(
      await readFile(join("content/lessons", name)),
      before,
      `Legacy source changed: ${name}`,
    );
  console.log(
    "Release build gate: legacy and schema3 synthetic approvals accepted; package/index mismatch, unsupported contracts, forged identity and path escapes rejected; unreviewed home-release entries build with empty review registers and reject edits, double listing, orphan examples and non-P4 lessons; the artifact check allows only listed drafts; 18 original source files unchanged.",
  );
} finally {
  await server.close();
  await rm(directory, { recursive: true, force: true });
  await rm(libraryDirectory, { recursive: true, force: true });
}
