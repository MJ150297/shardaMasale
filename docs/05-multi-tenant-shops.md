# Multi-Tenant Shops

## Overview

Sharda Masale uses a **shop-based multi-tenancy** model. Each owner can create multiple shops, and all data (items, parties, transactions, invoices) is scoped to a specific shop. This is enforced at three levels:

1. **Database level** — Global Mongoose plugin auto-filters queries by `shopId`
2. **API level** — Route handlers validate `activeShopId` and tag documents
3. **UI level** — `ShopProvider` context + `RequireShopGuard` component

## Global Mongoose Plugin

In `lib/db.ts`, a global plugin automatically scopes queries:

```typescript
mongoose.plugin((schema) => {
  // Auto-filter find queries by shopId
  schema.pre('find', async function() {
    const session = await getServerAuthSession();
    if (session?.user && session.user.role !== 'superOwner' && session.user.activeShopId) {
      this.where({ shopId: session.user.activeShopId });
    }
  });

  schema.pre('findOne', async function() {
    // Same filter applied
  });

  schema.pre('countDocuments', async function() {
    // Same filter applied
  });

  // Auto-set shopId on new document saves
  schema.pre('save', async function() {
    if (this.isNew && (this as any).shopId === undefined || (this as any).shopId === null) {
      const session = await getServerAuthSession();
      if (session?.user && session.user.activeShopId) {
        (this as any).shopId = session.user.activeShopId;
      }
    }
  });
});
```

**Important**: Super owners bypass shop scoping to see all data.

## ShopProvider (Client-Side Context)

`components/providers/shop-provider.tsx` provides shop context:

```typescript
interface ShopContextType {
  activeShopId: string | null;
  availableShops: Shop[];
  currentShop: Shop | null;
  switchShop: (shopId: string) => Promise<void>;
  isLoading: boolean;
}
```

### Key behaviors:
- Initializes `activeShopId` from the session (set during JWT creation)
- Fetches available shops from `/api/shops` when session is ready
- Provides `switchShop()` which calls `/api/auth/shop/switch` and reloads the page
- Exposes `currentShop` — the full shop object for display purposes

### Usage:

```tsx
'use client';
import { useActiveShop } from '@/components/providers/shop-provider';

function MyComponent() {
  const { activeShopId, currentShop, switchShop, availableShops } = useActiveShop();
  // ...
}
```

## Shop Switching

When a user switches shops via `switchShop()`:

1. Client calls `POST /api/auth/shop/switch` with `{ shopId }`
2. Server updates the JWT token's `activeShopId`
3. Client reloads the page to re-render with the new shop context

## RequireShopGuard Component

`components/require-shop-guard.tsx` blocks UI actions when no shop is selected:

### Three States:

| State | What shows | User action |
|-------|-----------|-------------|
| **No shops exist** | Disabled button + tooltip with "Create Your First Shop" button | Opens `CreateShopDialog` |
| **Shops exist but none selected** | Disabled button + "Select a shop" tooltip | Use shop switcher in header |
| **Shop is active** | Children render normally | — |

### Usage in Pages:

```tsx
// Wrap create action buttons
<RequireShopGuard>
  <CreateItemDialog />
</RequireShopGuard>

<RequireShopGuard>
  <DropdownMenu>New Transaction</DropdownMenu>
</RequireShopGuard>

<RequireShopGuard>
  <Button>New Invoice</Button>
</RequireShopGuard>
```

## Shop Model

From `models/Shop.ts`:

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | ObjectId (ref: User) | Owner who created the shop |
| `name` | String | Shop name (unique per owner) |
| `displayName` | String (optional) | Display name override |
| `email` | String (optional) | Shop contact email |
| `phone` | String (optional) | Shop contact phone |
| `address` | Embedded address | Full address object |
| `currency` | String | Default: INR |
| `timezone` | String | Default: Asia/Kolkata |
| `isActive` | Boolean | Whether shop is active |
| `settings` | Embedded settings | Invoice/purchase/payment/quote prefixes |

### Shop Settings

```typescript
interface IShopSettings {
  invoicePrefix: string;    // Default: 'INV'
  purchasePrefix: string;   // Default: 'PUR'
  paymentPrefix: string;    // Default: 'PAY'
  quotationPrefix: string;  // Default: 'QTN'
}
```

## Data Isolation Rules

| Entity | Has `shopId`? | Scope Rule |
|--------|--------------|------------|
| Item | Yes | Per-shop items and pricing |
| Party | Yes | Per-shop customers/suppliers |
| Transaction | Yes | Per-shop sales/purchases |
| Invoice | Yes | Per-shop invoices |
| StockMovement | Yes | Per-shop inventory tracking |
| User/Shop/Settings | No | Global to owner |

## Onboarding Banner

When a user has no shops, an `onboarding-banner.tsx` component is shown on the dashboard prompting them to create their first shop.

## Super Owner Access

Super owners bypass all shop scoping:
- The global plugin skips `shopId` filtering when `role === 'superOwner'`
- They can view and manage all shops across all owners
- They have their own route group at `/(superowner)/super/`