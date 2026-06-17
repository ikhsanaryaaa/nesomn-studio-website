import type { UserDTO, SessionDTO, ApiError } from '@nesomn/shared';

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
};
