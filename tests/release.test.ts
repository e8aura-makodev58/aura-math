import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  digest,
  assertApprovals,
  type Reviewer,
  type ReviewRecord,
} from "../src/content-release";
describe("exact-content release boundary", () => {
  it("uses a frozen canonical vector and rejects non JSON values", async () => {
    expect(canonicalJson({ z: [true, null, "x"], a: 1 })).toBe(
      '{"a":1,"z":[true,null,"x"]}',
    );
    expect(await digest({})).toBe(
      "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    );
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it("canonicalizes object order but binds prose, provenance, fixtures and visual settings", async () => {
    const payload = {
      story: "draft",
      hints: ["hint"],
      provenance: { seed: 1 },
      fixtures: [18],
      visual: { rotation: 20 },
    };
    expect(await digest(payload)).toBe(
      await digest({
        visual: payload.visual,
        fixtures: payload.fixtures,
        provenance: payload.provenance,
        hints: payload.hints,
        story: payload.story,
      }),
    );
    for (const changed of [
      { ...payload, story: "edited" },
      { ...payload, hints: ["edited"] },
      { ...payload, provenance: { seed: 2 } },
      { ...payload, fixtures: [19] },
      { ...payload, visual: { rotation: 21 } },
    ])
      expect(await digest(changed)).not.toBe(await digest(payload));
  });
  const reviewers: Reviewer[] = [
    {
      id: "math-human",
      kind: "human",
      qualifications: "maths reviewer",
      roles: ["mathematical"],
    },
    {
      id: "teaching-human",
      kind: "human",
      qualifications: "pedagogy reviewer",
      roles: ["pedagogical"],
    },
  ];
  const records: ReviewRecord[] = reviewers.map((r, i) => ({
    reviewerId: r.id,
    role: i === 0 ? "mathematical" : "pedagogical",
    digest: "exact",
    decision: "approve",
    evidence: "Synthetic test fixture only",
    warningDispositions: ["prose"],
  }));
  it("requires independent qualified humans, exact hashes and warning dispositions", () => {
    expect(() =>
      assertApprovals("exact", ["author"], ["prose"], reviewers, records),
    ).not.toThrow();
    expect(() =>
      assertApprovals("edited", ["author"], [], reviewers, records),
    ).toThrow();
    expect(() =>
      assertApprovals("exact", ["math-human"], [], reviewers, records),
    ).toThrow();
    expect(() =>
      assertApprovals("exact", [], ["unresolved"], reviewers, records),
    ).toThrow();
    expect(() => assertApprovals("exact", [], [], [], records)).toThrow();
    expect(() =>
      assertApprovals("exact", [], [], reviewers, [
        ...records,
        { ...records[0], decision: "changes" },
      ]),
    ).toThrow();
  });
});
