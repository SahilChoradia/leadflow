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
