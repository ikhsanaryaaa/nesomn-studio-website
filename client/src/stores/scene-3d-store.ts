import { create } from 'zustand';
import type { CameraPreset, Decal3D, Scene3DState } from '@nesomn/shared';

/**
 * Store editor 3D (Zustand). Memisahkan state scene 3D dari UI.
 * State disimpan sebagai JSON di projects.state (kind scene3d).
 * Tanpa AI dan tanpa logika harga/credit (sesuai AI-RULES).
 */

const DEFAULT_STATE: Scene3DState = {
  modelKey: 'mug',
  background: '#1b1f2a',
  materialColor: '#d6d3cc',
  grain: 20,
  camera: 'threeQuarter',
  decals: [],
};

type Scene3DStoreState = {
  documentVersion: number;
  modelKey: string;
  modelSource?: 'catalog';
  modelUrl: string | null;
  background: string;
  materialColor: string;
  grain: number;
  camera: CameraPreset;
  decals: Decal3D[];
  selectedDecalId: string | null;
  dirty: boolean;
  projectId: string | null;
  title: string;

  setMaterialColor: (color: string) => void;
  setBackground: (color: string) => void;
  setGrain: (value: number) => void;
  setCamera: (preset: CameraPreset) => void;
  setModelUrl: (url: string | null) => void;
  setModelKey: (key: string) => void;
  addDecal: (src: string) => void;
  updateDecal: (id: string, patch: Partial<Decal3D>) => void;
  removeDecal: (id: string) => void;
  selectDecal: (id: string | null) => void;
  loadState: (state: Scene3DState, projectId: string, title: string) => void;
  toState: () => Scene3DState;
  markSaved: (
    projectId: string,
    title: string,
    snapshot: Scene3DState,
    documentVersion: number,
  ) => boolean;
  setTitle: (title: string) => void;
  reset: () => void;
};

function uid(): string {
  return crypto.randomUUID();
}

export const useScene3DEditor = create<Scene3DStoreState>((set, get) => ({
  ...DEFAULT_STATE,
  documentVersion: 0,
  modelUrl: null,
  selectedDecalId: null,
  dirty: false,
  projectId: null,
  title: 'Untitled 3D Scene',

  setMaterialColor: (color) => set({ materialColor: color, dirty: true }),

  setBackground: (color) => set({ background: color, dirty: true }),

  setGrain: (value) => set({ grain: Math.max(0, Math.min(100, value)), dirty: true }),

  setCamera: (preset) => set({ camera: preset, dirty: true }),

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelKey: (key) => set({ modelKey: key, modelSource: 'catalog', modelUrl: null, dirty: true }),

  addDecal: (src) => {
    const decal: Decal3D = {
      id: uid(),
      src,
      // Tempel di sisi depan model secara default; user dapat menyesuaikan.
      position: [0, 0, 0.5],
      rotation: [0, 0, 0],
      scale: 0.6,
    };
    set((s) => ({ decals: [...s.decals, decal], selectedDecalId: decal.id, dirty: true }));
  },

  updateDecal: (id, patch) =>
    set((s) => ({
      decals: s.decals.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      dirty: true,
    })),

  removeDecal: (id) =>
    set((s) => ({
      decals: s.decals.filter((d) => d.id !== id),
      selectedDecalId: s.selectedDecalId === id ? null : s.selectedDecalId,
      dirty: true,
    })),

  selectDecal: (id) => set({ selectedDecalId: id }),

  loadState: (state, projectId, title) =>
    set({
      documentVersion: get().documentVersion + 1,
      modelKey: state.modelKey ?? DEFAULT_STATE.modelKey,
      modelSource: state.modelSource,
      modelUrl: null,
      background: state.background ?? DEFAULT_STATE.background,
      materialColor: state.materialColor ?? DEFAULT_STATE.materialColor,
      grain: state.grain ?? DEFAULT_STATE.grain,
      camera: state.camera ?? DEFAULT_STATE.camera,
      decals: state.decals ?? [],
      selectedDecalId: null,
      dirty: false,
      projectId,
      title,
    }),

  toState: () => {
    const { modelKey, modelSource, background, materialColor, grain, camera, decals } = get();
    return {
      modelKey,
      ...(modelSource ? { modelSource } : {}),
      background,
      materialColor,
      grain,
      camera,
      decals,
    };
  },

  markSaved: (projectId, title, snapshot, documentVersion) => {
    const current = get();
    if (current.documentVersion !== documentVersion) return false;
    const unchanged =
      current.title === title && JSON.stringify(current.toState()) === JSON.stringify(snapshot);
    set({ projectId, dirty: !unchanged });
    return true;
  },

  setTitle: (title) => set({ title, dirty: true }),

  reset: () =>
    set({
      ...DEFAULT_STATE,
      documentVersion: get().documentVersion + 1,
      modelSource: undefined,
      modelUrl: null,
      selectedDecalId: null,
      dirty: false,
      projectId: null,
      title: 'Untitled 3D Scene',
    }),
}));
