import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { brokerageRouter } from './routes/brokerages';
import { userRouter } from './routes/users';
import { leadRouter } from './routes/leads';
import { webhookRouter } from './routes/webhook';
import { clientRouter } from './routes/clients';
import { documentRouter } from './routes/documents';
import { dashboardRouter } from './routes/dashboard';
import { emailTemplateRouter } from './routes/emailTemplates';
import { taskRouter } from './routes/tasks';
import { pipelineStageConfigRouter } from './routes/pipelineStageConfigs';

export const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — tighten origins in production via env var ───────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.CLIENT_URL ?? 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Global rate limiters ─────────────────────────────────────────────────────
// Strict limiter for auth endpoints — prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,  // 15 minutes
  max: 20,                // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// General API limiter — allows normal usage, blocks scripts
const apiLimiter = rateLimit({
  windowMs: 60_000,       // 1 minute
  max: 300,               // 300 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health', // never limit health checks
  message: { success: false, error: 'API rate limit exceeded. Slow down and retry.' },
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.get('/api', (_req, res) => {
  res.json({ service: 'LeadFlow API', version: '1.0.0', status: 'ok' });
});

// Phase 1 — Auth & tenant management (strict rate limit on auth)
app.use('/api/auth',       authLimiter, authRouter);
app.use('/api/brokerages', apiLimiter,  brokerageRouter);
app.use('/api/users',      apiLimiter,  userRouter);

// Phase 2 — Leads & webhook ingestion
app.use('/api/leads',    apiLimiter, leadRouter);
app.use('/api/webhooks', webhookRouter); // webhook has its own per-slug limiter

// Phase 4 — Clients & documents
app.use('/api/clients',   apiLimiter, clientRouter);
app.use('/api/documents', apiLimiter, documentRouter);

// Phase 6 — Dashboard metrics (Redis cached)
app.use('/api/dashboard', apiLimiter, dashboardRouter);

// Phase 7 — Email Templates, Tasks & Automation
app.use('/api/email-templates',         apiLimiter, emailTemplateRouter);
app.use('/api/tasks',                   apiLimiter, taskRouter);
app.use('/api/pipeline-stage-configs',  apiLimiter, pipelineStageConfigRouter);


// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global async error handler ───────────────────────────────────────────────
// Catches errors thrown from async controllers (express-async-errors pattern).
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[app] Unhandled error:', err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal server error', stack: err.stack });
});
