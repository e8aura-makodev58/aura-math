/// <reference types="vite/client" />
/**
 * Guards against answer cues that do not need any mathematics: a learner should not be able to
 * pick the right option because it is the longest, the shortest or always in the same place.
 * The oracle is independent of the topic code: it reads the stored answer key of each saved
 * package (and of each fresh variant) and measures label lengths and positions directly.
 */
import { describe, expect, it } from "vitest";
import { packages } from "../src/content/lessons";
import { createVariantRun } from "../src/practice/generation";
import { choiceBalanceIssues } from "../src/topics/p4-kit";

interface Option {
  id: string;
  label: string;
}
interface ChoiceStep {
  id: string;
  kind: string;
  choices?: Option[];
  answer: unknown;
}
interface Pkg {
  lesson: { id: string; steps: ChoiceStep[] };
}
interface Sample {
  where: string;
  kind: string;
  labels: string[];
  correct: number[];
}

const raw = import.meta.glob(
  ["../content/lessons/*.json", "../content/examples/**/*.json"],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;
const saved = Object.values(raw).map((text) => JSON.parse(text) as Pkg);

function samples(pkg: Pkg, where: string): Sample[] {
  const result: Sample[] = [];
  for (const step of pkg.lesson.steps) {
    if (!step.choices || (step.kind !== "choice" && step.kind !== "multi"))
      continue;
    const key = Array.isArray(step.answer) ? step.answer : [step.answer];
    const correct = step.choices
      .map((c, i) => (key.includes(c.id) ? i : -1))
      .filter((i) => i >= 0);
    result.push({
      where: `${where}#${step.id}`,
      kind: step.kind,
      labels: step.choices.map((c) => c.label),
      correct,
    });
  }
  return result;
}

const isSentence = (label: string) => label.length >= 20 && label.includes(" ");
function outOfBand(labels: string[]): boolean {
  const lengths = labels.filter(isSentence).map((l) => l.length);
  if (lengths.length < 2) return false;
  const longest = Math.max(...lengths),
    shortest = Math.min(...lengths);
  return !(longest / shortest <= 1.25 || longest - shortest <= 8);
}

interface Stats {
  steps: number;
  chance: number;
  longest: number;
  shortest: number;
  positions: { observed: number; expected: number }[];
  last: { observed: number; expected: number };
}
function statistics(list: Sample[]): Stats {
  const single = list.filter((s) => s.kind === "choice");
  let chance = 0,
    longest = 0,
    shortest = 0;
  const positions = Array.from({ length: 6 }, () => ({
    observed: 0,
    expected: 0,
  }));
  const last = { observed: 0, expected: 0 };
  for (const s of single) {
    const n = s.labels.length,
      lengths = s.labels.map((l) => l.length),
      mine = lengths[s.correct[0]],
      max = Math.max(...lengths),
      min = Math.min(...lengths);
    chance += 1 / n;
    if (mine === max && lengths.filter((l) => l === max).length === 1)
      longest++;
    if (mine === min && lengths.filter((l) => l === min).length === 1)
      shortest++;
    for (let i = 0; i < n && i < positions.length; i++)
      positions[i].expected += 1 / n;
    if (s.correct[0] < positions.length) positions[s.correct[0]].observed++;
    last.expected += 1 / n;
    if (s.correct[0] === n - 1) last.observed++;
  }
  return { steps: single.length, chance, longest, shortest, positions, last };
}
const pct = (part: number, whole: number) => (100 * part) / whole;
function report(name: string, s: Stats): string {
  const p = (x: number) => `${pct(x, s.steps).toFixed(1)}%`;
  return [
    `${name}: ${s.steps} single-choice steps; chance ${p(s.chance)}`,
    `  correct is unique longest ${s.longest} (${p(s.longest)}), unique shortest ${s.shortest} (${p(s.shortest)})`,
    `  correct position ${s.positions
      .filter((x) => x.expected > 0)
      .map((x, i) => `${i + 1}: ${p(x.observed)} (chance ${p(x.expected)})`)
      .join(", ")}; last: ${p(s.last.observed)} (chance ${p(s.last.expected)})`,
  ].join("\n");
}
// Two-sided: a share far below chance is a cue too ("never pick the longest").
function expectWithinChance(s: Stats) {
  const chance = pct(s.chance, s.steps);
  for (const share of [s.longest, s.shortest])
    expect(Math.abs(pct(share, s.steps) - chance)).toBeLessThanOrEqual(8);
  for (const x of [...s.positions, s.last])
    expect(
      Math.abs(pct(x.observed, s.steps) - pct(x.expected, s.steps)),
    ).toBeLessThanOrEqual(10);
}

const fromPackages = saved.flatMap((p) => samples(p, p.lesson.id));
// A deterministic sample of fresh examples from every source the generator accepts.
const fromVariants: Sample[] = [];
for (const seed of [7, 20260101])
  for (const source of packages) {
    const run = createVariantRun(structuredClone(source), seed);
    if (!run) continue;
    for (let i = 0; i < 10; i++) {
      const next = run.next();
      if (next.status !== "ready") break;
      fromVariants.push(
        ...samples(
          next.package as unknown as Pkg,
          `${source.lesson.id}@${seed}:${i}`,
        ),
      );
    }
  }

describe("choice balance: length and position carry no answer", () => {
  it("reads a stored answer key for every choice step", () => {
    expect(fromPackages.length).toBeGreaterThan(100);
    expect(fromVariants.length).toBeGreaterThan(50);
    for (const s of [...fromPackages, ...fromVariants]) {
      expect(s.correct.length, s.where).toBeGreaterThan(0);
      if (s.kind === "choice") expect(s.correct.length, s.where).toBe(1);
    }
  });

  it("keeps sentence options in one step within a narrow length band", () => {
    const wide = [...fromPackages, ...fromVariants]
      .filter((s) => outOfBand(s.labels))
      .map((s) => `${s.where}: ${s.labels.map((l) => l.length).join("/")}`);
    expect(wide).toEqual([]);
  });

  it("agrees with the author helper on every saved step", () => {
    for (const s of fromPackages)
      expect(
        choiceBalanceIssues(s.labels.map((label) => ({ label }))).length > 0,
        s.where,
      ).toBe(outOfBand(s.labels));
    expect(
      choiceBalanceIssues([
        { label: "A careful and fully qualified explanation of the idea." },
        { label: "A blunt and wrong idea." },
      ]),
    ).toHaveLength(1);
    expect(
      choiceBalanceIssues([{ label: "Tens" }, { label: "Hundreds" }]),
    ).toEqual([]);
  });

  it("keeps the longest, the shortest and each position near chance in the library", () => {
    const stats = statistics(fromPackages);
    console.info(report("Saved lesson packages", stats));
    expectWithinChance(stats);
  });

  it("keeps the longest, the shortest and each position near chance in fresh variants", () => {
    const stats = statistics(fromVariants);
    console.info(report("Fresh variants (seeds 7 and 20260101)", stats));
    expectWithinChance(stats);
  });
});
