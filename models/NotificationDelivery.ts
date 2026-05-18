import mongoose, { type Model, Schema, Types } from 'mongoose';
import { mongooseDocumentTransform } from '@/lib/utils';

export type NotificationDeliveryChannel = 'in_app' | 'email' | 'whatsapp';
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'failed';

export interface INotificationDelivery {
  notificationId: Types.ObjectId;
  channel: NotificationDeliveryChannel;
  attempts: number;
  status: NotificationDeliveryStatus;
  providerResponse: Record<string, unknown>;
  lastAttemptAt?: Date | null;
}

type NotificationDeliveryModel = Model<INotificationDelivery>;

const notificationDeliverySchema = new Schema<INotificationDelivery, NotificationDeliveryModel>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'whatsapp'],
      default: 'in_app',
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      required: true,
    },
    providerResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastAttemptAt: {
      type: Date,
      default: null,
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

const NotificationDelivery =
  (mongoose.models.NotificationDelivery as NotificationDeliveryModel | undefined) ??
  mongoose.model<INotificationDelivery, NotificationDeliveryModel>(
    'NotificationDelivery',
    notificationDeliverySchema,
  );

export default NotificationDelivery;
