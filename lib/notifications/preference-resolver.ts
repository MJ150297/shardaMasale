import { NotificationChannel, NotificationEventKey } from './catalog';
import { NotificationSettings } from '@/models/Settings';

export function resolveNotificationChannels(
  eventKey: NotificationEventKey,
  settings?: NotificationSettings,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  const config = settings ?? getDefaultNotificationSettings();

  if (config.inAppEnabled) {
    channels.push('in_app');
  }

  if (config.emailEnabled && isEmailEnabled(eventKey, config)) {
    channels.push('email');
  }

  if (config.whatsappEnabled && isWhatsAppEnabled(eventKey, config)) {
    channels.push('whatsapp');
  }

  return channels;
}

function isEmailEnabled(eventKey: NotificationEventKey, settings: NotificationSettings) {
  switch (eventKey) {
    case 'item.low_stock':
      return settings.lowStockAlerts;
    case 'invoice.overdue':
      return settings.invoiceOverdueAlerts;
    case 'subscription.expiring':
      return settings.subscriptionExpiringAlerts;
    case 'subscription.expired':
      return settings.subscriptionExpiredAlerts;
    case 'party.payment_received':
      return settings.paymentReceivedAlerts;
    default:
      return true;
  }
}

function isWhatsAppEnabled(eventKey: NotificationEventKey, settings: NotificationSettings) {
  return false;
}

function getDefaultNotificationSettings(): NotificationSettings {
  return {
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
    lowStockAlerts: true,
    duePaymentAlerts: true,
    dailySummary: false,
    subscriptionExpiringAlerts: true,
    subscriptionExpiredAlerts: true,
    invoiceOverdueAlerts: true,
    invoiceDueSoonAlerts: true,
    paymentReceivedAlerts: true,
    creditLimitWarningAlerts: true,
    systemAnnouncements: true,
    quietHours: { start: '00:00', end: '06:00' },
    digestMode: 'instant',
    digestEmailEnabled: false,
    notifyRoles: {
      owner: true,
      admin: false,
      staff: false,
    },
  };
}
