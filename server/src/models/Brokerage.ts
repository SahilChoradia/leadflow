import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBrokerage extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;      // URL-safe unique identifier, e.g. "alpha-mortgage"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrokerageSchema = new Schema<IBrokerage>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// slug has unique:true on the field definition, no separate index needed

export const Brokerage = mongoose.model<IBrokerage>('Brokerage', BrokerageSchema);
