import {
  NotificationEventKey,
  NotificationPayload,
  getNotificationEventDefinition,
} from './catalog';

export function getDedupeKey(
  eventKey: NotificationEventKey,
  payload: NotificationPayload,
): string {
  const definition = getNotificationEventDefinition(eventKey);
  return definition.buildDedupeKey(payload);
}
