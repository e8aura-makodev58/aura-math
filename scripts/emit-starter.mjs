#!/usr/bin/env node
// Writes the starter lesson packages for one author topic into content/lessons/ so they become
// ordinary data files. Refuses to overwrite an existing file unless --force is given, and refuses
// to write a package that does not validate.
//   node scripts/emit-starter.mjs <topic-id> [--force]
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";

const topic = process.argv[2];
const force = process.argv.includes("--force");
if (!topic) {
  console.error("Usage: node scripts/emit-starter.mjs <topic-id> [--force]");
  process.exit(2);
}
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { authorTopics } = await server.ssrLoadModule("/src/authoring/registry.ts");
  const { validatePackage } = await server.ssrLoadModule("/src/content/package-validation.ts");
  const capability = authorTopics[topic];
  if (!capability) throw new Error(`No author capability for topic ${topic}.`);
  for (const form of capability.forms) {
    const pkg = capability.template(form.id, form.id);
    const checked = validatePackage(JSON.parse(JSON.stringify(pkg)));
    const errors = checked.issues.filter((i) => i.severity === "error");
    if (errors.length)
      throw new Error(`${form.id}: ${errors.map((e) => `${e.path} ${e.message}`).join("; ")}`);
    const path = `content/lessons/${form.id}.json`;
    if (existsSync(path) && !force) {
      console.log(`skip ${path} (exists)`);
      continue;
    }
    await writeFile(path, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`wrote ${path}`);
  }
} finally {
  await server.close();
}
