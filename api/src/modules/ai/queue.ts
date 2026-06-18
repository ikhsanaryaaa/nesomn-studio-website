import { Queue } from 'bullmq';

/**
 * Producer queue AI di sisi API. Mengirim job ke Redis; worker yang
 * mengonsumsi. Nama queue harus sama dengan di worker ('ai-jobs').
 * Connection memakai opsi (bukan instance ioredis) agar BullMQ memakai
 * ioredis bawaannya.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisUrl = new URL(REDIS_URL);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  maxRetriesPerRequest: null,
};

export const AI_QUEUE_NAME = 'ai-jobs';

export const aiQueue = new Queue(AI_QUEUE_NAME, { connection });

/**
 * Enqueue job AI. Priority numerik BullMQ: makin kecil makin diprioritaskan,
 * jadi Pro (priority 1) didahulukan dari Free (priority 2).
 */
export async function enqueueAiJob(jobId: string, priority: number): Promise<void> {
  await aiQueue.add(
    'generate',
    { jobId },
    {
      priority,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}
