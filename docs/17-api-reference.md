# API Reference

## Overview

Comprehensive reference for all REST API endpoints. All endpoints (except NextAuth) return JSON responses.

**Base URL**: `/api`

**Authentication**: Most endpoints require authentication via NextAuth session. Guards are noted per endpoint.

**Shop Scoping**: All data operations are automatically scoped to the authenticated user's `activeShopId` via the global Mongoose plugin.

---

## Authentication

### NextAuth Handler

Handles sign-in, sign-out, and session management.

- **Path**: `GET/POST /api/auth/[...nextauth]`
- **Auth**: Public
- **Returns**: NextAuth session handling

### Switch Shop

Switches the active shop for the current session.

- **Path**: `POST /api/auth/shop/switch`
- **Auth**: Required
- **Body**: `{ "shopId": "string" }`
- **Response**: `{ "success": true }`

### Impersonate

Super owner impersonates another user.

- **Path**: `POST /api/auth/impersonate`
- **Auth**: SuperOwner only
- **Body**: `{ "userId": "string" }`

---

## Items

### List Items

- **Path**: `GET /api/items`
- **Auth**: Required
- **Query Parameters**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `search` | string | Full-text search (name, SKU, barcode, category, brand) |
  | `category` | string | Filter by category |
  | `status` | enum | draft, active, discontinued, archived |
  | `itemType` | enum | product, service |
  | `trackInventory` | boolean | Filter by inventory tracking |
  | `page` | number | Page number (default: 1) |
  | `limit` | number | Items per page (default: 20) |
  | `sort` | string | Field to sort by |
  | `order` | enum | asc, desc |

- **Response**: `{ "items": Item[], "total": number, "page": number, "limit": number }`

### Create Item

- **Path**: `POST /api/items`
- **Auth**: Owner required + active shop
- **Body**:
  ```json
  {
    "name": "string (required)",
    "itemType": "product | service",
    "sku": "string (optional)",
    "barcode": "string (optional)",
    "unitOfMeasure": "string (required, default: pcs)",
    "category": "string (optional)",
    "brand": "string (optional)",
    "description": "string (optional)",
    "pricing": {
      "costPrice": "number",
      "purchasePrice": "number",
      "sellingPrice": "number (required)",
      "mrp": "number (optional)"
    },
    "stock": {
      "openingQuantity": "number"
    },
    "trackInventory": "boolean",
    "taxRate": "number"
  }
  ```
- **Response**: `{ "item": Item }`
- **Errors**: `400` (validation), `401`, `400` (no active shop)

### Get Item

- **Path**: `GET /api/items/[id]`
- **Auth**: Required
- **Response**: `{ "item": Item }`

### Update Item

- **Path**: `PUT /api/items/[id]`
- **Auth**: Owner required
- **Body**: Partial item fields
- **Response**: `{ "item": Item }`

### Delete Item

- **Path**: `DELETE /api/items/[id]`
- **Auth**: Owner required
- **Response**: `{ "success": true }`

---

## Parties

### List Parties

- **Path**: `GET /api/parties`
- **Auth**: Required
- **Query Parameters**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `search` | string | Search by displayName, email, phone |
  | `partyType` | enum | customer, supplier, both |
  | `status` | enum | active, inactive, blocked |
  | `isArchived` | boolean | Include archived |
  | `page` | number | Page number |
  | `limit` | number | Per page |

- **Response**: `{ "parties": Party[], "total": number, "page": number, "limit": number }`

### Create Party

- **Path**: `POST /api/parties`
- **Auth**: Owner required + active shop
- **Body**:
  ```json
  {
    "displayName": "string (required)",
    "partyType": "customer | supplier | both",
    "email": "string (optional)",
    "phoneNumber": "string (optional)",
    "gstin": "string (optional)",
    "creditLimit": "number",
    "openingBalance": "number"
  }
  ```
- **Response**: `{ "party": Party }`

### Get Party

- **Path**: `GET /api/parties/[id]`
- **Auth**: Required
- **Response**: `{ "party": Party }`

### Update Party

- **Path**: `PUT /api/parties/[id]`
- **Auth**: Owner required
- **Response**: `{ "party": Party }`

### Delete Party

- **Path**: `DELETE /api/parties/[id]`
- **Auth**: Owner required
- **Response**: `{ "success": true }`

---

## Transactions

### List Transactions

- **Path**: `GET /api/transactions`
- **Auth**: Required
- **Query Parameters**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `type` | enum | sale, purchase, sale-return, purchase-return, payment-in, payment-out, adjustment, opening-balance |
  | `status` | enum | draft, confirmed, cancelled |
  | `paymentStatus` | enum | unpaid, partial, paid, void, not-applicable |
  | `partyId` | string | Filter by party |
  | `dateFrom` | date (ISO) | Start date filter |
  | `dateTo` | date (ISO) | End date filter |
  | `search` | string | Search by transactionNumber |
  | `page` | number | Page number |
  | `limit` | number | Per page (default: 20) |
  | `sort` | string | Field to sort |
  | `order` | enum | asc, desc |

- **Response**: `{ "transactions": Transaction[], "total": number, "page": number, "limit": number }`

### Create Transaction

- **Path**: `POST /api/transactions`
- **Auth**: Owner required + active shop
- **Body**:
  ```json
  {
    "type": "sale | purchase | ... (required)",
    "party": "string (optional, ObjectId)",
    "transactionDate": "date (ISO, default: now)",
    "dueDate": "date (ISO, optional)",
    "lineItems": [
      {
        "item": "string (ObjectId, optional)",
        "itemName": "string (required)",
        "unit": "string (required)",
        "quantity": "number (required)",
        "unitPrice": "number (required)",
        "discountAmount": "number",
        "taxRate": "number",
        "costPrice": "number (optional)"
      }
    ],
    "payment": {
      "method": "cash | card | upi | bank-transfer | cheque | other",
      "referenceNumber": "string (optional)",
      "notes": "string (optional)"
    },
    "summary": {
      "paidAmount": "number",
      "totalDiscountType": "percentage | fixed | null",
      "totalDiscountValue": "number"
    },
    "notes": "string (optional)",
    "tags": ["string"],
    "status": "draft | confirmed (default: draft)"
  }
  ```
- **Response**: `{ "transaction": Transaction }`
- **Errors**: `400` (validation, credit limit, stock), `401`, `400` (no active shop)

### Get Transaction

- **Path**: `GET /api/transactions/[id]`
- **Auth**: Required
- **Response**: `{ "transaction": Transaction }`

### Update Transaction

- **Path**: `PUT /api/transactions/[id]`
- **Auth**: Owner required
- **Notes**: Only draft transactions can be edited. Confirmed/cancelled transactions are immutable.
- **Response**: `{ "transaction": Transaction }`

### Delete/Cancel Transaction

- **Path**: `DELETE /api/transactions/[id]`
- **Auth**: Owner required
- **Notes**: Cancels the transaction, releasing inventory reservations and reverting party balance changes.
- **Response**: `{ "success": true }`

---

## Invoices

### List Invoices

- **Path**: `GET /api/invoices`
- **Auth**: Required
- **Query Parameters**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `status` | enum | draft, sent, paid, overdue, cancelled |
  | `dateFrom` | date (ISO) | Filter by due date |
  | `dateTo` | date (ISO) | Filter by due date |
  | `search` | string | Search by invoiceNumber |
  | `page` | number | Page number |
  | `limit` | number | Per page |

- **Response**: `{ "invoices": Invoice[], "total": number, "page": number, "limit": number }`

### Create Invoice

- **Path**: `POST /api/invoices`
- **Auth**: Owner required + active shop
- **Body**:
  ```json
  {
    "transactionId": "string (required, ObjectId)",
    "dueDate": "date (ISO, required)",
    "termsAndConditions": "string (optional)",
    "notes": "string (optional)"
  }
  ```
- **Validation**:
  - Transaction must exist and belong to user's shop
  - Transaction type must be `sale`
  - Transaction status must be `confirmed`
  - Transaction must not already have an invoice
- **Response**: `{ "invoice": Invoice }`

### Get Invoice

- **Path**: `GET /api/invoices/[id]`
- **Auth**: Required
- **Response**: `{ "invoice": Invoice }`

### Update Invoice

- **Path**: `PUT /api/invoices/[id]`
- **Auth**: Owner required
- **Response**: `{ "invoice": Invoice }`

### Delete Invoice

- **Path**: `DELETE /api/invoices/[id]`
- **Auth**: Owner required
- **Response**: `{ "success": true }`

### Share Invoice

- **Path**: `GET /api/invoices/[id]/share`
- **Auth**: Required
- **Response**: Invoice data in a shareable format (santized for customer view)

### Generate Invoice PDF

- **Path**: `POST /api/invoices/generate`
- **Auth**: Required
- **Body**: `{ "invoiceId": "string" }`
- **Response**: PDF file download

---

## Shops

### List Shops

- **Path**: `GET /api/shops`
- **Auth**: Required
- **Response**: `{ "shops": Shop[] }`

### Create Shop

- **Path**: `POST /api/shops`
- **Auth**: Owner required
- **Body**:
  ```json
  {
    "name": "string (required)",
    "displayName": "string (optional)",
    "email": "string (optional)",
    "phone": "string (optional)",
    "currency": "string (default: INR)",
    "timezone": "string (default: Asia/Kolkata)",
    "address": {
      "line1": "string",
      "city": "string",
      "state": "string",
      "postalCode": "string",
      "country": "string"
    }
  }
  ```
- **Response**: `{ "shop": Shop }`

### Update Shop

- **Path**: `PUT /api/shops/[id]`
- **Auth**: Owner required
- **Response**: `{ "shop": Shop }`

---

## Stock Movements

### List Stock Movements

- **Path**: `GET /api/stock-movements`
- **Auth**: Required
- **Query Parameters**: `itemId`, `type` (IN/OUT), `referenceType`, `dateFrom`, `dateTo`, `page`, `limit`
- **Response**: `{ "movements": StockMovement[], "total": number }`

### Record Movement

- **Path**: `POST /api/stock-movements`
- **Auth**: Owner required

### Adjust Stock

- **Path**: `POST /api/stock-movements/adjust`
- **Auth**: Owner required
- **Body**:
  ```json
  {
    "itemId": "string (required)",
    "newQuantity": "number (required)",
    "reason": "string (required)",
    "notes": "string (optional)"
  }
  ```
- **Response**: `{ "item": Item, "movement": StockMovement }`

---

## Reports

### Profit & Loss

- **Path**: `POST /api/reports/profit-loss`
- **Auth**: Required
- **Body**: `{ "dateFrom": "ISO date", "dateTo": "ISO date" }`
- **Response**: Aggregated profit/loss data

### Stock Report

- **Path**: `POST /api/reports/stock`
- **Auth**: Required
- **Body**: `{ "category": "string (optional)", "belowReorder": "boolean (optional)" }`
- **Response**: Stock status data

### Transaction Report

- **Path**: `POST /api/reports/transactions`
- **Auth**: Required
- **Body**: `{ "dateFrom": "ISO date", "dateTo": "ISO date", "type": "transaction type (optional)", "partyId": "string (optional)" }`
- **Response**: Aggregated transaction data

---

## Settings

### Get Settings

- **Path**: `GET /api/settings`
- **Auth**: Required
- **Query Parameters**: `shopId` (optional)
- **Response**: User settings object, including `business` and `billing.shareMessageTemplates`

### Update Settings

- **Path**: `PUT /api/settings`
- **Auth**: Required
- **Body**: Partial settings object
- **Common fields**: billing prefixes, sequence counters, terms and conditions, footer text, and `billing.shareMessageTemplates`
- **Response**: Updated settings

---

## Notifications

### List Notifications

- **Path**: `GET /api/notifications`
- **Auth**: Required
- **Query Parameters**: `status` (unread/read/dismissed), `type`, `page`, `limit`
- **Response**: `{ "notifications": Notification[], "total": number }`

### Update Notification

- **Path**: `PUT /api/notifications/[id]`
- **Auth**: Required
- **Body**: `{ "status": "read | dismissed" }`
- **Response**: `{ "notification": Notification }`

---

## Super Admin

### List Owners

- **Path**: `GET /api/super/owners`
- **Auth**: SuperOwner only
- **Response**: `{ "owners": User[] }`

### Create Owner

- **Path**: `POST /api/super/owners`
- **Auth**: SuperOwner only
- **Body**: `{ "name": "string", "email": "string", "password": "string" }`
- **Response**: `{ "owner": User }`

---

## Common Error Codes

| Status | Meaning |
|--------|---------|
| `400` | Bad request — validation error, credit limit exceeded, insufficient stock |
| `401` | Unauthenticated — no valid session |
| `404` | Resource not found |
| `409` | Conflict — duplicate key, invoice already exists |
| `422` | Unprocessable entity — invalid state transition |
| `500` | Internal server error |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "details": [
    { "field": "name", "message": "Name is required" }
  ]
}
