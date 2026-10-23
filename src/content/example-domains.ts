/** Saved-example domains only. No import from the approved learner entry. */
import type { LessonPackage } from "./package-validation";
import { variantCandidates } from "../practice/generation";
import { CUBE_NETS, orientations } from "../practice/family-domains";
import { netMenu, netsAuthor } from "../authoring/nets";
import { demoScript } from "../topics/nets-bench";
import { SHAPE_IDS } from "../topics/symmetry";
import { SOLID_IDS } from "../topics/nets";
import { gcd } from "../topics/exact";
import { runtimeTopics } from "../topics/registry";
type Spec = Record<string, unknown>;
const letters = (net: string, shift: number) => {
  let at = shift;
  return net.replace(/#/g, () => "ABCDEF"[at++ % 6]);
};
export function exampleCandidates(parent: LessonPackage): Spec[] {
  const s = parent.lesson.specification;
  let out: Spec[];
  switch (parent.lesson.id) {
    case "p4-solid-from-net":
    case "p4-fold-a-solid":
      out = SOLID_IDS.flatMap((solid) =>
        [0, 1, 2, 3].flatMap((rotation) =>
          s.task === "fold-solid"
            ? SOLID_IDS.filter((demoSolid) => demoSolid !== solid).map(
                (demoSolid) => ({ ...s, solid, demoSolid, rotation }),
              )
            : [{ ...s, solid, rotation }],
        ),
      );
      break;
    case "p4-fold-a-cube-net":
    case "p4-fold-a-net-that-fails": {
      const pool =
        s.task === "fold"
          ? CUBE_NETS
          : netMenu()
              .filter((n) => !n.valid)
              .map((n) => n.net);
      out = pool.flatMap((net) =>
        orientations(net).flatMap((net) =>
          [0, 1, 2, 3, 4, 5].flatMap((shift) =>
            [..."ABCDEF"].map((face) => ({
              ...s,
              nets: [
                letters(net, shift),
                s.nets instanceof Array ? s.nets[1] : "",
              ],
              face,
              ...(s.task === "fold"
                ? { second: "ABCDEF"[("ABCDEF".indexOf(face) + 2) % 6] }
                : {}),
            })),
          ),
        ),
      );
      break;
    }
    case "p4-protractor-bench-read":
    case "p4-protractor-bench-draw":
      out = Array.from({ length: 33 }, (_, i) => (i + 2) * 5).flatMap(
        (degrees) => [false, true].map((flip) => ({ ...s, degrees, flip })),
      );
      break;
    case "p4-mirror-line-bench":
    case "p4-lines-of-symmetry":
      out = SHAPE_IDS.flatMap((shape) =>
        [0, 1, 2, 3].map((rotation) => ({ ...s, shape, rotation })),
      );
      break;
    case "p4-shade-to-complete-bench":
      out = ["vertical", "horizontal"].flatMap((mirror) =>
        Array.from({ length: 12 }, (_, offset) => {
          const rows = Number(s.rows),
            cols = Number(s.cols);
          const half = (rows * cols) / 2;
          const cells = Array.from({ length: 3 + (offset % 4) }, (_, i) => {
            const at = (offset + i * 3) % half;
            return mirror === "vertical"
              ? `${Math.floor(at / (cols / 2))},${at % (cols / 2)}`
              : `${Math.floor(at / cols)},${at % cols}`;
          });
          return { ...s, mirror, cells: [...new Set(cells)], probe: cells[0] };
        }),
      );
      break;
    case "p4-fraction-add-subtract":
      out = [4, 6, 8, 10, 12].flatMap((denominator) =>
        Array.from({ length: denominator - 1 }, (_, i) => i + 1).flatMap(
          (numerator) =>
            Array.from({ length: denominator / 2 - 1 }, (_, i) => i + 1)
              .filter(
                (otherNumerator) =>
                  numerator > 2 * otherNumerator &&
                  gcd(numerator - 2 * otherNumerator, denominator) > 1,
              )
              .map((otherNumerator) => ({
                ...s,
                denominator,
                numerator,
                otherDenominator: denominator / 2,
                otherNumerator,
              })),
        ),
      );
      break;
    default:
      out = variantCandidates(parent)?.candidates ?? [];
  }
  const topic = runtimeTopics[parent.lesson.topic]!;
  const seen = new Set<string>();
  return out.filter((spec) => {
    const key = JSON.stringify(spec);
    if (seen.has(key) || topic.validateSpec(spec).length) return false;
    if (spec.task === "fold" || spec.task === "collide") {
      const lesson = netsAuthor.rewrite({
        ...structuredClone(parent.lesson),
        specification: spec,
      });
      for (const step of lesson.steps.filter((s) => s.goal !== "reflection")) {
        const answer = step.choices!.find((c) => c.id === step.answer)!.label;
        const frames = demoScript(
          step.goal!,
          (spec.nets as string[])[1],
          String(spec.demoFace),
        );
        if (frames.at(-1)?.caption.includes(answer)) return false;
      }
    }
    seen.add(key);
    return true;
  });
}
