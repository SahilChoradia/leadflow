import { Router } from 'express';
import { listUsers, getUser, updateUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

export const userRouter = Router();

userRouter.use(authenticate);

// List users — brokerage_admin and advisor can list (advisor sees teammates)
userRouter.get('/',    requireRole('brokerage_admin', 'advisor'), listUsers);
userRouter.get('/:id', requireRole('brokerage_admin', 'advisor'), getUser);

// Updates — brokerage_admin only
userRouter.patch('/:id', requireRole('brokerage_admin'), updateUser);
