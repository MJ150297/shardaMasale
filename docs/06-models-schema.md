# Models & Schema

## Overview

Sharda Masale uses **Mongoose 9** with TypeScript for MongoDB ODM. There are 9 models total, each in a dedicated file under `models/`.

## Model Relationships

```
User (owner)
 ├── Shop (ownerId)
 │    ├── Item (shopId)
 │    ├── Party (shopId)
 │    ├── Transaction (shopId)
 │    ├── Invoice (shopId)
 │    ├── StockMovement (shopId)
 │    └── Notification (shopId)
 ├── Settings (owner)
 └── Notification (owner)
```

## 1. User Model (`models/User.ts`)

**Purpose**: Authentication, authorization, and user management.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | String | required, 2-120 chars | User's display name |
| `email` | String | required, unique, lowercase | Login identifier |
| `passwordHash` | String | required, select: false | bcrypt hash |
| `role` | Enum | superOwner/owner/admin/manager/cashier/staff/customer | Authorization level |
| `status` | Enum | invited/active/inactive/suspended | Account state |
| `phoneNumber` | String | optional | Contact number |
| `avatarUrl` | String | optional | Profile image |
| `shopName` | String | optional, max 160 | Business name |
| `timezone` | String | default: Asia/Kolkata | User timezone |
| `currency` | String | default: INR | Preferred currency |
| `loginAttempts` | Number | default: 0 | Failed login counter |
| `lastLoginAt` | Date | optional | Last successful login |
| `lastFailedLoginAt` | Date | optional | Lockout tracking |
| `passwordChangedAt` | Date | optional | Password history |
| `emailVerifiedAt` | Date | optional | Email verification |
| `belongsTo` | ObjectId (ref: User) | optional | Parent owner |
| `createdBySuperOwner` | ObjectId (ref: User) | optional | Creator reference |
| `allowedShops` | [ObjectId] (ref: Shop) | default: [] | Shop access control |
| `subscription` | Embedded | plan/status/expiry | Subscription management |
| `metadata` | Mixed | default: {} | Extensible data |

### Indexes
- `email`: unique
- `status + role`: compound
- `loginAttempts`: for lockout queries

### Methods
- `comparePassword(password)`: bcrypt comparison
- `toSafeObject()`: Returns sanitized user without passwordHash

### Hooks
- **pre('validate')**: Normalizes email and phone
- **pre('save')**: Auto-hashes password if plain text

## 2. Shop Model (`models/Shop.ts`)

**Purpose**: Multi-tenant shop configuration.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | ObjectId (ref: User) | Shop owner |
| `name` | String | Shop name (unique per owner) |
| `displayName` | String (optional) | Display name override |
| `email` | String (optional) | Contact email |
| `phone` | String (optional) | Contact phone |
| `address` | Embedded `ShopAddress` | Full address |
| `currency` | String (default: INR) | Shop currency |
| `timezone` | String (default: Asia/Kolkata) | Shop timezone |
| `isActive` | Boolean (default: true) | Active flag |
| `settings` | Embedded `ShopSettings` | Prefix configuration |
| `metadata` | Mixed | Extensible data |

### Embedded: ShopAddress
- `line1` (req), `line2`, `city` (req), `state` (req), `postalCode` (req), `country` (req)

### Embedded: ShopSettings
- `invoicePrefix` (default: INV), `purchasePrefix` (default: PUR), `paymentPrefix` (default: PAY), `quotationPrefix` (default: QTN)

### Indexes
- `ownerId + name`: unique compound

## 3. Item Model (`models/Item.ts`)

**Purpose**: Products and services with pricing, inventory, and categorization.

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | ObjectId (ref: User) | Owner reference |
| `shopId` | ObjectId (ref: Shop) | Shop scope |
| `name` | String | Item name |
| `slug` | String | URL-friendly unique ID |
| `sku` | String (optional, unique) | Stock keeping unit |
| `barcode` | String (optional, unique) | Barcode |
| `itemType` | Enum: product/service | Item classification |
| `status` | Enum: draft/active/discontinued/archived | Lifecycle |
| `category` | String (optional) | Product category |
| `brand` | String (optional) | Brand name |
| `unitOfMeasure` | String | Unit (pcs, kg, etc.) |
| `hsnCode` / `sacCode` | String | Tax codes |
| `pricing` | Embedded `ItemPricing` | Cost/purchase/selling prices |
| `stock` | Embedded `ItemStock` | Inventory tracking |
| `trackInventory` | Boolean | Enable stock tracking |
| `trackBatch` / `trackExpiry` | Boolean | Batch/expiry tracking |

### Embedded: ItemPricing
- `costPrice`, `purchasePrice`, `sellingPrice` (req), `mrp`

### Embedded: ItemStock
- `openingQuantity`, `currentQuantity`, `reservedQuantity`, `reorderLevel`, `reorderQuantity`, `allowNegativeStock` (default: false), `location`

### Indexes
- `owner + slug`: unique
- `owner + status + category`: compound
- `owner + sku`: unique (partial for non-null)
- `owner + barcode`: unique (partial)
- Text index: name, description, category, brand, sku, barcode

### Virtuals
- `availableQuantity`: `currentQuantity - reservedQuantity`

### Hooks
- **pre('validate')**: Generates slug, handles SKU/barcode cleanup, copies opening qty to current qty for new items, zeros inventory for services, normalizes tax rates
- **post('save')**: Creates opening stock movement if initial quantity > 0

## 4. Party Model (`models/Party.ts`)

**Purpose**: Customers, suppliers, and contacts.

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | ObjectId (ref: User) | Owner reference |
| `shopId` | ObjectId (ref: Shop) | Shop scope |
| `displayName` | String | Primary name |
| `legalName` | String (optional) | Legal/business name |
| `partyType` | Enum: customer/supplier/both | Classification |
| `status` | Enum: active/inactive/blocked | State |
| `email` | String (optional) | Contact email |
| `phoneNumber` | String (optional) | Primary phone |
| `gstin` | String (optional) | GST identification |
| `pan` | String (optional) | PAN number |
| `taxTreatment` | Enum: registered/unregistered/consumer/overseas | Tax handling |
| `address` | String (optional) | Simple address text |
| `billingAddress` | Embedded `PartyAddress` | Structured billing address |
| `shippingAddress` | Embedded `PartyAddress` | Structured shipping address |
| `contactPerson` | Embedded `ContactPerson` | Primary contact |
| `creditLimit` | Number (default: 0) | Credit limit |
| `openingBalance` | Number | Initial balance |
| `currentBalance` | Number | Computed running balance |
| `isArchived` | Boolean (default: false) | Soft delete |

### Indexes
- `owner + displayName`: compound
- `owner + partyType + status`: compound
- `owner + email`: unique (partial for non-null)

### Hooks
- **pre('validate')**: Normalizes email, phone, contact person fields

## 5. Transaction Model (`models/Transaction.ts`)

**Purpose**: All financial transactions — sales, purchases, payments, adjustments.

### Transaction Types

```typescript
const TRANSACTION_TYPES = [
  "sale",              // Sales to customers
  "purchase",          // Purchases from suppliers
  "sale-return",       // Customer returns
  "purchase-return",   // Returns to suppliers
  "payment-in",        // Payments received
  "payment-out",       // Payments made
  "adjustment",        // Stock/balance adjustments
  "opening-balance",   // Initial balance entry
] as const;
```

### Statuses
- `draft` → `confirmed` → `cancelled`
- Draft transactions can be edited; confirmed/cancelled are immutable

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | ObjectId (ref: User) | Owner reference |
| `shopId` | ObjectId (ref: Shop) | Shop scope |
| `transactionNumber` | String | Unique identifier |
| `type` | Enum (8 types) | Transaction category |
| `status` | Enum: draft/confirmed/cancelled | Lifecycle |
| `paymentStatus` | Enum: unpaid/partial/paid/void/not-applicable | Payment state |
| `party` | ObjectId (ref: Party) | Related party |
| `transactionDate` | Date | Transaction date |
| `dueDate` | Date (optional) | Payment due date |
| `lineItems` | [LineItem] | Products/services |
| `summary` | Embedded `TransactionSummary` | Computed totals |
| `payment` | Embedded `PaymentDetails` | Payment info |
| `tags` | [String] | Categorization |
| `invoiceId` | ObjectId (ref: Invoice) | Linked invoice |

### Embedded: LineItem
- `item` (ObjectId ref), `itemName`, `sku`, `description`, `unit`, `quantity`, `unitPrice`, `discountAmount`, `taxRate`, `taxAmount`, `lineTotal`, `costPrice`

### Embedded: TransactionSummary
- `subtotal`, `discountTotal`, `taxTotal`, `totalDiscountType` (percentage/fixed), `totalDiscountValue`, `totalDiscount`, `roundOff`, `grandTotal`, `paidAmount`, `dueAmount`

### Indexes
- `owner + transactionNumber`: unique
- `owner + type + status + transactionDate`: compound
- `owner + party + transactionDate`: compound

### Hooks
- **pre('validate')**: Computes line totals, tax, discounts, grand total, payment status
- **pre('save')**: Immutability enforcement — blocks editing line items or protected fields on confirmed/cancelled transactions. Validates stock availability when confirming OUT movements

## 6. Invoice Model (`models/Invoice.ts`)

**Purpose**: Invoice document generation linked to transactions.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `transactionId` | ObjectId (ref: Transaction) | Source transaction |
| `owner` | ObjectId (ref: User) | Owner reference |
| `shopId` | ObjectId (ref: Shop) | Shop scope |
| `invoiceNumber` | String | Unique invoice ID |
| `status` | Enum: draft/sent/paid/overdue/cancelled | Lifecycle |
| `dueDate` | Date | Payment due |
| `termsAndConditions` | String (optional) | Legal terms |
| `notes` | String (optional) | Additional notes |
| `sentAt` / `paidAt` / `cancelledAt` | Date (optional) | Timestamps |

### Indexes
- `invoiceNumber`: unique
- `transactionId`: unique (one invoice per transaction)
- `owner`: index
- `status`: index

## 7. StockMovement Model (`models/StockMovement.ts`)

Tracks all inventory changes with audit trail. Reference types include: SALE, PURCHASE, ADJUSTMENT, TRANSFER, RETURN, OPENING.

## 8. Notification Model (`models/Notification.ts`)

User notifications with status tracking (unread/read/dismissed), types, and optional document references.

## 9. Settings Model (`models/Settings.ts`)

User-level settings including business profile, billing prefixes, share-message templates, security configuration, preferences, and feature flags.

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `business` | Embedded `BusinessProfileSettings` | Legal name, display name, contact details, logo, and address |
| `billing` | Embedded `BillingSettings` | Prefixes, sequence counters, round-off, terms, footer text, and share templates |
| `billing.shareMessageTemplates` | Embedded map | Per-transaction share templates for invoice, sale, purchase, returns, payments, adjustments, and opening balance |
| `notifications` | Embedded `NotificationSettings` | Alerts and digest preferences |
| `featureFlags` | Record | Feature toggles used by the UI |

### Billing Share Templates

The billing settings store a reusable WhatsApp/share-sheet message template for each transaction kind:

- `invoice`
- `sale`
- `purchase`
- `sale-return`
- `purchase-return`
- `payment-in`
- `payment-out`
- `adjustment`
- `opening-balance`

Each template is rendered from a shared context in `lib/share-messages.ts`, so placeholders like `{{party_name}}`, `{{reference_no}}`, `{{line_items}}`, `{{summary}}`, and `{{footer}}` are filled automatically from the live transaction data.

## Common Patterns

### Timestamps
All models use `{ timestamps: true }` for automatic `createdAt` / `updatedAt`.

### JSON Transformation
All models use `mongooseDocumentTransform` for consistent JSON serialization (converts `_id` to `id`, removes `__v`).

### Optimistic Concurrency
Transaction, Item, Shop, and User models use `optimisticConcurrency: true` for safe concurrent edits.

### Minimize: false
All models use `minimize: false` to preserve empty objects and default values in the database.
