# Transactions & Billing

## Overview

The transaction system is the core of Sharda Masale, handling all financial operations including sales, purchases, payments, and adjustments. The billing module generates invoices, PDFs, and manages settlement allocations.

## Transaction Types

There are **8 transaction types**, each with distinct behavior for inventory and financial accounting:

| Type | Direction | Inventory Impact | Balance Impact |
|------|-----------|-----------------|----------------|
| `sale` | OUT (customer pays) | Decrease stock | Customer balance increases (debit) |
| `purchase` | IN (supplier paid) | Increase stock | Supplier balance increases (credit) |
| `sale-return` | IN | Increase stock | Customer balance decreases |
| `purchase-return` | OUT | Decrease stock | Supplier balance decreases |
| `payment-in` | — | No change | Customer balance decreases (payment received) |
| `payment-out` | — | No change | Supplier balance decreases (payment made) |
| `adjustment` | IN/OUT | Manual adjust | No party balance change |
| `opening-balance` | — | No change | Set initial party balance |

## Transaction Lifecycle

```
DRAFT ──→ CONFIRMED ──→ CANCELLED
  │           │
  │           └── Inventory movements recorded
  │           └── Party balance updated
  │           └── Invoice can be generated
  │
  └── Editable (line items, pricing)
```

- **Draft**: Editable, no inventory or balance impact. Used for work-in-progress transactions.
- **Confirmed**: Immutable. Inventory is adjusted, party balances update, invoice can be created.
- **Cancelled**: Reverses inventory (if confirmed). Blocked from further edits.

## Line Items

Each transaction contains an array of `lineItems`:

```typescript
interface TransactionLineItem {
  item?: ObjectId | null;        // Reference to Item (if tracked)
  itemName: string;               // Denormalized name
  sku?: string | null;            // Denormalized SKU
  description?: string | null;
  unit: string;                   // pcs, kg, etc.
  quantity: number;
  unitPrice: number;
  discountAmount: number;         // Per-line discount
  taxRate: number;                // Tax percentage
  taxAmount: number;              // Computed tax
  lineTotal: number;              // Computed total (qty * price - discount + tax)
  costPrice?: number | null;      // For profit calculation
}
```

## Transaction Summary (Auto-Computed)

The summary is computed automatically during `pre('validate')`:

```typescript
interface TransactionSummary {
  subtotal: number;               // Sum of (qty * unitPrice)
  discountTotal: number;          // Sum of line discounts
  taxTotal: number;               // Sum of line taxes
  totalDiscountType: 'percentage' | 'fixed' | null;
  totalDiscountValue: number | null;
  totalDiscount: number;          // Computed overall discount
  roundOff: number;               // Rounding adjustment
  grandTotal: number;             // Final total
  paidAmount: number;             // Amount paid
  dueAmount: number;              // Remaining due
}
```

### Calculation Order
1. Line-level: `taxAmount = (qty * unitPrice - discount) * (taxRate / 100)`
2. Line-level: `lineTotal = qty * unitPrice - discount + taxAmount`
3. Summary: `subtotal = sum(qty * unitPrice)`
4. Summary: `totalDiscount` (either % of subtotal or fixed amount)
5. Summary: `grandTotal = subtotal - discountTotal - totalDiscount + taxTotal + roundOff + additionalCharges`
6. Summary: `dueAmount = max(grandTotal - paidAmount, 0)`
7. `paymentStatus` derived automatically from grandTotal vs paidAmount

## Payment Status Derivation

```typescript
function derivePaymentStatus({ status, grandTotal, paidAmount }):
  - cancelled → 'void'
  - grandTotal === 0 && paidAmount > 0 → 'paid'
  - grandTotal === 0 → 'not-applicable'
  - paidAmount <= 0 → 'unpaid'
  - paidAmount < grandTotal → 'partial'
  - else → 'paid'
```

## Immutability Enforcement

Once a transaction is confirmed or cancelled:
- **Line items cannot be modified**
- **Protected fields cannot change**: `type`, `transactionDate`, `party`, `status`
- Validation runs in `pre('save')` hook comparing against the original document

## Invoice Generation

Invoices are created from confirmed `sale` transactions:

```typescript
// POST /api/invoices
{
  "transactionId": "txn_id",
  "dueDate": "2025-02-15",
  "termsAndConditions": "..."
}
```

**Validation:**
1. Transaction must exist and belong to the user's shop
2. Must be a `sale` type transaction
3. Must be `confirmed` status
4. Must not already have an invoice

**Invoice Number Generation:**
- Uses the shop's `invoicePrefix` (e.g., "INV")
- Appends a sequential number
- Format: `{PREFIX}-{SEQUENCE}` (e.g., "INV-0001")

## Invoice Lifecycle

```
DRAFT ──→ SENT ──→ PAID
  │         │
  │         └── OVERDUE (if due date passed)
  │
  └── CANCELLED
```

- **draft**: Initial state, editable
- **sent**: Customer has been notified
- **paid**: Payment received (linked to payment-in transactions)
- **overdue**: Past due date without payment
- **cancelled**: Void invoice

## Payment Settlements

The `lib/payment-settlement.ts` module handles allocation of payments across multiple invoices:

```typescript
function allocateInvoiceSettlements(
  targets: SettlementTarget[],    // Invoices with due amounts
  cashAmount: number,            // Payment cash amount
  discountAmount: number         // Payment discount amount
): InvoiceSettlementResult
```

### Settlement Algorithm
1. For each invoice (ordered), apply cash amount first
2. If invoice is fully covered by cash, remaining cash moves to next invoice
3. If invoice has remaining due after cash, apply discount amount
4. Returns allocation breakdown per invoice

### Settlement Result
```typescript
interface InvoiceSettlementResult {
  allocations: InvoiceSettlementAllocation[];
  totalAppliedAmount: number;
  totalDiscountAmount: number;
  totalSettledAmount: number;
  remainingCashAmount: number;
  remainingDiscountAmount: number;
}
```

## Party Balance Tracking

Party balances are updated automatically when transactions are created/modified:

- **Sales**: Increase party's `currentBalance` (customer owes more)
- **Payments received**: Decrease party's `currentBalance` (customer paid)
- **Purchases**: Increase party's `currentBalance` (you owe supplier more)
- **Payments made**: Decrease party's `currentBalance` (you paid supplier)

### Credit Limit Enforcement

When creating a transaction, the system checks:
```typescript
const projectedBalance = party.currentBalance + delta; // where delta depends on transaction type
if (projectedBalance > party.creditLimit) {
  throw new AppError('Credit limit exceeded', 400);
}
```

## Transaction Form Component

The `components/transaction-form.tsx` is a shared form used by all transaction creation dialogs. It handles:
- Line item management (add/remove items, update quantities/prices)
- Party selection
- Transaction-level discounts (percentage or fixed)
- Round-off adjustments
- Payment entry (amount, method, reference)
- Validation via Zod schema

## Create Dialogs

Each transaction type has a dedicated dialog component:
- `create-sale-dialog.tsx`
- `create-purchase-dialog.tsx`
- `create-sale-return-dialog.tsx`
- `create-purchase-return-dialog.tsx`
- `create-payment-in-dialog.tsx`
- `create-payment-out-dialog.tsx`
- `stock-adjustment-dialog.tsx`

All use the shared `TransactionForm` component under the hood.

## PDF Generation

The billing module (`modules/billing/invoice-pdf.tsx`) uses `@react-pdf/renderer` to generate professional invoice PDFs with:
- Shop logo and details
- Customer/billing address
- Line items table
- Tax breakdown
- Payment terms
- QR code for digital payments (optional)

## Share Messages

Sharda Masale also generates configurable share messages for WhatsApp, Telegram, and the invoice share sheet.

### Template Source

- Templates are stored in `Settings.billing.shareMessageTemplates`
- The Billing settings screen lets each shop customize message text per transaction kind
- `lib/share-messages.ts` renders the final message using named placeholders and live transaction data

### Supported Transaction Templates

- `invoice`
- `sale`
- `purchase`
- `sale-return`
- `purchase-return`
- `payment-in`
- `payment-out`
- `adjustment`
- `opening-balance`

### Available Placeholders

Common tokens include:

- `{{business_name}}`
- `{{document_title}}`
- `{{reference_no}}`
- `{{secondary_reference_no}}`
- `{{document_date}}`
- `{{due_date}}`
- `{{party_name}}`
- `{{line_items}}`
- `{{summary}}`
- `{{payment_details}}`
- `{{notes}}`
- `{{footer}}`

The renderer removes blank sections automatically, so templates can be as short or as detailed as needed without leaving awkward gaps.
