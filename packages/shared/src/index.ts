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

// ── Project / Scene Editor (M5) ──

/** Jenis project editor. */
export type ProjectKind = 'scene2d' | 'scene3d';

/** Satu objek di canvas 2D (image atau text) beserta transform-nya. */
export type SceneObject = {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  /** Warna isi: untuk text = warna huruf, untuk image = tint opsional (tidak dipakai default). */
  fill?: string;
  /** Sumber gambar (data URL atau URL aset) untuk type image. */
  src?: string;
  /** Konten teks untuk type text. */
  text?: string;
  fontSize?: number;
};

/** Properti canvas scene 2D. */
export type SceneCanvas = {
  width: number;
  height: number;
  background: string;
};

/** State editor 2D lengkap, disimpan sebagai JSON di projects.state. */
export type SceneState = {
  canvas: SceneCanvas;
  objects: SceneObject[];
};

/** Project lengkap milik user (termasuk state editor). */
export type ProjectDTO = {
  id: string;
  title: string;
  kind: ProjectKind;
  state: SceneState | Record<string, unknown>;
  thumbnailKey: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

/** Ringkasan project untuk daftar (tanpa state berat). */
export type ProjectSummaryDTO = {
  id: string;
  title: string;
  kind: ProjectKind;
  thumbnailKey: string | null;
  updatedAt: string | Date;
};

