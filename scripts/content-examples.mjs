import { execFileSync } from "node:child_process";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { run } = await server.ssrLoadModule("/scripts/example-cli.ts");
  process.exitCode = await run(process.argv.slice(2));
  if (!process.exitCode && !process.argv.includes("--check"))
    execFileSync("node", ["scripts/bind-library.mjs"], { stdio: "inherit" });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
