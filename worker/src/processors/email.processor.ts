import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// Configure Nodemailer transporter using env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: parseInt(process.env.SMTP_PORT ?? '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
    
    if (process.env.SMTP_ENABLED !== 'true') {
      console.info(`[worker:email] SMTP_ENABLED is false. Mocking email to ${to}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.info(`[worker:email] Mock Email sent successfully to ${to}. Subject: "${subject}"`);
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: `"LeadFlow Automation" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      console.info(`[worker:email] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    } catch (err) {
      console.error(`[worker:email] Failed to send email to ${to}:`, err);
      throw err; // Re-throw to let BullMQ retry or mark as failed
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    settings: {
      stalledInterval: 300000,
      drainDelay: 10,
    }
  }
);

emailWorker.on('completed', (job) => {
  console.info(`[worker:email] Job ${job.id} completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[worker:email] Job ${job?.id} failed with error:`, err);
});
