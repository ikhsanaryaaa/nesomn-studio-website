import { Queue, Worker } from 'bullmq';

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

// Placeholder queue — logika job AI nyata ditambahkan pada milestone AI.
export const aiQueue = new Queue(QUEUE_NAME, { connection });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    // Belum memproses logika nyata; sekadar log untuk membuktikan koneksi.
    console.log(`📥 received job ${job.id} (${job.name}) — no-op for now`);
  },
  { connection },
);

worker.on('ready', () => {
  console.log('✅ worker ready');
});

worker.on('error', (err) => {
  console.error('❌ worker error:', err.message);
});

console.log(`🔧 worker starting, listening on queue "${QUEUE_NAME}"...`);
