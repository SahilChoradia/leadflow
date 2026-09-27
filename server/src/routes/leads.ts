import { Router } from 'express';
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
} from '../controllers/lead.controller';
import { convertLeadToClient } from '../controllers/client.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { CreateLeadSchema, UpdateLeadSchema } from '../middleware/schemas';

export const leadRouter = Router();

leadRouter.use(authenticate);

// All brokerage roles can read leads
leadRouter.get('/',    requireRole('brokerage_admin', 'advisor'), listLeads);
leadRouter.get('/:id', requireRole('brokerage_admin', 'advisor'), getLead);

// Create — advisor and above
leadRouter.post('/', requireRole('brokerage_admin', 'advisor'), validate(CreateLeadSchema), createLead);

// Convert lead to active client — advisor and above
leadRouter.post('/:id/convert', requireRole('brokerage_admin', 'advisor'), convertLeadToClient);

// Update (stage move, reassign) — advisor and above
leadRouter.patch('/:id', requireRole('brokerage_admin', 'advisor'), validate(UpdateLeadSchema), updateLead);

// Delete — brokerage_admin only
leadRouter.delete('/:id', requireRole('brokerage_admin'), deleteLead);
