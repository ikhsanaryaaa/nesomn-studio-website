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
  '/works': {
    title: 'Works',
    description: 'Selected creative work and original concepts from Nesomn Studio.',
  },
  '/demo/works/nesomn-studio-kit': {
    title: 'Nesomn Studio Kit — Demo / Sample',
    description:
      'An original internal concept exploring the Nesomn identity. Demo / Sample, not a client commission.',
  },
  '/pricing': {
    title: 'Pricing',
    description:
      'Choose a Nesomn Studio plan: Free Basic, Scene Editor, Full Access, or Enterprise.',
  },
  '/marketplace': {
    title: 'Marketplace',
    description:
      'Explore mockups, 3D assets, fonts, and premium motion packs in the Nesomn Studio catalogue.',
  },
};

/** Path halaman publik yang di-prerender saat build. */
export const PRERENDER_ROUTES = Object.keys(ROUTE_META);

/** Format judul lengkap: "Halaman - Nesomn Studio". */
export function formatTitle(title: string): string {
  return title === SITE_NAME ? title : `${title} - ${SITE_NAME}`;
}
