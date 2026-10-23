/**
 * Minimal Node declarations for the server-only admin settings modules and their tests. The project
 * has no @types/node, and the plan forbids new dependencies. Only module declarations live here (no
 * globals), so they merge harmlessly if @types/node is ever added.
 */
declare module "node:buffer" {
  export class Buffer extends Uint8Array {
    static from(text: string, encoding?: "utf8"): Buffer;
    static concat(chunks: readonly Uint8Array[]): Buffer;
    static byteLength(text: string, encoding?: "utf8"): number;
    toString(encoding?: "utf8" | "hex" | "base64url"): string;
  }
}

declare module "node:process" {
  export const env: Record<string, string | undefined>;
  export function getuid(): number;
}

declare module "node:crypto" {
  import type { Buffer } from "node:buffer";
  interface Hash {
    update(data: string): Hash;
    digest(): Buffer;
  }
  export function createHash(algorithm: "sha256"): Hash;
  export function randomBytes(size: number): Buffer;
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

declare module "node:os" {
  export function homedir(): string;
  export function tmpdir(): string;
}

declare module "node:path" {
  export const sep: string;
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string): string;
  export function isAbsolute(path: string): boolean;
}

declare module "node:fs/promises" {
  interface FileHandle {
    writeFile(data: string): Promise<void>;
    sync(): Promise<void>;
    close(): Promise<void>;
  }
  interface Stats {
    mode: number;
    uid: number;
    isDirectory(): boolean;
  }
  export function open(
    path: string,
    flags: string,
    mode?: number,
  ): Promise<FileHandle>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function writeFile(
    path: string,
    data: string,
    options?: { mode?: number },
  ): Promise<void>;
  export function chmod(path: string, mode: number): Promise<void>;
  export function mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<string | undefined>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function realpath(path: string): Promise<string>;
  export function rename(from: string, to: string): Promise<void>;
  export function stat(path: string): Promise<Stats>;
  export function unlink(path: string): Promise<void>;
  export function readdir(path: string): Promise<string[]>;
  export function rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  export function symlink(target: string, path: string): Promise<void>;
}
