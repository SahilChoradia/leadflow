import mongoose, { Schema, Document, Types } from 'mongoose';
import type { PipelineStage } from '@leadflow/types';

/**
 * Pre-aggregated dashboard metrics per brokerage.
 * Updated on every relevant pipeline event (stage change, task creation).
 * Backed by Redis cache in Phase 6; this model is the durable fallback store.
 */
export interface IDashboardCache extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  stageCounts: Record<PipelineStage, number>;
  totalLeads: number;
  activeClients: number;
  overdueTaskCount: number;
  conversionRate: number;
  lastUpdatedAt: Date;
}

const DashboardCacheSchema = new Schema<IDashboardCache>(
  {
    brokerageId: { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true, unique: true },
    stageCounts: {
      type: Schema.Types.Mixed,
      default: { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 },
    },
    totalLeads:       { type: Number, default: 0 },
    activeClients:    { type: Number, default: 0 },
    overdueTaskCount: { type: Number, default: 0 },
    conversionRate:   { type: Number, default: 0 },
    lastUpdatedAt:    { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// brokerageId has unique:true on the field definition, no separate index needed

export const DashboardCache = mongoose.model<IDashboardCache>('DashboardCache', DashboardCacheSchema);
