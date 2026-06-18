import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type { HealthResponse } from '@nesomn/shared';
import { errorHandler } from './middleware/error.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { userRoutes } from './modules/user/routes.ts';
import { adminRoutes } from './modules/admin/index.ts';
import { catalogRoutes } from './modules/catalog/routes.ts';
import { storeRoutes } from './modules/store/routes.ts';
import { storageRoutes } from './modules/storage/routes.ts';
import { projectRoutes } from './modules/project/routes.ts';
import { aiRoutes } from './modules/ai/routes.ts';
import { billingRoutes } from './modules/billing/routes.ts';

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';

export const app = new Elysia()
  .use(
    cors({
      origin: [CLIENT_URL, ADMIN_URL],
      credentials: true, // izinkan cookie httpOnly lintas origin
      exposeHeaders: ['x-total-count'],
    }),
  )
  .use(errorHandler)
  // Hardening: rate limit baseline per IP+path (lindungi dari abuse dasar).
  .use(rateLimit('global', { max: 200, windowMs: 60_000 }))
  .get('/health', (): HealthResponse => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  })
  .use(authRoutes)
  .use(userRoutes)
  .use(adminRoutes)
  .use(catalogRoutes)
  .use(storeRoutes)
  .use(storageRoutes)
  .use(projectRoutes)
  .use(aiRoutes)
  .use(billingRoutes);

// Jalankan server hanya saat file dieksekusi langsung (bukan saat di-import test).
if (import.meta.main) {
  app.listen(PORT);
  console.log(`🚀 API running at http://localhost:${app.server?.port}`);
}

/** Tipe aplikasi untuk Eden treaty client (dikonsumsi via @nesomn/shared). */
export type App = typeof app;
