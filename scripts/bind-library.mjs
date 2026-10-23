#!/usr/bin/env node
// Publisher tool: recomputes the digest of content/library.json and writes it into
// release/manifest.json. Run after any change to the library index; the learner build and the
// release tests refuse a manifest whose digest does not match the index.
//   node scripts/bind-library.mjs
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { validateLibraryIndex } = await server.ssrLoadModule("/src/library/catalogue.ts");
  const { digest } = await server.ssrLoadModule("/src/content-release.ts");
  const manifest = JSON.parse(await readFile("release/manifest.json", "utf8"));
  const index = validateLibraryIndex(JSON.parse(await readFile(manifest.library.path, "utf8")));
  const next = await digest(index);
  if (next === manifest.library.digest) console.log("Library digest already current.");
  else {
    manifest.library.digest = next;
    await writeFile("release/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Library digest updated to ${next}`);
  }
} finally {
  await server.close();
}
