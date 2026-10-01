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
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 15000,
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

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const apiKey = process.env.BREVO_API_KEY || (process.env.SMTP_PASS?.startsWith('xsmtpsib-') ? process.env.SMTP_PASS : undefined);

    // 1. Permanent Fix: If Brevo API key is available or Brevo SMTP is configured, send via HTTPS REST API (Port 443)
    if (apiKey && (process.env.SMTP_HOST?.includes('brevo') || process.env.BREVO_API_KEY)) {
      try {
        console.info(`[worker:email] Sending via Brevo HTTPS REST API (Port 443) to ${to}`);
        const apiRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'LeadFlow Automation', email: fromAddress },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        if (apiRes.ok) {
          const resData = await apiRes.json() as { messageId?: string };
          console.info(`[worker:email] Email sent successfully via HTTPS API to ${to}. MessageId: ${resData.messageId ?? 'ok'}`);
          return;
        }

        const errorText = await apiRes.text();
        console.warn(`[worker:email] Brevo HTTPS API returned HTTP ${apiRes.status}: ${errorText}. Falling back to Nodemailer SMTP...`);
      } catch (httpErr) {
        console.warn(`[worker:email] Brevo HTTPS API request failed:`, httpErr, `. Falling back to Nodemailer SMTP...`);
      }
    }

    // 2. Fallback / Standard Nodemailer SMTP
    try {
      const info = await transporter.sendMail({
        from: `"LeadFlow Automation" <${fromAddress}>`,
        to,
        subject,
        html,
      });
      console.info(`[worker:email] Email sent successfully via SMTP to ${to}. MessageId: ${info.messageId}`);
    } catch (err) {
      console.error(`[worker:email] Failed to send email to ${to}:`, err);
      throw err; // Re-throw to let BullMQ retry or mark as failed
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    stalledInterval: 300000,
    drainDelay: 10,
  }
);

emailWorker.on('completed', (job) => {
  console.info(`[worker:email] Job ${job.id} completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[worker:email] Job ${job?.id} failed with error:`, err);
});
