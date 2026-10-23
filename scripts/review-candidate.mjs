import { readFile, stat } from "node:fs/promises";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const path = process.argv[2];
  if (!path)
    throw new Error("Usage: npm run content:review -- path/to/package.json");
  const { parsePackage, MAX_PACKAGE_BYTES } = await server.ssrLoadModule(
    "/src/content/package-validation.ts",
  );
  const { digest } = await server.ssrLoadModule("/src/content-release.ts");
  if ((await stat(path)).size > MAX_PACKAGE_BYTES)
    throw new Error("Package exceeds import size limit.");
  const result = parsePackage(await readFile(path, "utf8"));
  if (!result.package) throw new Error(JSON.stringify(result.issues, null, 2));
  const payload = result.package;
  console.log(
    JSON.stringify(
      {
        status: "draft-review-required",
        canonicalVersion: 1,
        candidate: {
          path,
          id: payload.lesson.id,
          version: payload.lesson.version,
          digest: await digest(payload),
        },
        authors: payload.authors,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
