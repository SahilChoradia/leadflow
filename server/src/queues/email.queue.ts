import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-sending', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export interface EmailJobData {
  brokerageId: string;
  templateId?: string;
  to: string;
  subject: string;
  html: string;
}

export async function enqueueEmail(data: EmailJobData): Promise<string> {
  const job = await emailQueue.add('send-email', data);
  console.info(`[queue] Enqueued email job: ${job.id} to ${data.to}`);
  return job.id!;
}
