import { runEnd, MODES } from "./sweep";
const t0 = Date.now();
const r = runEnd("cube", 0, 64);
console.log(Date.now() - t0, "ms");
for (const [k, v] of Object.entries(r)) for (const m of MODES) console.log(k, m, JSON.stringify(v[m]));
