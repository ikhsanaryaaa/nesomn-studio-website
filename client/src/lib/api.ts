import type {
  UserDTO,
  SessionDTO,
  ApiError,
  AssetDTO,
  BundleDTO,
  BundlePriceDTO,
  LibraryItemDTO,
  ProjectDTO,
  ProjectSummaryDTO,
  SceneState,
  Scene3DState,
  AiJobDTO,
  AiModelDTO,
  SceneGenInput,
  MotionGenInput,
  AiTab,
} from '@nesomn/shared';

/**
 * Klien API tipis berbasis fetch dengan kredensial cookie httpOnly.
 *
 * Catatan: kontrak tipe diambil dari DTO bersama `@nesomn/shared`.
 * Eden treaty penuh dapat dipasang di milestone berikutnya saat lebih
 * banyak endpoint dikonsumsi. Base URL `/api` diteruskan ke server lewat
 * proxy Vite (lihat vite.config.ts).
 */

const BASE_URL = '/api';

export class ApiRequestError extends Error {
  code: string;
  status: number;
  fields?: ApiError['error']['fields'];

  constructor(status: number, body: ApiError) {
    super(body.error?.message ?? 'Terjadi kesalahan');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body.error?.code ?? 'unknown';
    this.fields = body.error?.fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiRequestError(res.status, data as ApiError);
  }

  return data as T;
}

export const api = {
  /** Ambil profil user terautentikasi. Melempar 401 bila belum login. */
  me: () => request<UserDTO>('/me'),

  /** Daftar sesi aktif milik user. */
  sessions: () => request<SessionDTO[]>('/sessions'),

  /** Cabut sesi milik sendiri. */
  revokeSession: (id: string) =>
    request<{ ok: true }>(`/sessions/${id}`, { method: 'DELETE' }),

  /** Logout: hapus sesi aktif & bersihkan cookie. */
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // ── Catalog (publik) ──
  /** Daftar aset katalog dengan filter & search opsional. */
  catalogAssets: (params?: {
    type?: string;
    tier?: string;
    popular?: string;
    q?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return request<AssetDTO[]>(`/catalog/assets${qs ? `?${qs}` : ''}`);
  },

  /** Detail aset by slug. */
  catalogAsset: (slug: string) => request<AssetDTO>(`/catalog/assets/${slug}`),

  /** Daftar bundle preset. */
  catalogBundles: () => request<BundleDTO[]>('/catalog/bundles'),

  // ── Store (butuh auth) ──
  /** Hitung harga bundle dari daftar asset ID (server-side). */
  bundlePrice: (assetIds: string[]) =>
    request<BundlePriceDTO>('/store/bundle/price', {
      method: 'POST',
      body: JSON.stringify({ assetIds }),
    }),

  /** Claim aset gratis: grant license instan. */
  claimAsset: (id: string) =>
    request<{ id: string }>(`/store/assets/${id}/claim`, { method: 'POST' }),

  /** Buat order pending untuk item berbayar (settle di M8). */
  checkout: (assetIds: string[]) =>
    request<{ note: string }>('/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ assetIds }),
    }),

  /** Asset Library: aset yang dimiliki user. */
  library: () => request<LibraryItemDTO[]>('/store/library'),

  /** Signed URL untuk download aset berlisensi. */
  downloadUrl: (id: string) =>
    request<{ url: string }>(`/store/assets/${id}/download`),

  // ── Projects (butuh auth) ──
  projects: {
    /** Daftar project milik user (ringkas). */
    list: (kind?: string) =>
      request<ProjectSummaryDTO[]>(`/projects${kind ? `?kind=${kind}` : ''}`),
    /** Ambil 1 project lengkap (dengan state). */
    get: (id: string) => request<ProjectDTO>(`/projects/${id}`),
    /** Buat project baru. */
    create: (payload: { title: string; kind: string; state?: SceneState | Scene3DState }) =>
      request<ProjectDTO>('/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    /** Update title/state/thumbnail. */
    update: (
      id: string,
      payload: { title?: string; state?: SceneState | Scene3DState; thumbnailKey?: string | null },
    ) =>
      request<ProjectDTO>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    /** Hapus project. */
    remove: (id: string) =>
      request<{ ok: true }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  // ── AI System (butuh auth) ──
  ai: {
    /** Daftar model AI yang boleh diakses user (per tab). */
    models: (tab?: AiTab) =>
      request<AiModelDTO[]>(`/ai/models${tab ? `?tab=${tab}` : ''}`),
    /** Saldo credit user. */
    credit: () => request<{ balance: number }>('/ai/credit'),
    /** Buat job AI (Scene atau Motion). */
    createJob: (payload: {
      providerId: string;
      tab: AiTab;
      input: SceneGenInput | MotionGenInput;
    }) =>
      request<AiJobDTO>('/ai/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    /** Status 1 job (untuk polling). */
    getJob: (id: string) => request<AiJobDTO>(`/ai/jobs/${id}`),
    /** Riwayat job user. */
    listJobs: () => request<AiJobDTO[]>('/ai/jobs'),
  },
};
