import { useEffect, useState } from 'react';
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@nesomn/shared/theme';

export function ThemeControl() {
  const [mode, setMode] = useState(readThemePreference);
  useEffect(() => subscribeTheme(() => setMode(readThemePreference())), []);
  return (
    <select
      className="theme-select"
      aria-label="Tema tampilan"
      value={mode}
      onChange={(e) => {
        const value = e.target.value as ThemePreference;
        setMode(value);
        setThemePreference(value);
      }}
    >
      <option value="system">Tema sistem</option>
      <option value="light">Terang</option>
      <option value="dark">Gelap</option>
    </select>
  );
}
