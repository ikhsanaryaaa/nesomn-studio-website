/**
 * Tipe & kontrak bersama lintas workspace (client, api, worker).
 *
 * Eden treaty: tipe `App` diekspor dari paket `@nesomn/api`
 * (`export type App = typeof app`). Client mengimpor `App` secara
 * langsung (`import type { App } from '@nesomn/api'`) untuk panggilan
 * type-safe, sementara DTO bersama di bawah dipakai kedua sisi.
 */

/** Respons dari endpoint health check API. */
export type HealthResponse = {
  status: 'ok';
  uptime: number;
};

/** Peran pengguna. */
export type UserRole = 'admin' | 'user';

/** Profil user yang aman dikirim ke client (tanpa data sensitif). */
export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/** Ringkasan sesi login untuk ditampilkan ke user. */
export type SessionDTO = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | Date;
  lastSeenAt: string | Date;
};

/** Bentuk error terstruktur dari API. */
export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: Array<{ path: string; message: string }>;
  };
};

/** Jenis & tier aset katalog. */
export type AssetType = 'font' | 'mockup3d' | 'mockup2d' | 'asset3d' | 'graphic' | 'motion';
export type AssetTier = 'free' | 'pro';

/** Aset publik untuk storefront. fileKey TIDAK pernah disertakan. */
export type AssetDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: AssetType;
  tier: AssetTier;
  priceIdr: string;
  priceUsd: string;
  previews: string[];
  popular: boolean;
  createdAt: string | Date;
};

/** Bundle preset beserta asetnya. */
export type BundleDTO = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: 'preset' | 'custom';
  previews: string[];
  assets?: AssetDTO[];
};

/** Ringkasan harga Bundle Builder (hitung server-side). */
export type BundlePriceDTO = {
  itemCount: number;
  discountRate: number;
  subtotalIdr: number;
  subtotalUsd: number;
  discountIdr: number;
  discountUsd: number;
  totalIdr: number;
  totalUsd: number;
};

/** Item di Asset Library milik user. */
export type LibraryItemDTO = {
  id: string;
  slug: string;
  title: string;
  type: AssetType;
  previews: string[];
};

