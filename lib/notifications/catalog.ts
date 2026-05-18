export type NotificationChannel = 'in_app' | 'email' | 'whatsapp';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'failed';

export interface NotificationCTA {
  label: string;
  href: string;
}

export type NotificationPayload = Record<string, unknown>;

export type NotificationEventKey =
  | 'item.low_stock'
  | 'invoice.overdue'
  | 'subscription.expiring'
  | 'subscription.expired'
  | 'party.payment_received'
  | 'party.inactive';

export interface NotificationEventDefinition {
  description: string;
  defaultChannels: NotificationChannel[];
  defaultPriority: NotificationPriority;
  buildTitle: (payload: NotificationPayload) => string;
  buildMessage: (payload: NotificationPayload) => string;
  buildCTA?: (payload: NotificationPayload) => NotificationCTA | null;
  buildDedupeKey: (payload: NotificationPayload) => string;
}

const notificationCatalog: Record<NotificationEventKey, NotificationEventDefinition> = {
  'item.low_stock': {
    description: 'Low stock alert for a tracked inventory item',
    defaultChannels: ['in_app'],
    defaultPriority: 'high',
    buildTitle: (payload) => `Low Stock Alert: ${payload.itemName ?? 'Item'}`,
    buildMessage: (payload) => {
      const currentQuantity = payload.currentQuantity ?? 'unknown';
      const reorderLevel = payload.reorderLevel ?? 'unknown';
      const unitOfMeasure = payload.unitOfMeasure ?? '';
      return `Current stock is ${currentQuantity} ${unitOfMeasure}. Reorder level is ${reorderLevel} ${unitOfMeasure}. Please restock this item.`;
    },
    buildCTA: (payload) => {
      if (!payload.itemId) return null;
      return {
        label: 'Review item',
        href: `/dashboard/items/${payload.itemId}`,
      };
    },
    buildDedupeKey: (payload) =>
      `item.low_stock:${payload.shopId ?? 'unknown'}:${payload.itemId ?? 'unknown'}`,
  },
  'invoice.overdue': {
    description: 'Invoice became overdue',
    defaultChannels: ['in_app'],
    defaultPriority: 'critical',
    buildTitle: (payload) => `Invoice Overdue: ${payload.invoiceNumber ?? 'Unknown'}`,
    buildMessage: (payload) => {
      const amount = payload.amount ?? 'unknown';
      const dueDate = payload.dueDate ? new Date(payload.dueDate as string).toLocaleDateString() : 'unknown';
      return `Invoice ${payload.invoiceNumber ?? ''} is overdue. Amount: ₹${amount}. Due date: ${dueDate}. Please follow up with the customer.`;
    },
    buildCTA: (payload) => {
      if (!payload.invoiceId) return null;
      return {
        label: 'View invoice',
        href: `/dashboard/invoices/${payload.invoiceId}`,
      };
    },
    buildDedupeKey: (payload) =>
      `invoice.overdue:${payload.invoiceId ?? 'unknown'}`,
  },
  'subscription.expiring': {
    description: 'Subscription will expire soon',
    defaultChannels: ['in_app'],
    defaultPriority: 'normal',
    buildTitle: (payload) => `Subscription Expiring Soon`,
    buildMessage: (payload) => {
      const daysRemaining = payload.daysRemaining ?? 'a few';
      return `Your subscription will expire in ${daysRemaining} day(s). Renew soon to avoid interruption.`;
    },
    buildCTA: () => ({
      label: 'Manage subscription',
      href: '/dashboard/settings/subscription',
    }),
    buildDedupeKey: (payload) =>
      `subscription.expiring:${payload.userId ?? 'unknown'}:${payload.daysRemaining ?? 'unknown'}`,
  },
  'subscription.expired': {
    description: 'Subscription has expired',
    defaultChannels: ['in_app'],
    defaultPriority: 'high',
    buildTitle: () => 'Subscription Expired',
    buildMessage: () =>
      'Your subscription has expired. Please renew to restore full access.',
    buildCTA: () => ({
      label: 'Renew now',
      href: '/dashboard/settings/subscription',
    }),
    buildDedupeKey: (payload) => `subscription.expired:${payload.userId ?? 'unknown'}`,
  },
  'party.payment_received': {
    description: 'Payment received for a party',
    defaultChannels: ['in_app'],
    defaultPriority: 'normal',
    buildTitle: (payload) => `Payment Received${payload.partyName ? ` from ${payload.partyName}` : ''}`,
    buildMessage: (payload) => {
      const amount = payload.amount ?? 'unknown';
      return `A payment of ₹${amount} has been received.${payload.partyName ? ` from ${payload.partyName}.` : ''}`;
    },
    buildCTA: (payload) => {
      if (!payload.partyId) return null;
      return {
        label: 'View customer',
        href: `/dashboard/parties/${payload.partyId}`,
      };
    },
    buildDedupeKey: (payload) =>
      `party.payment_received:${payload.partyId ?? 'unknown'}:${payload.invoiceId ?? 'unknown'}`,
  },
  'party.inactive': {
    description: 'Customer has had no recent business activity',
    defaultChannels: ['in_app'],
    defaultPriority: 'normal',
    buildTitle: (payload) =>
      `Customer inactive: ${payload.partyName ?? 'Unknown customer'}`,
    buildMessage: (payload) =>
      `No invoices or confirmed transactions with ${payload.partyName ?? 'this customer'} in the last ${payload.inactivityDays ?? 100} days. Consider following up.`,
    buildCTA: (payload) => {
      if (!payload.partyId) return null;
      return {
        label: 'Review customer',
        href: `/dashboard/parties/${payload.partyId}`,
      };
    },
    buildDedupeKey: (payload) =>
      `party.inactive:${payload.partyId ?? 'unknown'}`,
  },
};

export function getNotificationEventDefinition(
  eventKey: NotificationEventKey,
): NotificationEventDefinition {
  return notificationCatalog[eventKey];
}
