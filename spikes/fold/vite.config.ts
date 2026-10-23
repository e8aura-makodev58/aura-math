import { defineConfig } from "vite";
// WP0a SPIKE (throwaway) dev server: npx vite --config spikes/fold/vite.config.ts
export default defineConfig({
  // three is read-only from the loci project (0.162.0); the spike does not add a dependency to aura-math
  resolve: { alias: { three: "/home/makodev58/loci/loci-app/node_modules/three" } },
  root: new URL(".", import.meta.url).pathname,
  server: { port: 5192, strictPort: true, host: "127.0.0.1", fs: { allow: ["../..", "/home/makodev58/loci/loci-app/node_modules/three"] } },
});
