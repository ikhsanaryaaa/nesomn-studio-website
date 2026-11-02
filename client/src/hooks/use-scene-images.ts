import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { editorEpoch } from '../lib/editor-session';
import type { SceneObject } from '@nesomn/shared';

export function useSceneImages(objects: SceneObject[]) {
  const sources = JSON.stringify([
    ...new Set(objects.filter((o) => o.type === 'image').map((o) => o.src ?? '')),
  ]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    images: Map<string, HTMLImageElement>;
    errors: number;
  }>();
  const key = sources + ':' + attempt;
  useEffect(() => {
    let active = true;
    const epoch = editorEpoch();
    const pending = new Set<HTMLImageElement>();
    const images = new Map<string, HTMLImageElement>();
    let errors = 0;
    const valid = () => active && epoch === editorEpoch();
    function load(src: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const image = new Image();
        pending.add(image);
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          pending.delete(image);
          resolve(image);
        };
        image.onerror = () => {
          pending.delete(image);
          reject(new Error('Image failed'));
        };
        image.src = src;
      });
    }
    void Promise.all(
      (JSON.parse(sources) as string[]).map(async (src) => {
        try {
          let image: HTMLImageElement;
          try {
            image = await load(src);
          } catch {
            if (!valid()) return;
            const resolved = await api.resolveEditorImage(src);
            if (!valid()) return;
            image = await load(resolved.url);
          }
          if (valid()) images.set(src, image);
        } catch {
          if (valid()) errors++;
        }
      }),
    ).then(() => {
      if (valid()) setResult({ key, images, errors });
    });
    return () => {
      active = false;
      for (const image of pending) {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      }
    };
  }, [sources, key]);
  const current = result?.key === key ? result : undefined;
  return {
    images: current?.images,
    loading: !current,
    errors: current?.errors ?? 0,
    retry: () => setAttempt((v) => v + 1),
  };
}
