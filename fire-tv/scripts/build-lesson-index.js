/**
 * Snapshots the web app's lesson packages (../content/lessons/*.json) into
 * src/generated/lessons.json so the TV bundle can import them statically.
 * Metro cannot require files dynamically, so this runs before the bundle.
 *
 * Only the `lesson` payload and the evidence status are kept; the review
 * status stays "draft" and is surfaced in the UI.
 */
const fs = require('fs');
const path = require('path');

const lessonsDir = path.resolve(__dirname, '../../content/lessons');
const outFile = path.resolve(__dirname, '../src/generated/lessons.json');

const entries = fs
  .readdirSync(lessonsDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(lessonsDir, name), 'utf8'));
    if (!pkg.lesson || !pkg.lesson.id) {
      throw new Error(`${name}: missing lesson payload`);
    }
    return {
      file: name,
      evidenceStatus: pkg.curriculum?.evidenceStatus ?? 'unknown',
      lesson: pkg.lesson,
    };
  });

fs.mkdirSync(path.dirname(outFile), {recursive: true});
fs.writeFileSync(outFile, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Wrote ${entries.length} lessons to ${path.relative(process.cwd(), outFile)}`);
