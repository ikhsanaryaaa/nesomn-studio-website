import { useEffect, useState } from 'react';
import { Button, DropdownMenu as ThemesDropdownMenu } from '@radix-ui/themes';
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@nesomn/shared/theme';

const themes = [
  { value: 'system', label: 'System theme', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

export function ThemeControl() {
  const [mode, setMode] = useState(readThemePreference);
  useEffect(() => subscribeTheme(() => setMode(readThemePreference())), []);
  const current = themes.find((theme) => theme.value === mode) ?? themes[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="surface"
          color="gray"
          size="3"
          className="nesomn-theme-control"
          aria-label="Appearance"
          data-theme-control
        >
          <Icon aria-hidden="true" size={16} />
          <span>{current.label}</span>
          <ChevronDown aria-hidden="true" size={16} className="nesomn-theme-chevron" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-menu">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <ThemesDropdownMenu.RadioGroup
          value={mode}
          onValueChange={(value) => {
            setMode(value as ThemePreference);
            setThemePreference(value as ThemePreference);
          }}
        >
          {themes.map(({ value, label, icon: ThemeIcon }) => (
            <ThemesDropdownMenu.RadioItem
              key={value}
              value={value}
              data-theme-option={value}
              className="nesomn-theme-option"
            >
              <ThemeIcon aria-hidden="true" size={16} />
              <span>{label}</span>
            </ThemesDropdownMenu.RadioItem>
          ))}
        </ThemesDropdownMenu.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
