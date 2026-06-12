import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type { HealthResponse } from '@nesomn/shared';

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = new Elysia()
  .use(cors({ origin: CLIENT_URL }))
  .get('/health', (): HealthResponse => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  })
  .listen(PORT);

console.log(`🚀 API running at http://localhost:${app.server?.port}`);
