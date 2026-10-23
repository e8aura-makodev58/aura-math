import {remoteKeyFor} from '../src/engine/remote';

describe('remoteKeyFor', () => {
  it.each([
    ['up', 'up'],
    ['down', 'down'],
    ['left', 'left'],
    ['right', 'right'],
    ['select', 'select'],
    ['back', 'back'],
    ['menu', 'hint'],
  ])('maps %s to %s on key down', (eventType, expected) => {
    expect(remoteKeyFor({eventType, eventKeyAction: 0})).toBe(expected);
  });

  it('ignores key-up releases so one press is one action', () => {
    expect(remoteKeyFor({eventType: 'select', eventKeyAction: 1})).toBeNull();
  });

  it('ignores keys Aura Math does not use', () => {
    expect(remoteKeyFor({eventType: 'playpause', eventKeyAction: 0})).toBeNull();
    expect(remoteKeyFor({eventType: 'volume_up', eventKeyAction: 0})).toBeNull();
  });

  it('treats an event without an action as a press', () => {
    expect(remoteKeyFor({eventType: 'up'})).toBe('up');
  });

  it('ignores events without a type', () => {
    expect(remoteKeyFor({})).toBeNull();
  });
});
