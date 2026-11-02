import { describe, it, expect } from 'bun:test';
import type Konva from 'konva';
import { exportStage } from '../client/src/lib/export-image';
import { useSceneEditor } from '../client/src/stores/scene-editor-store';
import { fitScene } from '../client/src/lib/scene-viewport';

describe('2D presentation never changes scene/export dimensions', () => {
  it('fits actual available widths including small screens', () => {
    for (const width of [80, 328, 358, 496, 752, 1100]) {
      const scale = fitScene(960, 600, width, 300);
      expect(960 * scale).toBeLessThanOrEqual(width);
      expect(600 * scale).toBeLessThanOrEqual(300);
    }
    expect(fitScene(0, 600, 320, 200)).toBe(1);
  });
  for (const fails of [false, true])
    it('restores stage and selection on ' + (fails ? 'CORS failure' : 'download'), () => {
      let size = { width: 320, height: 200 },
        scale = { x: 1 / 3, y: 1 / 3 },
        visible = true,
        clicked = false;
      const originalDocument = globalThis.document;
      const link = {
        download: '',
        href: '',
        click() {
          clicked = true;
        },
        remove() {},
      };
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { createElement: () => link, body: { appendChild() {} } },
      });
      const stage = {
        size(value?: typeof size) {
          if (value) size = value;
          return { ...size };
        },
        scale(value?: typeof scale) {
          if (value) scale = value;
          return { ...scale };
        },
        find() {
          return [
            {
              visible(value?: boolean) {
                if (value !== undefined) visible = value;
                return visible;
              },
              hide() {
                visible = false;
              },
            },
          ];
        },
        batchDraw() {},
        toDataURL(options: { pixelRatio: number }) {
          expect(size).toEqual({ width: 1920, height: 1200 });
          expect(scale).toEqual({ x: 1, y: 1 });
          expect(visible).toBe(false);
          expect(options.pixelRatio).toBe(1080 / 1920);
          if (fails) throw Error('tainted');
          return 'data:image/png;base64,test';
        },
      };
      try {
        const action = () =>
          exportStage(stage as unknown as Konva.Stage, 'png', 'test', {
            width: 1920,
            height: 1200,
          });
        if (fails) expect(action).toThrow('tainted');
        else action();
        expect(size).toEqual({ width: 320, height: 200 });
        expect(scale).toEqual({ x: 1 / 3, y: 1 / 3 });
        expect(visible).toBe(true);
        expect(clicked).toBe(!fails);
      } finally {
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          value: originalDocument,
        });
      }
    });
});

it('edits made while saving stay dirty and retain authored title', () => {
  const store = useSceneEditor.getState();
  store.reset();
  store.setTitle('Saved title');
  const sent = store.toState();
  store.addText('Newer edit');
  store.setTitle('Newer title');
  store.markSaved('project-id', 'Saved title', sent);
  expect(useSceneEditor.getState().title).toBe('Newer title');
  expect(useSceneEditor.getState().dirty).toBe(true);
  expect(useSceneEditor.getState().objects).toHaveLength(1);
  store.reset();
});
