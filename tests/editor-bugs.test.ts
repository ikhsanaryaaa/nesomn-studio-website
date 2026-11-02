import { afterEach, expect, test } from 'bun:test';
import { useSceneEditor } from '../client/src/stores/scene-editor-store';
import { useScene3DEditor } from '../client/src/stores/scene-3d-store';
import { editorEpoch, setEditorIdentity } from '../client/src/lib/editor-session';
import { api } from '../client/src/lib/api';
import { legacyEditorImageKey, editorImagePath } from '../api/src/lib/legacy-editor-image';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  useSceneEditor.getState().reset();
  useScene3DEditor.getState().reset();
});

test('account transition clears both editors, selection and undo history', () => {
  setEditorIdentity('A');
  useSceneEditor.getState().addText('PRIVATE A');
  useScene3DEditor.getState().addDecal('private-A');
  useScene3DEditor.getState().setModelUrl('private-model');
  const epoch = editorEpoch();
  setEditorIdentity(null);
  setEditorIdentity('B');
  expect(editorEpoch()).toBeGreaterThan(epoch);
  expect(useSceneEditor.getState().objects).toEqual([]);
  expect(useSceneEditor.getState().past).toEqual([]);
  expect(useSceneEditor.getState().selectedId).toBeNull();
  expect(useScene3DEditor.getState().decals).toEqual([]);
  expect(useScene3DEditor.getState().modelUrl).toBeNull();
  useSceneEditor.getState().addText('B draft');
  setEditorIdentity('B');
  expect(useSceneEditor.getState().objects).toHaveLength(1);
});

test('in-flight API response from A cannot be consumed after login B', async () => {
  setEditorIdentity('A');
  let finish!: (r: Response) => void;
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    })) as typeof fetch;
  const request = api.projects.get('A-project');
  setEditorIdentity('B');
  finish(Response.json({ id: 'A-project', title: 'PRIVATE' }));
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});

for (const existing of [false, true]) {
  test(`3D ${existing ? 'update' : 'create'} preserves title/material/decal edits during save`, () => {
    if (existing)
      useScene3DEditor
        .getState()
        .loadState(useScene3DEditor.getState().toState(), 'existing', 'Original');
    const sent = useScene3DEditor.getState();
    const snapshot = structuredClone(sent.toState());
    sent.setTitle('Edited while saving');
    sent.setMaterialColor('#ff6600');
    sent.addDecal('data:image/png;base64,sample');
    expect(sent.markSaved('saved', sent.title, snapshot, sent.documentVersion)).toBe(true);
    const current = useScene3DEditor.getState();
    expect(current.title).toBe('Edited while saving');
    expect(current.materialColor).toBe('#ff6600');
    expect(current.decals).toHaveLength(1);
    expect(current.projectId).toBe('saved');
    expect(current.dirty).toBe(true);
    expect(
      current.markSaved('saved', current.title, current.toState(), current.documentVersion),
    ).toBe(true);
    expect(useScene3DEditor.getState().dirty).toBe(false);
  });
}

test('old 3D save cannot modify a reset or newly loaded document', () => {
  const old = useScene3DEditor.getState();
  const snapshot = old.toState();
  old.reset();
  expect(old.markSaved('old', old.title, snapshot, old.documentVersion)).toBe(false);
  old.loadState(snapshot, 'new', 'NEW DOCUMENT');
  expect(old.markSaved('old', old.title, snapshot, old.documentVersion)).toBe(false);
  expect(useScene3DEditor.getState().projectId).toBe('new');
  expect(useScene3DEditor.getState().title).toBe('NEW DOCUMENT');
});

test('legacy URL recovery accepts only recognized storage identities, never arbitrary hosts/paths', () => {
  const key = 'assets/sample.png';
  expect(legacyEditorImageKey('/files/assets%2Fsample.png?exp=1&token=expired')).toBe(key);
  const endpoint = 'https://account.r2.cloudflarestorage.com';
  for (const url of [
    endpoint + '/bucket/' + key,
    'https://bucket.account.r2.cloudflarestorage.com/' + key,
  ])
    expect(legacyEditorImageKey(url + '?X-Amz-Signature=expired', endpoint, 'bucket')).toBe(key);
  for (const url of [
    'https://evil.invalid/files/assets%2Fsample.png?exp=1&token=x',
    '//evil.invalid/files/x?exp=1&token=x',
    '/files/%2E%2E%2Fsecret?exp=1&token=x',
    '/files/assets%252Fsample.png?exp=1&token=x',
    endpoint + '/other/' + key + '?X-Amz-Signature=x',
  ])
    expect(legacyEditorImageKey(url, endpoint, 'bucket')).toBeNull();
  expect(editorImagePath('sample asset')).toBe('/api/catalog/editor-image/sample%20asset');
});
