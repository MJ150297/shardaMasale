# Project Structure

```
gsms_next/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ThemeProvider + Sonner)
│   ├── globals.css               # Global styles + Tailwind
│   ├── page.tsx                  # Landing page (Portal page)
│   ├── favicon.ico
│   │
│   ├── (auth)/                   # Route group: Authentication
│   │   └── signin/
│   │       └── page.tsx          # Sign-in page
│   │
│   ├── (dashboard)/              # Route group: Dashboard (requires auth)
│   │   ├── layout.tsx            # Dashboard layout (session wrapper + shell)
│   │   ├── dashboard-user-menu.tsx
│   │   ├── dashboard/            # Main dashboard pages
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── dashboard-client.tsx
│   │   │   ├── items/            # Items CRUD pages
│   │   │   ├── parties/          # Parties CRUD pages
│   │   │   ├── transactions/     # Transactions pages
│   │   │   ├── invoices/         # Invoices pages
│   │   │   ├── shops/            # Shop management pages
│   │   │   ├── reports/          # Reports pages
│   │   │   ├── developer/        # Developer tools
│   │   │   └── settings/         # Settings pages
│   │   ├── reports/              # Alternative reports route
│   │   └── settings/             # User/shop settings
│   │
│   ├── (customer)/               # Route group: Customer portal
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Customer dashboard
│   │   ├── customer-dashboard-client.tsx
│   │   └── items/                # Customer item listing
│   │
│   ├── (superowner)/             # Route group: Super admin
│   │   └── super/
│   │       ├── layout.tsx
│   │       ├── page.tsx          # Super admin dashboard
│   │       ├── owners/           # Manage owners
│   │       ├── shops/            # Manage all shops
│   │       └── settings/         # Platform settings
│   │
│   └── api/                      # API routes (REST)
│       ├── auth/                 # Auth endpoints
│       │   ├── [...nextauth]/    # NextAuth handler
│       │   ├── impersonate/      # Admin impersonation
│       │   └── shop/             # Shop switching
│       ├── items/                # Items CRUD
│       ├── parties/              # Parties CRUD
│       ├── transactions/         # Transactions CRUD
│       ├── invoices/             # Invoices CRUD + generate + share
│       ├── shops/                # Shops CRUD
│       ├── settings/             # Settings CRUD
│       ├── stock-movements/      # Stock tracking
│       ├── reports/              # Report data endpoints
│       ├── notifications/        # User notifications
│       └── super/                # Super admin endpoints
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── form.tsx
│   │   ├── tooltip.tsx
│   │   ├── sheet.tsx
│   │   └── ... (30+ primitives)
│   ├── layout/                   # Layout components
│   │   ├── dashboard-shell.tsx   # Main dashboard layout
│   │   └── notification-bell.tsx
│   ├── providers/                # Context providers
│   │   ├── session-provider-wrapper.tsx
│   │   ├── shop-provider.tsx     # Shop context (activeShopId)
│   │   └── theme-provider.tsx
│   ├── create-item-dialog.tsx
│   ├── create-party-dialog.tsx
│   ├── create-sale-dialog.tsx
│   ├── create-purchase-dialog.tsx
│   ├── create-shop-dialog.tsx
│   ├── transaction-form.tsx      # Shared transaction form
│   ├── require-shop-guard.tsx    # UI guard for shop selection
│   ├── onboarding-banner.tsx
│   ├── data-table-toolbar.tsx
│   └── ... (20+ components)
│
├── lib/                          # Shared utilities
│   ├── auth.ts                   # Auth helpers, session, guards
│   ├── db.ts                     # MongoDB connection + global plugin
│   ├── utils.ts                  # General utilities
│   ├── party-balance.ts          # Party balance calculations
│   ├── party-helpers.ts          # Party utility functions
│   ├── payment-settlement.ts     # Invoice settlement allocation
│   ├── transaction-inventory.ts  # Inventory logic for transactions
│   └── workers/                  # Background job workers
│       ├── invoice-overdue-worker.ts
│       └── stock-check-worker.ts
│
├── models/                       # Mongoose models
│   ├── User.ts                   # User model (7 roles)
│   ├── Shop.ts                   # Shop model (multi-tenant)
│   ├── Item.ts                   # Item model (products/services)
│   ├── Party.ts                  # Party model (customers/suppliers)
│   ├── Transaction.ts            # Transaction model (8 types)
│   ├── Invoice.ts                # Invoice model
│   ├── StockMovement.ts          # Stock movement tracking
│   ├── Notification.ts           # User notifications
│   └── Settings.ts               # User/shop settings
│
├── modules/                      # Feature modules
│   ├── billing/                  # Billing/invoice module
│   │   ├── create-invoice.tsx
│   │   ├── invoice-pdf.tsx       # PDF generation
│   │   └── invoice-preview-modal.tsx
│   ├── crm/                      # CRM module
│   ├── inventory/                # Inventory module
│   └── reports/                  # Reports module
│       ├── date-range-filter.tsx
│       ├── export-button.tsx
│       ├── profit-loss-report.tsx
│       ├── stock-report.tsx
│       └── transaction-report.tsx
│
├── hooks/                        # Custom React hooks
│   └── use-mobile.ts
│
├── types/                        # TypeScript type definitions
│   └── next-auth.d.ts            # NextAuth type augmentation
│
├── scripts/                      # CLI scripts
│   ├── seed-owner.ts
│   ├── seed-super-owner.ts
│   └── backfill-invoice-ids.ts
│
├── public/                       # Static assets
│   └── images/
│       └── signin/
│
├── proxy.ts                      # Development proxy config
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts
├── tsconfig.json
├── components.json               # shadcn/ui configuration
└── package.json
```

## Key Directory Conventions

### Route Groups `app/(groupname)/`
Route groups create logical groupings without affecting URL paths. Each group may have its own layout:
- `(auth)` — Public authentication pages
- `(dashboard)` — Authenticated business pages
- `(customer)` — Customer-facing portal
- `(superowner)` — Super admin panel

### API Routes `app/api/`
Each resource has a top-level `route.ts` for collection operations (GET list, POST create) and `[id]/route.ts` for individual operations (GET, PUT, PATCH, DELETE).

### Components `components/`
- `components/ui/` — shadcn/ui primitives (reusable, generic)
- `components/layout/` — Layout-specific components
- `components/providers/` — React context providers
- Top-level: Domain-specific composite components (dialogs, forms, guards)

### Models `models/`
Mongoose schemas with TypeScript interfaces, validation hooks, indexes, and relationship references. Each file exports the model and its TypeScript types.

### Lib `lib/`
Pure utilities, helpers, and server-only code (auth, DB connection) that don't fit elsewhere.

### Modules `modules/`
Feature-specific grouped code that could theoretically be extracted into separate packages. Currently used for billing, CRM, inventory, and reports.