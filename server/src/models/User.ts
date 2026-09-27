import mongoose, { Schema, Document, Types } from 'mongoose';
import type { UserRole } from '@leadflow/types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  brokerageId?: Types.ObjectId;   // undefined for platform_admin
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default — must be explicitly selected
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      enum: ['platform_admin', 'brokerage_admin', 'advisor', 'client'] as UserRole[],
      required: true,
    },
    brokerageId: {
      type: Schema.Types.ObjectId,
      ref: 'Brokerage',
      // Required for all roles except platform_admin — validated at app layer
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// brokerageId+role compound index for listing users in a brokerage
UserSchema.index({ brokerageId: 1, role: 1 });
// email has unique:true on the field, so no separate index needed

// Note: User is NOT a tenant-scoped model in the same way — platform_admin
// users have no brokerageId. We do NOT apply the tenantScopePlugin here.
// Tenant isolation for users is enforced at the route/controller layer.
export const User = mongoose.model<IUser>('User', UserSchema);
