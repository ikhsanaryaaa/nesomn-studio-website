import { create } from 'zustand';
import type { AssetDTO } from '@nesomn/shared';

/**
 * Cart Bundle Builder (UI state, Zustand).
 * Menyimpan aset yang dipilih user untuk disusun jadi bundle custom.
 * Harga dihitung server-side (jangan hitung total di sini).
 */
type CartState = {
  items: AssetDTO[];
  add: (asset: AssetDTO) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
};

export const useCart = create<CartState>((set, get) => ({
  items: [],
  add: (asset) =>
    set((s) => (s.items.some((i) => i.id === asset.id) ? s : { items: [...s.items, asset] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  has: (id) => get().items.some((i) => i.id === id),
  clear: () => set({ items: [] }),
}));
