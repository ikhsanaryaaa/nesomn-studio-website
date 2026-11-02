import { useEffect, useState } from 'react';
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@nesomn/shared/theme';
export function useAdminTheme() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  useEffect(
    () => subscribeTheme(() => setDark(document.documentElement.dataset.theme === 'dark')),
    [],
  );
  return dark;
}
export function AdminThemeControl() {
  const [mode, setMode] = useState(readThemePreference);
  useEffect(() => subscribeTheme(() => setMode(readThemePreference())), []);
  return (
    <select
      className="theme-select"
      aria-label="Admin appearance"
      value={mode}
      onChange={(e) => {
        const value = e.target.value as ThemePreference;
        setMode(value);
        setThemePreference(value);
      }}
    >
      <option value="system">System theme</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}
