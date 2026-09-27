// Trigger restart
import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processDocumentVerification } from './processors/document.processor';
import { emailWorker } from './processors/email.processor';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/leadflow';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10);

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

async function startWorker() {
  console.info('[worker] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.info('[worker] ✓ Connected to MongoDB');

  // ── Document Verification Worker ───────────────────────────────────────────
  const documentWorker = new Worker(
    'document-verification',
    processDocumentVerification,
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
    }
  );

  documentWorker.on('ready', () => {
    console.info(`[worker] ✓ Document verification worker ready (concurrency: ${CONCURRENCY})`);
  });

  documentWorker.on('completed', (job) => {
    console.info(`[worker] ✓ Job ${job.id} completed successfully`);
  });

  documentWorker.on('failed', (job, err) => {
    console.error(`[worker] ✗ Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  // ── Health Check Worker ───────────────────────────────────────────────────
  const healthWorker = new Worker(
    'health-check',
    async (job) => {
      console.info(`[worker] Processing job ${job.id} on queue "health-check"`, job.data);
      return { processed: true };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  console.info('[worker] LeadFlow background worker process running — listening for jobs...');

  // Graceful shutdown
  async function shutdown() {
    console.info('\n[worker] Shutting down gracefully...');
    await documentWorker.close();
    await emailWorker.close();
    await healthWorker.close();
    await redisConnection.quit();
    await mongoose.disconnect();
    console.info('[worker] Shutdown complete.');
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch((err) => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});
