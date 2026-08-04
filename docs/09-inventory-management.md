# Inventory Management

## Overview

Sharda Masale provides inventory tracking for products (not services). The system tracks stock quantities, reservations, movements, and reorder levels.

## Stock Fields

Every `Item` of type `product` has an embedded `stock` object:

```typescript
interface ItemStock {
  openingQuantity: number;      // Initial stock at item creation
  currentQuantity: number;      // Current available stock
  reservedQuantity: number;     // Quantity reserved for draft sales
  reorderLevel: number;         // Threshold for low-stock alerts
  reorderQuantity: number;      // Recommended reorder amount
  allowNegativeStock: boolean;  // Allow negative inventory (default: false)
  location?: string | null;     // Warehouse/shelf location
}
```

### Virtual: Available Quantity

```typescript
itemSchema.virtual("availableQuantity").get(function() {
  return this.stock.currentQuantity - this.stock.reservedQuantity;
});
```

This represents the actual sellable stock at any given moment.

## Stock Movements

All inventory changes are recorded as `StockMovement` documents for audit trail:

```typescript
// models/StockMovement.ts
interface IStockMovement {
  owner: ObjectId;
  item: ObjectId;
  type: 'IN' | 'OUT';
  quantity: number;
  referenceType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'OPENING';
  referenceId: ObjectId;           // Related document ID
  previousQuantity: number;
  newQuantity: number;
  notes?: string;
  createdBy: ObjectId;
  metadata: Record<string, unknown>;
}
```

## When Stock Changes

| Event | Movement Type | Quantity Change |
|-------|--------------|-----------------|
| Sale confirmed | OUT | Decrease `currentQuantity` |
| Purchase confirmed | IN | Increase `currentQuantity` |
| Sale-return confirmed | IN | Increase `currentQuantity` |
| Purchase-return confirmed | OUT | Decrease `currentQuantity` |
| Manual adjustment | IN or OUT | Adjust `currentQuantity` |
| Opening balance (new item) | OPENING | Set `currentQuantity` from `openingQuantity` |

## Reservation System

Draft sales reserve inventory to prevent overselling:

### Reserve on Draft

When a sale is created as `draft`, the system reserves stock:

```typescript
// lib/transaction-inventory.ts
async function reserveDraftSaleInventory(
  context: { ownerId: string; userId: string; shopId: string | null },
  lineItems: TransactionLineItem[],
  session: ClientSession
)
```

- Each line item with an `item` reference and inventory tracking gets its quantity added to `reservedQuantity`
- `availableQuantity` decreases even though stock hasn't left physically

### Release on Confirm

When a draft sale is confirmed:
1. Reserved quantities are released
2. Actual stock decreases via `StockMovement OUT`
3. `currentQuantity` is reduced

### Release on Cancel

When a draft sale is cancelled:
- Reserved quantities are released (no stock movement since it was only reserved)

## Stock Adjustment

The `POST /api/stock-movements/adjust` endpoint allows manual stock corrections:

```json
{
  "itemId": "item_id",
  "newQuantity": 150,
  "reason": "Physical count correction",
  "notes": "Found 50 extra units in warehouse"
}
```

The handler:
1. Calculates the difference (`newQuantity - currentQuantity`)
2. Creates a `StockMovement` record
3. Updates the item's `currentQuantity`

## Reorder Management

Items track `reorderLevel` and `reorderQuantity`. When `currentQuantity` falls below `reorderLevel`, the system can trigger restock recommendations (via the stock-check background worker).

## Negative Stock Guard

By default, `allowNegativeStock` is `false`. When enabled:
- Stock can go below zero (useful for accept-then-fulfill workflows)
- When disabled, the system throws an error if a sale would exceed available stock

The validation happens in:
1. Transaction `pre('save')` hook — checks available stock before confirming OUT movements
2. API routes — explicit stock validation during transaction creation

## Inventory Reports

The stock report (`modules/reports/stock-report.tsx`) provides:
- Current stock levels for all products
- Items below reorder level
- Stock value (cost × quantity)
- Movement history for a date range
- Export to XLSX format

## Opening Stock on Item Creation

When a new `product` item is created with `openingQuantity > 0`:
1. The item's `currentQuantity` is set to `openingQuantity`
2. A `StockMovement` of type `OPENING` is auto-created in the `post('save')` hook
3. This establishes the audit trail from the very beginning