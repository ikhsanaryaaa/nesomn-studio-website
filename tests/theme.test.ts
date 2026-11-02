import { expect, test } from 'bun:test';
import { resolveTheme, readThemePreference } from '../packages/shared/src/theme.ts';
import { setThemePreference, subscribeTheme } from '../packages/shared/src/theme.ts';

test('system tracks OS, explicit theme overrides; invalid/storage failures safely fall back', () => {
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
  expect(readThemePreference({ getItem: () => 'invalid' })).toBe('system');
  expect(readThemePreference({ getItem: () => 'dark' })).toBe('dark');
  expect(
    readThemePreference({
      getItem: () => {
        throw Error('Blocked');
      },
    }),
  ).toBe('system');
});

test('controller tracks storage/OS, blocked storage retains session choice, cleanup removes listeners', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const media = Object.assign(new EventTarget(), { matches: false });
  let stored: string | null = null,
    blocked = false,
    notifications = 0;
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    localStorage: {
      getItem: () => {
        if (blocked) throw Error('Blocked');
        return stored;
      },
      setItem: (_key: string, value: string) => {
        if (blocked) throw Error('Blocked');
        stored = value;
      },
    },
  });
  const element = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: element },
    configurable: true,
  });
  let cleanup: (() => void) | undefined;
  try {
    cleanup = subscribeTheme(() => notifications++);
    expect(element.dataset.theme).toBe('light');
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    expect(element.dataset.theme).toBe('dark');
    setThemePreference('light');
    expect(stored).toBe('light');
    expect(element.style.colorScheme).toBe('light');
    stored = 'dark';
    win.dispatchEvent(new Event('storage'));
    expect(element.dataset.theme).toBe('dark');
    blocked = true;
    setThemePreference('light');
    expect(readThemePreference()).toBe('light');
    media.dispatchEvent(new Event('change'));
    expect(element.dataset.theme).toBe('light');
    cleanup();
    const before = notifications;
    win.dispatchEvent(new Event('storage'));
    media.dispatchEvent(new Event('change'));
    win.dispatchEvent(new Event('nesomn-theme-change'));
    expect(notifications).toBe(before);
  } finally {
    cleanup?.();
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
