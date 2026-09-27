import { Router } from 'express';
import {
  getCurrentClient,
  listClients,
  getClient,
  convertLeadToClient,
} from '../controllers/client.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

export const clientRouter = Router();

clientRouter.use(authenticate);

// Client self-service portal profile
clientRouter.get('/me', requireRole('client'), getCurrentClient);

// Advisors & Admins client management
clientRouter.get('/',    requireRole('brokerage_admin', 'advisor'), listClients);
clientRouter.get('/:id', requireRole('brokerage_admin', 'advisor'), getClient);
clientRouter.post('/convert/:id', requireRole('brokerage_admin', 'advisor'), convertLeadToClient);
