import type { Plugin } from "vite";

/**
 * Development-server routes for the admin model settings (`/api/admin/settings/*`, including the
 * story generate-and-approve queue) and the read-only approved-story route for the preview
 * (`GET /api/stories/approved`). Serve-only:
 * never part of `vite build`, `vite preview` or the learner build. Under Vitest it registers
 * nothing, and even on the dev server the data root and token are created only on the first admin
 * request (R-119). Keys stay in the owner-only data root on this machine and are never returned.
 *
 * `AURA_MATH_FAKE_PROVIDER=1` swaps in a network-free provider for browser tests.
 */
export function adminSettingsPlugin(): Plugin {
  return {
    name: "aura-admin-settings",
    apply: "serve",
    configureServer(server) {
      if (process.env.VITEST) return;
      if (server.config.server.allowedHosts === true)
        throw new Error(
          "Admin settings refuse server.allowedHosts: true (host validation guards the admin routes).",
        );
      type Handler = ReturnType<
        typeof import("../src/admin-server/handler").createAdminHandler
      >;
      let handlerPromise: Promise<Handler> | undefined;
      const handler = () =>
        (handlerPromise ??= (async () => {
          const [handlerModule, storeModule, providerModule] =
            (await Promise.all([
              server.ssrLoadModule("/src/admin-server/handler.ts"),
              server.ssrLoadModule("/src/admin-server/store.ts"),
              server.ssrLoadModule("/src/admin-server/providers.ts"),
            ])) as [
              typeof import("../src/admin-server/handler"),
              typeof import("../src/admin-server/store"),
              typeof import("../src/admin-server/providers"),
            ];
          const fake = process.env.AURA_MATH_FAKE_PROVIDER === "1";
          return handlerModule.createAdminHandler({
            transport: fake
              ? providerModule.createFakeTransport()
              : providerModule.createLiveTransport(),
            openStore: () =>
              storeModule.SettingsStore.open({
                root: storeModule.defaultDataRoot(),
                forbiddenRoots: [
                  server.config.root,
                  ...server.config.server.fs.allow,
                ],
                log: (line) => server.config.logger.info(line),
              }),
          });
        })());
      type PublicHandler = ReturnType<
        typeof import("../src/admin-server/handler").createPublicStoryHandler
      >;
      let publicPromise: Promise<PublicHandler> | undefined;
      const publicHandler = () =>
        (publicPromise ??= (async () => {
          const [handlerModule, storeModule] = (await Promise.all([
            server.ssrLoadModule("/src/admin-server/handler.ts"),
            server.ssrLoadModule("/src/admin-server/store.ts"),
          ])) as [
            typeof import("../src/admin-server/handler"),
            typeof import("../src/admin-server/store"),
          ];
          return handlerModule.createPublicStoryHandler({
            root: () => storeModule.defaultDataRoot(),
            forbiddenRoots: [
              server.config.root,
              ...server.config.server.fs.allow,
            ],
          });
        })());
      // Read-only approved story slot sets for the development preview (no token, no writes,
      // never a provider call). Not part of any build.
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== "/api/stories/approved") return next();
        const headers = {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        };
        try {
          const response = await (
            await publicHandler()
          )({ method: req.method ?? "GET", path });
          if (!response) return next();
          res.statusCode = response.status;
          for (const [name, value] of Object.entries(headers))
            res.setHeader(name, value);
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 200;
          for (const [name, value] of Object.entries(headers))
            res.setHeader(name, value);
          res.end(JSON.stringify({ version: 1, sets: [] }));
        }
      });
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/api/admin/settings/")) return next();
        const send = (status: number, body: unknown, headers: object) => {
          res.statusCode = status;
          for (const [name, value] of Object.entries(headers))
            res.setHeader(name, value as string);
          res.end(JSON.stringify(body));
        };
        try {
          const handlerModule = (await server.ssrLoadModule(
            "/src/admin-server/handler.ts",
          )) as typeof import("../src/admin-server/handler");
          const chunks: Buffer[] = [];
          let size = 0;
          let tooLarge = false;
          for await (const chunk of req) {
            size += (chunk as Buffer).length;
            if (size > handlerModule.MAX_ADMIN_BODY_BYTES) {
              tooLarge = true;
              break;
            }
            chunks.push(chunk as Buffer);
          }
          const response = await (
            await handler()
          )({
            method: req.method ?? "GET",
            path,
            remoteAddress: req.socket.remoteAddress,
            headers: req.headers,
            body: tooLarge ? "" : Buffer.concat(chunks).toString("utf8"),
            bodyTooLarge: tooLarge,
          });
          if (!response) return next();
          send(response.status, response.body, handlerModule.ADMIN_HEADERS);
          if (tooLarge) req.destroy();
        } catch {
          // Never log the request: it may carry a key.
          send(
            500,
            {
              error: {
                code: "SETTINGS_FAILED",
                message: "The settings service failed.",
              },
            },
            {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          );
        }
      });
    },
  };
}
