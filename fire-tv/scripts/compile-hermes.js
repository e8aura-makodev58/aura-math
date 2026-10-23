/**
 * Compiles build/index.bundle to Hermes bytecode (build/index.hbc) with the
 * hermesc binary shipped in the Vega fork. hermesc is very chatty about
 * duplicate definitions, so only a summary is printed; the full log is kept in build/hermesc.log.
 */
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sdk = path.join(root, 'node_modules/@amazon-devices/react-native-kepler/sdks/hermesc');
const binary = process.platform === 'darwin'
  ? path.join(sdk, 'osx-bin/hermesc')
  : path.join(sdk, 'linux64-bin/hermesc');
const bundle = path.join(root, 'build/index.bundle');
const bytecode = path.join(root, 'build/index.hbc');

if (!fs.existsSync(bundle)) {
  console.error('build/index.bundle is missing. Run `npm run bundle` first.');
  process.exit(1);
}

const result = spawnSync(binary, ['-emit-binary', '-out', bytecode, '-O', bundle], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
fs.writeFileSync(path.join(root, 'build/hermesc.log'), log);

const warnings = (log.match(/: warning:/g) ?? []).length;
const errors = (log.match(/: error:/g) ?? []).length;
console.log(`hermesc exit=${result.status} warnings=${warnings} errors=${errors} log=build/hermesc.log`);
if (result.status !== 0 || !fs.existsSync(bytecode)) process.exit(result.status || 1);
console.log(`Wrote ${path.relative(root, bytecode)}`);
