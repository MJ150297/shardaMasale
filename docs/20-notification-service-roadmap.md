# Notification Service Roadmap

## Goal
Build a maintainable notification service for GSMS that starts with a strong in-app foundation, adds email readiness, and preserves room for future WhatsApp/SMS and realtime delivery.

## Current repo state
- `models/Notification.ts` stores notifications today with `type: 'low_stock' | 'system' | 'alert' | 'info'`
- `app/api/notifications/route.ts` supports GET list and POST read-all
- `app/api/notifications/[id]/read/route.ts` supports mark-as-read
- `components/layout/notification-bell.tsx` renders the bell dropdown and currently uses polling
- `models/Settings.ts` has `notifications` defaults with: `emailEnabled`, `lowStockAlerts`, `duePaymentAlerts`, `dailySummary`
- Worker producers exist in `lib/workers/stock-check-worker.ts`, `lib/workers/invoice-overdue-worker.ts`, `lib/workers/subscription-expiry-worker.ts`

## Phase 1 target
Deliver a robust in-app notification platform plus architecture for email:
- Central notification publishing
- Event-driven producers
- Dedupe and priority
- Extended schema with event keys and metadata
- Shop-aware scoping
- Better notification APIs
- Notification center UI page
- Email-ready delivery design

## Recommended file architecture

### New core files
- `lib/notifications/catalog.ts`
  - Event definitions, default channels, priority, dedupe rules, CTA templates
- `lib/notifications/notification-service.ts`
  - Main publish/resolve workflow
- `lib/notifications/renderer.ts`
  - Builds title, message, CTA, metadata from events
- `lib/notifications/preference-resolver.ts`
  - Reads settings and resolves channel eligibility
- `lib/notifications/dispatcher.ts`
  - Sends notifications to in-app/email adapters
- `lib/notifications/repository.ts`
  - Persistence helpers, query helpers, read/unread operations
- `lib/notifications/dedupe.ts`
  - Dedupe key generation and suppression logic

### New models
- `models/NotificationDelivery.ts`
  - `notificationId`, `channel`, `attempts`, `status`, `providerResponse`, `lastAttemptAt`
- `models/UserNotificationPreference.ts` (optional later)
  - User-specific channel/type overrides

### Existing files to evolve
- `models/Notification.ts`
  - Expand schema with optional fields
- `models/Settings.ts`
  - Expand `notifications` defaults carefully
- `app/api/notifications/route.ts`
  - Add filtering and separate read-all route if possible
- `components/layout/notification-bell.tsx`
  - Keep current entrypoint, add unread badge refresh and preferences link
- `app/(dashboard)/dashboard/notifications/page.tsx`
  - New notification center page

## Schema evolution
### Keep current collection, add fields safely
Add optional fields first to avoid breaking existing docs:
- `eventKey?: string` (e.g. `invoice.overdue`, `item.low_stock`)
- `channel?: string` (e.g. `in_app`, `email`, `whatsapp`)
- `deliveryStatus?: 'queued' | 'sent' | 'failed'`
- `priority?: 'low' | 'normal' | 'high' | 'critical'`
- `recipientUserId?: Types.ObjectId`
- `businessOwnerId?: Types.ObjectId`
- `actorUserId?: Types.ObjectId`
- `entityType?: string`
- `entityId?: Types.ObjectId | string`
- `cta?: { label: string; href: string }`
- `dedupeKey?: string`
- `scheduledFor?: Date | null`
- `deliveredAt?: Date | null`
- `failedAt?: Date | null`
- `failureReason?: string | null`
- `archivedAt?: Date | null`
- `dismissedAt?: Date | null`

Keep `type` as legacy for existing data while migrating event-driven producers to `eventKey`.

### NotificationDelivery model
- `notificationId`
- `channel`
- `attempts`
- `status`
- `providerResponse`
- `lastAttemptAt`
- `createdAt`
- `updatedAt`

## Settings and preferences
### Expand settings gradually
Update `models/Settings.ts` with additional tenant defaults:
- `inAppEnabled`
- `emailEnabled`
- `whatsappEnabled`
- `types: { lowStock, invoiceOverdue, invoiceDueSoon, subscriptionExpiring, subscriptionExpired, paymentReceived, paymentDue, creditLimitWarning, systemAnnouncements }`
- `quietHours: { start, end }`
- `digestMode: 'instant' | 'hourly' | 'daily'`
- `digestEmailEnabled`
- `notifyRoles: { owner: boolean; admin: boolean; staff: boolean }`

### Longer-term user overrides
- `UserNotificationPreference` can be added later to override tenant defaults per user
- For now keep tenant-wide defaults in `Settings`

## Event catalog
Define a catalog of event keys before implementation. Example v1 events:
- `item.low_stock`
- `item.out_of_stock`
- `invoice.due_soon`
- `invoice.overdue`
- `invoice.paid`
- `party.credit_limit_warning`
- `party.payment_received`
- `subscription.expiring`
- `subscription.expired`
- `transaction.sale_created`
- `transaction.purchase_created`
- `system.announcement`
- `system.import_completed`
- `system.backup_failed`
- `auth.new_login`
- `staff.invited`
- `shop.created`

Each catalog entry should include:
- trigger source
- default recipients or recipient resolver
- default channels
- default priority
- dedupe rule
- CTA template
- retention hint

## Producer migration
Replace direct `Notification.create(...)` calls with central publish calls.
Example producers:
- `lib/workers/stock-check-worker.ts` -> `item.low_stock`
- `lib/workers/invoice-overdue-worker.ts` -> `invoice.overdue`
- `lib/workers/subscription-expiry-worker.ts` -> `subscription.expiring` / `subscription.expired`
- invoice/payment creation route -> `party.payment_received`
- sale route -> `transaction.sale_created`
- shop creation route -> `shop.created`

## Service API contract
### `lib/notifications/notification-service.ts`
Publish API shape:
```ts
await notificationService.publish({
  eventKey: 'invoice.overdue',
  recipientUserIds: [ownerId],
  businessOwnerId: ownerId,
  shopId,
  entityType: 'invoice',
  entityId: invoiceId,
  actorUserId: systemUserId,
  payload: { invoiceNumber, amount, dueDate, customerName },
});
```
Responsibilities:
- resolve recipients
- consult preferences
- render title/body/CTA
- generate dedupeKey
- save in-app notification
- queue additional channels
- return created records

## API route plan
### Keep or add these endpoints
- `GET /api/notifications`
  - filters: `unread`, `eventKey`, `priority`, `channel`, `shopId`, `startDate`, `endDate`, `page`, `limit`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/read-all`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/:id/dismiss`
- `POST /api/notifications/bulk`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences`

### Existing route evolution
- `app/api/notifications/route.ts`
  - add filtering and pagination
- `app/api/notifications/read-all/route.ts`
  - separate endpoint from collection POST
- `app/api/notifications/[id]/read/route.ts`
  - continue as mark-as-read
- `app/api/notifications/unread-count/route.ts`
  - lightweight badge endpoint
- `app/api/notifications/preferences/route.ts`
  - read/update defaults

## UI plan for repo
### Short-term
- Keep `components/layout/notification-bell.tsx`
- Add a “View all notifications” page under
  - `app/(dashboard)/dashboard/notifications/page.tsx`
- Add unread filter, type icons, CTA links, dismiss/archive actions
- Add dedicated notification type icons and priority highlights

### Medium-term
- Add real-time refresh via SSE/WebSocket only if needed
- Add notification settings UI
- Add bulk actions on notification center page

## Background job plan
- Keep existing cron workers
- Refactor them to emit events only
- Add `notification-dispatcher` worker for channel delivery and retries
- Add `notification-cleanup` worker for archiving old low-priority notifications
- Add `notification-digest` worker later for hourly/daily email digests

## Migration strategy
1. Extend `models/Notification.ts` with new optional fields
2. Introduce `lib/notifications/notification-service.ts` and event catalog
3. Refactor workers/routes to publish via service
4. Add richer notification APIs and notification center UI
5. Add email adapter and delivery log model
6. Expand settings and user preference support
7. Add real-time transport if feedback demands it

## Testing focus
- Unit tests for renderer, preference resolution, dedupe logic
- Integration tests for publish creating correct docs
- API tests for listing, read, dismiss, unread-count, preferences
- Worker tests for event emission
- Key scenarios:
  - low stock alert created once
  - duplicate low stock suppressed
  - overdue invoice emits correctly
  - email-disabled settings only show in-app
  - recipient authorization enforced
  - shop-scoped notifications isolated per tenant

## Observability
Log structured events for:
- publish request
- dedupe skipped
- notification created
- notification dispatched
- delivery failure

Track metrics for:
- unread count
- read rate
- delivery success/failure by channel
- queue lag

## Repo-specific implementation sequence
1. Create `lib/notifications/catalog.ts`
2. Create `lib/notifications/notification-service.ts`
3. Create `lib/notifications/renderer.ts` and `lib/notifications/preference-resolver.ts`
4. Update `models/Notification.ts` schema with optional event fields
5. Refactor `lib/workers/*` to use `notificationService.publish(...)`
6. Expand `app/api/notifications/route.ts` and add new API routes
7. Add notification center page in `app/(dashboard)/dashboard/notifications/page.tsx`
8. Expand `models/Settings.ts` notification defaults
9. Add `models/NotificationDelivery.ts` and dispatch worker
10. Add optional `UserNotificationPreference.ts` later when user-level preferences are needed

## Recommendation
For GSMS, ship Phase 1 as:
- centralized event publishing service
- stronger in-app notifications
- dedupe / priority / audit fields
- richer query APIs
- notification center page
- email-ready architecture

That gives you a real service without over-committing to provider integrations.
