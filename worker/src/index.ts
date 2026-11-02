import { Worker } from 'bullmq';
import { unlink } from 'node:fs/promises';
import { redisConnection } from '@nesomn/api/src/lib/redis.ts';
import { readRuntimeEnv } from '@nesomn/api/src/lib/runtime-env.ts';
import { startWorkerHealth } from './health-http.ts';

if (process.env.NODE_ENV === 'production') {
  try {
    readRuntimeEnv(process.env, 'worker');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Worker environment invalid');
    process.exit(1);
  }
}
const { processJob, recoverJobs } = await import('./process-job.ts');
const { dispatchOutbox } = await import('@nesomn/api/src/modules/ai/outbox.ts');
const { aiQueue } = await import('@nesomn/api/src/modules/ai/queue.ts');
const { sql } = await import('@nesomn/api/src/db/client.ts');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Pass connection options (bukan instance ioredis) agar BullMQ memakai
// ioredis bawaannya sendiri — menghindari konflik versi tipe.
const connection = redisConnection(REDIS_URL, 'worker');

const QUEUE_NAME = 'ai-jobs';

let workerInitialized = false;
const activeJobs = new Set<ReturnType<typeof processJob>>();
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { jobId } = job.data as { jobId: string };
    console.log(`📥 memproses job ${jobId}`);
    const task = processJob(jobId);
    activeJobs.add(task);
    let result;
    try {
      result = await task;
    } finally {
      activeJobs.delete(task);
    }
    console.log(`✔ job ${jobId} selesai: ${result.status}`);
    return result;
  },
  // Concurrency 2: beberapa user dapat diproses paralel; 1 job/user
  // ditegakkan di API. Priority (Pro > Free) diatur saat enqueue.
  { connection, concurrency: 2 },
);

worker.on('ready', () => {
  workerInitialized = true;
  console.log('✅ worker ready');
});

worker.on('error', () => {
  console.error('Worker connection error; retrying connection.');
});

console.log(`🔧 worker starting, listening on queue "${QUEUE_NAME}"...`);

let closing = false;
let maintenanceTask: Promise<void> | undefined;
function maintenance() {
  if (closing || maintenanceTask) return;
  maintenanceTask = (async () => {
    try {
      await recoverJobs();
      await dispatchOutbox();
    } catch {
      console.error('Job maintenance unavailable; will retry.');
    }
  })().finally(() => {
    maintenanceTask = undefined;
  });
}
const maintenanceInterval = setInterval(maintenance, 5000);
maintenanceInterval.unref();
maintenance();
const healthFile = '/tmp/nesomn-worker-health.json';
const healthServer = startWorkerHealth(process.env.WORKER_HEALTH_PORT, async () => {
  const state = await Bun.file(healthFile).json();
  return (
    !closing &&
    workerInitialized &&
    worker.isRunning() &&
    state.ready === true &&
    Date.now() - state.updatedAt <= 30000
  );
});
async function heartbeat() {
  if (!workerInitialized) return;
  try {
    const client = await worker.client;
    await Bun.write(
      healthFile,
      JSON.stringify({
        ready: !closing && worker.isRunning() && client.status === 'ready',
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* Healthcheck fails while Redis is unavailable. */
  }
}
worker.on('ready', () => {
  void heartbeat();
});
const interval = setInterval(() => {
  void heartbeat();
}, 5000);
interval.unref();

async function shutdown() {
  if (closing) return;
  closing = true;
  await healthServer?.stop(true);
  clearInterval(interval);
  clearInterval(maintenanceInterval);
  await maintenanceTask;
  await unlink(healthFile).catch(() => {});
  console.log('Worker draining active jobs');
  await Promise.allSettled([...activeJobs]);
  const redisReady = workerInitialized && (await worker.client).status === 'ready';
  await worker.close(!redisReady);
  await aiQueue.close();
  await sql.end({ timeout: 5 });
  console.log('Worker stopped');
  process.exit(0);
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
