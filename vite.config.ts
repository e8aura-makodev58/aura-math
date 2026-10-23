import { defineConfig } from "vitest/config";
import { annotationDevPlugin } from "./scripts/annotation-dev-plugin";
import { adminSettingsPlugin } from "./scripts/admin-settings-plugin";
import { learnerStaticPlugin } from "./scripts/learner-static-plugin";

export default defineConfig({
  plugins: [
    annotationDevPlugin(),
    adminSettingsPlugin(),
    learnerStaticPlugin(),
  ],
  // The Cloudflare tunnel (docs/cloudflare-tunnel.md) forwards this one public
  // hostname to the dev server. Never use `allowedHosts: true`.
  server: { allowedHosts: ["aura-math.makodev58.com"] },
  build: {
    rollupOptions: {
      input: {
        preview: "index.html",
        author: "author.html",
        admin: "admin.html",
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
