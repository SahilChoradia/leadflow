import mongoose, { Schema, Document, Types } from 'mongoose';
import type { DocumentStatus } from '@leadflow/types';
import { tenantScopePlugin } from '../plugins/tenantScope';

export interface IDocument extends Document {
  _id: Types.ObjectId;
  brokerageId: Types.ObjectId;
  clientId: Types.ObjectId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;               // S3 object key — never expose as a public URL directly
  status: DocumentStatus;
  verificationJobId?: string;  // BullMQ job ID for retryability
  failureReason?: string;
  uploadedAt: Date;
  verifiedAt?: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    brokerageId:       { type: Schema.Types.ObjectId, ref: 'Brokerage', required: true },
    clientId:          { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    fileName:          { type: String, required: true },
    mimeType:          { type: String, required: true },
    sizeBytes:         { type: Number, required: true },
    s3Key:             { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed'] as DocumentStatus[],
      default: 'pending',
    },
    verificationJobId: { type: String },
    failureReason:     { type: String },
    uploadedAt:        { type: Date, default: Date.now },
    verifiedAt:        { type: Date },
  },
  { timestamps: false }, // using uploadedAt/verifiedAt explicitly
);

DocumentSchema.index({ brokerageId: 1, clientId: 1 });

DocumentSchema.plugin(tenantScopePlugin);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
