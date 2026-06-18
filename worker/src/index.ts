import { Queue, Worker } from 'bullmq';
import { processJob } from './process-job.ts';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Pass connection options (bukan instance ioredis) agar BullMQ memakai
// ioredis bawaannya sendiri — menghindari konflik versi tipe.
const redisUrl = new URL(REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  maxRetriesPerRequest: null,
};

const QUEUE_NAME = 'ai-jobs';

// Queue dipakai juga oleh API (producer). Worker mengonsumsi & memproses.
export const aiQueue = new Queue(QUEUE_NAME, { connection });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { jobId } = job.data as { jobId: string };
    console.log(`📥 memproses job ${jobId}`);
    const result = await processJob(jobId);
    console.log(`✔ job ${jobId} selesai: ${result.status}`);
    return result;
  },
  // Concurrency 2: beberapa user dapat diproses paralel; 1 job/user
  // ditegakkan di API. Priority (Pro > Free) diatur saat enqueue.
  { connection, concurrency: 2 },
);

worker.on('ready', () => {
  console.log('✅ worker ready');
});

worker.on('error', (err) => {
  console.error('❌ worker error:', err.message);
});

console.log(`🔧 worker starting, listening on queue "${QUEUE_NAME}"...`);
