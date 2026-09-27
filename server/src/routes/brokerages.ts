import { Router } from 'express';
import {
  createBrokerage,
  listBrokerages,
  getBrokerage,
  updateBrokerage,
} from '../controllers/brokerage.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

export const brokerageRouter = Router();

// All brokerage management is platform_admin only
brokerageRouter.use(authenticate, requireRole('platform_admin'));

brokerageRouter.post('/',    createBrokerage);
brokerageRouter.get('/',     listBrokerages);
brokerageRouter.get('/:id',  getBrokerage);
brokerageRouter.patch('/:id', updateBrokerage);
