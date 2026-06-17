/**
 * Sumber kebenaran tunggal untuk metadata SEO per route.
 * Dipakai oleh komponen Seo (runtime client) dan fungsi prerender
 * (build-time, di main.tsx) agar title/description konsisten.
 */

export const SITE_NAME = 'Nesomn Studio';

export const DEFAULT_DESCRIPTION =
  'Creative studio platform for mockups, 3D editing, and asset marketplace.';

export interface RouteMeta {
  title: string;
  description: string;
}

/** Metadata untuk halaman publik yang di-prerender. */
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  '/pricing': {
    title: 'Pricing',
    description:
      'Pilih paket Nesomn Studio: Free Basic, Scene Editor, Full Access, atau Enterprise. Harga sudah termasuk pajak.',
  },
  '/marketplace': {
    title: 'Marketplace',
    description:
      'Jelajahi katalog mockup, aset 3D, font, dan motion pack premium di Nesomn Studio.',
  },
};

/** Path halaman publik yang di-prerender saat build. */
export const PRERENDER_ROUTES = Object.keys(ROUTE_META);

/** Format judul lengkap: "Halaman - Nesomn Studio". */
export function formatTitle(title: string): string {
  return title === SITE_NAME ? title : `${title} - ${SITE_NAME}`;
}
