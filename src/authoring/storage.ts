import {
  parsePackage,
  type LessonPackage,
  MAX_PACKAGE_BYTES,
} from "../content/package-validation";

export const DRAFT_PREFIX = "aura-author-draft:";
export const MAX_SAVED_DRAFTS = 10;
export interface SavedDraft {
  id: string;
  payload: LessonPackage;
  origin: LessonPackage;
  savedAt: string;
}
const heldIds = new Set<string>();
const validId = (id: string) => /^[a-zA-Z0-9-]{1,100}$/.test(id);
function storage(): Storage {
  return window.localStorage;
}
function keys(store: Storage): string[] {
  const result: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) result.push(key);
  }
  return result;
}
function decode(raw: string, id: string): SavedDraft {
  if (raw.length > MAX_PACKAGE_BYTES * 2 + 2000)
    throw new Error("Saved draft exceeds its size limit.");
  const record = JSON.parse(raw) as Record<string, unknown>;
  if (
    !record ||
    Object.keys(record).some(
      (key) => !["id", "payload", "origin", "savedAt"].includes(key),
    ) ||
    record.id !== id ||
    typeof record.savedAt !== "string" ||
    !Number.isFinite(Date.parse(record.savedAt))
  )
    throw new Error("Saved draft record is corrupt.");
  const payload = parsePackage(JSON.stringify(record.payload));
  const origin = parsePackage(JSON.stringify(record.origin));
  if (!payload.package || !origin.package)
    throw new Error("Saved draft content is corrupt.");
  return {
    id,
    payload: payload.package,
    origin: origin.package,
    savedAt: record.savedAt,
  };
}
export function listDrafts(): SavedDraft[] {
  try {
    const store = storage();
    return keys(store)
      .map((key) => decode(store.getItem(key)!, key.slice(DRAFT_PREFIX.length)))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    throw new Error(
      "Saved drafts could not be read on this device. Your current work remains available.",
    );
  }
}
export function loadDraft(id: string): SavedDraft | null {
  if (!validId(id)) throw new Error("Invalid saved draft identifier.");
  try {
    const raw = storage().getItem(DRAFT_PREFIX + id);
    return raw ? decode(raw, id) : null;
  } catch {
    throw new Error(
      "Saved draft could not be read. The existing record has not been changed.",
    );
  }
}
export function deleteDraft(id: string): void {
  if (!validId(id)) throw new Error("Invalid saved draft identifier.");
  if (typeof navigator.locks?.request === "function" && !heldIds.has(id))
    throw new Error(
      "Open this draft with an exclusive editing claim before deleting it.",
    );
  storage().removeItem(DRAFT_PREFIX + id);
}
/** Hold an exclusive browser lock until the returned release callback is called. */
export async function claimDraft(id: string): Promise<(() => void) | null> {
  if (!validId(id)) throw new Error("Invalid saved draft identifier.");
  if (typeof navigator.locks?.request !== "function") return null;
  return new Promise((resolve) => {
    let granted = false;
    navigator.locks
      .request(DRAFT_PREFIX + id, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        granted = true;
        heldIds.add(id);
        await new Promise<void>((release) =>
          resolve(() => {
            heldIds.delete(id);
            release();
          }),
        );
      })
      .catch(() => {
        if (!granted) resolve(null);
      });
  });
}
export async function saveDraft(
  payload: LessonPackage,
  origin: LessonPackage,
  recordId?: string,
): Promise<{ id: string; message: string }> {
  const validated = parsePackage(JSON.stringify(payload)),
    original = parsePackage(JSON.stringify(origin));
  if (!validated.package || !original.package)
    throw new Error("Fix draft errors before saving.");
  const perform = () => {
    const store = storage();
    const known = keys(store);
    // Refuse to write alongside corrupt records rather than silently repairing them.
    known.forEach((key) =>
      decode(store.getItem(key)!, key.slice(DRAFT_PREFIX.length)),
    );
    const continueExisting = !!recordId && heldIds.has(recordId);
    const id = continueExisting
      ? recordId!
      : typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    if (!continueExisting && known.length >= MAX_SAVED_DRAFTS)
      throw new Error(
        "Ten drafts are already saved. Delete a selected saved draft or download your work; no drafts were removed.",
      );
    const record: SavedDraft = {
      id,
      payload: validated.package!,
      origin: original.package!,
      savedAt: new Date().toISOString(),
    };
    store.setItem(DRAFT_PREFIX + id, JSON.stringify(record));
    return {
      id,
      message: continueExisting
        ? "Draft saved on this device."
        : "Draft saved as a separate copy on this device.",
    };
  };
  try {
    if (typeof navigator.locks?.request === "function")
      return await navigator.locks.request(DRAFT_PREFIX + "capacity", perform);
    return perform();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Ten drafts"))
      throw error;
    throw new Error(
      "Draft could not be saved on this device. Keep editing or download your work; existing saved drafts have not been replaced.",
    );
  }
}
