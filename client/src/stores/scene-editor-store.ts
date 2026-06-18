import { create } from 'zustand';
import type { SceneObject, SceneCanvas, SceneState } from '@nesomn/shared';

/**
 * Store editor 2D (Zustand). Memisahkan state canvas/objek dari UI.
 * Menyediakan history undo/redo: setiap mutasi struktural menyimpan
 * snapshot sebelumnya ke `past`. Harga/credit tidak ada di sini.
 */

const DEFAULT_CANVAS: SceneCanvas = {
  width: 960,
  height: 600,
  background: '#ffffff',
};

type Snapshot = {
  canvas: SceneCanvas;
  objects: SceneObject[];
};

type SceneEditorState = {
  canvas: SceneCanvas;
  objects: SceneObject[];
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  // Project terkait (null = scene belum tersimpan).
  projectId: string | null;
  title: string;

  // Selektor turunan dipakai komponen.
  select: (id: string | null) => void;
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => void;
  addText: (text: string) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  duplicate: () => void;
  deleteSelected: () => void;
  setFill: (id: string, fill: string) => void;
  setBackground: (color: string) => void;
  undo: () => void;
  redo: () => void;
  loadState: (state: SceneState, projectId: string, title: string) => void;
  toState: () => SceneState;
  markSaved: (projectId: string, title: string) => void;
  setTitle: (title: string) => void;
  reset: () => void;
};

function uid(): string {
  return crypto.randomUUID();
}

/** Skala gambar agar muat di canvas (maks 60% lebar/tinggi canvas). */
function fitSize(w: number, h: number, canvas: SceneCanvas) {
  const maxW = canvas.width * 0.6;
  const maxH = canvas.height * 0.6;
  const ratio = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

export const useSceneEditor = create<SceneEditorState>((set, get) => {
  /** Simpan snapshot saat ini ke history sebelum mutasi struktural. */
  function snapshot(): Pick<SceneEditorState, 'past' | 'future' | 'dirty'> {
    const { canvas, objects, past } = get();
    return {
      past: [...past, { canvas, objects }],
      future: [],
      dirty: true,
    };
  }

  return {
    canvas: { ...DEFAULT_CANVAS },
    objects: [],
    selectedId: null,
    past: [],
    future: [],
    dirty: false,
    projectId: null,
    title: 'Untitled Scene',

    select: (id) => set({ selectedId: id }),

    addImage: (src, naturalWidth, naturalHeight) => {
      const { canvas } = get();
      const { width, height } = fitSize(naturalWidth, naturalHeight, canvas);
      const obj: SceneObject = {
        id: uid(),
        type: 'image',
        x: Math.round((canvas.width - width) / 2),
        y: Math.round((canvas.height - height) / 2),
        width,
        height,
        rotation: 0,
        opacity: 1,
        src,
      };
      set((s) => ({ ...snapshot(), objects: [...s.objects, obj], selectedId: obj.id }));
    },

    addText: (text) => {
      const { canvas } = get();
      const obj: SceneObject = {
        id: uid(),
        type: 'text',
        x: Math.round(canvas.width / 2 - 100),
        y: Math.round(canvas.height / 2 - 20),
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        fill: '#111111',
        text,
        fontSize: 32,
      };
      set((s) => ({ ...snapshot(), objects: [...s.objects, obj], selectedId: obj.id }));
    },

    updateObject: (id, patch) =>
      set((s) => ({
        ...snapshot(),
        objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })),

    duplicate: () => {
      const { objects, selectedId } = get();
      const target = objects.find((o) => o.id === selectedId);
      if (!target) return;
      const copy: SceneObject = { ...target, id: uid(), x: target.x + 24, y: target.y + 24 };
      set((s) => ({ ...snapshot(), objects: [...s.objects, copy], selectedId: copy.id }));
    },

    deleteSelected: () => {
      const { selectedId } = get();
      if (!selectedId) return;
      set((s) => ({
        ...snapshot(),
        objects: s.objects.filter((o) => o.id !== selectedId),
        selectedId: null,
      }));
    },

    setFill: (id, fill) =>
      set((s) => ({
        ...snapshot(),
        objects: s.objects.map((o) => (o.id === id ? { ...o, fill } : o)),
      })),

    setBackground: (color) =>
      set((s) => ({ ...snapshot(), canvas: { ...s.canvas, background: color } })),

    undo: () => {
      const { past, canvas, objects, future } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [{ canvas, objects }, ...future],
        canvas: prev.canvas,
        objects: prev.objects,
        selectedId: null,
        dirty: true,
      });
    },

    redo: () => {
      const { future, canvas, objects, past } = get();
      if (!future.length) return;
      const next = future[0];
      set({
        future: future.slice(1),
        past: [...past, { canvas, objects }],
        canvas: next.canvas,
        objects: next.objects,
        selectedId: null,
        dirty: true,
      });
    },

    loadState: (state, projectId, title) =>
      set({
        canvas: state.canvas ?? { ...DEFAULT_CANVAS },
        objects: state.objects ?? [],
        selectedId: null,
        past: [],
        future: [],
        dirty: false,
        projectId,
        title,
      }),

    toState: () => {
      const { canvas, objects } = get();
      return { canvas, objects };
    },

    markSaved: (projectId, title) => set({ projectId, title, dirty: false }),

    setTitle: (title) => set({ title, dirty: true }),

    reset: () =>
      set({
        canvas: { ...DEFAULT_CANVAS },
        objects: [],
        selectedId: null,
        past: [],
        future: [],
        dirty: false,
        projectId: null,
        title: 'Untitled Scene',
      }),
  };
});
