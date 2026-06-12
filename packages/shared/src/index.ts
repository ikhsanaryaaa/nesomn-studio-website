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

