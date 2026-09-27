import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface IEmailTemplate extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  name: string;
  subject: string;
  bodyHtml: string;        // e.g. "Hello {{clientName}}, your advisor {{advisorName}}..."
  placeholders: string[];  // extracted placeholder names, e.g. ['clientName', 'advisorName']
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    brokerageId:  { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true },
    name:         { type: String, required: true, trim: true, maxlength: 120 },
    subject:      { type: String, required: true, trim: true, maxlength: 200 },
    bodyHtml:     { type: String, required: true },
    placeholders: [{ type: String }],
  },
  { timestamps: true },
);

EmailTemplateSchema.index({ brokerageId: 1 });

EmailTemplateSchema.plugin(tenantScopePlugin);

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
