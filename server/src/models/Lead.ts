import mongoose, { Schema, Document, Types } from 'mongoose';
import type { PipelineStage } from '@leadflow/types';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface ILead extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  stage: PipelineStage;
  assignedAdvisorId?: Types.ObjectId;
  source: string;
  /**
   * Idempotency key — composite of (externalId + source) forms a unique index
   * per brokerage. Prevents duplicate ingestion from external webhooks.
   */
  externalId?: string;
  isDuplicate: boolean;
  duplicateOfId?: Types.ObjectId;
  notes?: string;
  /**
   * Optimistic concurrency version. Incremented on every update.
   * Updates must supply the current version; mismatch → 409 Conflict.
   */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      required: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, lowercase: true, trim: true },
    phone:     { type: String, trim: true },
    stage: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost'] as PipelineStage[],
      default: 'new',
    },
    assignedAdvisorId: { type: Schema.Types.ObjectId, ref: 'User' },
    source:     { type: String, default: 'manual' },
    externalId: { type: String },
    isDuplicate:  { type: Boolean, default: false },
    duplicateOfId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    notes:   { type: String, maxlength: 2000 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Idempotency: same external lead cannot be ingested twice in the same brokerage
LeadSchema.index(
  { brokerageId: 1, externalId: 1, source: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: 'string' } },
  },
);

// Pipeline board: list leads in a brokerage by stage
LeadSchema.index({ brokerageId: 1, stage: 1 });

// Duplicate detection: find by email or phone within a brokerage
LeadSchema.index({ brokerageId: 1, email: 1 });
LeadSchema.index({ brokerageId: 1, phone: 1 });

// ── Tenant scope plugin ───────────────────────────────────────────────────────
LeadSchema.plugin(tenantScopePlugin);

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
