import mongoose from 'mongoose';
import { getRedis } from '../config/redis';
import { DashboardCache } from '../models/DashboardCache';
import { Lead } from '../models/Lead';
import { Client } from '../models/Client';
import { Task } from '../models/Task';
import { emitToBrokerage } from '../config/socket';
import type { DashboardMetrics, PipelineStage } from '@leadflow/types';

const CACHE_TTL_SECONDS = 3600; // 1 hour

function getCacheKey(brokerageId: string): string {
  return `cache:dashboard:${brokerageId}`;
}

const DEFAULT_STAGES: Record<PipelineStage, number> = {
  new: 0,
  contacted: 0,
  qualified: 0,
  won: 0,
  lost: 0,
};

/**
 * Recompute metrics from collections, persist to DashboardCache model,
 * and populate Redis cache.
 */
export async function computeAndCacheMetrics(brokerageId: string): Promise<DashboardMetrics> {
  const bId = new mongoose.Types.ObjectId(brokerageId);

  // 1. Pipeline stage aggregation
  const stageAgg = await Lead.aggregate([
    { $match: { brokerageId: bId } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);

  const stageCounts: Record<PipelineStage, number> = { ...DEFAULT_STAGES };
  let totalLeads = 0;

  for (const row of stageAgg) {
    const stage = row._id as PipelineStage;
    if (stage in stageCounts) {
      stageCounts[stage] = row.count;
      totalLeads += row.count;
    }
  }

  // 2. Conversion rate calculation: won / (won + lost)
  const won = stageCounts.won ?? 0;
  const lost = stageCounts.lost ?? 0;
  const totalClosed = won + lost;
  const conversionRate = totalClosed > 0 ? parseFloat((won / totalClosed).toFixed(4)) : 0;

  // 3. Active clients count
  const activeClients = await Client.countDocuments({
    brokerageId: bId,
    caseStatus: { $ne: 'closed' },
  });

  // 4. Overdue tasks count
  const overdueTaskCount = await Task.countDocuments({
    brokerageId: bId,
    isCompleted: false,
    dueDate: { $lt: new Date() },
  });

  const now = new Date();

  // 5. Update or insert into MongoDB DashboardCache (durable materialized view)
  await DashboardCache.findOneAndUpdate(
    { brokerageId: bId },
    {
      $set: {
        stageCounts,
        totalLeads,
        activeClients,
        overdueTaskCount,
        conversionRate,
        lastUpdatedAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const metrics: DashboardMetrics = {
    stageCounts,
    totalLeads,
    activeClients,
    overdueTaskCount,
    conversionRate,
    lastUpdatedAt: now.toISOString(),
  };

  // 6. Cache in Redis
  try {
    const redis = getRedis();
    await redis.setex(getCacheKey(brokerageId), CACHE_TTL_SECONDS, JSON.stringify(metrics));
  } catch (err) {
    console.warn('[dashboard] Failed to write metrics to Redis cache:', err);
  }

  return metrics;
}

/**
 * Fast dashboard metrics retrieval.
 * Checks Redis first (<2ms), falls back to MongoDB DashboardCache, or recomputes on cold start.
 */
export async function getDashboardMetrics(brokerageId: string): Promise<DashboardMetrics> {
  // 1. Check Redis cache first
  try {
    const redis = getRedis();
    const cached = await redis.get(getCacheKey(brokerageId));
    if (cached) {
      return JSON.parse(cached) as DashboardMetrics;
    }
  } catch (err) {
    console.warn('[dashboard] Redis cache read failed, falling back to database:', err);
  }

  // 2. Check MongoDB DashboardCache materialized document
  const doc = await DashboardCache.findOne({
    brokerageId: new mongoose.Types.ObjectId(brokerageId),
  });

  if (doc) {
    const metrics: DashboardMetrics = {
      stageCounts: doc.stageCounts as Record<PipelineStage, number>,
      totalLeads: doc.totalLeads,
      activeClients: doc.activeClients,
      overdueTaskCount: doc.overdueTaskCount,
      conversionRate: doc.conversionRate,
      lastUpdatedAt: doc.lastUpdatedAt.toISOString(),
    };

    // Repopulate Redis cache in the background
    try {
      const redis = getRedis();
      await redis.setex(getCacheKey(brokerageId), CACHE_TTL_SECONDS, JSON.stringify(metrics));
    } catch {}

    return metrics;
  }

  // 3. Cold start — compute from source documents
  return computeAndCacheMetrics(brokerageId);
}

/**
 * Invalidate cache and eagerly refresh metrics on relevant pipeline events.
 * Broadcasts updated metrics to all connected clients in the tenant room via Socket.io.
 */
export async function invalidateAndRefreshMetrics(brokerageId: string): Promise<DashboardMetrics> {
  // Clear Redis cache key immediately
  try {
    const redis = getRedis();
    await redis.del(getCacheKey(brokerageId));
  } catch (err) {
    console.warn('[dashboard] Failed to delete Redis key on invalidation:', err);
  }

  // Recompute metrics
  const freshMetrics = await computeAndCacheMetrics(brokerageId);

  // Broadcast to all connected clients in this brokerage
  emitToBrokerage(brokerageId, 'metrics:updated', freshMetrics);

  return freshMetrics;
}
