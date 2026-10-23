import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { run } = await server.ssrLoadModule("/scripts/content-cli.ts");
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
