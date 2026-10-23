import { readFile, realpath, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { env } from "node:process";
import type { Plugin } from "vite";

/** The parts of Node's request and response this handler uses. */
export interface StaticRequest {
  url?: string;
  method?: string;
}
export interface StaticResponse {
  headersSent: boolean;
  statusCode: number;
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: string | Uint8Array): unknown;
}

export const LEARNER_PREFIX = "/app";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/**
 * Serves the built learner app (`dist-learner`, built with base `/app/`) under `/app/` only.
 * Files are read from disk on every request, so a rebuild is picked up without a restart.
 * GET and HEAD only; the resolved real path must stay inside the build directory; unknown
 * types, directories and missing files are 404. Everything outside `/app` is passed on.
 */
export function createLearnerStaticHandler(root = resolve("dist-learner")) {
  return async (
    req: StaticRequest,
    res: StaticResponse,
    next: () => void,
  ): Promise<void> => {
    const path = (req.url ?? "").split(/[?#]/)[0];
    if (path !== LEARNER_PREFIX && !path.startsWith(`${LEARNER_PREFIX}/`))
      return next();
    const fail = (status: number, extra: Record<string, string> = {}) => {
      res.writeHead(status, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...extra,
      });
      res.end(status === 405 ? "Method not allowed" : "Not found");
    };
    if (req.method !== "GET" && req.method !== "HEAD")
      return fail(405, { allow: "GET, HEAD" });
    let relative: string;
    try {
      relative = decodeURIComponent(path.slice(LEARNER_PREFIX.length));
    } catch {
      return fail(404);
    }
    if (relative === "" || relative === "/") relative = "/learner.html";
    const segments = relative.split("/").slice(1);
    if (
      relative.includes("\0") ||
      relative.includes("\\") ||
      segments.some((s) => s === "" || s === "." || s === "..")
    )
      return fail(404);
    const type = TYPES[extname(relative).toLowerCase()];
    if (!type) return fail(404);
    let base: string, file: string;
    try {
      base = await realpath(root);
      file = await realpath(join(base, ...segments));
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile())
        return fail(404);
    } catch {
      return fail(404);
    }
    const body = await readFile(file);
    const html = type.startsWith("text/html");
    res.writeHead(200, {
      "content-type": type,
      "content-length": String(body.length),
      "cache-control":
        !html && segments[0] === "assets"
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      "x-content-type-options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };
}

export function learnerStaticPlugin(): Plugin {
  return {
    name: "aura-learner-static",
    apply: "serve",
    configureServer(server) {
      if (env.VITEST) return;
      const handler = createLearnerStaticHandler(
        resolve(server.config.root, "dist-learner"),
      );
      server.middlewares.use((req, res, next) => {
        // Node's request and response satisfy the narrow interfaces above.
        handler(
          req as unknown as StaticRequest,
          res as unknown as StaticResponse,
          next,
        ).catch(() => {
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}
