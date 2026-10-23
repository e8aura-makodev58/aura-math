/// <reference types="vite/client" />
import { parsePackage } from "./package-validation";
export { validateLesson } from "./validation";
const sources = import.meta.glob(
  ["../../content/lessons/*.json", "../../content/examples/**/*.json"],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);
const preferred = [
  "ribbon-collection",
  "garden-pots",
  "shell-discovery",
  "corner-detective",
  "angle-opening",
  "right-angle-hunt",
];
export const packages = Object.values(sources)
  .map((input) => {
    const result = parsePackage(input as string);
    if (!result.package)
      throw new Error(
        result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"),
      );
    return result.package;
  })
  .sort((a, b) => {
    const ai = preferred.indexOf(a.lesson.id),
      bi = preferred.indexOf(b.lesson.id);
    return (
      (ai < 0 ? preferred.length : ai) - (bi < 0 ? preferred.length : bi) ||
      a.lesson.id.localeCompare(b.lesson.id)
    );
  });
const identities = new Set<string>();
for (const p of packages) {
  const identity = p.lesson.id;
  if (identities.has(identity))
    throw new Error(`Duplicate lesson identity: ${identity}`);
  identities.add(identity);
}
export const lessons = packages.map((p) => p.lesson);
