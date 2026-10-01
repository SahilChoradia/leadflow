import nodemailer, { Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: 'brevo-api' | 'resend-api' | 'nodemailer-smtp' | 'mock';
  messageId?: string;
  error?: string;
}

/**
 * Clean environment variables from extra quotes or whitespace
 */
function cleanEnv(val?: string): string | undefined {
  if (!val) return undefined;
  const cleaned = val.trim().replace(/^["']|["']$/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

export class ProductionEmailService {
  private transporter: Transporter | null = null;

  constructor() {
    const host = cleanEnv(process.env.SMTP_HOST);
    const portStr = cleanEnv(process.env.SMTP_PORT) ?? '587';
    const user = cleanEnv(process.env.SMTP_USER);
    const pass = cleanEnv(process.env.SMTP_PASS);

    if (host && user && pass) {
      const port = parseInt(portStr, 10);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }
  }

  /**
   * Production Email Dispatcher with multi-provider failover:
   * 1. Brevo HTTP REST API (Port 443 - HTTPS)
   * 2. Resend HTTP REST API (Port 443 - HTTPS)
   * 3. Nodemailer SMTP (Port 465 / 587)
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, fromName = 'LeadFlow Automation' } = options;

    if (cleanEnv(process.env.SMTP_ENABLED) !== 'true') {
      console.info(`[EmailService] SMTP_ENABLED is not 'true'. Mocking email delivery to ${to}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, provider: 'mock', messageId: `mock-${Date.now()}` };
    }

    const defaultFrom = cleanEnv(process.env.SMTP_FROM) || cleanEnv(process.env.SMTP_USER) || 'ninjagaming1607@gmail.com';
    const errors: string[] = [];

    // ─── Strategy 1: Brevo HTTPS REST API (Port 443) ───────────────────────────
    const brevoApiKey = cleanEnv(process.env.BREVO_API_KEY) || 
      (cleanEnv(process.env.SMTP_PASS)?.startsWith('xkeysib-') ? cleanEnv(process.env.SMTP_PASS) : undefined);

    if (brevoApiKey) {
      try {
        console.info(`[EmailService] Attempting delivery via Brevo HTTPS API (key: ${brevoApiKey.slice(0, 10)}...) to ${to}`);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: fromName, email: defaultFrom },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { messageId?: string };
          console.info(`[EmailService] Delivered successfully via Brevo HTTPS API. MessageId: ${data.messageId ?? 'ok'}`);
          return { success: true, provider: 'brevo-api', messageId: data.messageId };
        }

        const errText = await response.text();
        const msg = `Brevo HTTPS API HTTP ${response.status}: ${errText}`;
        console.warn(`[EmailService] ${msg}`);
        errors.push(msg);
      } catch (err: any) {
        const msg = `Brevo HTTPS API network failure: ${err.message ?? err}`;
        console.warn(`[EmailService] ${msg}`);
        errors.push(msg);
      }
    }

    // ─── Strategy 2: Resend HTTPS REST API (Port 443) ──────────────────────────
    const resendApiKey = cleanEnv(process.env.RESEND_API_KEY) || 
      (cleanEnv(process.env.SMTP_PASS)?.startsWith('re_') ? cleanEnv(process.env.SMTP_PASS) : undefined);

    if (resendApiKey) {
      try {
        console.info(`[EmailService] Attempting delivery via Resend HTTPS API to ${to}`);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${defaultFrom}>`,
            to: [to],
            subject,
            html,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { id?: string };
          console.info(`[EmailService] Delivered successfully via Resend HTTPS API. ID: ${data.id ?? 'ok'}`);
          return { success: true, provider: 'resend-api', messageId: data.id };
        }

        const errText = await response.text();
        const msg = `Resend HTTPS API HTTP ${response.status}: ${errText}`;
        console.warn(`[EmailService] ${msg}`);
        errors.push(msg);
      } catch (err: any) {
        const msg = `Resend HTTPS API network failure: ${err.message ?? err}`;
        console.warn(`[EmailService] ${msg}`);
        errors.push(msg);
      }
    }

    // ─── Strategy 3: Nodemailer SMTP ───────────────────────────────────────────
    if (this.transporter && cleanEnv(process.env.SMTP_HOST)) {
      try {
        console.info(`[EmailService] Attempting delivery via Nodemailer SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT}) to ${to}`);
        const info = await this.transporter.sendMail({
          from: `"${fromName}" <${defaultFrom}>`,
          to,
          subject,
          html,
        });
        console.info(`[EmailService] Delivered successfully via Nodemailer SMTP. MessageId: ${info.messageId}`);
        return { success: true, provider: 'nodemailer-smtp', messageId: info.messageId };
      } catch (err: any) {
        const msg = `Nodemailer SMTP error: ${err.message ?? err}`;
        console.warn(`[EmailService] ${msg}`);
        errors.push(msg);
      }
    }

    // If all configured providers failed
    const combinedError = errors.length > 0 
      ? errors.join(' | ') 
      : 'No valid email configuration found (specify BREVO_API_KEY, RESEND_API_KEY, or SMTP_* env vars).';
      
    console.error(`[EmailService] All email delivery providers failed for ${to}: ${combinedError}`);
    return { success: false, provider: 'nodemailer-smtp', error: combinedError };
  }
}

export const productionEmailService = new ProductionEmailService();
