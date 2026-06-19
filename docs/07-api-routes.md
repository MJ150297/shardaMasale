# API Routes

## Overview

All API routes are under `app/api/` using the Next.js App Router convention. Each resource has:
- **Collection route** (`route.ts`) — GET (list) and POST (create)
- **Document route** (`[id]/route.ts`) — GET, PUT/PATCH, DELETE

All routes are **stateless REST** endpoints that return JSON. Authentication is enforced via `lib/auth.ts` guards.

## Authentication Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler | Public |
| `POST` | `/api/auth/shop/switch` | Switch active shop | Required |
| `POST` | `/api/auth/impersonate` | Super admin impersonation | SuperOwner |

## Items

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/items` | List items (with filtering/search) |
| `POST` | `/api/items` | Create item |
| `GET` | `/api/items/[id]` | Get item by ID |
| `PUT` | `/api/items/[id]` | Update item |
| `DELETE` | `/api/items/[id]` | Delete item |

### GET /api/items
**Query parameters:**
- `search` — Full-text search across name, SKU, barcode, etc.
- `category` — Filter by category
- `status` — Filter by status (active, draft, discontinued, archived)
- `itemType` — Filter by type (product, service)
- `trackInventory` — Filter by inventory tracking
- `page` / `limit` — Pagination
- `sort` / `order` — Sorting (name, createdAt, etc.)

### POST /api/items
**Request body:**
```json
{
  "name": "Product Name",
  "itemType": "product",
  "sku": "SKU001",
  "unitOfMeasure": "pcs",
  "pricing": {
    "costPrice": 50,
    "sellingPrice": 100,
    "mrp": 120
  },
  "stock": {
    "openingQuantity": 100
  }
}
```

**Guard:** Requires `owner` role and `activeShopId`. Automatically sets `shopId`.

## Parties

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/parties` | List parties |
| `POST` | `/api/parties` | Create party |
| `GET` | `/api/parties/[id]` | Get party by ID |
| `PUT` | `/api/parties/[id]` | Update party |
| `DELETE` | `/api/parties/[id]` | Delete party |

### GET /api/parties
**Query parameters:**
- `search` — Search by displayName, email, phone
- `partyType` — customer, supplier, both
- `status` — active, inactive, blocked
- `isArchived` — boolean
- `page` / `limit` — Pagination

### POST /api/parties
**Request body:**
```json
{
  "displayName": "John Doe",
  "partyType": "customer",
  "phoneNumber": "+919876543210",
  "email": "john@example.com",
  "creditLimit": 50000
}
```

## Transactions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transactions` | List transactions |
| `POST` | `/api/transactions` | Create transaction |
| `GET` | `/api/transactions/[id]` | Get transaction by ID |
| `PUT` | `/api/transactions/[id]` | Update transaction |
| `DELETE` | `/api/transactions/[id]` | Delete/cancel transaction |

### GET /api/transactions
**Query parameters:**
- `type` — sale, purchase, payment-in, payment-out, etc.
- `status` — draft, confirmed, cancelled
- `paymentStatus` — unpaid, partial, paid
- `partyId` — Filter by party
- `dateFrom` / `dateTo` — Date range
- `search` — Search by transactionNumber
- `page` / `limit` — Pagination (default: 20)

### POST /api/transactions
**Request body (sale example):**
```json
{
  "type": "sale",
  "party": "party_id",
  "transactionDate": "2025-01-15",
  "lineItems": [
    {
      "item": "item_id",
      "itemName": "Product",
      "unit": "pcs",
      "quantity": 2,
      "unitPrice": 100
    }
  ]
}
```

**Guard:** Requires `owner` role and `activeShopId`. Creates transaction with `shopId: user.activeShopId`.

## Invoices

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/invoices` | List invoices |
| `POST` | `/api/invoices` | Create invoice from transaction |
| `GET` | `/api/invoices/[id]` | Get invoice by ID |
| `PUT` | `/api/invoices/[id]` | Update invoice |
| `DELETE` | `/api/invoices/[id]` | Delete invoice |
| `GET` | `/api/invoices/[id]/share` | Get shareable invoice data |
| `POST` | `/api/invoices/generate` | Generate invoice PDF |

### POST /api/invoices
**Request body:**
```json
{
  "transactionId": "transaction_id",
  "dueDate": "2025-02-15",
  "termsAndConditions": "Payment due within 30 days"
}
```

The invoice creation handler verifies the transaction exists, is a sale type, and doesn't already have an invoice. It generates an invoice number using the shop's prefix and a sequence counter.

## Shops

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/shops` | List user's shops |
| `POST` | `/api/shops` | Create shop |
| `PUT` | `/api/shops/[id]` | Update shop |

## Stock Movements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stock-movements` | List stock movements |
| `POST` | `/api/stock-movements` | Record movement |
| `POST` | `/api/stock-movements/adjust` | Adjust stock level |

## Reports

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/reports/profit-loss` | Profit/Loss report |
| `POST` | `/api/reports/stock` | Stock status report |
| `POST` | `/api/reports/transactions` | Transaction report |

Report endpoints accept date ranges and filters in the request body, returning aggregated data for the reports module.

## Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get user settings |
| `PUT` | `/api/settings` | Update user settings |

### GET /api/settings
**Query parameters:**
- `shopId` - Optional shop scope. If omitted, returns the owner-level settings.

The response includes the `business` profile and the `billing` block, including `billing.shareMessageTemplates` for each supported transaction kind. Those templates power the WhatsApp/share-sheet messages used across the dashboard and invoice flows.

### PUT /api/settings
Accepts the full settings payload. When you update the Billing tab, the request can include:
- billing prefixes and sequence counters
- terms and conditions
- footer text
- `billing.shareMessageTemplates` for custom share-copy templates

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | List user notifications |
| `PUT` | `/api/notifications/[id]` | Mark as read/dismissed |

## Super Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/super/owners` | List all owners |
| `POST` | `/api/super/owners` | Create owner |

All super admin routes require `superOwner` role.

## Common Patterns

### Authentication Guard Pattern
```typescript
export async function POST(req: Request) {
  const user = await requireOwner();
  
  if (!user.activeShopId) {
    return Response.json(
      { error: "No active shop selected. Please select a shop first." },
      { status: 400 }
    );
  }
  // ... handler logic
}
```

### Response Format
```typescript
// Success (list)
{ "items": [...], "total": 100, "page": 1, "limit": 20 }

// Success (single)
{ "item": { ... } }

// Error
{ "error": "Message describing the error" }

// Validation Error
{ "error": "Validation failed", "details": [...] }
```

### Error Handling
- `400` — Bad request / validation error
- `401` — Unauthenticated
- `404` — Not found
- `500` — Internal server error
- Custom `AppError` class with HTTP status codes is used throughout
