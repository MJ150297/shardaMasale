# Customer Portal

## Overview

The customer portal provides a limited, customer-facing interface under the `(customer)` route group. Customers can view items without needing full dashboard access.

## Route Group

```
app/(customer)/
├── layout.tsx                  # Customer-specific layout
├── page.tsx                    # Customer dashboard
├── customer-dashboard-client.tsx
└── items/
    ├── page.tsx                # Items listing for customers
    └── items-client.tsx        # Client component for item browsing
```

## Authentication

Customer pages use `requireCustomer()` from `lib/auth.ts`:

```typescript
export const requireCustomer = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();
  if (user.role !== "customer") {
    notFound();
  }
  return user;
});
```

This ensures only users with the `customer` role can access these pages. Non-customer users get a 404.

## Features

### Item Browsing
- Customers can view available items
- Items are filtered to the customer's active shop
- Shows item name, price, description, and stock availability
- Read-only view — no create/edit/delete functionality

### Customer Dashboard
- Simple dashboard with relevant information
- Order history (future enhancement)
- Account details

## Restrictions

Customer users:
- Cannot access `/dashboard` or any business routes
- Cannot create transactions, items, parties, or invoices
- Do not see the shop switcher or business management UI
- Are scoped to a single shop via `belongsTo` relationship

## Separation from Business Routes

The customer portal is intentionally separate from the business dashboard:

- **Route group isolation**: `(customer)` vs `(dashboard)`
- **Layout isolation**: Different layout components
- **Auth isolation**: `requireCustomer()` vs `requireUser()` / `requireOwner()`
- **No cross-access**: Business users get 404 on customer routes, and vice versa