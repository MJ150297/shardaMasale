# Auth System

## Overview

Authentication is handled by **NextAuth 4** with a **Credentials Provider** (email + password). The system uses JWT-based sessions with a custom role and status system.

## Auth Flow

```
User submits credentials → authorize() callback
    → Validate with Zod schema
    → Find user by email in MongoDB
    → Check login lockout (max 5 attempts, 15-minute window)
    → Verify password with bcrypt
    → Update loginAttempts, lastLoginAt
    → Return user payload → JWT callback → Session callback
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | NextAuth configuration, session helpers, role guards |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API handler |
| `types/next-auth.d.ts` | Type augmentation for session + JWT |
| `components/providers/session-provider-wrapper.tsx` | Client-side SessionProvider |

## User Model Fields

From `models/User.ts`, the relevant auth fields:

| Field | Type | Purpose |
|-------|------|---------|
| `email` | String (unique) | Login identifier |
| `passwordHash` | String (select: false) | bcrypt hashed password |
| `role` | Enum (7 roles) | Authorization level |
| `status` | Enum (4 statuses) | Account state |
| `loginAttempts` | Number | Failed login counter |
| `lastFailedLoginAt` | Date | For lockout window |
| `lastLoginAt` | Date | Last successful login |
| `passwordChangedAt` | Date | Password change tracking |

## Roles

```typescript
const USER_ROLES = [
  "superOwner",  // Platform admin — manages owners
  "owner",       // Business owner — creates shops
  "admin",       // Shop admin — full access within shop
  "manager",     // Operational manager
  "cashier",     // Point-of-sale operator
  "staff",       // View-only or limited access
  "customer",    // External portal user
] as const;
```

## Statuses

```typescript
const USER_STATUSES = [
  "invited",   // User invited but hasn't logged in
  "active",    // Full access
  "inactive",  // Disabled by admin
  "suspended", // Temporarily blocked
] as const;
```

## Session Structure

The `AppSessionUser` extends `SafeUser` with:

```typescript
type AppSessionUser = SafeUser & {
  activeShopId?: string | null;  // Currently selected shop
};
```

The active shop ID is loaded during JWT creation from the user's shops and persisted in the session.

## Route Guards (Server-Side)

```typescript
// lib/auth.ts

// Requires any authenticated user — redirects to /signin if not
requireUser(): AppSessionUser

// Requires owner role — 404 if not
requireOwner(): AppSessionUser

// Requires customer role — 404 if not
requireCustomer(): AppSessionUser

// Requires superOwner role — 404 if not
requireSuperOwner(): AppSessionUser

// Requires business user (any role except customer)
requireBusinessUser(): AppSessionUser
```

### Usage in API Routes

```typescript
// app/api/items/route.ts
export async function POST(req: Request) {
  const user = await requireOwner();  // Blocks non-owners
  
  // Guard: must have active shop
  if (!user.activeShopId) {
    return Response.json(
      { error: "No active shop selected" },
      { status: 400 }
    );
  }
  
  // ... create item with shopId: user.activeShopId
}
```

### Usage in Server Components

```typescript
// app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const user = await requireUser();  // Redirects to /signin if not authenticated
  
  return (
    <SessionProviderWrapper>
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </SessionProviderWrapper>
  );
}
```

## API-Level Guards

All POST/PUT/DELETE endpoints enforce shop guards:

1. `requireUser()` or `requireOwner()` verifies authentication
2. Check `user.activeShopId` exists
3. Set `shopId: user.activeShopId` on created documents
4. GET queries are automatically filtered by `shopId` via global Mongoose plugin

## Login Lockout

- **Max attempts**: 5 (configurable via Settings document)
- **Lockout window**: 15 minutes
- **Error format**: `LOCKED_UNTIL:<ISO timestamp>`
- On successful login: counter resets
- On failed login: counter increments, lockout triggers at threshold

## JWT Configuration

```typescript
session: {
  strategy: "jwt",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24,     // Re-encrypt the JWT at most once per day
}

// Session cookie is prefixed with `__Secure-` in production so that
// browsers actually accept it on HTTPS (without the prefix, the cookie
// is silently dropped, which is what was causing "logout on browser
// close" / "logout on PWA relaunch" on mobile).
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    },
  },
},
```

## Impersonation

The system supports super admin impersonation via `/api/auth/impersonate/`. Super owners can temporarily assume the identity of an owner for debugging purposes.