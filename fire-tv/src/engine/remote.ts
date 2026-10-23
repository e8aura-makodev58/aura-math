/** Fire TV remote keys used by Aura Math. */
export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'hint';

/** Shape of the Kepler hardware event (see Libraries/TV/TVTypes.d.ts in the Vega fork). */
export interface HardwareKeyEvent {
  eventType?: string;
  /** 0 = key down, 1 = key up. Only key-down presses change the screen. */
  eventKeyAction?: number;
}

const KEY_MAP: Readonly<Record<string, RemoteKey>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  select: 'select',
  enter: 'select',
  back: 'back',
  menu: 'hint',
  info: 'hint',
};

export function remoteKeyFor(event: HardwareKeyEvent): RemoteKey | null {
  if (event.eventKeyAction !== undefined && event.eventKeyAction !== 0) return null;
  if (!event.eventType) return null;
  return KEY_MAP[event.eventType] ?? null;
}
