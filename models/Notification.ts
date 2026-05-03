import mongoose, { type Model, Schema, Types } from "mongoose";
import { mongooseDocumentTransform } from "@/lib/utils";

export const NOTIFICATION_TYPES = ["low_stock", "system", "alert", "info"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date | null;
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
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: "info",
      index: true,
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

const Notification =
  (mongoose.models.Notification as NotificationModel | undefined) ??
  mongoose.model<INotification, NotificationModel>("Notification", notificationSchema);

export default Notification;