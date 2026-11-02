import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../packages/shared/src/theme.css', import.meta.url), 'utf8');
const luminance = (hex) => {
  const v = hex
    .match(/[a-f\d]{2}/gi)
    .map((x) => parseInt(x, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
for (const [theme, block] of [
  ['light', css.split(":root[data-theme='dark']")[0]],
  ['dark', css.split(":root[data-theme='dark']")[1]],
])
  test(theme + ' semantic foreground/accent/focus meet contrast', () => {
    const tokens = Object.fromEntries(
      [...block.matchAll(/--color-([\w-]+):\s*(#[a-f\d]{6})/gi)].map((m) => [m[1], m[2]]),
    );
    const ratio = (a, b) => {
      const x = luminance(tokens[a]),
        y = luminance(tokens[b]);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const fg of ['foreground', 'muted-foreground', 'faint-foreground'])
      for (const bg of ['background', 'surface', 'surface-2'])
        assert.ok(ratio(fg, bg) >= 4.5, `${theme} ${fg}/${bg}: ${ratio(fg, bg)}`);
    assert.ok(ratio('accent-foreground', 'accent') >= 4.5);
    assert.ok(ratio('accent', 'accent-subtle') >= 4.5);
    assert.ok(ratio('accent', 'background') >= 3);
  });
