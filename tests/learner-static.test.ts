import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLearnerStaticHandler } from "../scripts/learner-static-plugin";

let directory: string;
let handler: ReturnType<typeof createLearnerStaticHandler>;
// The handler receives the raw request target, exactly as Node passes it (no normalisation).
async function send(method: string, url: string) {
  const out = {
    status: 0,
    headers: {} as Record<string, string>,
    body: "",
    passed: false,
  };
  await handler(
    { method, url },
    {
      headersSent: false,
      statusCode: 200,
      writeHead(status, headers) {
        out.status = status;
        out.headers = headers;
      },
      end(body) {
        out.body =
          body === undefined
            ? ""
            : typeof body === "string"
              ? body
              : new TextDecoder().decode(body);
      },
    },
    () => {
      out.passed = true;
    },
  );
  return out;
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "aura-static-"));
  const dist = join(directory, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "learner.html"), "<p>learner</p>");
  await writeFile(join(dist, "assets", "learner-abc.js"), "export {};");
  await writeFile(join(dist, "assets", "notes.unknown"), "x");
  await writeFile(join(directory, "secret.json"), '{"secret":true}');
  await symlink(join(directory, "secret.json"), join(dist, "escape.json"));
  handler = createLearnerStaticHandler(dist);
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
describe("learner static serving under /app/", () => {
  it("serves the learner entry for /app and /app/ without caching", async () => {
    for (const path of ["/app", "/app/", "/app/?x=1", "/app/learner.html"]) {
      const res = await send("GET", path);
      expect(res.status).toBe(200);
      expect(res.body).toBe("<p>learner</p>");
      expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(res.headers["cache-control"]).toBe("no-cache");
    }
  });
  it("serves hashed assets with a long cache and HEAD without a body", async () => {
    const res = await send("GET", "/app/assets/learner-abc.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(res.headers["cache-control"]).toContain("immutable");
    const head = await send("HEAD", "/app/assets/learner-abc.js");
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-length"]).toBe("10");
    expect(res.body).toBe("export {};");
  });
  it("rejects traversal, encoded traversal, symlink escapes and unknown files", async () => {
    for (const path of [
      "/app/../secret.json",
      "/app/%2e%2e/secret.json",
      "/app/%2E%2E/secret.json",
      "/app/assets/..%2f..%2fsecret.json",
      "/app/assets/%2e%2e%2f%2e%2e%2fsecret.json",
      "/app/..%5csecret.json",
      "/app/%00learner.html",
      "/app/%E0%A4%A",
      "/app//learner.html",
      "/app/./learner.html",
      "/app/escape.json",
      "/app/assets/",
      "/app/assets",
      "/app/assets/notes.unknown",
      "/app/missing.js",
    ]) {
      const res = await send("GET", path);
      expect(res.status, path).toBe(404);
      expect(res.body).not.toContain("secret");
    }
  });
  it("rejects methods other than GET and HEAD", async () => {
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const res = await send(method, "/app/");
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("GET, HEAD");
    }
  });
  it("never handles paths outside /app", async () => {
    for (const path of ["/", "/application", "/appx/learner.html", "/x/app/"]) {
      const res = await send("GET", path);
      expect(res.passed, path).toBe(true);
      expect(res.status).toBe(0);
    }
  });
});
