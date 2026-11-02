import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { aiProviders, aiJobs } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { getBalance } from './credit.ts';
import { createAiJob, cancelAiJob } from './service.ts';
import { effectiveSubscription, subscriptionTier } from '../../lib/entitlement.ts';

import type { AiJobDTO, AiModelDTO } from '@nesomn/shared';

/**
 * Job API AI (butuh auth): daftar model boleh-akses, saldo credit,
 * buat job (validasi tier + 1 job/user + saldo, potong credit, enqueue),
 * status job (polling), dan riwayat. Generate nyata di worker.
 */

const tabSchema = z.enum(['scene', 'motion']);

const sceneInput = z.object({
  prompt: z.string().min(1).max(2000),
  aspect: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']),
  baseImage: z.string().optional(),
  referenceImages: z.array(z.string()).max(4).optional(),
});

const motionInput = z.object({
  startFrame: z.string().min(1),
  endFrame: z.string().optional(),
  trajectory: z.object({
    h: z.number().min(-1).max(1),
    v: z.number().min(-1).max(1),
    zoom: z.number().min(-1).max(1),
  }),
  durationSec: z.number().int().min(1).max(15),
  aspect: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']),
  prompt: z.string().min(1).max(2000),
});

const createBody = z.object({
  providerId: z.string().uuid(),
  tab: tabSchema,
  input: z.record(z.string(), z.unknown()),
});

/** Tier user: 'pro' bila punya subscription aktif, else 'free'. */
async function getUserTier(userId: string): Promise<{ tier: 'free' | 'pro'; isPro: boolean }> {
  const sub = await effectiveSubscription(userId);
  const isPro = subscriptionTier(sub) === 'pro';
  return { tier: isPro ? 'pro' : 'free', isPro };
}

/** Petakan baris job ke DTO aman untuk client. */
function toJobDTO(row: typeof aiJobs.$inferSelect, tab: AiJobDTO['tab']): AiJobDTO {
  return {
    id: row.id,
    needsReview: row.needsReview,
    kind: row.kind,
    tab,
    status: row.status,
    resultUrl: row.resultUrl,
    error: row.error,
    creditCost: row.creditCost,
    createdAt: row.createdAt,
  };
}

export const aiRoutes = new Elysia({ prefix: '/ai' })
  .use(authPlugin)
  // Daftar model AI yang boleh diakses user (enabled + tierAccess cocok).
  .get(
    '/models',
    async ({ user, query }) => {
      const u = user as AuthUser;
      const tab = query.tab ? tabSchema.parse(query.tab) : undefined;
      const { tier } = await getUserTier(u.id);
      const rows = await db.query.aiProviders.findMany({
        where: tab
          ? and(eq(aiProviders.enabled, true), eq(aiProviders.tab, tab))
          : eq(aiProviders.enabled, true),
      });
      // tierAccess kosong = terbuka untuk semua tier.
      const visible = rows.filter((r) => r.tierAccess.length === 0 || r.tierAccess.includes(tier));
      return visible.map(
        (r): AiModelDTO => ({
          id: r.id,
          key: r.key,
          modelName: r.modelName,
          tab: r.tab,
          kind: r.kind,
          creditCost: r.creditCost,
        }),
      );
    },
    { requireAuth: true },
  )
  // Saldo credit user.
  .get(
    '/credit',
    async ({ user }) => {
      const u = user as AuthUser;
      return { balance: await getBalance(u.id) };
    },
    { requireAuth: true },
  )
  // Buat job AI: validasi -> potong credit -> enqueue.
  .post(
    '/jobs',
    async ({ body, user, request, set }) => {
      const u = user as AuthUser;
      const parsed = createBody.parse(body);

      // Validasi input sesuai tab.
      const input =
        parsed.tab === 'scene' ? sceneInput.parse(parsed.input) : motionInput.parse(parsed.input);

      const job = await createAiJob(
        u.id,
        parsed.providerId,
        parsed.tab,
        input,
        request.headers.get('idempotency-key') ?? undefined,
      );
      set.status = 202;
      return toJobDTO(job, parsed.tab);
    },
    { requireAuth: true },
  )
  .post(
    '/jobs/:id/cancel',
    async ({ params, user }) =>
      cancelAiJob((user as AuthUser).id, z.string().uuid().parse(params.id)),
    { requireAuth: true },
  )
  // Status 1 job (ownership) untuk polling.
  .get(
    '/jobs/:id',
    async ({ params, user }) => {
      const u = user as AuthUser;
      const job = await db.query.aiJobs.findFirst({
        where: and(eq(aiJobs.id, params.id), eq(aiJobs.userId, u.id)),
      });
      if (!job) throw new AppError('NOT_FOUND', 'Job not found.', 404);
      const provider = await db.query.aiProviders.findFirst({
        where: eq(aiProviders.id, job.providerId),
      });
      return toJobDTO(job, provider?.tab ?? 'scene');
    },
    { requireAuth: true },
  )
  // Riwayat job user.
  .get(
    '/jobs',
    async ({ user }) => {
      const u = user as AuthUser;
      const rows = await db.query.aiJobs.findMany({
        where: eq(aiJobs.userId, u.id),
        orderBy: [desc(aiJobs.createdAt)],
        limit: 50,
      });
      return rows.map((r) => toJobDTO(r, r.kind === 'video' ? 'motion' : 'scene'));
    },
    { requireAuth: true },
  );
