/**
 * Builds the Fire TV JavaScript bundle (build/index.bundle).
 * Refreshes the lesson snapshot first so the bundle matches content/lessons.
 */
const {spawnSync} = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (command, args) => {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(process.execPath, [path.join(__dirname, 'build-lesson-index.js')]);
run(process.execPath, [
  path.join(root, 'node_modules/.bin/react-native'),
  'bundle',
  '--platform', 'kepler',
  '--dev', 'false',
  '--entry-file', 'index.js',
  '--bundle-output', 'build/index.bundle',
  '--assets-dest', 'build/assets',
]);
