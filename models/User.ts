import mongoose, { type HydratedDocument, type Model, Schema } from "mongoose";

import {
  hashPassword,
  mongooseDocumentTransform,
  normalizeEmail,
  normalizePhoneNumber,
  verifyPassword,
} from "@/lib/utils";

export const USER_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "staff",
  "customer",
] as const;

export const USER_STATUSES = [
  "invited",
  "active",
  "inactive",
  "suspended",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  shopName?: string | null;
  timezone: string;
  currency: string;
  lastLoginAt?: Date | null;
  emailVerifiedAt?: Date | null;
  passwordChangedAt?: Date | null;
  loginAttempts: number;
  lastFailedLoginAt?: Date | null;
  belongsTo?: string | null;
  metadata: Record<string, unknown>;
}

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  shopName?: string | null;
  timezone: string;
  currency: string;
  belongsTo?: string | null;
};

export interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): SafeUser;
}

export type UserDocument = HydratedDocument<IUser, UserMethods>;
type UserModel = Model<IUser, object, UserMethods>;

const userSchema = new Schema<IUser, UserModel, UserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 20,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "owner",
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
      index: true,
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
      trim: true,
    },
    shopName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 160,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    lastFailedLoginAt: {
      type: Date,
      default: null,
      index: true,
    },
    belongsTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
    toObject: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
  },
);

userSchema.index({ status: 1, role: 1 });

userSchema.pre("validate", function preValidate() {
  this.email = normalizeEmail(this.email);

  if (this.phoneNumber) {
    this.phoneNumber = normalizePhoneNumber(this.phoneNumber);
  }
});

userSchema.pre("save", async function preSave() {
  if (this.isModified("passwordHash")) {
    // Only hash if this is plain text password (not already hashed with bcrypt)
    // bcrypt hashes always start with $2a$, $2b$ or $2y$
    if (!this.passwordHash.match(/^\$2[aby]\$/)) {
      this.passwordHash = await hashPassword(this.passwordHash);
      this.passwordChangedAt = new Date();
    }
  }
});

userSchema.method(
  "comparePassword",
  async function comparePassword(this: UserDocument, candidatePassword: string) {
    return verifyPassword(candidatePassword, this.passwordHash);
  },
);

userSchema.method("toSafeObject", function toSafeObject(this: UserDocument) {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    phoneNumber: this.phoneNumber ?? null,
    avatarUrl: this.avatarUrl ?? null,
    shopName: this.shopName ?? null,
    timezone: this.timezone,
    currency: this.currency,
    belongsTo: this.belongsTo?.toString() ?? null,
  };
});

const User =
  (mongoose.models.User as UserModel | undefined) ??
  mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
