# Client Pages

## Overview

The dashboard pages are organized under `app/(dashboard)/dashboard/`, each section having a server page component and a client component for interactivity.

## Layout Structure

```
app/(dashboard)/
├── layout.tsx              # Server layout: session guard + DashboardShell
└── dashboard/
    ├── page.tsx            # Dashboard home (server)
    ├── dashboard-client.tsx
    ├── items/
    │   ├── page.tsx        # Items list (server)
    │   └── items-client.tsx
    ├── parties/
    │   ├── page.tsx        # Parties list (server)
    │   ├── parties-client.tsx
    │   └── [partyId]/
    │       ├── page.tsx    # Party detail (server)
    │       └── party-client.tsx
    ├── transactions/
    │   ├── page.tsx        # Transactions list (server)
    │   └── transactions-client.tsx
    ├── invoices/
    │   ├── page.tsx        # Invoices list (server)
    │   └── invoices-client.tsx
    ├── shops/
    │   ├── page.tsx        # Shop management (server)
    │   └── shops-client.tsx
    ├── reports/
    │   └── page.tsx        # Reports (server)
    └── developer/
        └── page.tsx        # Dev tools
```

## Pattern: Server + Client Pages

Each section follows the same pattern:

1. **Server page** (`page.tsx`):
   - Guards authentication with `requireUser()`
   - Renders the client component with initial data

2. **Client component** (`*-client.tsx`):
   - Manages client-side state
   - Fetches data via `useQuery` (TanStack React Query) or SWR
   - Renders data tables with search, filter, pagination

## Items Pages

### items-client.tsx
- Lists all items with a data table
- **Features**: Search, filter by type/status/category, sort, paginate
- **Actions**: Create, edit, delete, preview items
- **Guard**: Create button wrapped in `<RequireShopGuard>`
- **Data source**: `GET /api/items` with query params

### Item Preview Dialog
- View item details including pricing, stock, and metadata
- Triggered from the items table row action

## Parties Pages

### parties-client.tsx
- Lists all parties with a data table
- **Features**: Search by name/email/phone, filter by type/status
- **Actions**: Create, edit, delete parties
- **Guard**: Create button wrapped in `<RequireShopGuard>`
- **Data source**: `GET /api/parties` with query params

### Party Detail Page (`[partyId]/`)
- `party-client.tsx` — Shows party profile with:
  - Contact information
  - Balance and credit limit
  - Transaction history for this party
  - Quick action buttons (new sale, new payment)

## Transactions Pages

### transactions-client.tsx
- Lists all transactions with a comprehensive data table
- **Features**: 
  - Filter by type (sale, purchase, payment-in, etc.)
  - Filter by status (draft, confirmed, cancelled)
  - Filter by payment status
  - Date range filter
  - Search by transaction number
  - Pagination (20 per page)
- **Actions**: 
  - Create new transaction (dropdown with all 8 types)
  - View, edit (draft only), confirm, cancel
- **Guard**: New transaction dropdown wrapped in `<RequireShopGuard>`

### Transaction Status Badges
- Draft: Yellow
- Confirmed: Green
- Cancelled: Red

## Invoices Pages

### invoices-client.tsx
- Lists all invoices with a data table
- **Features**: Filter by status (draft, sent, paid, overdue, cancelled), date range
- **Actions**: Create invoice from transaction, view, share, download PDF
- **Guard**: New invoice button wrapped in `<RequireShopGuard>`

### Invoice Actions
- **View/Preview**: Opens preview modal with invoice details
- **Share**: Opens share sheet with shareable link/QR
- **Download**: Generates and downloads PDF
- **Mark as Sent**: Updates invoice status
- **Record Payment**: Links payment transaction to invoice

## Shops Pages

### shops-client.tsx
- Lists user's shops
- **Actions**: Create new shop, edit shop details
- **Features**: Shop name, display name, contact info, currency, timezone

## Dashboard Home

### dashboard-client.tsx
- Summary statistics:
  - Total sales (today, this week, this month)
  - Total purchases
  - Outstanding invoices
  - Low stock items
- Recent transactions
- Quick action buttons
- Onboarding banner (shown when no shops exist)

## Reports Page

The reports page uses the reports module (see [Reports](./12-reports.md)) for rendering various report types.

## Common Client Page Architecture

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function ItemsClient({ initialData }: { initialData: any }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['items', search, page, category],
    queryFn: () => fetch(`/api/items?search=${search}&page=${page}&category=${category}`).then(r => r.json()),
    initialData,
  });

  return (
    <div>
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        filters={[...]}
      />
      <Table>
        {/* table content */}
      </Table>
      <Pagination page={page} total={data.total} onChange={setPage} />
    </div>
  );
}