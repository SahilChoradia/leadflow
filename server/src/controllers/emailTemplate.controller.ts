import { Request, Response } from 'express';
import { EmailTemplate, IEmailTemplate } from '../models/EmailTemplate';
import { enqueueEmail } from '../queues/email.queue';
import type { EmailTemplateDto, ApiResponse, PaginatedResponse } from '@leadflow/types';

function toDto(template: IEmailTemplate): EmailTemplateDto {
  return {
    id:           template._id.toString(),
    brokerageId:  template.brokerageId.toString(),
    name:         template.name,
    subject:      template.subject,
    bodyHtml:     template.bodyHtml,
    placeholders: template.placeholders,
    createdAt:    template.createdAt.toISOString(),
    updatedAt:    template.updatedAt.toISOString(),
  };
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const templates = await EmailTemplate.find({ brokerageId }).sort({ createdAt: -1 });

  const response: ApiResponse<PaginatedResponse<EmailTemplateDto>> = {
    success: true,
    data: {
      items: templates.map(toDto),
      total: templates.length,
      page: 1,
      limit: templates.length,
      totalPages: 1,
    },
  };
  res.json(response);
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const template = await EmailTemplate.findOne({ _id: req.params.id, brokerageId });
  
  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }
  res.json({ success: true, data: toDto(template) });
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const { name, subject, bodyHtml } = req.body;

  if (!name || !subject || !bodyHtml) {
    res.status(400).json({ success: false, error: 'name, subject, and bodyHtml are required' });
    return;
  }

  // Extract placeholders using a simple regex (e.g. {{clientName}})
  const placeholders = extractPlaceholders(bodyHtml);

  const template = await EmailTemplate.create({
    brokerageId,
    name,
    subject,
    bodyHtml,
    placeholders,
  });

  res.status(201).json({ success: true, data: toDto(template) });
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const { name, subject, bodyHtml } = req.body;

  const update: any = {};
  if (name !== undefined) update.name = name;
  if (subject !== undefined) update.subject = subject;
  if (bodyHtml !== undefined) {
    update.bodyHtml = bodyHtml;
    update.placeholders = extractPlaceholders(bodyHtml);
  }

  const template = await EmailTemplate.findOneAndUpdate(
    { _id: req.params.id, brokerageId },
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }

  res.json({ success: true, data: toDto(template) });
}

export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, brokerageId });
  
  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }
  res.json({ success: true, message: 'Template deleted' });
}

export async function sendEmail(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const { to, templateId, variables } = req.body;

  if (!to || !templateId) {
    res.status(400).json({ success: false, error: 'to and templateId are required' });
    return;
  }

  const template = await EmailTemplate.findOne({ _id: templateId, brokerageId });
  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }

  let html = template.bodyHtml;
  let subject = template.subject;
  
  // Replace placeholders
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, String(value));
      subject = subject.replace(regex, String(value));
    }
  }

  await enqueueEmail({
    brokerageId,
    templateId,
    to,
    subject,
    html,
  });

  res.json({ success: true, message: 'Email queued for sending' });
}

function extractPlaceholders(html: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
}
