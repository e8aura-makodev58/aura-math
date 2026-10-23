// WP0a SPIKE (throwaway): merge shard results and print a table.
import { readdirSync, readFileSync } from "node:fs";
const dir = new URL("./results/", import.meta.url).pathname;
const kinds = process.argv.slice(2);
const total = {};
for (const f of readdirSync(dir).filter((f) => kinds.some((k) => f.startsWith(k + "-")) && f.endsWith(".json"))) {
  const { res } = JSON.parse(readFileSync(dir + f, "utf8"));
  for (const [bucket, modes] of Object.entries(res))
    for (const [mode, s] of Object.entries(modes)) {
      const t = ((total[bucket] ??= {})[mode] ??= { configs: 0, covered: 0, mism: 0, coverageMism: 0, ties: 0, configsAny: 0, configsOver: 0, worst: { frac: 0, desc: "" } });
      for (const k of ["configs", "covered", "mism", "coverageMism", "ties", "configsAny", "configsOver"]) t[k] += s[k];
      if (s.worst.frac > t.worst.frac) t.worst = s.worst;
    }
}
export { total };
if (process.argv[1].endsWith("merge.mjs")) {
  for (const [bucket, modes] of Object.entries(total).sort())
    for (const [mode, s] of Object.entries(modes))
      console.log(
        `${bucket.padEnd(22)} ${mode.padEnd(9)} configs=${s.configs} covered=${s.covered} mism=${s.mism} rate=${((100 * s.mism) / s.covered).toFixed(4)}% cfgAny=${s.configsAny} cfg>0.5%=${s.configsOver} covMism=${s.coverageMism} ties=${s.ties} worst=${(100 * s.worst.frac).toFixed(2)}% [${s.worst.desc}]`,
      );
}
