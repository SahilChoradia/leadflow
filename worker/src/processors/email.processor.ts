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

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'ninjagaming1607@gmail.com';

    // 1. Send via Brevo HTTPS REST API (Port 443) if BREVO_API_KEY is provided or SMTP_PASS starts with xkeysib-
    const brevoApiKey = process.env.BREVO_API_KEY || (process.env.SMTP_PASS?.startsWith('xkeysib-') ? process.env.SMTP_PASS : undefined);
    if (brevoApiKey) {
      try {
        console.info(`[worker:email] Sending via Brevo HTTPS REST API (Port 443) to ${to}`);
        const apiRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
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
          console.info(`[worker:email] Email sent successfully via Brevo HTTPS API to ${to}. MessageId: ${resData.messageId ?? 'ok'}`);
          return;
        }

        const errorText = await apiRes.text();
        console.error(`[worker:email] Brevo HTTPS API error (HTTP ${apiRes.status}): ${errorText}`);
      } catch (httpErr) {
        console.error(`[worker:email] Brevo HTTPS API request failed:`, httpErr);
      }
    }

    // 2. Send via Resend HTTPS REST API (Port 443) if RESEND_API_KEY is provided or SMTP_PASS starts with re_
    const resendApiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS : undefined);
    if (resendApiKey) {
      try {
        console.info(`[worker:email] Sending via Resend HTTPS API (Port 443) to ${to}`);
        const apiRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `LeadFlow <${fromAddress}>`,
            to: [to],
            subject,
            html,
          }),
        });

        if (apiRes.ok) {
          const resData = await apiRes.json() as { id?: string };
          console.info(`[worker:email] Email sent successfully via Resend HTTPS API to ${to}. ID: ${resData.id ?? 'ok'}`);
          return;
        }

        const errorText = await apiRes.text();
        console.error(`[worker:email] Resend HTTPS API error (HTTP ${apiRes.status}): ${errorText}`);
      } catch (httpErr) {
        console.error(`[worker:email] Resend HTTPS API request failed:`, httpErr);
      }
    }

    // 3. Fallback / Standard Nodemailer SMTP
    try {
      console.info(`[worker:email] Attempting Nodemailer SMTP to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}...`);
      const info = await transporter.sendMail({
        from: `"LeadFlow Automation" <${fromAddress}>`,
        to,
        subject,
        html,
      });
      console.info(`[worker:email] Email sent successfully via SMTP to ${to}. MessageId: ${info.messageId}`);
    } catch (err) {
      console.error(`[worker:email] Failed to send email to ${to} via SMTP:`, err);
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
