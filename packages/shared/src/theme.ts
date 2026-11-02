export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_KEY = 'nesomn-theme';
let volatilePreference: ThemePreference | undefined;
export function readThemePreference(storage?: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const value = (storage ?? window.localStorage).getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return storage ? 'system' : (volatilePreference ?? 'system');
  }
}
export function resolveTheme(mode: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
}
export function applyTheme() {
  const theme = resolveTheme(
    readThemePreference(),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function setThemePreference(mode: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_KEY, mode);
    volatilePreference = undefined;
  } catch {
    volatilePreference = mode;
  }
  document.documentElement.dataset.theme = resolveTheme(
    mode,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
  window.dispatchEvent(new Event('nesomn-theme-change'));
}
export function subscribeTheme(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const external = () => {
    applyTheme();
    listener();
  };
  window.addEventListener('storage', external);
  media.addEventListener('change', external);
  window.addEventListener('nesomn-theme-change', listener);
  applyTheme();
  return () => {
    window.removeEventListener('storage', external);
    media.removeEventListener('change', external);
    window.removeEventListener('nesomn-theme-change', listener);
  };
}
