import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { aiJobs } from '../../db/schema/index.ts';
import { Queue } from 'bullmq';
import { redisConnection } from '../../lib/redis.ts';

/**
 * Producer queue AI di sisi API. Mengirim job ke Redis; worker yang
 * mengonsumsi. Nama queue harus sama dengan di worker ('ai-jobs').
 * Connection memakai opsi (bukan instance ioredis) agar BullMQ memakai
 * ioredis bawaannya.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = redisConnection(REDIS_URL, 'producer');

export const AI_QUEUE_NAME = 'ai-jobs';

export const aiQueue = new Queue(AI_QUEUE_NAME, { connection });
let producerClient: Awaited<ReturnType<typeof aiQueue.waitUntilReady>> | undefined;
void aiQueue
  .waitUntilReady()
  .then((client) => {
    producerClient = client;
  })
  .catch(() => {});
aiQueue.on('error', () => console.error('[queue] Redis connection unavailable.'));

/**
 * Enqueue job AI. Priority numerik BullMQ: makin kecil makin diprioritaskan,
 * jadi Pro (priority 1) didahulukan dari Free (priority 2).
 */
export async function enqueueAiJob(jobId: string, priority: number): Promise<void> {
  // The initial Queue.client promise may wait forever; never hold a SQL lock for it.
  if (!producerClient || producerClient.status !== 'ready')
    throw new Error('Queue producer is not ready.');
  const existing = await aiQueue.getJob(jobId);
  if (existing && (await existing.getState()) === 'failed') {
    const current = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
    if (current?.status === 'pending') await existing.retry();
    return;
  }
  await aiQueue.add(
    'generate',
    { jobId },
    {
      jobId,
      priority,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}
