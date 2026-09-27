import { Request, Response } from 'express';
import { User } from '../models/User';
import type { ApiResponse, UserDto, PaginatedResponse } from '@leadflow/types';

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

// ── GET /api/users — list users within the caller's brokerage ─────────────────
export async function listUsers(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId;
  if (!brokerageId) {
    res.status(403).json({ success: false, error: 'Platform admins do not have a brokerage scope' });
    return;
  }

  const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));
  const skip  = (page - 1) * limit;

  const filter = { brokerageId };

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const response: ApiResponse<PaginatedResponse<UserDto>> = {
    success: true,
    data: {
      items: users.map(toUserDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.json(response);
}

// ── GET /api/users/:id ────────────────────────────────────────────────────────
export async function getUser(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const user   = await User.findById(req.params.id);

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  // Non-platform-admin can only see users in their own brokerage
  if (
    caller.role !== 'platform_admin' &&
    user.brokerageId?.toString() !== caller.brokerageId
  ) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.json({ success: true, data: toUserDto(user) });
}

// ── PATCH /api/users/:id — deactivate or rename ───────────────────────────────
export async function updateUser(req: Request, res: Response): Promise<void> {
  const caller = req.user!;
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  // Tenant guard
  if (
    caller.role !== 'platform_admin' &&
    user.brokerageId?.toString() !== caller.brokerageId
  ) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  if (name     !== undefined) user.name     = name;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();
  res.json({ success: true, data: toUserDto(user) });
}
