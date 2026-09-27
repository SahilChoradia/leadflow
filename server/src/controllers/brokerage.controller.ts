import { Request, Response } from 'express';
import { Brokerage } from '../models/Brokerage';
import { DashboardCache } from '../models/DashboardCache';
import type { ApiResponse, BrokerageDto, PaginatedResponse } from '@leadflow/types';

function toBrokerageDto(b: InstanceType<typeof Brokerage>): BrokerageDto {
  return {
    id:        b._id.toString(),
    name:      b.name,
    slug:      b.slug,
    createdAt: b.createdAt.toISOString(),
    isActive:  b.isActive,
  };
}

// ── POST /api/brokerages — platform_admin only ────────────────────────────────
export async function createBrokerage(req: Request, res: Response): Promise<void> {
  const { name, slug } = req.body as { name?: string; slug?: string };

  if (!name || !slug) {
    res.status(400).json({ success: false, error: 'name and slug are required' });
    return;
  }

  const slugNorm = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (slugNorm !== slug) {
    res.status(400).json({ success: false, error: 'slug must be lowercase alphanumeric with hyphens only' });
    return;
  }

  const existing = await Brokerage.findOne({ slug: slugNorm });
  if (existing) {
    res.status(409).json({ success: false, error: `Slug "${slugNorm}" is already taken` });
    return;
  }

  const brokerage = await Brokerage.create({ name, slug: slugNorm });

  // Seed an empty dashboard cache record for this brokerage
  await DashboardCache.create({ brokerageId: brokerage._id });

  const response: ApiResponse<BrokerageDto> = { success: true, data: toBrokerageDto(brokerage) };
  res.status(201).json(response);
}

// ── GET /api/brokerages — platform_admin only ─────────────────────────────────
export async function listBrokerages(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20))));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Brokerage.find({ }, null, { skipTenantCheck: true } as object)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Brokerage.countDocuments({}, { skipTenantCheck: true } as object),
  ]);

  // Brokerage has no tenantScopePlugin, so skipTenantCheck isn't needed here,
  // but the cast is harmless and documents intent for future readers.
  const response: ApiResponse<PaginatedResponse<BrokerageDto>> = {
    success: true,
    data: {
      items: items.map(toBrokerageDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.json(response);
}

// ── GET /api/brokerages/:id ───────────────────────────────────────────────────
export async function getBrokerage(req: Request, res: Response): Promise<void> {
  const brokerage = await Brokerage.findById(req.params.id);
  if (!brokerage) {
    res.status(404).json({ success: false, error: 'Brokerage not found' });
    return;
  }
  res.json({ success: true, data: toBrokerageDto(brokerage) });
}

// ── PATCH /api/brokerages/:id ─────────────────────────────────────────────────
export async function updateBrokerage(req: Request, res: Response): Promise<void> {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };

  const brokerage = await Brokerage.findByIdAndUpdate(
    req.params.id,
    { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    { new: true, runValidators: true },
  );

  if (!brokerage) {
    res.status(404).json({ success: false, error: 'Brokerage not found' });
    return;
  }
  res.json({ success: true, data: toBrokerageDto(brokerage) });
}
