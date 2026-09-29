import { Router } from 'express';
import { login, register, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { LoginSchema, RegisterSchema } from '../middleware/schemas';

export const authRouter = Router();

// Public
authRouter.post('/login',    validate(LoginSchema),    login);
authRouter.post('/register', authenticate, validate(RegisterSchema), register);

// Protected
authRouter.get('/me', authenticate, me);

import { User } from '../models/User';
import { Brokerage } from '../models/Brokerage';
import { Client } from '../models/Client';
import bcrypt from 'bcryptjs';

authRouter.get('/seed-demo', async (req, res) => {
  try {
    const hashPassword = async (pass: string) => bcrypt.hash(pass, 10);
    
    let brokerage = await Brokerage.findOne({ name: 'Demo Brokerage' });
    if (!brokerage) brokerage = await Brokerage.create({ name: 'Demo Brokerage', slug: 'demo-brokerage', domain: 'demo' });

    let admin = await User.findOne({ email: 'admin@leadflow.app' });
    if (!admin) await User.create({ email: 'admin@leadflow.app', passwordHash: await hashPassword('ChangeMe123!'), name: 'System Admin', role: 'platform_admin' });

    let broker = await User.findOne({ email: 'broker@leadflow.app' });
    if (!broker) await User.create({ email: 'broker@leadflow.app', passwordHash: await hashPassword('Broker123!'), name: 'Demo Broker', role: 'brokerage_admin', brokerageId: brokerage._id });

    let advisor = await User.findOne({ email: 'advisor@leadflow.app' });
    if (!advisor) await User.create({ email: 'advisor@leadflow.app', passwordHash: await hashPassword('Advisor123!'), name: 'Demo Advisor', role: 'advisor', brokerageId: brokerage._id });

    let clientUser = await User.findOne({ email: 'client@leadflow.app' });
    if (!clientUser) clientUser = await User.create({ email: 'client@leadflow.app', passwordHash: await hashPassword('Client123!'), name: 'John Doe', role: 'client', brokerageId: brokerage._id });

    let clientProfile = await Client.findOne({ email: 'client@leadflow.app' });
    if (!clientProfile && advisor && clientUser) {
      await Client.create({ brokerageId: brokerage._id, userId: clientUser._id, email: 'client@leadflow.app', firstName: 'John', lastName: 'Doe', phone: '+15551234567', assignedAdvisorId: advisor._id });
    }

    res.json({ success: true, message: 'Users seeded successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
