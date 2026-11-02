import { expect, test } from 'bun:test';
import { isSidebarActive } from '../client/src/lib/navigation.ts';
test('only matching marketplace filter is current; route descendants keep editor active', () => {
  const targets = [
    '/marketplace',
    '/marketplace?type=font',
    '/marketplace?type=mockup3d',
    '/marketplace?type=motion',
  ];
  expect(targets.filter((to) => isSidebarActive(to, '/marketplace', '?type=font'))).toEqual([
    '/marketplace?type=font',
  ]);
  expect(targets.filter((to) => isSidebarActive(to, '/marketplace', '?q=shirt'))).toEqual([
    '/marketplace',
  ]);
  expect(isSidebarActive('/editor/scene', '/editor/scene/abc', '')).toBe(true);
  expect(isSidebarActive('/editor/scene', '/editor/scenery', '')).toBe(false);
});
