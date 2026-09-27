import mongoose, { Schema, Document, Types } from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface ITask extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  leadId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  title: string;
  assignedAdvisorId?: Types.ObjectId;
  dueDate?: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    brokerageId:       { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true },
    leadId:            { type: Schema.Types.ObjectId, ref: 'Lead' },
    clientId:          { type: Schema.Types.ObjectId, ref: 'Client' },
    title:             { type: String, required: true, trim: true, maxlength: 300 },
    assignedAdvisorId: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate:           { type: Date },
    isCompleted:       { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Fast retrieval of overdue open tasks per brokerage
TaskSchema.index({ brokerageId: 1, isCompleted: 1, dueDate: 1 });
TaskSchema.index({ brokerageId: 1, leadId: 1 });
TaskSchema.index({ brokerageId: 1, assignedAdvisorId: 1, isCompleted: 1 });

TaskSchema.plugin(tenantScopePlugin);

export const Task = mongoose.model<ITask>('Task', TaskSchema);
