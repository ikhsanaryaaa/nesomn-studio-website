import { useEffect, useState } from 'react';
import { Select } from '@radix-ui/themes';
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
    <Select.Root
      size="3"
      value={mode}
      onValueChange={(next) => {
        const value = next as ThemePreference;
        setMode(value);
        setThemePreference(value);
      }}
    >
      <Select.Trigger
        data-theme-control
        aria-label="Admin appearance"
        className="admin-theme-select"
      />
      <Select.Content position="popper" className="admin-select-content">
        <Select.Item data-theme-option="system" value="system">
          System theme
        </Select.Item>
        <Select.Item data-theme-option="light" value="light">
          Light
        </Select.Item>
        <Select.Item data-theme-option="dark" value="dark">
          Dark
        </Select.Item>
      </Select.Content>
    </Select.Root>
  );
}
