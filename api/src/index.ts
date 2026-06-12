import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type { HealthResponse } from '@nesomn/shared';
import { errorHandler } from './middleware/error.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { userRoutes } from './modules/user/routes.ts';

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export const app = new Elysia()
  .use(
    cors({
      origin: CLIENT_URL,
      credentials: true, // izinkan cookie httpOnly lintas origin
    }),
  )
  .use(errorHandler)
  .get('/health', (): HealthResponse => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  })
  .use(authRoutes)
  .use(userRoutes);

// Jalankan server hanya saat file dieksekusi langsung (bukan saat di-import test).
if (import.meta.main) {
  app.listen(PORT);
  console.log(`🚀 API running at http://localhost:${app.server?.port}`);
}

/** Tipe aplikasi untuk Eden treaty client (dikonsumsi via @nesomn/shared). */
export type App = typeof app;
