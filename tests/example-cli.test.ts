declare const process: { cwd(): string; chdir(path: string): void };
import { it, expect, vi } from "vitest";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../scripts/example-cli";
import { digest } from "../src/content-release";
it("check is read-only and force cannot overwrite a reviewed digest", async () => {
  const original = process.cwd(),
    directory = await mkdtemp(join(tmpdir(), "aura-example-cli-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    await mkdir(join(directory, "content/examples/p4"), { recursive: true });
    await mkdir(join(directory, "release"), { recursive: true });
    const index = await readFile(
      join(original, "content/library.json"),
      "utf8",
    );
    await writeFile(join(directory, "content/library.json"), index);
    for (let i = 1; i <= 5; i++)
      await writeFile(
        join(
          directory,
          `content/examples/p4/p4-protractor-bench-read-ex${i}.json`,
        ),
        await readFile(
          join(
            original,
            `content/examples/p4/p4-protractor-bench-read-ex${i}.json`,
          ),
          "utf8",
        ),
      );
    const target = join(
      directory,
      "content/examples/p4/p4-protractor-bench-read-ex1.json",
    );
    const changed = JSON.parse(await readFile(target, "utf8"));
    changed.lesson.title = "Reviewed fixture wording";
    const before = JSON.stringify(changed);
    await writeFile(target, before);
    await writeFile(
      join(directory, "release/reviews.json"),
      JSON.stringify([{ digest: await digest(changed) }]),
    );
    process.chdir(directory);
    expect(await run(["--lesson", "p4-protractor-bench-read", "--check"])).toBe(
      1,
    );
    expect(await readFile(target, "utf8")).toBe(before);
    await expect(
      run(["--lesson", "p4-protractor-bench-read", "--force"]),
    ).rejects.toThrow(/reviewed/);
    expect(await readFile(target, "utf8")).toBe(before);
    expect(
      await readFile(join(directory, "content/library.json"), "utf8"),
    ).toBe(index);
  } finally {
    process.chdir(original);
    log.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
