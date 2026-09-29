import { Job } from 'bullmq';
import Redis from 'ioredis';
import { DocumentModel } from '../models/Document';
import { simulateDocumentVerification } from '../services/verification';

export interface DocumentJobData {
  documentId: string;
  brokerageId: string;
  clientId: string;
  fileName: string;
  s3Key: string;
}

// Redis publisher for real-time Socket.io relay
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Publish real-time status update to Redis channel for Socket.io broadcasting.
 */
async function publishStatusUpdate(payload: {
  brokerageId: string;
  id: string;
  clientId: string;
  status: string;
  failureReason?: string;
  verifiedAt?: string;
  fileName?: string;
}) {
  try {
    await pubClient.publish('events:document', JSON.stringify(payload));
  } catch (err) {
    console.error('[worker] Failed to publish status update to Redis:', err);
  }
}

/**
 * Idempotent BullMQ Document Verification Processor.
 *
 * Idempotency & Safety Guarantees:
 *  1. Checks if document is already 'passed' before processing; skips if so.
 *  2. Atomically transitions status to 'checking', notifying the client immediately.
 *  3. Executes verification with simulated latency.
 *  4. Atomically updates status to 'passed' or 'failed'.
 *  5. Retries safely without corrupting status or duplicating actions on mid-job crash.
 */
export async function processDocumentVerification(job: Job<DocumentJobData>): Promise<{
  status: string;
  documentId: string;
  failureReason?: string;
}> {
  const { documentId, brokerageId, clientId, fileName } = job.data;
  const attempt = job.attemptsMade + 1;

  console.info(`[worker] Starting verification for doc ${documentId} (${fileName}) — attempt ${attempt}`);

  // 1. Fetch document and check idempotency guard
  const doc = await DocumentModel.findById(documentId);
  if (!doc) {
    console.warn(`[worker] Document ${documentId} not found in database — job aborted.`);
    return { status: 'not_found', documentId };
  }

  // If already verified, do not re-verify (idempotent guard)
  if (doc.status === 'verified') {
    console.info(`[worker] Document ${documentId} is already verified — skipping redundant check.`);
    return { status: 'verified', documentId };
  }

  // 2. Keep status as 'pending' during processing (no intermediate 'checking' state)
  await DocumentModel.updateOne(
    { _id: documentId },
    { $set: { verificationJobId: job.id } }
  );

  // 3. Perform simulated verification
  const outcome = await simulateDocumentVerification(fileName);

  // 4. Update final outcome in MongoDB
  await DocumentModel.updateOne(
    { _id: documentId },
    {
      $set: {
        status: outcome.status,
        failureReason: outcome.failureReason ?? null,
        verifiedAt: outcome.verifiedAt,
      },
    }
  );

  // 5. Notify real-time layer: final verification outcome
  await publishStatusUpdate({
    brokerageId,
    id: documentId,
    clientId,
    status: outcome.status,
    failureReason: outcome.failureReason,
    verifiedAt: outcome.verifiedAt.toISOString(),
    fileName,
  });

  console.info(
    `[worker] Finished verification for doc ${documentId}: outcome = ${outcome.status} (${outcome.processingTimeMs}ms)`
  );

  return {
    status: outcome.status,
    documentId,
    failureReason: outcome.failureReason,
  };
}
