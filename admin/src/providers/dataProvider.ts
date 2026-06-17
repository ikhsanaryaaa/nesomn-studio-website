import simpleRestDataProvider from '@refinedev/simple-rest';
import type { DataProvider } from '@refinedev/core';
import axios from 'axios';

/**
 * Data provider REST ke API Elysia (prefix /api/admin).
 * @refinedev/simple-rest membutuhkan instance axios (bukan fetch) sebagai
 * httpClient. Kita pakai axios ber-credential agar cookie httpOnly ikut
 * terkirim. Dialek query: _start/_end/_sort/_order + header x-total-count
 * (lihat api/src/lib/admin-query.ts).
 */
const API_URL = '/api/admin';

/** Axios instance dengan cookie httpOnly disertakan di setiap request. */
const httpClient = axios.create({ withCredentials: true });

export const dataProvider: DataProvider = simpleRestDataProvider(API_URL, httpClient);
