# Architecture Overview

## System Architecture

GSMS Next is a **multi-tenant shop management system** built on the Next.js 16 App Router with MongoDB as the primary database.

```
┌──────────────────────────────────────────────┐
│                  Browser                       │
├──────────────────────────────────────────────┤
│           Next.js 16 (App Router)             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth     │ │ Dashboard│ │ Customer     │  │
│  │ (SignIn) │ │ Routes   │ │ Portal       │  │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
│       │            │              │           │
│  ┌────┴────────────┴──────────────┴───────┐  │
│  │         API Routes (REST)              │  │
│  │  /api/items, /api/parties, ...         │  │
│  └────────────────┬───────────────────────┘  │
├───────────────────┼──────────────────────────┤
│                   │                          │
│  ┌────────────────┴───────────────────────┐  │
│  │      MongoDB (Mongoose 9)              │  │
│  │  Collections: User, Shop, Item,        │  │
│  │  Party, Transaction, Invoice, etc.     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 16 App Router | Server components, API routes, route groups, middleware |
| Database | MongoDB + Mongoose 9 | Flexible document schemas for varied transaction types |
| Auth | NextAuth 4 (Credentials) | JWT-based sessions, custom role system |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first CSS, accessible component primitives |
| Forms | react-hook-form + Zod | Type-safe validation with schema inference |
| State | TanStack React Query | Server state caching, optimistic updates |
| Charts | Recharts | Transaction and report visualizations |
| PDF | @react-pdf/renderer | Invoice PDF generation |
| Notifications | Sonner | Toast notifications |
| Background Jobs | node-cron | Scheduled tasks (overdue invoices, stock checks) |

## Multi-Tenancy Model

The application uses a **shop-based multi-tenancy** approach:

```
SuperOwner ──→ Owner 1 ──→ Shop A ──→ Items, Parties, Transactions
                   │          └── Shop B ──→ Items, Parties, Transactions
                   │
                   └── Owner 2 ──→ Shop C ──→ Items, Parties, Transactions
```

- **SuperOwner**: Platform-level admin who can create and manage owners
- **Owner**: Business owner who creates shops
- **Staff roles**: Admin, Manager, Cashier, Staff — scoped to owner's shops
- **Customer**: End-user who can view items and make purchases

## Data Flow Pattern

1. **Server Component** → fetches session via `getServerAuthSession()`
2. **Server Action / API Route** → validates user via `requireUser()`, `requireOwner()`, etc.
3. **Mongoose Global Plugin** → automatically adds `shopId` filter to queries
4. **Response** → returns JSON to client component

## Role Hierarchy

```
superOwner
    └── owner
         ├── admin
         ├── manager
         ├── cashier
         └── staff
customer (separate route group)
```

Each role is guarded at both the **API level** (in route handlers) and **UI level** (via server components and client-side guards).