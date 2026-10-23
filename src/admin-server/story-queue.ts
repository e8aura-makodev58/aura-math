/**
 * Owner-only queue of model-suggested story slot sets (Phase B2/B3). Server-side only.
 *
 * One file, `stories.json`, in the settings data root (0600, atomic writes). Pending sets wait for
 * the adult; only approved sets are ever served to the preview, by `readApprovedForPublic`, which
 * reads without creating or writing anything. Bounded: 200 pending and 200 approved.
 */
import { randomBytes } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  exampleStory,
  isStorySlotProfile,
  storySlotIssues,
  slotKey,
  MODEL_SLOTS,
  type StorySlots,
} from "../content/story-slots";
import type { StoryProfileId } from "../content/story-frames";
import { SettingsError, writeAtomic, type AtomicHooks } from "./store";

export const STORIES_FILE = "stories.json";
export const MAX_PENDING = 200;
export const MAX_APPROVED = 200;
const ID_PATTERN = /^[a-f0-9]{16}$/;

export interface StoryProvenance {
  provider: string;
  model: string;
  servedModel: string | null;
  settingsRevision: string;
  promptVersion: string;
  createdAt: string;
}
export interface StoryEntry {
  id: string;
  profile: StoryProfileId;
  slots: StorySlots;
  provenance: StoryProvenance;
  approvedAt?: string;
}
interface StoriesState {
  version: 1;
  pending: StoryEntry[];
  approved: StoryEntry[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const short = (value: unknown, max = 200) =>
  typeof value === "string" && value.length <= max;

function validEntry(value: unknown): value is StoryEntry {
  if (!isRecord(value)) return false;
  const p = value.provenance;
  return (
    typeof value.id === "string" &&
    ID_PATTERN.test(value.id) &&
    isStorySlotProfile(value.profile) &&
    storySlotIssues(value.profile, value.slots).length === 0 &&
    isRecord(p) &&
    short(p.provider, 40) &&
    short(p.model) &&
    (p.servedModel === null || short(p.servedModel)) &&
    short(p.settingsRevision, 64) &&
    short(p.promptVersion, 40) &&
    short(p.createdAt, 40) &&
    (value.approvedAt === undefined || short(value.approvedAt, 40))
  );
}

function parseStories(value: unknown): StoriesState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.pending) ||
    !Array.isArray(value.approved) ||
    !value.pending.every(validEntry) ||
    !value.approved.every(validEntry) ||
    value.pending.length > MAX_PENDING ||
    value.approved.length > MAX_APPROVED
  )
    throw new SettingsError(
      "SETTINGS_CORRUPT",
      `The story file ${STORIES_FILE} has an unexpected shape. Fix or remove it in the data folder.`,
      503,
    );
  return value as unknown as StoriesState;
}

async function readStories(root: string): Promise<StoriesState | undefined> {
  let text: string;
  try {
    text = await readFile(join(root, STORIES_FILE), "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return parseStories(JSON.parse(text));
  } catch (error) {
    if (error instanceof SettingsError) throw error;
    throw new SettingsError(
      "SETTINGS_CORRUPT",
      `The story file ${STORIES_FILE} could not be read.`,
      503,
    );
  }
}

/** One listed entry for the admin page: provenance, never a key, plus one rendered example. */
export interface ListedStory extends StoryEntry {
  example: string;
}
const listed = (entry: StoryEntry): ListedStory => ({
  ...structuredClone(entry),
  example: exampleStory(
    entry.profile,
    entry.slots,
    parseInt(entry.id.slice(0, 6), 16),
  ),
});

export class StoryQueue {
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(
    private root: string,
    private state: StoriesState,
    private hooks: AtomicHooks,
  ) {}

  /** `root` is the prepared settings data root (already checked and owner-only). */
  static async open(root: string, hooks: AtomicHooks = {}) {
    const state = (await readStories(root)) ?? {
      version: 1 as const,
      pending: [],
      approved: [],
    };
    return new StoryQueue(root, state, hooks);
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(next: StoriesState) {
    await writeAtomic(this.root, STORIES_FILE, next, this.hooks);
    this.state = next;
  }

  list() {
    return {
      pending: this.state.pending.map(listed),
      approved: this.state.approved.map(listed),
      limits: { pending: MAX_PENDING, approved: MAX_APPROVED },
    };
  }

  pendingRoom() {
    return MAX_PENDING - this.state.pending.length;
  }

  /** Keys of every pending and approved set, for de-duplication of new candidates. */
  knownKeys(): Set<string> {
    return new Set(
      [...this.state.pending, ...this.state.approved].map((entry) =>
        slotKey(entry.profile, entry.slots),
      ),
    );
  }

  addPending(
    profile: StoryProfileId,
    sets: StorySlots[],
    provenance: StoryProvenance,
  ) {
    return this.exclusive(async () => {
      const room = this.pendingRoom();
      const added = sets.slice(0, Math.max(0, room)).map((slots) => ({
        id: randomBytes(8).toString("hex"),
        profile,
        slots: Object.fromEntries(
          MODEL_SLOTS[profile].map((slot) => [slot, slots[slot]]),
        ) as StorySlots,
        provenance: { ...provenance },
      }));
      if (added.length)
        await this.write({
          ...this.state,
          pending: [...this.state.pending, ...added],
        });
      return added.length;
    });
  }

  private find(list: "pending" | "approved", id: unknown) {
    const index =
      typeof id === "string" && ID_PATTERN.test(id)
        ? this.state[list].findIndex((entry) => entry.id === id)
        : -1;
    if (index < 0)
      throw new SettingsError(
        "STORY_NOT_FOUND",
        "That story is no longer in the list. Refresh the list.",
        404,
      );
    return index;
  }

  approve(id: unknown, at: Date) {
    return this.exclusive(async () => {
      const index = this.find("pending", id);
      if (this.state.approved.length >= MAX_APPROVED)
        throw new SettingsError(
          "APPROVED_FULL",
          `The approved list is full (${MAX_APPROVED}). Remove some approved stories first.`,
          409,
        );
      const entry = {
        ...this.state.pending[index],
        approvedAt: at.toISOString(),
      };
      await this.write({
        version: 1,
        pending: this.state.pending.filter((_, i) => i !== index),
        approved: [...this.state.approved, entry],
      });
      return this.list();
    });
  }

  reject(id: unknown) {
    return this.exclusive(async () => {
      const index = this.find("pending", id);
      await this.write({
        ...this.state,
        pending: this.state.pending.filter((_, i) => i !== index),
      });
      return this.list();
    });
  }

  remove(id: unknown) {
    return this.exclusive(async () => {
      const index = this.find("approved", id);
      await this.write({
        ...this.state,
        approved: this.state.approved.filter((_, i) => i !== index),
      });
      return this.list();
    });
  }
}

/**
 * Read-only access for the unauthenticated preview route: never creates the data root, the token
 * or any file, and never calls a provider. Returns only approved sets with an opaque id. A missing
 * root or file gives an empty list; a root inside a forbidden folder is refused (empty list).
 */
export async function readApprovedForPublic(
  root: string,
  forbiddenRoots: readonly string[],
) {
  let real: string;
  try {
    real = await realpath(root);
    if (!(await stat(real)).isDirectory()) return [];
  } catch {
    return [];
  }
  for (const entry of forbiddenRoots) {
    let forbidden: string;
    try {
      forbidden = await realpath(entry);
    } catch {
      continue;
    }
    if (real === forbidden || real.startsWith(forbidden.replace(/\/?$/, "/")))
      return [];
  }
  const state = await readStories(real);
  return (state?.approved ?? []).map((entry) => ({
    id: entry.id,
    profile: entry.profile,
    slots: { ...entry.slots },
    status: "approved" as const,
  }));
}
