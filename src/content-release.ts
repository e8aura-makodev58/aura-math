/** Version 1 canonicalization: sorted object keys, JSON scalar encoding, ordered arrays. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Canonical payload must contain only finite JSON values.");
}
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
export interface Reviewer {
  id: string;
  kind: "human";
  qualifications: string;
  roles: ("mathematical" | "pedagogical")[];
}
export interface ReviewRecord {
  reviewerId: string;
  role: "mathematical" | "pedagogical";
  digest: string;
  decision: "approve" | "changes";
  evidence: string;
  warningDispositions: string[];
}
export interface ReleaseEntry {
  path: string;
  id: string;
  version: number;
  digest: string;
}
export interface ReleaseManifest {
  schemaVersion: 2;
  canonicalVersion: 1;
  applicationContract: 3;
  library: { path: string; digest: string };
  contentImpactDecision: string;
  entries: ReleaseEntry[];
}
export function assertApprovals(
  hash: string,
  authors: string[],
  warningPaths: string[],
  reviewers: Reviewer[],
  records: ReviewRecord[],
): void {
  const selected: ReviewRecord[] = [];
  for (const role of ["mathematical", "pedagogical"] as const) {
    const eligible = records.filter(
      (record) => record.digest === hash && record.role === role,
    );
    if (eligible.some((record) => record.decision === "changes"))
      throw new Error(`${role} review requests changes.`);
    const record = eligible.find((record) => {
      const reviewer = reviewers.find((item) => item.id === record.reviewerId);
      return (
        record.decision === "approve" &&
        !!record.evidence.trim() &&
        reviewer?.kind === "human" &&
        !!reviewer.qualifications.trim() &&
        reviewer.roles.includes(role) &&
        !authors.includes(reviewer.id) &&
        warningPaths.every((path) => record.warningDispositions.includes(path))
      );
    });
    if (!record)
      throw new Error(
        `Missing qualified independent ${role} approval for exact digest and warnings.`,
      );
    selected.push(record);
  }
  if (selected[0].reviewerId === selected[1].reviewerId)
    throw new Error(
      "Mathematical and pedagogical reviewers must be distinct humans.",
    );
}
