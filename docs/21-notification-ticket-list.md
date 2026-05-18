# Prioritized Notification Service Ticket List

## Phase 1: Core Notification Service

1. **Create notification event catalog and definitions**
   - Add `lib/notifications/catalog.ts`
   - Define event keys, default channels, priorities, dedupe rules, CTA templates, and retention hints
   - Ensure mappings cover current worker events: low stock, invoice overdue, subscription warnings

2. **Build central notification publish service**
   - Add `lib/notifications/notification-service.ts`
   - Accept event payloads and orchestrate recipient resolution, rendering, dedupe, persistence, and dispatch

3. **Extend `Notification` schema for service fields**
   - Update `models/Notification.ts`
   - Add optional fields: `eventKey`, `deliveryStatus`, `priority`, `recipientUserId`, `businessOwnerId`, `actorUserId`, `entityType`, `entityId`, `cta`, `dedupeKey`, `scheduledFor`, `deliveredAt`, `failedAt`, `failureReason`, `archivedAt`, `dismissedAt`
   - Keep existing `type` field for backward compatibility

4. **Create renderer and preference resolver**
   - Add `lib/notifications/renderer.ts`
   - Add `lib/notifications/preference-resolver.ts`
   - Render notification title/body/CTA from event payloads
   - Resolve channel eligibility from settings defaults

5. **Refactor worker producers to use the service**
   - Update `lib/workers/stock-check-worker.ts`
   - Update `lib/workers/invoice-overdue-worker.ts`
   - Update `lib/workers/subscription-expiry-worker.ts`
   - Emit central event keys instead of direct `Notification.create(...)`

6. **Improve notification listing APIs**
   - Update `app/api/notifications/route.ts`
   - Add filtering by `unread`, `eventKey`, `priority`, `channel`, `shopId`, date range, `page`, and `limit`
   - Add lightweight `GET /api/notifications/unread-count` route
   - Add `POST /api/notifications/read-all` route if needed

7. **Create notification center page**
   - Add `app/(dashboard)/dashboard/notifications/page.tsx`
   - Include unread filtering, type filtering, shop filtering, CTA links, and pagination
   - Keep the existing bell UI as first-class entrypoint

8. **Expand business notification settings**
   - Update `models/Settings.ts` notification settings structure
   - Add defaults for channel toggles, event type toggles, quiet hours, digest mode, and notify roles
   - Ensure safe backward compatibility with existing settings

## Phase 1.5: Email Readiness and Delivery

9. **Add delivery log model**
   - Create `models/NotificationDelivery.ts`
   - Track `notificationId`, `channel`, `attempts`, `status`, `providerResponse`, `lastAttemptAt`

10. **Create notification dispatcher adapter architecture**
    - Add `lib/notifications/dispatcher.ts`
    - Implement in-app dispatch immediately and stub email adapter
    - Prepare provider adapter interfaces for later WhatsApp/SMS

11. **Add email template scaffolding and queue support**
    - Create email template mappings for event types
    - Add queue or delayed send support to the dispatcher without provider coupling

## Phase 2: User preferences and cleanup

12. **Add notification center settings UI**
    - Add pages/components to let users adjust per-type and channel preferences
    - Show tenant defaults and support later user-level overrides

13. **Add optional `UserNotificationPreference` model** (later)
    - Introduce user-level overrides for notifications
    - Keep tenant defaults in `Settings`

14. **Add notification cleanup and digest worker**
    - Implement `notification-cleanup` cron job for old low-priority notifications
    - Implement `notification-digest` job for daily/hourly email digests if enabled

## Phase 3: Real-time and advanced channels

15. **Add real-time notification transport**
    - Add SSE or WebSocket refresh only if feedback requires it
    - Keep polling as fallback until real-time is validated

16. **Add WhatsApp/SMS provider adapters**
    - Implement adapter interfaces behind `dispatcher.ts`
    - Start with high-value transactional reminder support only

## Implementation notes
- Deliver Phase 1 tickets in order; each dependent ticket should build on the previous one.
- Keep schema changes additive and optional in the first pass.
- Avoid coupling notification business logic to transport provider SDKs.
- Use the catalog/service layer to ensure all producers share the same notification contract.

## Suggested sprint breakdown
- Sprint 1: tickets 1-6
- Sprint 2: tickets 7-10
- Sprint 3: tickets 11-14
- Sprint 4: tickets 15-16
