import {
  NotificationCTA,
  NotificationEventKey,
  NotificationPayload,
  getNotificationEventDefinition,
} from './catalog';

export interface RenderedNotification {
  title: string;
  message: string;
  cta?: NotificationCTA | null;
  metadata: NotificationPayload;
}

export function renderNotification(
  eventKey: NotificationEventKey,
  payload: NotificationPayload,
): RenderedNotification {
  const definition = getNotificationEventDefinition(eventKey);

  return {
    title: definition.buildTitle(payload),
    message: definition.buildMessage(payload),
    cta: definition.buildCTA?.(payload) ?? null,
    metadata: payload,
  };
}
