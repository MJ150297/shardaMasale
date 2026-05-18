# Super Owner Panel

## Overview

The super owner panel provides platform-level administration. Super owners can manage owners, shops, and platform settings across all tenants.

## Route Group

```
app/(superowner)/
└── super/
    ├── layout.tsx          # Super admin layout with sidebar
    ├── page.tsx            # Super admin dashboard
    ├── owners/             # Owner management
    ├── shops/              # All shops view
    └── settings/           # Platform settings
```

## Access Control

Super owner routes use `requireSuperOwner()`:

```typescript
export const requireSuperOwner = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();
  if (user.role !== "superOwner") {
    notFound();
  }
  return user;
});
```

This provides a 404 to any non-superOwner user attempting to access these routes.

## Features

### Owner Management (`/super/owners`)
- **List all owners** — View all registered owners across the platform
- **Create new owners** — Manually create owner accounts
- **View owner details** — See owner information, subscription status, shop count
- **API**: `GET /api/super/owners` and `POST /api/super/owners`

### Shop Overview (`/super/shops`)
- **View all shops** — Across all owners
- **Shop details** — Name, owner, status, settings
- **Super owner bypass**: The global Mongoose plugin skips `shopId` filtering for super owners, giving them full visibility

### Platform Settings (`/super/settings`)
- Global configuration options
- Security settings
- System preferences

### Dashboard (`/super/page.tsx`)
- Platform-wide statistics
- Total owners, shops, transactions
- System health indicators

## Impersonation

Super owners can impersonate owner accounts for debugging and support:

```typescript
// POST /api/auth/impersonate
{ "userId": "owner_user_id" }
```

This temporarily switches the super owner's session to the target owner's identity, allowing them to see exactly what the owner sees. The session is restored on logout.

## Data Visibility

Super owners have **unrestricted data access**:
- The global Mongoose plugin explicitly checks `role !== 'superOwner'` before applying shop filters
- Can view all shops, items, transactions, and parties across all owners
- Used for auditing, support, and platform management