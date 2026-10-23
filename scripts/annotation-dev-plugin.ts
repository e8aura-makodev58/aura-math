import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Development-server endpoint behind the author's "Suggest layout" button. Serve-only: it is never
 * part of `vite build`, so no learner or preview artifact contains it, and the API key stays on
 * this machine's server process, never in browser code.
 */
export function annotationDevPlugin(): Plugin {
  return {
    name: "aura-annotation-dev",
    apply: "serve",
    configureServer(server) {
      let state: unknown;
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/__annotation/")) return next();
        // The dev server is reachable through a Cloudflare tunnel, whose requests arrive from
        // loopback, so loopback is not proof of a local author. The tool is set aside: it answers
        // only when explicitly enabled, and never for proxied requests.
        const proxied = Boolean(
          req.headers["cf-connecting-ip"] ||
          req.headers["cf-ray"] ||
          req.headers["x-forwarded-for"],
        );
        if (process.env.AURA_ANNOTATION_ENABLE !== "1" || proxied) {
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          if (path === "/__annotation/status") {
            res.statusCode = 200;
            return res.end(JSON.stringify({ configured: false }));
          }
          res.statusCode = 404;
          return res.end(
            JSON.stringify({ error: "The annotation tool is turned off." }),
          );
        }
        try {
          const handler = (await server.ssrLoadModule(
            "/src/annotation/handler.ts",
          )) as typeof import("../src/annotation/handler");
          state ??= handler.newHandlerState();
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += (chunk as Buffer).length;
            if (size > handler.MAX_BODY_BYTES * 2) break;
            chunks.push(chunk as Buffer);
          }
          const credentials = () =>
            Boolean(
              process.env.ANTHROPIC_API_KEY ||
              process.env.ANTHROPIC_AUTH_TOKEN ||
              existsSync(join(homedir(), ".config", "anthropic")),
            );
          const response = await handler.handleAnnotationRequest(
            {
              method: req.method ?? "GET",
              path,
              remoteAddress: req.socket.remoteAddress,
              headers: req.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            },
            {
              configured: credentials,
              model: () =>
                process.env.AURA_ANNOTATION_MODEL ?? "claude-opus-5-5",
              call: () => {
                let inner:
                  import("../src/annotation/proposer").ModelCall | undefined;
                return async (request) => {
                  const mod = (await server.ssrLoadModule(
                    "/src/annotation/anthropic-call.ts",
                  )) as typeof import("../src/annotation/anthropic-call");
                  inner ??= mod.createAnthropicCall({
                    model: process.env.AURA_ANNOTATION_MODEL,
                  });
                  try {
                    return await inner(request);
                  } catch (error) {
                    throw new Error(mod.describeModelError(error));
                  }
                };
              },
            },
            state as ReturnType<typeof handler.newHandlerState>,
          );
          if (!response) return next();
          res.statusCode = response.status;
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(response.body));
        } catch {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "The annotation tool failed." }));
        }
      });
    },
  };
}
