const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {
  getKeplerCompatibilityMetroConfig,
} = require('@amazon-devices/kepler-compatibility-metro-config');

// The TV app reuses the web app's pure lesson engine (../src/core, ../src/topics)
// and lesson packages (../content/lessons), so Metro must watch the repository root.
const repoRoot = path.resolve(__dirname, '..');

// package.json aliases the Kepler fork as `react-native`; Metro cannot resolve that
// bare specifier through the alias, so map it to the installed folder explicitly.
const reactNativePath = path.resolve(__dirname, 'node_modules/@amazon-devices/react-native-kepler');

const config = {
  watchFolders: [repoRoot],
  resolver: {
    // Babel helpers injected into ../src resolve from here, not from the repo root.
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
        const subpath = moduleName.slice('react-native'.length);
        return context.resolveRequest(context, reactNativePath + subpath, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(
  getDefaultConfig(__dirname),
  getKeplerCompatibilityMetroConfig(),
  config,
);
