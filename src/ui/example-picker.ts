import type { LibraryIndex } from "../library/catalogue";
import type { LessonPackage } from "../content/package-validation";
export function savedInstances(
  index: LibraryIndex,
  parent: string,
  available: readonly LessonPackage[],
): LessonPackage[] {
  const ids = [
    parent,
    ...(index.lessons.find((l) => l.lessonId === parent)?.examples ?? []),
  ];
  return ids
    .map((id) => available.find((p) => p.lesson.id === id))
    .filter((p): p is LessonPackage => !!p);
}
export function readExampleNumber(hash: string, count: number): number {
  const value =
    new URLSearchParams(hash.split("?")[1] ?? "").get("example") ?? "1";
  const n = /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(n) && n >= 1 && n <= count ? n : 1;
}
export function withExample(route: string, number: number): string {
  const [path, query] = route.split("?");
  const params = new URLSearchParams(query ?? "");
  if (number > 1) params.set("example", String(number));
  else params.delete("example");
  return `${path}${params.size ? `?${params}` : ""}`;
}
export function mountExamplePicker(
  root: HTMLElement,
  options: {
    number: number;
    count: number;
    temporary?: boolean;
    onChange(number: number): void;
  },
) {
  root.querySelector(".saved-example-picker")?.remove();
  if (options.count <= 1) return;
  const nav = document.createElement("nav");
  nav.className = "saved-example-picker";
  nav.setAttribute("aria-label", "Saved examples");
  const label = document.createElement("span");
  label.textContent = options.temporary
    ? "Fresh preview variant · choose a saved example below"
    : `Example ${options.number} of ${options.count} · saved`;
  const button = (text: string, number: number, disabled: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.disabled = disabled;
    b.addEventListener("click", () => options.onChange(number));
    return b;
  };
  nav.append(
    label,
    button("← Previous", options.number - 1, options.number === 1),
    button(
      "Next example →",
      options.number + 1,
      options.number === options.count,
    ),
  );
  // The lesson canvas is hidden on the completion screen, so the picker moves there and the
  // learner can go straight on to the next saved example.
  const completion = root.querySelector<HTMLElement>(".completion");
  const actions = completion?.querySelector(".completion-actions");
  const heading = root.querySelector(".workspace-heading");
  if (completion && !completion.hidden && actions) actions.before(nav);
  else if (heading) heading.after(nav);
  else root.prepend(nav);
}
