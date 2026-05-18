# Background Jobs

## Overview

GSMS uses **node-cron** for scheduled background tasks. There are two workers that handle automated operations: invoice overdue detection and stock level monitoring.

## Worker Files

| Worker | File | Schedule |
|--------|------|----------|
| Invoice Overdue | `lib/workers/invoice-overdue-worker.ts` | Daily at 10:00 AM |
| Stock Check | `lib/workers/stock-check-worker.ts` | Every hour |

## 1. Invoice Overdue Worker

**File**: `lib/workers/invoice-overdue-worker.ts`

### Scheduled Tasks

#### Overdue Check (`runOverdueCheck()`)
- Runs daily at 10:00 AM
- Finds all invoices with `status: 'sent'` and `dueDate` in the past
- Updates their status to `overdue`
- Creates a `Notification` document for the business owner

**Notification created:**
```typescript
{
  owner: invoice.owner,
  type: 'invoice_overdue',
  title: `Invoice Overdue: ${invoice.invoiceNumber}`,
  message: `Invoice ${invoice.invoiceNumber} is now overdue. Please follow up with customer for payment.`,
  metadata: {
    invoiceId,
    invoiceNumber,
    dueDate,
    transactionId,
    amount
  }
}
```

#### Reminder Check (`sendReminders()`)

Sends WhatsApp reminders at three stages:
1. **7 days before due date**: Invoices due in ~7 days
2. **On due date**: Invoices due today
3. **7 days overdue**: Invoices overdue for ~7 days

**Reminder tracking**: Uses `reminders` field on the Invoice document to avoid duplicate reminders:
- `reminders.7daysBefore`
- `reminders.onDueDate`
- `reminders.7daysOverdue`

**WhatsApp integration**: Currently logs reminder messages to console. WhatsApp API integration placeholder exists for future implementation.

### Concurrency Protection
- Uses `isRunning` flag to prevent overlapping executions
- Skips if previous run is still in progress

## 2. Stock Check Worker

**File**: `lib/workers/stock-check-worker.ts`

### Scheduled Task (`runStockCheck()`)
- Runs every hour at minute 0
- Finds all active, inventory-tracked items with `currentQuantity <= reorderLevel` and `reorderLevel > 0`
- Creates low-stock notifications for each item

**Notification created:**
```typescript
{
  owner: item.owner,
  shopId: item.shopId,
  type: 'low_stock',
  title: `Low Stock Alert: ${item.name}`,
  message: `Current stock: ${currentQuantity} ${unit}. Reorder level: ${reorderLevel} ${unit}. Please restock this item.`,
  metadata: {
    itemId,
    itemName,
    sku,
    currentQuantity,
    reorderLevel,
    unitOfMeasure
  }
}
```

### Duplicate Prevention
- Checks for existing notifications for the same item within the last 24 hours
- Skips if a notification was already sent recently

### Manual Trigger
```typescript
// For testing
StockCheckWorker.triggerManually();
```

### Auto-Start
The stock check worker auto-starts in production:
```typescript
if (process.env.NODE_ENV === 'production') {
  StockCheckWorker.start();
}
```

## Notification Model

Both workers create notifications using the `Notification` model:

```typescript
interface INotification {
  owner: ObjectId;
  shopId?: ObjectId | null;
  type: string;              // 'invoice_overdue' | 'low_stock' | etc.
  title: string;
  message: string;
  status: 'unread' | 'read' | 'dismissed';
  metadata: Record<string, unknown>;
}
```

## Adding New Workers

To add a new background worker:

1. Create a new file in `lib/workers/`
2. Export a class with a `start()` static method
3. Use `cron.schedule()` with the desired cron expression
4. Call `.start()` during application initialization
5. Follow the concurrency protection pattern (`isRunning` flag)

## Current Limitations

- Workers run in the Node.js process (not a separate worker thread)
- In serverless deployments (Vercel), cron jobs may not persist — a separate cron service may be needed
- WhatsApp integration is placeholder-only; actual API integration needs to be implemented