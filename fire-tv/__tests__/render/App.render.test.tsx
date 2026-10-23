import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import type {HardwareKeyEvent} from '../../src/engine/remote';

/**
 * Renders the real App tree through react-test-renderer. The Kepler TV event
 * hook needs native input, so it is replaced with a capture that tests call
 * with simulated remote presses.
 */
let handler: ((event: HardwareKeyEvent) => void) | null = null;

jest.mock('@amazon-devices/react-native-kepler', () => ({
  useTVEventHandler: (callback: (event: HardwareKeyEvent) => void) => {
    handler = callback;
  },
}));

import App from '../../src/App';

function press(renderer: ReactTestRenderer, eventType: string) {
  act(() => {
    handler?.({eventType, eventKeyAction: 0});
  });
  return renderer;
}

function allText(renderer: ReactTestRenderer): string {
  const strings: string[] = [];
  const walk = (node: ReactTestRenderer['root']) => {
    node.children.forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else walk(child as ReactTestRenderer['root']);
    });
  };
  walk(renderer.root);
  return strings.join('|');
}

describe('Fire TV App', () => {
  it('renders the home screen with branding and the draft notice', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<App />);
    });
    const text = allText(renderer);
    expect(text).toContain('Aura Math');
    expect(text).toContain('Little steps, bright ideas');
    expect(text).toContain('Draft lessons. They have not been reviewed by a teacher yet.');
  });

  it('walks from home to a question and shows the feedback area after a press', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<App />);
    });
    press(renderer, 'select');
    expect(allText(renderer)).toContain('Choose a topic');
    press(renderer, 'select');
    expect(allText(renderer)).toMatch(/Comparison|Angles|Picture graphs|Fractions/);
    press(renderer, 'select');
    expect(allText(renderer)).toContain('Which relationship fits the story?');
    expect(allText(renderer)).toContain('Choose an answer, then press OK.');
    press(renderer, 'select');
    expect(allText(renderer)).toMatch(/That fits|Not quite yet/);
  });
});
