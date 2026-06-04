# Reports

## Overview

The reports module provides financial and operational reporting. Reports are located in `modules/reports/` and rendered on the dashboard reports page.

## Report Types

### 1. Profit & Loss Report

**Location**: `modules/reports/profit-loss-report.tsx`

Calculates profit/loss over a date range by comparing sales revenue against cost of goods sold.

**Metrics:**
- **Gross Sales**: Total sales revenue (sum of sale transaction grand totals)
- **Sales Returns**: Total sale-return amounts
- **Net Sales**: Gross Sales - Sales Returns
- **Cost of Goods Sold (COGS)**: Sum of costPrice × quantity for sold items
- **Gross Profit**: Net Sales - COGS
- **Gross Margin %**: (Gross Profit / Net Sales) × 100
- **Expenses**: Purchase transactions categorized as expenses
- **Net Profit**: Gross Profit - Expenses

**Features:**
- Date range filter (custom, today, this week, this month, this quarter, this year)
- Group by day/week/month
- Export to XLSX

### 2. Stock Report

**Location**: `modules/reports/stock-report.tsx`

Provides inventory status overview for all products.

**Metrics:**
- Item name, SKU, category
- Current stock quantity
- Reserved quantity
- Available quantity (current - reserved)
- Stock value (current quantity × cost price)
- Reorder level status
- Location

**Features:**
- Filter by category
- Show only items below reorder level
- Export to XLSX

### 3. Transaction Report

**Location**: `modules/reports/transaction-report.tsx`

Detailed transaction listing with aggregation.

**Features:**
- Filter by transaction type
- Filter by date range
- Filter by party
- Group by transaction type, date, or party
- Summary totals (total sales, total purchases, net)
- Export to XLSX

## Shared Components

### DateRangeFilter (`modules/reports/date-range-filter.tsx`)

Reusable date range picker with presets:
- Today
- This Week
- This Month
- This Quarter
- This Year
- Custom Range

```tsx
<DateRangeFilter
  value={dateRange}
  onChange={setDateRange}
/>
```

### ExportButton (`modules/reports/export-button.tsx`)

Exports report data to XLSX format using the `xlsx` library:

```tsx
<ExportButton
  data={reportData}
  filename="profit-loss-report"
  disabled={isLoading}
/>
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/reports/profit-loss` | Fetch P&L data |
| `POST` | `/api/reports/stock` | Fetch stock report data |
| `POST` | `/api/reports/transactions` | Fetch transaction report data |

All report endpoints:
- Accept `{ dateFrom, dateTo, filters }` in request body
- Require authentication and active shop
- Return aggregated data for the frontend to render
- Apply shop scoping automatically via global plugin

## Data Aggregation Pattern

Reports use MongoDB aggregation pipelines for efficient server-side computation:

```typescript
// Example: Profit/Loss aggregation
const pipeline = [
  { $match: { owner: user.id, shopId: user.activeShopId, type: 'sale', status: 'confirmed', transactionDate: { $gte: dateFrom, $lte: dateTo } } },
  { $group: { _id: null, totalSales: { $sum: '$summary.grandTotal' }, totalCost: { $sum: { $sum: '$lineItems.costPrice' } } } },
];
```

## Advanced Reports & Subscription Gating

Reports are divided into **basic** and **advanced** tiers. Advanced reports require the `advancedReports` plan feature (set to `false` for `free` and `trial` plans, `true` for `paid` and `enterprise`).

### Basic Reports (all plans)
These are available on every plan and only require the user to be authenticated as a business user:

| Report | Slug | Description |
|--------|------|-------------|
| Daily Sales | `daily-sales` | Daily sales summary |
| Customer Ledger | `customer-ledger` | Per-customer balance history |
| Stock | `stock` | Current inventory levels |
| Stock Movements | `stock/movements` | Detailed stock movement log |
| Parties | `parties` | Party summaries |
| Transactions | `transactions` | Full transaction list |
| Invoices | `invoices` | Full invoice list |
| Dashboard Charts | `dashboard-charts` | Time-series chart data |
| Snapshot | `snapshot` | At-a-glance KPIs |

### Advanced Reports (paid+ plans)
These return **HTTP 403** with `error: "Advanced reports are not available on your plan. Upgrade to access this report."` for users on `free` or `trial` plans:

| Report | Slug | Plan Required |
|--------|------|---------------|
| Profit & Loss | `profit-loss` | paid+ |
| Balance Sheet | `balance-sheet` | paid+ |
| Cash Flow | `cash-flow` | paid+ |
| Tax/GST | `tax` | paid+ |
| Sales by Item | `sales-by-item` | paid+ |
| Receivables Aging | `receivables-aging` | paid+ |
| Payables Aging | `payables-aging` | paid+ |
| Supplier Performance | `supplier-performance` | paid+ |
| Top Spenders | `top-spenders` | paid+ |
| Wastage | `wastage` | paid+ |
| Purchase Orders | `purchase-orders` | paid+ |
| Stock Aging | `stock-aging` | paid+ |
| Sales Returns | `sales-returns` | paid+ |

### How Gating Works

Each advanced report route:

1. Calls `requireOwner()` (or `requireBusinessUser()`) to verify auth + role
2. Calls `requireActiveBusinessSubscription()` to verify subscription is **active** or **trial** (not expired/suspended)
3. Checks `features.advancedReports` against `ADVANCED_REPORT_SLUGS` from `lib/subscription.ts`
4. Returns 403 if the user is on a plan that doesn't support that report

```typescript
// Pattern used in every advanced report route
const user = await requireOwner();
const { features } = await requireActiveBusinessSubscription();
if (!features.advancedReports || !isAdvancedReport('profit-loss')) {
  return NextResponse.json(
    { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
    { status: 403 }
  );
}
```

The `ADVANCED_REPORT_SLUGS` set is defined in `lib/subscription.ts` along with the `isAdvancedReport(slug)` helper. Adding a new advanced report requires:
1. Adding the slug to `ADVANCED_REPORT_SLUGS`
2. Adding the gate in the new route's `GET` handler

## Report Page Layout

The reports page (`app/(dashboard)/dashboard/reports/page.tsx`) uses tabs to switch between report types:

```tsx
<Tabs defaultValue="profit-loss">
  <TabsList>
    <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
    <TabsTrigger value="stock">Stock</TabsTrigger>
    <TabsTrigger value="transactions">Transactions</TabsTrigger>
  </TabsList>
  <TabsContent value="profit-loss">
    <ProfitLossReport />
  </TabsContent>
  <TabsContent value="stock">
    <StockReport />
  </TabsContent>
  <TabsContent value="transactions">
    <TransactionReport />
  </TabsContent>
</Tabs>