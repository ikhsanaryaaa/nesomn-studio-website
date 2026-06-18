import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { aiProviders, aiJobs, subscriptions, plans } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { authPlugin, type AuthUser } from '../../middleware/auth.ts';
import { getBalance, deductCredit } from './credit.ts';
import { enqueueAiJob } from './queue.ts';
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
  input: z.record(z.unknown()),
});

/** Tier user: 'pro' bila punya subscription aktif, else 'free'. */
async function getUserTier(userId: string): Promise<{ tier: 'free' | 'pro'; isPro: boolean }> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    orderBy: [desc(subscriptions.currentPeriodEnd)],
  });
  const isPro = Boolean(sub);
  return { tier: isPro ? 'pro' : 'free', isPro };
}

/** Petakan baris job ke DTO aman untuk client. */
function toJobDTO(row: typeof aiJobs.$inferSelect, tab: AiJobDTO['tab']): AiJobDTO {
  return {
    id: row.id,
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
        where: tab ? and(eq(aiProviders.enabled, true), eq(aiProviders.tab, tab)) : eq(aiProviders.enabled, true),
      });
      // tierAccess kosong = terbuka untuk semua tier.
      const visible = rows.filter(
        (r) => r.tierAccess.length === 0 || r.tierAccess.includes(tier),
      );
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
    async ({ body, user }) => {
      const u = user as AuthUser;
      const parsed = createBody.parse(body);

      // Validasi input sesuai tab.
      const input =
        parsed.tab === 'scene' ? sceneInput.parse(parsed.input) : motionInput.parse(parsed.input);

      // Provider harus ada, enabled, dan tab cocok.
      const provider = await db.query.aiProviders.findFirst({
        where: eq(aiProviders.id, parsed.providerId),
      });
      if (!provider || !provider.enabled) {
        throw new AppError('NOT_FOUND', 'Model tidak tersedia.', 404);
      }
      if (provider.tab !== parsed.tab) {
        throw new AppError('BAD_REQUEST', 'Model tidak cocok dengan tab.', 400);
      }

      // Tier access.
      const { tier, isPro } = await getUserTier(u.id);
      if (provider.tierAccess.length > 0 && !provider.tierAccess.includes(tier)) {
        throw new AppError('FORBIDDEN', 'Model ini butuh langganan yang lebih tinggi.', 403);
      }

      // Video butuh akses aiVideo pada plan (gate fitur).
      if (provider.kind === 'video') {
        const sub = await db.query.subscriptions.findFirst({
          where: and(eq(subscriptions.userId, u.id), eq(subscriptions.status, 'active')),
        });
        const plan = sub ? await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) }) : null;
        if (!plan?.editorAccess.aiVideo) {
          throw new AppError('FORBIDDEN', 'Plan Anda belum termasuk AI video.', 403);
        }
      }

      // 1 job aktif per user (pending/processing).
      const active = await db.query.aiJobs.findFirst({
        where: and(
          eq(aiJobs.userId, u.id),
          inArray(aiJobs.status, ['pending', 'processing']),
        ),
      });
      if (active) {
        throw new AppError('JOB_IN_PROGRESS', 'Masih ada job berjalan. Tunggu sampai selesai.', 409);
      }

      // Saldo cukup, lalu potong (transaksi). deductCredit melempar bila kurang.
      const cost = provider.creditCost;
      const refId = crypto.randomUUID();
      if (cost > 0) {
        try {
          await deductCredit(u.id, cost, refId);
        } catch {
          throw new AppError('INSUFFICIENT_CREDIT', 'Saldo credit tidak cukup.', 402);
        }
      }

      // Insert job (pakai refId sebagai id agar refund konsisten).
      const priority = isPro ? 1 : 2;
      const [job] = await db
        .insert(aiJobs)
        .values({
          id: refId,
          userId: u.id,
          providerId: provider.id,
          kind: provider.kind,
          status: 'pending',
          priority,
          input,
          creditCost: cost,
        })
        .returning();

      await enqueueAiJob(job.id, priority);
      return toJobDTO(job, provider.tab);
    },
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
      if (!job) throw new AppError('NOT_FOUND', 'Job tidak ditemukan.', 404);
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
