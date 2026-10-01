import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { productionEmailService } from '../services/email.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export interface EmailJobData {
  brokerageId: string;
  templateId?: string;
  to: string;
  subject: string;
  html: string;
}

export const emailWorker = new Worker(
  'email-sending',
  async (job: Job<EmailJobData>) => {
    const { to, subject, html } = job.data;
    console.info(`[worker:email] Processing job ${job.id} - sending to ${to}`);

    const result = await productionEmailService.sendEmail({
      to,
      subject,
      html,
    });

    if (!result.success) {
      throw new Error(`[worker:email] Email delivery failed via ${result.provider}: ${result.error}`);
    }

    console.info(`[worker:email] Job ${job.id} delivered successfully via provider: ${result.provider}`);
  },
  {
    connection: redisConnection,
    concurrency: 5,
    stalledInterval: 300000,
    drainDelay: 10,
  }
);

emailWorker.on('completed', (job) => {
  console.info(`[worker:email] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[worker:email] Job ${job?.id} failed:`, err.message);
});
