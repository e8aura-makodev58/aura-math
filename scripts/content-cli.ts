import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parsePackage,
  MAX_PACKAGE_BYTES,
} from "../src/content/package-validation";
import {
  buildLibraryRecords,
  validateLibraryIndex,
} from "../src/library/catalogue";
import { generateBatch } from "../src/content/generation";

export async function run(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "generate") {
    const seedIndex = rest.indexOf("--seed");
    if (
      seedIndex >= 0 &&
      (!rest[seedIndex + 1] || rest[seedIndex + 1].startsWith("--"))
    )
      throw new Error("--seed requires uint32 value");
    const seed = seedIndex < 0 ? 1 : Number(rest[seedIndex + 1]);
    const outIndex = rest.indexOf("--out");
    if (
      outIndex >= 0 &&
      (!rest[outIndex + 1] || rest[outIndex + 1].startsWith("--"))
    )
      throw new Error("--out requires a directory");
    const out = resolve(
      outIndex < 0 ? "content/generated" : rest[outIndex + 1],
    );
    const batch = generateBatch(seed);
    await mkdir(out, { recursive: true });
    for (const p of batch)
      await writeFile(
        resolve(out, `${p.lesson.id}.json`),
        JSON.stringify(p, null, 2) + "\n",
      );
    console.log(
      `Generated ${batch.length} separate unapproved drafts with seed ${seed} in ${out}`,
    );
    return 0;
  }
  if (command === "validate") {
    let paths = rest.filter((s) => !s.startsWith("--"));
    const full = !paths.length;
    if (full) {
      const collect = async (dir: string): Promise<string[]> => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(
          () => [],
        );
        return (
          await Promise.all(
            entries.map(async (e) =>
              e.isDirectory()
                ? collect(`${dir}/${e.name}`)
                : e.name.endsWith(".json")
                  ? [`${dir}/${e.name}`]
                  : [],
            ),
          )
        ).flat();
      };
      paths = [
        ...(await collect("content/lessons")),
        ...(await collect("content/examples")),
      ];
    }
    const identities = new Set<string>();
    const validated = [];
    let failures = 0;
    for (const path of paths) {
      if ((await stat(path)).size > MAX_PACKAGE_BYTES) {
        console.error(
          `${path} error $: Package exceeds ${MAX_PACKAGE_BYTES} bytes. Repair: Reduce file size.`,
        );
        failures++;
        continue;
      }
      const result = parsePackage(await readFile(path, "utf8"));
      for (const issue of result.issues)
        console.log(
          `${path} ${issue.severity} ${issue.path}: ${issue.message} Repair: ${issue.repair}`,
        );
      if (!result.package) failures++;
      else {
        if (identities.has(result.package.lesson.id)) {
          console.error("Duplicate lesson identity.");
          failures++;
        }
        identities.add(result.package.lesson.id);
        validated.push(result.package);
      }
    }
    if (full) {
      const index = validateLibraryIndex(
        JSON.parse(await readFile("content/library.json", "utf8")),
      );
      buildLibraryRecords(validated, index);
      for (const id of index.lessons.flatMap((l) => l.examples ?? []))
        if (!identities.has(id)) {
          console.error(`Missing example ${id}`);
          failures++;
        }
    }
    console.log(
      `Validated ${paths.length} packages; ${failures} invalid. Human review remains required.`,
    );
    return failures ? 1 : 0;
  }
  throw new Error(
    "Usage: content validate [files...] | generate --seed UINT32 [--out DIR]",
  );
}
