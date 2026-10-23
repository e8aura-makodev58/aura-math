import type { Adapter, Lesson, Step } from "../core/types";
import type { RuntimeTopic } from "./capability";
import { applyAnswer, assess, resetAnswer } from "./shared";
export interface GraphCategory {
  id: string;
  label: string;
  count: number;
}
export interface PictureGraphsSpec {
  task: "read" | "compare" | "total";
  key: number;
  introductory?: boolean;
  categories: GraphCategory[];
  target: string;
  other?: string;
}
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function validatePictureGraphsSpec(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Picture graph specification must be an object."];
  const s = input as PictureGraphsSpec;
  const errors: string[] = [];
  if (
    Object.keys(s).some(
      (k) =>
        ![
          "task",
          "key",
          "introductory",
          "categories",
          "target",
          "other",
        ].includes(k),
    )
  )
    errors.push("Unknown graph field.");
  if (!["read", "compare", "total"].includes(s.task))
    errors.push("Unsupported graph task.");
  if (
    ![2, 5].includes(s.key) &&
    !(s.key === 1 && s.introductory === true && s.task === "read")
  )
    errors.push(
      "Scaled graphs use keys 2 or 5; key 1 needs an introductory reading task.",
    );
  if (s.introductory !== undefined && typeof s.introductory !== "boolean")
    errors.push("Invalid introductory flag.");
  if (
    !Array.isArray(s.categories) ||
    s.categories.length < 2 ||
    s.categories.length > 4
  )
    return [...errors, "Use 2–4 graph categories."];
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const c of s.categories) {
    if (!c || typeof c !== "object") {
      errors.push("Invalid category.");
      continue;
    }
    if (Object.keys(c).some((k) => !["id", "label", "count"].includes(k)))
      errors.push("Unknown category field.");
    if (typeof c.id !== "string" || !c.id || ids.has(c.id))
      errors.push("Category IDs must be unique.");
    ids.add(c.id);
    if (typeof c.label !== "string" || !c.label.trim() || labels.has(c.label))
      errors.push("Category labels must be unique and nonempty.");
    labels.add(c.label);
    if (!Number.isInteger(c.count) || c.count < 0 || c.count > 6)
      errors.push("Full-symbol counts must be integers 0–6.");
  }
  if (!ids.has(s.target)) errors.push("Graph target must name a category.");
  if (s.task === "compare" && (!ids.has(s.other ?? "") || s.other === s.target))
    errors.push("Compare two distinct existing categories.");
  if (s.task !== "compare" && s.other !== undefined)
    errors.push("Other category is only used for comparison.");
  return errors;
}
export function pictureGraphsAnswer(
  s: PictureGraphsSpec,
  step: Step,
): Step["answer"] {
  const goal = step.goal ?? step.id;
  const a = s.categories.find((c) => c.id === s.target)!;
  const b = s.categories.find((c) => c.id === s.other);
  if (goal === "key") return s.key;
  if (goal === "symbols") return a.count;
  if (goal === "quantity") return a.count * s.key;
  if (goal === "total")
    return s.categories.reduce((n, c) => n + c.count * s.key, 0);
  if (goal === "difference") return Math.abs(a.count - b!.count) * s.key;
  if (goal === "compare") {
    const relation =
      a.count > b!.count ? "target" : a.count < b!.count ? "other" : "same";
    return (
      step.choices?.find((c) => c.meaning === `relation:${relation}`)?.id ?? ""
    );
  }
  if (goal === "reflection") return step.answer;
  return "";
}
export function validatePictureGraphsSteps(l: Lesson): string[] {
  const errors = validatePictureGraphsSpec(l.specification);
  if (errors.length) return errors;
  const s = l.specification as unknown as PictureGraphsSpec;
  const allowed =
    s.task === "compare"
      ? ["key", "difference", "compare", "reflection"]
      : s.task === "read"
        ? ["key", "symbols", "quantity", "reflection"]
        : ["key", "quantity", "total", "reflection"];
  if (
    l.steps.length !== allowed.length ||
    new Set(l.steps.map((st) => st.goal)).size !== allowed.length ||
    allowed.some((goal) => !l.steps.some((st) => st.goal === goal))
  )
    errors.push("Graph lesson must contain each task goal exactly once.");
  for (const step of l.steps) {
    if (!allowed.includes(step.goal ?? step.id))
      errors.push(`Unsupported graph goal ${step.goal}.`);
    if (step.goal === "reflection") continue;
    if (step.kind !== (step.goal === "compare" ? "choice" : "number"))
      errors.push("Graph response kind contradicts goal.");
    if (step.goal === "compare") {
      const meanings = step.choices?.map((c) => c.meaning);
      if (
        !meanings ||
        meanings.length !== 3 ||
        new Set(meanings).size !== 3 ||
        meanings.some(
          (m) =>
            !["relation:target", "relation:other", "relation:same"].includes(
              m ?? "",
            ),
        )
      )
        errors.push(
          "Graph comparison requires the two categories and tie choices.",
        );
    }
    if (step.answer !== pictureGraphsAnswer(s, step) || step.answer === "")
      errors.push(`Answer contradicts graph goal ${step.id}.`);
  }
  return errors;
}
export function describePictureGraphs(s: PictureGraphsSpec): string {
  return `Each full symbol represents ${s.key} items. ${s.categories.map((c) => `${c.label}: ${c.count} full symbols.`).join(" ")}`;
}
const adapter: Adapter = {
  id: "picture-graphs",
  initialState: (l) => ({ specification: structuredClone(l.specification) }),
  apply: applyAnswer,
  resetStep: resetAnswer,
  evaluate: (state, step) =>
    assess(
      state,
      step,
      pictureGraphsAnswer(
        state.specification as unknown as PictureGraphsSpec,
        step,
      ),
    ),
  describe: (state) =>
    describePictureGraphs(state.specification as unknown as PictureGraphsSpec),
};
export const pictureGraphsTopic: RuntimeTopic = {
  id: "picture-graphs",
  label: "Picture graphs",
  visualTitle: "Read the picture graph",
  adapter,
  validateSpec: validatePictureGraphsSpec,
  validateSteps: validatePictureGraphsSteps,
  answer: (l, s) =>
    pictureGraphsAnswer(l.specification as unknown as PictureGraphsSpec, s),
  render: (l) => {
    const s = l.specification as unknown as PictureGraphsSpec;
    return `<div class="picture-graph" role="img" aria-label="${esc(describePictureGraphs(s))}"><p class="graph-key"><strong>Key: ● = ${s.key} items</strong></p>${s.categories.map((c) => `<div class="graph-row"><strong>${esc(c.label)}</strong><span aria-hidden="true">${Array.from({ length: c.count }, () => '<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="#6d977c" stroke="#315c46" stroke-width="2"/></svg>').join("")}${c.count === 0 ? "No symbols" : ""}</span></div>`).join("")}</div><p class="diagram-note">Every symbol is whole. Use the key for every row.</p>`;
  },
};
