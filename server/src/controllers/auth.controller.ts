import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Brokerage } from '../models/Brokerage';
import type { JwtPayload, ApiResponse, UserDto } from '@leadflow/types';

const SALT_ROUNDS = 12;

function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

function toUserDto(user: InstanceType<typeof User>): UserDto {
  return {
    id:          user._id.toString(),
    email:       user.email,
    name:        user.name,
    role:        user.role,
    brokerageId: user.brokerageId?.toString(),
    createdAt:   user.createdAt.toISOString(),
    isActive:    user.isActive,
  };
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'email and password are required' });
    return;
  }

  // Select passwordHash explicitly (it's select:false on the schema)
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  if (!user || !user.isActive) {
    // Uniform timing — compare a dummy hash to prevent user-enumeration via timing
    await bcrypt.compare(password, '$2b$12$dummyhashtopreventtimingattacks00000000000000000');
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = signToken({
    sub:         user._id.toString(),
    role:        user.role,
    brokerageId: user.brokerageId?.toString(),
  });

  const response: ApiResponse<{ token: string; user: UserDto }> = {
    success: true,
    data: { token, user: toUserDto(user) },
  };
  res.json(response);
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Only brokerage_admin can create advisor accounts within their brokerage.
// Platform_admin can create brokerage_admin accounts.
export async function register(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const { email, password, name, role, brokerageId } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    brokerageId?: string;
  };

  if (!email || !password || !name || !role) {
    res.status(400).json({ success: false, error: 'email, password, name, role are required' });
    return;
  }

  // Role permission matrix
  const allowedToCreate: Record<string, string[]> = {
    platform_admin:   ['brokerage_admin'],
    brokerage_admin:  ['advisor', 'client'],
  };

  const permitted = allowedToCreate[caller.role] ?? [];
  if (!permitted.includes(role)) {
    res.status(403).json({
      success: false,
      error: `Your role (${caller.role}) cannot create users with role (${role})`,
    });
    return;
  }

  // Determine the target brokerageId
  let targetBrokerageId: string | undefined;
  if (caller.role === 'platform_admin') {
    if (!brokerageId) {
      res.status(400).json({ success: false, error: 'brokerageId is required when platform_admin creates a user' });
      return;
    }
    const brokerage = await Brokerage.findById(brokerageId);
    if (!brokerage) {
      res.status(404).json({ success: false, error: 'Brokerage not found' });
      return;
    }
    targetBrokerageId = brokerageId;
  } else {
    // brokerage_admin can only create users in their own brokerage
    targetBrokerageId = caller.brokerageId;
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    res.status(409).json({ success: false, error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email: email.toLowerCase().trim(),
    passwordHash,
    name,
    role,
    brokerageId: targetBrokerageId,
  });

  const response: ApiResponse<UserDto> = { success: true, data: toUserDto(user) };
  res.status(201).json(response);
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, error: 'User not found or inactive' });
    return;
  }
  res.json({ success: true, data: toUserDto(user) });
}
