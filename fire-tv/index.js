import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// The shared engine (../src/core/runtime.ts) clones session state with structuredClone.
// Older Hermes builds do not provide it, so fall back to a JSON copy; the state is plain JSON.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
}

AppRegistry.registerComponent(appName, () => App);
