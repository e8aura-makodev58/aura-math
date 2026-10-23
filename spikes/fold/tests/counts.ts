import { classify, fixedOrientations, freeHexominoes, rotationClasses, rolledCoincidences } from "../nets-model";
const free = freeHexominoes();
const cls: Record<string, number> = {};
let fixedCube = 0, rotCube = 0, fixedCol = 0, rotCol = 0;
for (const f of free) {
  const c = classify(f);
  cls[c] = (cls[c] ?? 0) + 1;
  if (c === "cube") { fixedCube += fixedOrientations(f).length; rotCube += rotationClasses(f).length; }
  if (c === "collide1") { fixedCol += fixedOrientations(f).length; rotCol += rotationClasses(f).length; }
}
console.log(free.length, cls, { fixedCube, rotCube, fixedCol, rotCol });
void rolledCoincidences;
