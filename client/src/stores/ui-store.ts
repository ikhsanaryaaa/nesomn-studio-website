import { create } from 'zustand';

/** State global UI (non-server). Editor punya store terpisah kelak. */
interface UiState {
  /** Sidebar dalam mode ringkas (ikon-only 64px). */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;

  /** Section Marketplace di sidebar sedang terbuka. */
  marketplaceOpen: boolean;
  toggleMarketplace: () => void;

  /** Sidebar drawer terbuka di layar kecil (mobile overlay). */
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),

  marketplaceOpen: true,
  toggleMarketplace: () =>
    set((state) => ({ marketplaceOpen: !state.marketplaceOpen })),

  mobileSidebarOpen: false,
  setMobileSidebarOpen: (value) => set({ mobileSidebarOpen: value }),
}));
