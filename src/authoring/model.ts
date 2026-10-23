import type {
  LessonPackage,
  ValidationIssue,
} from "../content/package-validation";
import { validatePackage } from "../content/package-validation";
import { derivePackageModel, rewritePackageWording } from "../content/wording";
import { packages } from "../content/lessons";
import { canonicalJson, digest } from "../content-release";
import { intrinsicLibrary } from "../library/catalogue";
import { runtimeTopics } from "../topics/registry";
import { authorTopics } from "./registry";
import type { TopicId } from "../core/types";
import type { AnglesSpec } from "../topics/angles";

export type AuthorCommand =
  | { kind: "topic"; key: string; value: string | number }
  | {
      kind: "text";
      field:
        | "title"
        | "objective"
        | "story"
        | "stepTitle"
        | "prompt"
        | "hint"
        | "choice";
      value: string;
      stepIndex?: number;
      hintIndex?: number;
      choiceId?: string;
    }
  | {
      kind: "comparison";
      field:
        | "smaller"
        | "difference"
        | "largerName"
        | "smallerName"
        | "unit"
        | "unknown";
      value: string | number;
    }
  | {
      kind: "angle";
      cardId: string;
      field: "degrees" | "rotation" | "label";
      value: string | number;
    }
  | { kind: "reflectionAnswer"; choiceId: string }
  | { kind: "reorder"; stepIndex: number; choiceId: string; direction: -1 | 1 }
  | { kind: "details"; field: "level" | "source"; value: string };
export interface WordingFlag {
  path: string;
  message: string;
  createdAt: string;
  acknowledgedAt?: string;
  required?: boolean;
}
export interface WordingChange {
  path: string;
  before: string;
  after: string;
}
interface Snapshot {
  working: LessonPackage;
  lastValid: LessonPackage;
  flags: WordingFlag[];
  contributor: string;
  difference: string | number;
}

function numeric(value: string | number): string | number {
  return typeof value === "number"
    ? Number.isFinite(value)
      ? value
      : String(value)
    : /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
      ? Number(value)
      : value;
}
function textBlocks(p: LessonPackage): Record<string, string> {
  const l = p.lesson,
    result: Record<string, string> = { "$.lesson.story": l.story };
  l.steps.forEach((s, i) => {
    result[`$.lesson.steps[${i}].prompt`] = s.prompt;
    s.hints.forEach((h, j) => (result[`$.lesson.steps[${i}].hints[${j}]`] = h));
    s.choices?.forEach((c, j) => {
      result[`$.lesson.steps[${i}].choices[${j}].label`] = c.label;
    });
  });
  return result;
}
function equalPayload(a: unknown, b: unknown): boolean {
  try {
    return canonicalJson(a) === canonicalJson(b);
  } catch {
    return (
      JSON.stringify(a, (_k, v) =>
        typeof v === "number" && !Number.isFinite(v)
          ? { invalidNumber: String(v) }
          : v === undefined
            ? { invalidValue: "undefined" }
            : v,
      ) ===
      JSON.stringify(b, (_k, v) =>
        typeof v === "number" && !Number.isFinite(v)
          ? { invalidNumber: String(v) }
          : v === undefined
            ? { invalidValue: "undefined" }
            : v,
      )
    );
  }
}
function differences(a: unknown, b: unknown, path = "$"): string[] {
  if (equalPayload(a, b)) return [];
  if (Array.isArray(a) && Array.isArray(b))
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
      a[i] === undefined || b[i] === undefined
        ? [`${path}[${i}]`]
        : differences(a[i], b[i], `${path}[${i}]`),
    ).flat();
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(
      (key) => {
        const av = (a as Record<string, unknown>)[key],
          bv = (b as Record<string, unknown>)[key];
        return av === undefined || bv === undefined
          ? [`${path}.${key}`]
          : differences(av, bv, `${path}.${key}`);
      },
    );
  return [path];
}

export class AuthorModel {
  private draft: LessonPackage;
  private valid: LessonPackage;
  private readonly baseline: LessonPackage;
  private readonly source: LessonPackage;
  private flags: WordingFlag[] = [];
  private author = "author-local";
  private difference: string | number;
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private group: string | null = null;
  private grouped = false;
  private readonly isNew: boolean;
  constructor(
    p: LessonPackage,
    origin?: LessonPackage,
    options: { isNew?: boolean } = {},
  ) {
    const result = validatePackage(p);
    if (!result.package)
      throw new Error("Open a structurally valid lesson package.");
    this.draft = structuredClone(p);
    this.valid = structuredClone(p);
    this.baseline = structuredClone(p);
    this.source = structuredClone(origin ?? p);
    this.isNew = !!options.isNew;
    this.difference =
      Number(p.lesson.specification.larger) -
      Number(p.lesson.specification.smaller);
  }
  get working(): LessonPackage {
    return structuredClone(this.draft);
  }
  get lastValid(): LessonPackage {
    return structuredClone(this.valid);
  }
  get origin(): LessonPackage {
    return structuredClone(this.source);
  }
  get contributor(): string {
    return this.author;
  }
  get comparisonDifference(): string | number {
    return this.difference;
  }
  get issues(): ValidationIssue[] {
    const issues = validatePackage(this.draft).issues;
    if (this.draft.lesson.topic === "comparison") {
      const s = this.draft.lesson.specification,
        modelValues = new Set([
          Number(s.larger),
          Number(s.smaller),
          Number(s.larger) - Number(s.smaller),
        ]);
      for (const [path, text] of Object.entries(textBlocks(this.draft)))
        if (
          typeof text === "string" &&
          (text.match(/\b\d+\b/g) ?? []).some(
            (token) => !modelValues.has(Number(token)),
          )
        )
          issues.push({
            path,
            severity: "warning",
            message:
              "This wording contains a number outside the current model; it may be stale.",
            repair:
              "Check its meaning or apply coherent task wording. Equal-valued known quantities are not treated as unknown leaks.",
          });
    }
    return issues;
  }
  get pending(): WordingFlag[] {
    return structuredClone(this.flags.filter((f) => !f.acknowledgedAt));
  }
  get dirty(): boolean {
    return !equalPayload(this.draft, this.baseline) || this.flags.length > 0;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get canUseCandidate(): boolean {
    return (
      !this.issues.some((i) => i.severity === "error") && !this.pending.length
    );
  }
  beginEdit(field = "field"): void {
    if (this.group !== field) {
      this.endEdit();
      this.group = field;
    }
  }
  endEdit(): void {
    this.group = null;
    this.grouped = false;
  }
  private snapshot(): Snapshot {
    return {
      working: structuredClone(this.draft),
      lastValid: structuredClone(this.valid),
      flags: structuredClone(this.flags),
      contributor: this.author,
      difference: this.difference,
    };
  }
  private restore(s: Snapshot): void {
    this.draft = structuredClone(s.working);
    this.valid = structuredClone(s.lastValid);
    this.flags = structuredClone(s.flags);
    this.author = s.contributor;
    this.difference = s.difference;
  }
  private remember(before: Snapshot): void {
    if (!this.group || !this.grouped) {
      this.past.push(before);
      if (this.past.length > 30) this.past.shift();
      this.grouped = !!this.group;
    }
    this.future = [];
  }
  private markEdited(): void {
    if (this.draft.schemaVersion !== 3) {
      this.draft.library = intrinsicLibrary(this.draft);
      this.draft.schemaVersion = 3;
      this.draft.lesson.level = `${this.draft.library.level} candidate`;
    }
    this.draft.lesson.version =
      this.baseline.lesson.version + (this.isNew ? 0 : 1);
    this.draft.provenance = { kind: "authored" };
    if (!this.draft.authors.includes(this.author))
      this.draft.authors.push(this.author);
  }
  private checkPreview(): void {
    const result = validatePackage(this.draft);
    if (
      result.package &&
      !this.flags.some((f) => f.required && !f.acknowledgedAt)
    )
      this.valid = structuredClone(result.package);
  }
  private flag(
    path: string,
    message = "Check wording after this model change.",
    required = false,
  ): void {
    const flag = {
      path,
      message,
      createdAt: new Date().toISOString(),
      ...(required ? { required: true } : {}),
    };
    const existing = this.flags.findIndex((f) => f.path === path);
    if (existing < 0) this.flags.push(flag);
    else this.flags[existing] = flag;
  }
  private flagDependencies(): void {
    for (const path of Object.keys(textBlocks(this.draft))) this.flag(path);
  }
  patch(command: AuthorCommand): void {
    const before = this.snapshot(),
      l = this.draft.lesson;
    if (command.kind === "text") {
      const step = l.steps[command.stepIndex ?? 0];
      switch (command.field) {
        case "title":
        case "objective":
        case "story":
          l[command.field] = command.value;
          break;
        case "stepTitle":
          if (!step) throw new Error("Unknown step");
          step.title = command.value;
          break;
        case "prompt":
          if (!step) throw new Error("Unknown step");
          step.prompt = command.value;
          break;
        case "hint":
          if (
            !step ||
            command.hintIndex === undefined ||
            command.hintIndex < 0 ||
            command.hintIndex > 3
          )
            throw new Error("Unknown hint");
          step.hints[command.hintIndex] = command.value;
          break;
        case "choice": {
          const choice = step?.choices?.find((c) => c.id === command.choiceId);
          if (!choice) throw new Error("Unknown choice");
          choice.label = command.value;
          break;
        }
      }
      if (command.field === "story" && this.draft.interpretation)
        this.draft.interpretation.sourceSpans = [
          { start: 0, end: l.story.length, text: l.story },
        ];
    } else if (command.kind === "comparison") {
      if (l.topic !== "comparison")
        throw new Error("This draft has no comparison model");
      const spec = l.specification;
      if (command.field === "difference") {
        this.difference = numeric(command.value);
        spec.larger =
          typeof spec.smaller === "number" &&
          typeof this.difference === "number"
            ? spec.smaller + this.difference
            : this.difference;
      } else if (command.field === "smaller") {
        spec.smaller = numeric(command.value);
        if (
          typeof spec.smaller === "number" &&
          typeof this.difference === "number"
        )
          spec.larger = spec.smaller + this.difference;
      } else spec[command.field] = command.value;
      this.draft = derivePackageModel(this.draft);
      this.flagDependencies();
      if (command.field === "unknown")
        this.flag(
          "$.lesson.specification.unknown",
          "Apply coherent wording for the changed unknown before using this draft.",
          true,
        );
    } else if (command.kind === "angle") {
      if (l.topic !== "angles")
        throw new Error("This draft has no angle cards");
      const spec = l.specification as unknown as AnglesSpec,
        card = spec.angles.find((a) => a.id === command.cardId);
      if (!card) throw new Error("Unknown card");
      const previousTemplate = rewritePackageWording(this.draft),
        previousReveal = l.steps[0].hints[3];
      if (command.field === "label") card.label = String(command.value);
      else card[command.field] = numeric(command.value) as number;
      this.draft = derivePackageModel(this.draft);
      this.flagDependencies();
      if (previousReveal === previousTemplate.lesson.steps[0].hints[3])
        this.draft.lesson.steps[0].hints[3] = rewritePackageWording(
          this.draft,
        ).lesson.steps[0].hints[3];
    } else if (command.kind === "topic") {
      const capability = authorTopics[l.topic];
      if (!capability) throw new Error("Unsupported topic editor");
      this.draft.lesson = capability.patch(l, command.key, command.value);
      this.draft = derivePackageModel(this.draft);
      // A dimension layout changes no wording, so it raises no wording checks.
      if (command.key !== "annotations") this.flagDependencies();
      if (["task", "targetPlace", "key", "operation"].includes(command.key))
        this.flag(
          "$.lesson.specification",
          "Apply coherent wording for this changed task before trying or exporting.",
          true,
        );
    } else if (command.kind === "reflectionAnswer") {
      const reflection = l.steps.at(-1)!;
      if (!reflection.choices?.some((c) => c.id === command.choiceId))
        throw new Error("Unknown explanation choice");
      reflection.answer = command.choiceId;
      this.draft = derivePackageModel(this.draft);
      this.flag(
        `$.lesson.steps[${l.steps.length - 1}].choices`,
        "Check the authored explanation key and its reveal hints.",
      );
    } else if (command.kind === "reorder") {
      const choices = l.steps[command.stepIndex]?.choices;
      if (!choices) throw new Error("This step has no choices");
      const i = choices.findIndex((c) => c.id === command.choiceId),
        j = i + command.direction;
      if (i < 0 || j < 0 || j >= choices.length) return;
      [choices[i], choices[j]] = [choices[j], choices[i]];
    } else {
      if (command.field === "level") {
        l.level = command.value;
        if (this.draft.library && /^P[234] candidate$/.test(command.value))
          this.draft.library.level = command.value.startsWith("P4")
            ? "P4"
            : command.value.startsWith("P3")
              ? "P3"
              : "P2";
      } else this.draft.curriculum.sources[0] = command.value;
    }
    if (
      equalPayload(before.working, this.draft) &&
      before.difference === this.difference
    ) {
      this.restore(before);
      return;
    }
    this.remember(before);
    this.markEdited();
    this.checkPreview();
  }
  undo(): void {
    const s = this.past.pop();
    if (!s) return;
    this.endEdit();
    this.future.push(this.snapshot());
    this.restore(s);
  }
  redo(): void {
    const s = this.future.pop();
    if (!s) return;
    this.endEdit();
    this.past.push(this.snapshot());
    this.restore(s);
  }
  proposeWording(): WordingChange[] {
    const before = textBlocks(this.draft),
      after = textBlocks(rewritePackageWording(this.draft));
    return Object.entries(after)
      .filter(([path, value]) => value !== before[path])
      .map(([path, after]) => ({ path, before: before[path] ?? "", after }));
  }
  applyWording(): void {
    const capability = runtimeTopics[this.draft.lesson.topic];
    if (
      capability
        ? capability.validateSpec(this.draft.lesson.specification).length
        : this.issues.some((i) => i.severity === "error")
    )
      throw new Error("Correct model values before updating wording.");
    const candidate = rewritePackageWording(this.draft);
    const result = validatePackage(candidate);
    if (!result.package)
      throw new Error(
        result.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; "),
      );
    this.endEdit();
    const before = this.snapshot();
    this.draft = candidate;
    const now = new Date().toISOString();
    this.flags = this.flags.map((f) => ({ ...f, acknowledgedAt: now }));
    this.remember(before);
    this.markEdited();
    this.checkPreview();
  }
  acknowledge(path: string): void {
    const f = this.flags.find((f) => f.path === path && !f.acknowledgedAt);
    if (!f) return;
    if (f.required)
      throw new Error(
        "Use Update wording to apply this unknown-position change.",
      );
    this.endEdit();
    const before = this.snapshot();
    f.acknowledgedAt = new Date().toISOString();
    this.remember(before);
    this.checkPreview();
  }
  setContributor(id: string): void {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(id))
      throw new Error(
        "Use an author ID beginning with a letter, followed by 1–63 lowercase letters, digits or hyphens.",
      );
    if (id === this.author) return;
    this.endEdit();
    const before = this.snapshot();
    this.author = id;
    if (this.dirty) {
      this.markEdited();
      this.checkPreview();
    }
    this.remember(before);
  }
  async report(): Promise<object> {
    let workingDigest: string | null = null;
    const digestErrors: string[] = [];
    try {
      if (this.issues.some((issue) => issue.severity === "error"))
        throw new Error(
          "Working payload is structurally invalid; no candidate digest is available.",
        );
      workingDigest = await digest(this.draft);
    } catch (error) {
      digestErrors.push(error instanceof Error ? error.message : String(error));
    }
    return {
      kind: "author-draft-report",
      createdAt: new Date().toISOString(),
      originDigest: await digest(this.source),
      workingDigest,
      digestErrors,
      origin: structuredClone(this.source),
      working: structuredClone(this.draft),
      changedBlocks: differences(this.source, this.draft),
      validation: this.issues,
      pending: this.pending,
      assertions: structuredClone(this.flags),
      contributor: this.author,
      assertionMeaning:
        "Author wording acknowledgements only; these are not independent review approval or approval-warning dispositions.",
    };
  }
}
export function createAuthorModel(
  p: LessonPackage,
  origin?: LessonPackage,
  options: { isNew?: boolean } = {},
): AuthorModel {
  return new AuthorModel(p, origin, options);
}
export function createTemplate(
  topic: TopicId,
  form: string,
  id: string,
): LessonPackage {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(id))
    throw new Error(
      "Use a stable lesson ID containing lowercase letters, digits and hyphens.",
    );
  const capability = authorTopics[topic];
  if (capability) {
    const p = capability.template(form, id);
    p.schemaVersion = 3;
    return p;
  }
  const base = packages.find(
    (p) =>
      p.lesson.topic === topic &&
      (topic === "comparison"
        ? p.lesson.specification.unknown
        : p.lesson.specification.task) === form,
  );
  if (!base) throw new Error("Unsupported lesson form");
  const p = structuredClone(base);
  p.lesson.id = id;
  p.lesson.version = 1;
  p.lesson.title = "My new lesson";
  p.authors = ["author-local"];
  p.provenance = { kind: "authored" };
  p.library = intrinsicLibrary(base);
  p.schemaVersion = 3;
  p.lesson.level = `${p.library.level} candidate`;
  return rewritePackageWording(p);
}
