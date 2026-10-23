const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// The TV app imports the shared engine (../src) and lesson packages (../content), so Metro
// must watch the repository root. Babel helpers injected into those files resolve from here.
const repoRoot = path.resolve(__dirname, '..');
const config = {
  watchFolders: [repoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
