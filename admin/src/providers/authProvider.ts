import type { AuthProvider } from '@refinedev/core';

/**
 * Auth provider Refine yang reuse endpoint M1.
 * - login  -> POST /api/auth/login
 * - logout -> POST /api/auth/logout
 * - check  -> GET  /api/me (tolak bila role bukan admin: RBAC)
 * Sesi disimpan via cookie httpOnly, jadi tidak ada token di localStorage.
 */
const API = '/api';

async function call(path: string, options: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
}

export const authProvider: AuthProvider = {
  async login({ email, password }) {
    const res = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      return {
        success: false,
        error: { name: 'LoginError', message: 'Email atau password salah.' },
      };
    }
    const user = await res.json();
    if (user.role !== 'admin') {
      // Bukan admin: langsung logout lagi agar sesi tidak menggantung.
      await call('/auth/logout', { method: 'POST' });
      return {
        success: false,
        error: { name: 'ForbiddenError', message: 'Akses khusus admin.' },
      };
    }
    return { success: true, redirectTo: '/' };
  },

  async logout() {
    await call('/auth/logout', { method: 'POST' });
    return { success: true, redirectTo: '/login' };
  },

  async check() {
    const res = await call('/me');
    if (!res.ok) return { authenticated: false, redirectTo: '/login' };
    const user = await res.json();
    if (user.role !== 'admin') return { authenticated: false, redirectTo: '/login' };
    return { authenticated: true };
  },

  async getPermissions() {
    const res = await call('/me');
    if (!res.ok) return null;
    const user = await res.json();
    return user.role;
  },

  async getIdentity() {
    const res = await call('/me');
    if (!res.ok) return null;
    const user = await res.json();
    return { id: user.id, name: user.name, email: user.email };
  },

  async onError(error) {
    if (error?.status === 401 || error?.status === 403) {
      return { logout: true, redirectTo: '/login' };
    }
    return {};
  },
};
