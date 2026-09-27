import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { emitToBrokerage } from '../config/socket';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Dedicated connection for Queue
const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const documentQueue = new Queue('document-verification', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export interface DocumentVerificationJobData {
  documentId: string;
  brokerageId: string;
  clientId: string;
  fileName: string;
  s3Key: string;
}

/**
 * Enqueue a document for background verification.
 * Uses deterministic jobId to prevent duplicate queueing for the same document.
 */
export async function enqueueDocumentVerification(data: DocumentVerificationJobData): Promise<string> {
  const jobId = `verify-doc-${data.documentId}`;

  const job = await documentQueue.add('verify-document', data, {
    jobId,
  });

  console.info(`[queue] Enqueued document verification job: ${job.id} for document ${data.documentId}`);
  return job.id!;
}

// ── Redis Pub/Sub Subscriber for Worker Events ───────────────────────────────
// Allows worker process to push real-time status updates to Socket.io
const subClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export function initWorkerEventSubscriber(): void {
  subClient.subscribe('events:document', (err) => {
    if (err) {
      console.error('[queue] Failed to subscribe to events:document:', err);
    } else {
      console.info('[queue] Subscribed to Redis channel events:document');
    }
  });

  subClient.on('message', (channel, message) => {
    if (channel === 'events:document') {
      try {
        const payload = JSON.parse(message);
        const { brokerageId, ...eventData } = payload;
        if (brokerageId) {
          emitToBrokerage(brokerageId, 'doc:status', eventData);
        }
      } catch (err) {
        console.error('[queue] Error processing Redis pub/sub message:', err);
      }
    }
  });
}
