import { createRestProvider } from './rest';
import type { DataProvider } from '@refinedev/core';
import axios from 'axios';

/**
 * Data provider REST ke API Elysia (prefix /api/admin).
 * Adapter memakai instance axios sebagai
 * httpClient. Kita pakai axios ber-credential agar cookie httpOnly ikut
 * terkirim. Dialek query: _start/_end/_sort/_order + header x-total-count
 * (lihat api/src/lib/admin-query.ts).
 */

/** Axios instance dengan cookie httpOnly disertakan di setiap request. */
const httpClient = axios.create({ withCredentials: true });

httpClient.interceptors.request.use((config) => {
  if (
    config.method === 'post' &&
    config.url?.replace(/\/$/, '').endsWith('/credit-ledger') &&
    !config.headers.has('Idempotency-Key')
  )
    config.headers.set('Idempotency-Key', crypto.randomUUID());
  return config;
});

export const dataProvider: DataProvider = createRestProvider(httpClient);
