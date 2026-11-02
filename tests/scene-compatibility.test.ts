import { afterEach, describe, expect, it } from 'bun:test';
import type { SceneState, Scene3DState } from '../packages/shared/src/index.ts';
import { useSceneEditor } from '../client/src/stores/scene-editor-store.ts';
import { useScene3DEditor } from '../client/src/stores/scene-3d-store.ts';
import scene2d from './fixtures/scene2d-legacy.json';
import scene3d from './fixtures/scene3d-legacy.json';

describe('legacy scene contract baseline (tanpa DB/WebGL)', () => {
  afterEach(() => {
    useSceneEditor.getState().reset();
    useScene3DEditor.getState().reset();
  });

  it('state 2D melewati load/save tanpa kehilangan layer, transform atau sumber gambar', () => {
    const fixture = structuredClone(scene2d) as SceneState;
    useSceneEditor.getState().loadState(fixture, 'synthetic-project-2d', 'Synthetic scene');
    expect(useSceneEditor.getState().toState()).toEqual(scene2d);
    expect(useSceneEditor.getState().dirty).toBe(false);
  });

  it('duplicate lalu undo mengembalikan dokumen 2D ke fixture semula', () => {
    useSceneEditor
      .getState()
      .loadState(structuredClone(scene2d) as SceneState, 'synthetic-project-2d', 'Synthetic scene');
    useSceneEditor.getState().select(scene2d.objects[0].id);
    useSceneEditor.getState().duplicate();
    expect(useSceneEditor.getState().objects).toHaveLength(scene2d.objects.length + 1);
    useSceneEditor.getState().undo();
    expect(useSceneEditor.getState().toState()).toEqual(scene2d);
  });

  it('state 3D lama mempertahankan modelKey, kamera, material dan decal saat load/save', () => {
    useScene3DEditor
      .getState()
      .loadState(
        structuredClone(scene3d) as Scene3DState,
        'synthetic-project-3d',
        'Synthetic scene',
      );
    expect(useScene3DEditor.getState().toState()).toEqual(scene3d);
    expect(useScene3DEditor.getState().dirty).toBe(false);
  });
  it('reset/load remove stale signed URL; catalog key and optional target survive JSON', () => {
    const store = useScene3DEditor.getState();
    store.setModelKey('catalog-model');
    store.setModelUrl('https://storage.invalid/old?signature=synthetic');
    expect(store.toState().modelKey).toBe('catalog-model');
    store.reset();
    expect(useScene3DEditor.getState().modelUrl).toBeNull();
    store.setModelUrl('https://storage.invalid/stale');
    store.loadState(
      {
        ...structuredClone(scene3d),
        modelKey: 'catalog-model',
        decals: [{ ...scene3d.decals[0], meshPath: '0.1' }],
      } as Scene3DState,
      'project',
      'Title',
    );
    expect(useScene3DEditor.getState().modelUrl).toBeNull();
    expect(store.toState().decals[0].meshPath).toBe('0.1');
    expect(JSON.stringify(store.toState())).not.toContain('signature');
  });
});

it('catalog mug is explicitly distinguishable from legacy builtin without persisting signed URL', () => {
  const state = useScene3DEditor.getState();
  state.reset();
  state.setModelKey('mug');
  const saved = state.toState();
  expect(saved.modelSource).toBe('catalog');
  state.loadState(saved, 'sample', 'Sample');
  expect(useScene3DEditor.getState().modelSource).toBe('catalog');
  state.reset();
  expect(state.toState().modelSource).toBeUndefined();
});
