#!/usr/bin/env node
// Audit source characters against real font cmap data from fontconfig's fc-query.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const roots = ["src", "content"];
const sourceExtensions = new Set([".ts", ".css", ".html", ".json", ".mjs"]);
const checks = new Set("0123456789OoIl+−×÷=<>≤≥%.,°¼½¾←→↗");
// These characters have an explicit symbol-font fallback or code-native treatment.
const documentedFallbacks = new Set("←→↗≤≥●✓✳");
const observed = new Map();

function scan(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) scan(file);
    else if (sourceExtensions.has(path.extname(file))) {
      for (const char of readFileSync(file, "utf8")) {
        if (char.codePointAt(0) < 128) continue;
        checks.add(char);
        observed.set(char, (observed.get(char) ?? 0) + 1);
      }
    }
  }
}

for (const root of roots) scan(root);
const order = (a, b) => a.codePointAt(0) - b.codePointAt(0);
const render = (char) =>
  `${char} U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
console.log("Observed non-ASCII characters in src/ and content/:");
for (const char of [...observed.keys()].sort(order))
  console.log(`  ${render(char)} ${observed.get(char)} occurrence(s)`);

if (process.argv.includes("--inventory-only")) process.exit(0);
const file =
  process.argv[2] === "--charset-stdin" ? process.argv[3] : undefined;
if (!file) {
  console.error(
    "Usage: fc-query -f '%{charset}' font.woff2 | node scripts/font-audit.mjs --charset-stdin font.woff2",
  );
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`Font file missing: ${file}`);
  process.exit(2);
}
const charset = readFileSync(0, "utf8").trim();
if (!charset) {
  console.error(
    "No charset received from fc-query; check the font binary and fontconfig.",
  );
  process.exit(2);
}
const ranges = charset
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => {
    const [start, end = start] = part.split("-");
    return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
  });
const missing = [...checks].filter((char) => {
  const code = char.codePointAt(0);
  return !ranges.some(([start, end]) => code >= start && code <= end);
});
console.log(
  `${file}: ${missing.length ? `missing ${missing.length} checked glyph(s)` : "all checked glyphs present"}`,
);
const fallbackMissing = missing.filter((char) => documentedFallbacks.has(char));
const unexpected = missing.filter((char) => !documentedFallbacks.has(char));
if (fallbackMissing.length)
  console.log(
    `  documented fallbacks: ${fallbackMissing.sort(order).map(render).join(", ")}`,
  );
if (unexpected.length)
  console.error(
    `  unexpected missing glyphs: ${unexpected.sort(order).map(render).join(", ")}`,
  );
process.exitCode = unexpected.length ? 1 : 0;
