import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface IClient extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  userId: Types.ObjectId;      // linked User (role: 'client') for portal login
  leadId: Types.ObjectId;      // original lead that was converted
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  caseStatus: string;          // e.g. 'active', 'on_hold', 'closed'
  assignedAdvisorId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    brokerageId:        { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true },
    userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
    leadId:             { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    firstName:          { type: String, required: true, trim: true },
    lastName:           { type: String, required: true, trim: true },
    email:              { type: String, required: true, lowercase: true, trim: true },
    phone:              { type: String },
    caseStatus:         { type: String, default: 'active' },
    assignedAdvisorId:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

ClientSchema.index({ brokerageId: 1 });
ClientSchema.index({ brokerageId: 1, email: 1 });

ClientSchema.plugin(tenantScopePlugin);

export const Client = mongoose.model<IClient>('Client', ClientSchema);
