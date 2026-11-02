import { useEffect, useState, type ReactNode } from 'react';
import { Theme } from '@radix-ui/themes';
import { subscribeTheme } from '@nesomn/shared/theme';

function currentAppearance(): 'light' | 'dark' {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';
}

/** One appearance source for page CSS, Themes controls and portaled surfaces. */
export function AppTheme({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(currentAppearance);
  useEffect(() => subscribeTheme(() => setAppearance(currentAppearance())), []);
  return (
    <Theme
      appearance={appearance}
      accentColor="orange"
      grayColor="sand"
      radius="large"
      scaling="100%"
      panelBackground="solid"
      hasBackground={false}
      className="nesomn-theme-root"
    >
      {children}
    </Theme>
  );
}
