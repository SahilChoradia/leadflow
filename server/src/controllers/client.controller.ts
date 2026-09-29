import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Client, IClient } from '../models/Client';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import { emitToBrokerage } from '../config/socket';
import { invalidateAndRefreshMetrics } from '../services/dashboard.service';
import type { ClientDto, ApiResponse, PaginatedResponse, LeadDto } from '@leadflow/types';

function toClientDto(client: IClient): ClientDto {
  return {
    id:                client._id.toString(),
    brokerageId:       client.brokerageId.toString(),
    userId:            client.userId.toString(),
    leadId:            client.leadId?.toString() ?? '',
    firstName:         client.firstName,
    lastName:          client.lastName,
    email:             client.email,
    phone:             client.phone,
    caseStatus:        client.caseStatus,
    assignedAdvisorId: client.assignedAdvisorId?.toString(),
    createdAt:         client.createdAt.toISOString(),
  };
}

/**
 * Convert a Lead to an active Client with portal access.
 * POST /api/leads/:id/convert
 */
export async function convertLeadToClient(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const leadId = req.params.id;
  const { temporaryPassword = 'Client123!', caseStatus = 'active' } = req.body;

  const lead = await Lead.findOne({ _id: leadId, brokerageId });
  if (!lead) {
    res.status(404).json({ success: false, error: 'Lead not found' });
    return;
  }

  // Check if lead was already converted
  const existingClient = await Client.findOne({ leadId: lead._id, brokerageId });
  if (existingClient) {
    res.status(409).json({
      success: false,
      error: 'This lead has already been converted to a client',
      data: toClientDto(existingClient),
    });
    return;
  }

  // Find or create the linked User account for portal login
  let user = await User.findOne({ email: lead.email.toLowerCase().trim() });
  let createdNewUser = false;

  if (!user) {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    user = await User.create({
      email:        lead.email.toLowerCase().trim(),
      passwordHash,
      name:         `${lead.firstName} ${lead.lastName}`,
      role:         'client',
      brokerageId:  lead.brokerageId,
    });
    createdNewUser = true;
  }

  // Create Client record
  const client = await Client.create({
    brokerageId,
    userId:             user._id,
    leadId:             lead._id,
    firstName:          lead.firstName,
    lastName:           lead.lastName,
    email:              lead.email.toLowerCase().trim(),
    phone:              lead.phone,
    caseStatus,
    assignedAdvisorId:  lead.assignedAdvisorId,
  });

  // Update lead stage to 'won' and increment version
  lead.stage = 'won';
  lead.version += 1;
  await lead.save();

  const clientDto = toClientDto(client);

  // Broadcast lead stage update to tenant room
  const updatedLeadDto: LeadDto = {
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

  emitToBrokerage(brokerageId, 'lead:updated', updatedLeadDto);
  emitToBrokerage(brokerageId, 'client:created', clientDto);

  invalidateAndRefreshMetrics(brokerageId).catch(console.error);

  res.status(201).json({
    success: true,
    data: {
      client: clientDto,
      credentials: createdNewUser
        ? { email: user.email, temporaryPassword }
        : { email: user.email, note: 'Existing account credentials' },
    },
    message: 'Lead successfully converted to client',
  });
}

/**
 * Get current logged-in client profile.
 * GET /api/clients/me
 */
export async function getCurrentClient(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const brokerageId = req.user!.brokerageId;
  const client = await Client.findOne({ userId, brokerageId }).populate('assignedAdvisorId', 'name email phone');

  if (!client) {
    res.status(404).json({ success: false, error: 'Client profile not found for this user' });
    return;
  }

  res.json({
    success: true,
    data: {
      ...toClientDto(client),
      assignedAdvisor: client.assignedAdvisorId
        ? {
            id: (client.assignedAdvisorId as any)._id.toString(),
            name: (client.assignedAdvisorId as any).name,
            email: (client.assignedAdvisorId as any).email,
          }
        : undefined,
    },
  });
}

/**
 * List clients for current brokerage.
 * GET /api/clients
 */
export async function listClients(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const page  = Math.max(1, parseInt(String(req.query.page ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));
  const skip  = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    Client.find({ brokerageId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedAdvisorId', 'name email'),
    Client.countDocuments({ brokerageId }),
  ]);

  res.json({
    success: true,
    data: {
      items: clients.map(toClientDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * Get client by ID.
 * GET /api/clients/:id
 */
export async function getClient(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const client = await Client.findOne({ _id: req.params.id, brokerageId }).populate('assignedAdvisorId', 'name email');

  if (!client) {
    res.status(404).json({ success: false, error: 'Client not found' });
    return;
  }

  res.json({ success: true, data: toClientDto(client) });
}
