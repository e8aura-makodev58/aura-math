import { defineConfig } from "vitest/config";
// WP0a SPIKE (throwaway): separate config so `npm test` (tests/**) is unaffected.
export default defineConfig({
  resolve: { alias: { three: "/home/makodev58/loci/loci-app/node_modules/three" } },
  root: new URL(".", import.meta.url).pathname,
  test: { include: ["tests/**/*.spike.test.ts"], testTimeout: 600000 },
});
