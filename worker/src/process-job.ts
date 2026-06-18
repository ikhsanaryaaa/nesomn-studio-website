import { eq } from 'drizzle-orm';
import { db } from '@nesomn/api/src/db/client.ts';
import { aiJobs, aiProviders } from '@nesomn/api/src/db/schema/index.ts';
import { resolveProvider } from '@nesomn/api/src/modules/ai/provider.ts';
import { refundCredit } from '@nesomn/api/src/modules/ai/credit.ts';
import type { AiJobInput } from '@nesomn/shared';

/**
 * Proses satu job AI: ambil dari DB, set processing, resolve adapter,
 * generate, simpan resultUrl + done. Bila gagal -> failed + refund credit.
 * Dipisah dari index.ts agar mudah diuji unit.
 */

export type ProcessResult = {
  status: 'done' | 'failed';
  resultUrl?: string;
  error?: string;
};

export async function processJob(jobId: string): Promise<ProcessResult> {
  const job = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
  if (!job) {
    return { status: 'failed', error: 'Job tidak ditemukan.' };
  }

  // Tandai processing.
  await db
    .update(aiJobs)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(aiJobs.id, jobId));

  try {
    const provider = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.id, job.providerId),
    });
    if (!provider) throw new Error('Provider tidak ditemukan.');

    const adapter = await resolveProvider({
      key: provider.key,
      kind: provider.kind,
      tab: provider.tab,
      modelName: provider.modelName,
      baseUrl: provider.baseUrl,
      apiKeyEncrypted: provider.apiKeyEncrypted,
    });

    const { resultUrl } = await adapter.generate(job.input as AiJobInput);

    await db
      .update(aiJobs)
      .set({ status: 'done', resultUrl, updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId));

    return { status: 'done', resultUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job gagal diproses.';
    await db
      .update(aiJobs)
      .set({ status: 'failed', error: message, updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId));

    // Refund credit yang terpotong saat job dibuat (idempoten via refId = jobId).
    if (job.creditCost > 0) {
      await refundCredit(job.userId, job.creditCost, jobId);
    }

    return { status: 'failed', error: message };
  }
}
