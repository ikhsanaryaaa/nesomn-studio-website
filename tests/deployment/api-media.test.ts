import { expect, test } from 'bun:test';
import { legacyEditorImageKey } from '../../api/src/lib/legacy-editor-image';
test('absolute local signed identity accepts configured API only; authorization remains server-side', () => {
  const previous = process.env.API_URL;
  process.env.API_URL = 'https://api.nesomn.studio';
  try {
    expect(
      legacyEditorImageKey('https://api.nesomn.studio/files/paid%2Fbase.png?token=expired&exp=1'),
    ).toBe('paid/base.png');
    expect(
      legacyEditorImageKey('https://evil.test/files/paid%2Fbase.png?token=expired&exp=1'),
    ).toBeNull();
    expect(
      legacyEditorImageKey('https://user@api.nesomn.studio/files/base.png?token=x&exp=1'),
    ).toBeNull();
  } finally {
    if (previous === undefined) delete process.env.API_URL;
    else process.env.API_URL = previous;
  }
});
