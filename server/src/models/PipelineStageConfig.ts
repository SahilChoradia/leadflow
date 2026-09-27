import mongoose, { Schema, Document, Types } from 'mongoose';
import type { PipelineStage, TaskConfigItem } from '@leadflow/types';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface IPipelineStageConfig extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  stage: PipelineStage;
  emailTemplateId?: Types.ObjectId;
  tasks: TaskConfigItem[];
}

const TaskConfigItemSchema = new Schema<TaskConfigItem>(
  {
    title:               { type: String, required: true },
    assigneePlaceholder: { type: String, enum: ['assigned_advisor', 'any'], default: 'assigned_advisor' },
    dueDaysOffset:       { type: Number, default: 3 },
  },
  { _id: false },
);

const PipelineStageConfigSchema = new Schema<IPipelineStageConfig>(
  {
    brokerageId:     { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true },
    stage: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost'] as PipelineStage[],
      required: true,
    },
    emailTemplateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate' },
    tasks:           [TaskConfigItemSchema],
  },
  { timestamps: true },
);

// One config per stage per brokerage
PipelineStageConfigSchema.index({ brokerageId: 1, stage: 1 }, { unique: true });

PipelineStageConfigSchema.plugin(tenantScopePlugin);

export const PipelineStageConfig = mongoose.model<IPipelineStageConfig>(
  'PipelineStageConfig',
  PipelineStageConfigSchema,
);
