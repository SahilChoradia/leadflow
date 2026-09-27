import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email:    z.string().email('Must be a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  email:    z.string().email('Must be a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name:     z.string().min(1, 'Name is required').max(120),
  role:     z.enum(['brokerage_admin', 'advisor']).optional(),
});

// ─── Lead ─────────────────────────────────────────────────────────────────────

export const CreateLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80).trim(),
  lastName:  z.string().min(1, 'Last name is required').max(80).trim(),
  email:     z.string().email('Must be a valid email'),
  phone:     z.string().max(30).optional(),
  source:    z.string().max(60).optional(),
  notes:     z.string().max(2000).optional(),
  externalId:z.string().max(200).optional(),
});

export const UpdateLeadSchema = z.object({
  firstName:         z.string().min(1, 'First name is required').max(80).trim().optional(),
  lastName:          z.string().min(1, 'Last name is required').max(80).trim().optional(),
  email:             z.string().email('Must be a valid email').optional(),
  phone:             z.string().max(30).optional().nullable(),
  source:            z.string().max(60).optional(),
  stage:             z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).optional(),
  assignedAdvisorId: z.string().optional().nullable(),
  notes:             z.string().max(2000).optional().nullable(),
  version:           z.number().int('version must be an integer'),
});

// ─── Email Template ───────────────────────────────────────────────────────────

// Strip potentially dangerous script tags but allow basic HTML
const htmlString = z
  .string()
  .max(50_000)
  .transform((val) =>
    val
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, 'data-removed=')   // strip inline event handlers
      .trim()
  );

export const CreateEmailTemplateSchema = z.object({
  name:    z.string().min(1, 'Name is required').max(120).trim(),
  subject: z.string().min(1, 'Subject is required').max(200).trim(),
  bodyHtml:htmlString,
});

export const UpdateEmailTemplateSchema = CreateEmailTemplateSchema.partial();

export const SendEmailSchema = z.object({
  to:         z.string().email('Must be a valid recipient email'),
  templateId: z.string().min(1, 'templateId is required'),
  variables:  z.record(z.string()).optional(),
});

// ─── Task ─────────────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title:             z.string().min(1, 'Title is required').max(300).trim(),
  leadId:            z.string().optional(),
  clientId:          z.string().optional(),
  assignedAdvisorId: z.string().optional(),
  dueDate:           z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
});

export const UpdateTaskSchema = z.object({
  title:             z.string().max(300).trim().optional(),
  isCompleted:       z.boolean().optional(),
  dueDate:           z.string().nullable().optional(),
  assignedAdvisorId: z.string().nullable().optional(),
});

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

export const TaskConfigItemSchema = z.object({
  title:               z.string().min(1).max(300).trim(),
  assigneePlaceholder: z.enum(['assigned_advisor', 'any']),
  dueDaysOffset:       z.number().int().min(0).max(365),
});

export const UpsertStageConfigSchema = z.object({
  emailTemplateId: z.string().nullable().optional(),
  tasks:           z.array(TaskConfigItemSchema).max(10).optional(),
});

// ─── Brokerage ────────────────────────────────────────────────────────────────

export const CreateBrokerageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120).trim(),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only').optional(),
});
