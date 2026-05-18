import mongoose, { type Model, Schema, Types } from "mongoose";
import { mongooseDocumentTransform } from "@/lib/utils";

export const NOTIFICATION_TYPES = [
  'low_stock',
  'system',
  'alert',
  'info',
  'invoice_overdue',
  'subscription_expired',
  'subscription_expiry_warning',
  'payment_received',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  owner: Types.ObjectId;
  recipientUserId?: Types.ObjectId | null;
  businessOwnerId?: Types.ObjectId | null;
  actorUserId?: Types.ObjectId | null;
  shopId?: Types.ObjectId | null;
  eventKey?: string;
  type: NotificationType;
  channel?: 'in_app' | 'email' | 'whatsapp';
  deliveryStatus?: 'queued' | 'sent' | 'failed';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  entityType?: string;
  entityId?: Types.ObjectId | string | null;
  title: string;
  message: string;
  cta?: {
    label: string;
    href: string;
  } | null;
  dedupeKey?: string | null;
  read: boolean;
  readAt?: Date | null;
  dismissedAt?: Date | null;
  archivedAt?: Date | null;
  autoArchiveAt?: Date | null;
  expiresAt?: Date | null;
  scheduledFor?: Date | null;
  deliveredAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  metadata: Record<string, unknown>;
}

type NotificationModel = Model<INotification>;

const notificationSchema = new Schema<INotification, NotificationModel>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    businessOwnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
      index: true,
    },
    eventKey: {
      type: String,
      default: null,
      index: true,
    },
    dedupeKey: {
      type: String,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: "info",
      index: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'whatsapp'],
      default: 'in_app',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'sent',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
      index: true,
    },
    entityType: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
      index: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    cta: {
      type: {
        label: { type: String, trim: true, maxlength: 100 },
        href: { type: String, trim: true, maxlength: 500 },
      },
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    autoArchiveAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
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

// Indexes for common queries
notificationSchema.index({ owner: 1, read: 1, createdAt: -1 });
notificationSchema.index({ owner: 1, createdAt: -1 });
notificationSchema.index({ owner: 1, "metadata.itemId": 1, createdAt: -1 });
notificationSchema.index({ autoArchiveAt: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification =
  (mongoose.models.Notification as NotificationModel | undefined) ??
  mongoose.model<INotification, NotificationModel>("Notification", notificationSchema);

export default Notification;