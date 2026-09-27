import { Request, Response } from 'express';
import { Lead, ILead } from '../models/Lead';
import { Client } from '../models/Client';
import { Brokerage } from '../models/Brokerage';
import { emitToBrokerage } from '../config/socket';
import { invalidateAndRefreshMetrics } from '../services/dashboard.service';
import { triggerStageAutomation } from '../services/automation.service';
import type {
  LeadDto,
  CreateLeadInput,
  UpdateLeadInput,
  ApiResponse,
  PaginatedResponse,
  PipelineStage,
  ExternalLeadWebhookPayload,
} from '@leadflow/types';

// ─── DTO helper ───────────────────────────────────────────────────────────────
function toLeadDto(lead: ILead): LeadDto {
  return {
    id:                lead._id.toString(),
    brokerageId:       lead.brokerageId.toString(),
    firstName:         lead.firstName,
    lastName:          lead.lastName,
    email:             lead.email,
    phone:             lead.phone,
    stage:             lead.stage,
    assignedAdvisorId: lead.assignedAdvisorId?.toString(),
    source:            lead.source,
    externalId:        lead.externalId,
    isDuplicate:       lead.isDuplicate,
    duplicateOfId:     lead.duplicateOfId?.toString(),
    notes:             lead.notes,
    version:           lead.version,
    createdAt:         lead.createdAt.toISOString(),
    updatedAt:         lead.updatedAt.toISOString(),
  };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────
/**
 * Check whether an email or phone already exists as a lead or client
 * within the same brokerage. Returns the matching lead ID if found.
 */
async function findDuplicate(
  brokerageId: string,
  email: string,
  phone?: string,
  excludeLeadId?: string,
): Promise<string | undefined> {
  const emailLower = email.toLowerCase().trim();

  // Check existing leads
  const leadQuery: Record<string, unknown> = {
    brokerageId,
    $or: [{ email: emailLower }, ...(phone ? [{ phone }] : [])],
  };
  if (excludeLeadId) leadQuery['_id'] = { $ne: excludeLeadId };

  const existingLead = await Lead.findOne(leadQuery);
  if (existingLead) return existingLead._id.toString();

  // Check existing clients
  const existingClient = await Client.findOne({
    brokerageId,
    $or: [{ email: emailLower }, ...(phone ? [{ phone }] : [])],
  });
  if (existingClient) return existingClient._id.toString();

  return undefined;
}

// ─── GET /api/leads ───────────────────────────────────────────────────────────
export async function listLeads(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const stage       = req.query.stage as PipelineStage | undefined;
  const page        = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit       = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? 100))));
  const skip        = (page - 1) * limit;

  const filter: Record<string, unknown> = { brokerageId };
  if (stage) filter['stage'] = stage;

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedAdvisorId', 'name email'),
    Lead.countDocuments(filter),
  ]);

  const response: ApiResponse<PaginatedResponse<LeadDto>> = {
    success: true,
    data: {
      items: leads.map(toLeadDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.json(response);
}

// ─── GET /api/leads/:id ───────────────────────────────────────────────────────
export async function getLead(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const lead = await Lead.findOne({ _id: req.params.id, brokerageId });

  // Guessing another tenant's lead ID returns 404, not 403
  if (!lead) {
    res.status(404).json({ success: false, error: 'Lead not found' });
    return;
  }
  res.json({ success: true, data: toLeadDto(lead) });
}

// ─── POST /api/leads ──────────────────────────────────────────────────────────
export async function createLead(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const body = req.body as CreateLeadInput;

  if (!body.firstName || !body.lastName || !body.email) {
    res.status(400).json({ success: false, error: 'firstName, lastName, email are required' });
    return;
  }

  // Duplicate detection
  const duplicateOfId = await findDuplicate(brokerageId, body.email, body.phone);

  const lead = await Lead.create({
    brokerageId,
    firstName:   body.firstName,
    lastName:    body.lastName,
    email:       body.email.toLowerCase().trim(),
    phone:       body.phone,
    source:      body.source ?? 'manual',
    notes:       body.notes,
    externalId:  body.externalId,
    isDuplicate: !!duplicateOfId,
    duplicateOfId,
  });

  const dto = toLeadDto(lead);
  emitToBrokerage(brokerageId, 'lead:created', dto);
  invalidateAndRefreshMetrics(brokerageId).catch(console.error);
  triggerStageAutomation(lead, null).catch(console.error);

  res.status(201).json({ success: true, data: dto });
}

// ─── PATCH /api/leads/:id ─────────────────────────────────────────────────────
// Implements optimistic concurrency — caller must supply current version.
export async function updateLead(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const body = req.body as UpdateLeadInput;

  if (body.version === undefined || body.version === null) {
    res.status(400).json({ success: false, error: 'version field is required for updates' });
    return;
  }

  const existingLead = await Lead.findOne({ _id: req.params.id, brokerageId });
  if (!existingLead) {
    res.status(404).json({ success: false, error: 'Lead not found' });
    return;
  }

  const oldStage = existingLead.stage;

  const update: Record<string, unknown> = {};
  if (body.firstName         !== undefined) update['firstName']         = body.firstName.trim();
  if (body.lastName          !== undefined) update['lastName']          = body.lastName.trim();
  if (body.email             !== undefined) update['email']             = body.email.toLowerCase().trim();
  if (body.phone             !== undefined) update['phone']             = body.phone ? body.phone.trim() : undefined;
  if (body.source            !== undefined) update['source']            = body.source;
  if (body.stage             !== undefined) update['stage']             = body.stage;
  if (body.assignedAdvisorId !== undefined) update['assignedAdvisorId'] = body.assignedAdvisorId || null;
  if (body.notes             !== undefined) update['notes']             = body.notes ?? '';

  // Re-evaluate duplicate status if email or phone is updated
  if (body.email !== undefined || body.phone !== undefined) {
    const emailToCheck = body.email !== undefined ? body.email.toLowerCase().trim() : existingLead.email;
    const phoneToCheck = body.phone !== undefined ? (body.phone ? body.phone.trim() : undefined) : existingLead.phone;
    const duplicateOfId = await findDuplicate(brokerageId, emailToCheck, phoneToCheck, req.params.id);
    update['isDuplicate'] = !!duplicateOfId;
    update['duplicateOfId'] = duplicateOfId ?? null;
  }

  // Atomic: only succeeds if _id + brokerageId + version all match
  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, brokerageId, version: body.version },
    { $set: update, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );

  if (!lead) {
    // Version mismatch — concurrent edit detected
    const current = await Lead.findOne({ _id: req.params.id, brokerageId });
    if (!current) {
      res.status(404).json({ success: false, error: 'Lead not found' });
    } else {
      res.status(409).json({
        success: false,
        error: 'Conflict: this lead was modified by another user. Refresh and try again.',
        currentVersion: current.version,
        data: toLeadDto(current), // return current state so client can show a diff
      });
    }
    return;
  }

  const dto = toLeadDto(lead);
  emitToBrokerage(brokerageId, 'lead:updated', dto);
  invalidateAndRefreshMetrics(brokerageId).catch(console.error);
  if (body.stage !== undefined && body.stage !== oldStage) {
    triggerStageAutomation(lead, oldStage).catch(console.error);
  }

  res.json({ success: true, data: dto });
}

// ─── DELETE /api/leads/:id ────────────────────────────────────────────────────
export async function deleteLead(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const lead = await Lead.findOneAndDelete({ _id: req.params.id, brokerageId });
  if (!lead) {
    res.status(404).json({ success: false, error: 'Lead not found' });
    return;
  }
  emitToBrokerage(brokerageId, 'lead:deleted', { id: req.params.id });
  invalidateAndRefreshMetrics(brokerageId).catch(console.error);
  res.json({ success: true, message: 'Lead deleted' });
}

// ─── POST /api/webhooks/leads/:brokerageSlug ──────────────────────────────────
/**
 * External lead ingestion — idempotent.
 *
 * Idempotency guarantee:
 *   The unique index on { brokerageId, externalId, source } means an upsert
 *   with the same (externalId, source) will update the existing record, not
 *   create a duplicate. A burst of 500 identical requests will all resolve
 *   to the same document.
 */
export async function ingestWebhookLead(req: Request, res: Response): Promise<void> {
  const { brokerageSlug } = req.params;
  const body = req.body as ExternalLeadWebhookPayload;

  // Validate required fields
  if (!body.externalId || !body.source || !body.firstName || !body.lastName || !body.email) {
    res.status(400).json({
      success: false,
      error: 'externalId, source, firstName, lastName, email are required',
    });
    return;
  }

  // Resolve brokerage by slug (no auth — webhook uses slug + optional shared secret in prod)
  const brokerage = await Brokerage.findOne({ slug: brokerageSlug, isActive: true });
  if (!brokerage) {
    res.status(404).json({ success: false, error: 'Brokerage not found' });
    return;
  }

  const brokerageId = brokerage._id.toString();
  const emailLower  = body.email.toLowerCase().trim();

  // Duplicate detection before upsert
  const duplicateOfId = await findDuplicate(brokerageId, emailLower, body.phone);

  // Idempotent upsert: if (brokerageId + externalId + source) already exists,
  // update non-key fields. If not, create a new lead.
  const lead = await Lead.findOneAndUpdate(
    { brokerageId: brokerage._id, externalId: body.externalId, source: body.source },
    {
      $setOnInsert: { brokerageId: brokerage._id, version: 0, stage: 'new' },
      $set: {
        firstName:   body.firstName,
        lastName:    body.lastName,
        email:       emailLower,
        phone:       body.phone,
        notes:       body.notes,
        isDuplicate: !!duplicateOfId,
        duplicateOfId: duplicateOfId ?? null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const isNew = lead.version === 0 && !lead.updatedAt;
  const dto = toLeadDto(lead);
  emitToBrokerage(brokerageId, isNew ? 'lead:created' : 'lead:updated', dto);

  invalidateAndRefreshMetrics(brokerageId).catch(console.error);

  res.status(isNew ? 201 : 200).json({
    success: true,
    data: dto,
    meta: {
      idempotent: !isNew,          // true = same lead already existed
      isDuplicate: lead.isDuplicate,
    },
  });
}
