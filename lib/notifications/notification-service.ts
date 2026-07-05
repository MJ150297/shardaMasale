import connectToDatabase from '@/lib/db';
import NotificationModel from '@/models/Notification';
import NotificationDelivery, { type INotificationDelivery } from '@/models/NotificationDelivery';
import Settings from '@/models/Settings';
import {
  NotificationChannel,
  NotificationEventKey,
  getNotificationEventDefinition,
  NotificationPayload,
} from './catalog';
import { renderNotification } from './renderer';
import { resolveNotificationChannels } from './preference-resolver';
import { getDedupeKey } from './dedupe';

export interface NotificationPublishOptions {
  eventKey: NotificationEventKey;
  recipientUserIds: string[];
  businessOwnerId: string;
  shopId?: string | null;
  entityType?: string;
  entityId?: string | null;
  actorUserId?: string | null;
  payload?: NotificationPayload;
}

export interface PublishResult {
  notifications: Array<import('mongoose').HydratedDocument<import('@/models/Notification').INotification>>;
  deliveries?: Array<import('mongoose').HydratedDocument<import('@/models/NotificationDelivery').INotificationDelivery>>;
  skippedDedupe: boolean;
  channels: NotificationChannel[];
}

const eventTypeMap: Record<NotificationEventKey, import('@/models/Notification').NotificationType> = {
  'item.low_stock': 'low_stock',
  'invoice.overdue': 'invoice_overdue',
  'subscription.expiring': 'subscription_expiry_warning',
  'subscription.expired': 'subscription_expired',
  'party.payment_received': 'payment_received',
  'party.inactive': 'alert',
};

const eventPriorityMap: Record<NotificationEventKey, 'low' | 'normal' | 'high' | 'critical'> = {
  'item.low_stock': 'high',
  'invoice.overdue': 'critical',
  'subscription.expiring': 'normal',
  'subscription.expired': 'high',
  'party.payment_received': 'normal',
  'party.inactive': 'normal',
};

export async function publishNotification(
  options: NotificationPublishOptions,
): Promise<PublishResult> {
  await connectToDatabase();

  const settingsDoc = await Settings.findOne({
    owner: options.businessOwnerId,
    shopId: options.shopId ?? null,
  }).lean();

  const channels = resolveNotificationChannels(
    options.eventKey,
    settingsDoc?.notifications,
  );

  if (!channels.includes('in_app')) {
    return { notifications: [], skippedDedupe: false, channels };
  }

  const eventDefinition = getNotificationEventDefinition(options.eventKey);
  const rendered = renderNotification(options.eventKey, options.payload ?? {});
  const dedupeKey = getDedupeKey(options.eventKey, {
    ...options.payload,
    shopId: options.shopId,
    entityType: options.entityType,
    entityId: options.entityId,
  });
  const dedupeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const retentionDays = settingsDoc?.notifications?.retentionDays ?? 90;
  const archiveAfterDays = Math.min(
    retentionDays,
    settingsDoc?.notifications?.archiveAfterDays ?? 30,
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const autoArchiveAt = new Date(now.getTime() + archiveAfterDays * 24 * 60 * 60 * 1000);

  const existing = await NotificationModel.findOne({
    dedupeKey,
    createdAt: { $gte: dedupeWindow },
  });

  if (existing) {
    return { notifications: [existing], skippedDedupe: true, channels };
  }

  const created = await Promise.all(
    options.recipientUserIds.map(async (recipientUserId) => {
      const notification = await NotificationModel.create({
        owner: options.businessOwnerId,
        recipientUserId,
        businessOwnerId: options.businessOwnerId,
        shopId: options.shopId ?? undefined,
        actorUserId: options.actorUserId ?? undefined,
        eventKey: options.eventKey,
        type: eventTypeMap[options.eventKey] ?? 'info',
        channel: 'in_app',
        deliveryStatus: 'sent',
        priority:
          eventPriorityMap[options.eventKey] ?? eventDefinition.defaultPriority ?? 'normal',
        entityType: options.entityType ?? undefined,
        entityId: options.entityId ?? undefined,
        cta: rendered.cta ?? undefined,
        title: rendered.title,
        message: rendered.message,
        metadata: rendered.metadata ?? {},
        dedupeKey,
        read: false,
        autoArchiveAt,
        expiresAt,
      });

      const delivery = await NotificationDelivery.create({
        notificationId: notification._id,
        channel: 'in_app',
        attempts: 1,
        status: 'sent',
        providerResponse: {},
        lastAttemptAt: new Date(),
      });

      return { notification, delivery };
    }),
  );

  return {
    notifications: created.map((entry) => entry.notification),
    deliveries: created.map((entry) => entry.delivery),
    skippedDedupe: false,
    channels,
  };
}
