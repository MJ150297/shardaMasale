# Subscription & Plan Tiers

## Overview

GSMS uses a multi-tier subscription system to gate features and enforce usage limits. The subscription state is stored on the `User.subscription` field and resolved into a `PlanFeatures` object on every request.

## Plan Tiers

Five plans are defined in `lib/subscription.ts`:

| Plan | `advancedReports` | `maxShops` | `maxItems` | `maxParties` | `maxMonthlyTransactions` | `maxUsers` | `inventoryTracking` | `crm` | `customRoles` | `apiAccess` | `multiUser` |
|------|------|------|------|------|------|------|------|------|------|------|------|
| `free` | ❌ | 1 | 20 | 20 | 100 | 0 | ❌ | ❌ | ❌ | ❌ | ❌ |
| `trial` | ❌ | 1 | 200 | 100 | 500 | 1 | ✅ | ❌ | ❌ | ❌ | ❌ |
| `paid` | ✅ | 5 | 10,000 | 5,000 | 20,000 | 25 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `enterprise` | ✅ | 100 | 1,000,000 | 500,000 | 1,000,000 | 1,000 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `unlimited` | ✅ | ∞ | ∞ | ∞ | ∞ | ∞ | ✅ | ✅ | ✅ | ✅ | ✅ |

`unlimited` is reserved for **superOwner** role — it bypasses all limit checks.

## User Model

```typescript
// models/User.ts
subscription?: {
  plan: "free" | "trial" | "paid" | "enterprise" | "unlimited";
  status: "active" | "trial" | "expired" | "suspended";
  expiryDate?: Date | null;
  trialEndsAt?: Date | null;
};
```

A new user starts with `plan: "free"`, `status: "trial"`. Super owners can override per-user via `components/edit-owner-dialog.tsx` (Advanced tab).

## Core Library: `lib/subscription.ts`

### Constants

```typescript
export const SUBSCRIPTION_PLANS = ["free", "trial", "paid", "enterprise", "unlimited"] as const;
export const SUBSCRIPTION_STATUSES = ["active", "trial", "expired", "suspended"] as const;
export const ADVANCED_REPORT_SLUGS = new Set<string>([...]);
```

### Functions

| Function | Purpose |
|----------|---------|
| `getPlanFeatures(plan?)` | Returns the `PlanFeatures` object for a plan name, falls back to `free` |
| `isSubscriptionActive(status?)` | `true` for `"active"` or `"trial"` statuses |
| `isAdvancedReport(slug)` | `true` if the report slug is in `ADVANCED_REPORT_SLUGS` |
| `checkUserSubscription(userId)` | Looks up the user's subscription and returns `{ ok, plan, status, features, reason? }` |
| `requireActiveSubscription(result)` | Asserts that the subscription check result is `ok`, throws `Error` (with `statusCode: 403`) otherwise |

### Plan Features Interface

```typescript
export interface PlanFeatures {
  maxShops: number;
  maxItems: number;
  maxParties: number;
  maxMonthlyTransactions: number;
  advancedReports: boolean;
  inventoryTracking: boolean;
  crm: boolean;
  customRoles: boolean;
  apiAccess: boolean;
  multiUser: boolean;
  maxUsers: number;
}
```

## Auth Integration: `lib/auth.ts`

`requireActiveBusinessSubscription()` is a server-only helper that:
1. Calls `requireUser()` to verify authentication
2. **Bypasses** the subscription check for `superOwner` (returns unlimited)
3. **Bypasses** for `customer` (no business subscription required)
4. For all business users, calls `checkUserSubscription()` and asserts the result
5. Returns `{ user, subscription: { plan, status }, features }`

It's the primary guard used in creation endpoints. The subscription data is also loaded into the JWT via the `jwt` callback in `NextAuth({...})` so it's available client-side via `useSession().user.subscription`.

## Limit Enforcement in API Routes

### Items (`app/api/items/route.ts` POST)

```typescript
const { user, features } = await requireActiveBusinessSubscription();
const currentItemCount = await Item.countDocuments({ owner: user.id });
if (currentItemCount >= features.maxItems) {
  throw new AppError(
    `You've reached the maximum limit of ${features.maxItems} items on your plan. Please upgrade.`,
    403
  );
}
```

### Parties (`app/api/parties/route.ts` POST)

```typescript
const currentPartyCount = await Party.countDocuments({ owner: user.id, isArchived: false });
if (currentPartyCount >= features.maxParties) {
  throw new AppError(
    `You've reached the maximum limit of ${features.maxParties} parties on your plan. Please upgrade.`,
    403
  );
}
```

### Transactions (`app/api/transactions/route.ts` POST)

```typescript
const currentMonthStart = new Date();
currentMonthStart.setDate(1);
currentMonthStart.setHours(0, 0, 0, 0);
const currentMonthTransactionCount = await Transaction.countDocuments({
  owner: user.id,
  createdAt: { $gte: currentMonthStart },
});
if (currentMonthTransactionCount >= features.maxMonthlyTransactions) {
  throw new AppError(
    `You've reached the maximum limit of ${features.maxMonthlyTransactions} transactions this month. Please upgrade.`,
    403
  );
}
```

### Invoices (`app/api/invoices/route.ts` POST)

Invoices also count against `maxMonthlyTransactions` because creating an invoice creates a `Transaction` record behind the scenes. Same check as transactions route.

### Shops (`app/api/shops/route.ts` POST)

Already implemented before this work — uses `checkUserSubscription` to get features and checks `features.maxShops`.

### Reports (13 advanced report routes)

Each advanced report route gates access with:

```typescript
const { features } = await requireActiveBusinessSubscription();
if (!features.advancedReports || !isAdvancedReport('profit-loss')) {
  return NextResponse.json(
    { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
    { status: 403 }
  );
}
```

Affected routes: `profit-loss`, `balance-sheet`, `cash-flow`, `tax`, `sales-by-item`, `receivables-aging`, `payables-aging`, `supplier-performance`, `top-spenders`, `wastage`, `purchase-orders`, `stock-aging`, `sales-returns`. See [12-reports.md](./12-reports.md#advanced-reports--subscription-gating) for details.

## Background Workers

### Subscription Expiry Worker (`lib/workers/subscription-expiry-worker.ts`)

Cron schedule: `0 2 * * *` (daily at 2:00 AM)

Three jobs:

1. **`processExpiredTrials()`** — Finds users whose `trialEndsAt < now`, marks them as `expired`, sends a `subscription.expired` notification
2. **`processExpiredSubscriptions()`** — Finds `paid`/`enterprise` users whose `expiryDate < now`, marks them as `expired`, sends notification
3. **`sendExpiryWarnings()`** — Finds trials and paid subscriptions expiring within 7 days, sends `subscription.expiring` notifications with `daysRemaining` payload

## Subscription Status Card (`components/subscription-status-card.tsx`)

A client component that displays:
- Plan name and status badge
- Days remaining (from `trialEndsAt` or `expiryDate`)
- Shop usage progress bar (current / max)
- Warning alert when subscription is `expired` or `suspended`

Reads data from `session.user.subscription` and `/api/subscription/usage`.

## Usage API (`app/api/subscription/usage/route.ts`)

Returns the owner's current usage vs plan limits:
```json
{
  "shops": 3,
  "maxShops": 5,
  "items": 142,
  "maxItems": 10000,
  "parties": 87,
  "maxParties": 5000,
  "monthlyTransactions": 412,
  "maxMonthlyTransactions": 20000
}
```

The `/api/subscription/usage` endpoint uses `getPlanFeatures(plan)` to resolve limits and aggregates counts via MongoDB queries.

## Super Owner Management

Super owners can manage other owners' subscriptions via `components/edit-owner-dialog.tsx` (Advanced tab):
- Set `subscriptionPlan` (free/trial/paid/enterprise)
- Set `subscriptionStatus` (active/trial/expired/suspended)
- Set shop access via `allowedShops` (Shop Access tab)

## Feature Flags Defined But Not Yet Enforced

These plan features are defined in `PlanFeatures` but **not yet checked** at runtime:

| Feature | Status |
|---------|--------|
| `inventoryTracking` | Defined but stock features work regardless of plan |
| `crm` | Defined but CRM module works regardless of plan |
| `customRoles` | Defined but role creation works regardless |
| `apiAccess` | Defined but API endpoints work regardless |
| `multiUser` | Defined but user invitation works regardless |
| `maxUsers` | Defined but not checked when creating sub-users |

To add enforcement, follow the same pattern as items/parties/transactions: call `requireActiveBusinessSubscription()` and check the flag, returning 403 with an upgrade message if not allowed.