/**
 * Extra minimal Node declarations for scripts/learner-static-plugin.ts and its test. They merge
 * with src/admin-server/node-modules.d.ts (the project has no @types/node).
 */
declare module "node:path" {
  export function extname(path: string): string;
}

declare module "node:fs/promises" {
  interface Stats {
    size: number;
    isFile(): boolean;
  }
  export function readFile(path: string): Promise<Uint8Array>;
}
