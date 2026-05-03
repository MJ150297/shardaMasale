import type { ClientSession } from "mongoose";

import { AppError, roundCurrency } from "@/lib/utils";
import Item from "@/models/Item";
import StockMovement from "@/models/StockMovement";

type TransactionInventoryType =
  | "sale"
  | "purchase"
  | "sale-return"
  | "purchase-return"
  | "payment-in"
  | "payment-out"
  | "adjustment"
  | "opening-balance";

type TransactionLineItemInput = {
  item?: string | { toString(): string } | null;
  itemName: string;
  quantity: number;
  unitPrice?: number;
};

type InventoryActor = {
  ownerId: string;
  userId: string;
  shopId?: string | null;
};

type InventoryContext = InventoryActor & {
  session: ClientSession;
  transactionId: string;
  transactionNumber: string;
};

type AggregatedLineItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice?: number;
};

const CONFIRMED_MOVEMENT_CONFIG = {
  sale: {
    quantityDelta: -1,
    movementType: "OUT",
    referenceType: "SALE",
  },
  purchase: {
    quantityDelta: 1,
    movementType: "IN",
    referenceType: "PURCHASE",
  },
  "sale-return": {
    quantityDelta: 1,
    movementType: "RETURN_IN",
    referenceType: "SALE",
  },
  "purchase-return": {
    quantityDelta: -1,
    movementType: "RETURN_OUT",
    referenceType: "PURCHASE",
  },
} as const;

const CANCELLATION_MOVEMENT_CONFIG = {
  sale: {
    quantityDelta: 1,
    movementType: "RETURN_IN",
    referenceType: "SALE",
  },
  purchase: {
    quantityDelta: -1,
    movementType: "RETURN_OUT",
    referenceType: "PURCHASE",
  },
  "sale-return": {
    quantityDelta: -1,
    movementType: "RETURN_OUT",
    referenceType: "SALE",
  },
  "purchase-return": {
    quantityDelta: 1,
    movementType: "RETURN_IN",
    referenceType: "PURCHASE",
  },
} as const;

function aggregateLineItems(
  lineItems: TransactionLineItemInput[],
): AggregatedLineItem[] {
  const aggregated = new Map<string, AggregatedLineItem>();

  for (const lineItem of lineItems) {
    if (!lineItem.item || lineItem.quantity <= 0) continue;

    const itemId = lineItem.item.toString();
    const existing = aggregated.get(itemId);

    if (existing) {
      existing.quantity = roundCurrency(existing.quantity + lineItem.quantity);
      if (lineItem.unitPrice != null) {
        existing.unitPrice = lineItem.unitPrice;
      }
      continue;
    }

    aggregated.set(itemId, {
      itemId,
      itemName: lineItem.itemName,
      quantity: roundCurrency(lineItem.quantity),
      unitPrice: lineItem.unitPrice,
    });
  }

  return Array.from(aggregated.values());
}

function hasInventoryEffect(type: TransactionInventoryType) {
  return type in CONFIRMED_MOVEMENT_CONFIG;
}

async function adjustReservedQuantity(
  actor: InventoryActor,
  lineItems: TransactionLineItemInput[],
  session: ClientSession,
  multiplier: 1 | -1,
) {
  for (const lineItem of aggregateLineItems(lineItems)) {
    const item = await Item.findById(lineItem.itemId).session(session);

    if (!item) {
      throw new AppError(`Item not found: ${lineItem.itemName}`, 404);
    }

    if (item.itemType !== "product" || !item.trackInventory) {
      continue;
    }

    const quantityDelta = roundCurrency(lineItem.quantity * multiplier);
    const reservedQuantity = roundCurrency(item.stock.reservedQuantity || 0);
    const nextReservedQuantity = roundCurrency(reservedQuantity + quantityDelta);

    if (nextReservedQuantity < 0) {
      throw new AppError(
        `Reserved stock cannot go below zero for ${item.name}`,
        400,
      );
    }

    if (quantityDelta > 0 && !item.stock.allowNegativeStock) {
      const availableStock = roundCurrency(
        item.stock.currentQuantity - reservedQuantity,
      );

      if (availableStock < quantityDelta) {
        throw new AppError(
          `Insufficient available stock for ${item.name}. Available: ${availableStock}, Required: ${lineItem.quantity}`,
          400,
        );
      }
    }

    const updatedItem = await Item.findOneAndUpdate(
      {
        _id: item._id,
        __v: item.__v,
        owner: actor.ownerId,
      },
      {
        $inc: {
          "stock.reservedQuantity": quantityDelta,
          __v: 1,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );

    if (!updatedItem) {
      throw new AppError(
        `Item ${item.name} was modified by another operation. Please try again.`,
        409,
      );
    }
  }
}

async function applyInventoryChange(
  configMap:
    | typeof CONFIRMED_MOVEMENT_CONFIG
    | typeof CANCELLATION_MOVEMENT_CONFIG,
  context: InventoryContext,
  type: TransactionInventoryType,
  lineItems: TransactionLineItemInput[],
  metadata: Record<string, unknown>,
) {
  if (!hasInventoryEffect(type)) {
    return;
  }

  const config = configMap[type as keyof typeof configMap];

  for (const lineItem of aggregateLineItems(lineItems)) {
    const item = await Item.findById(lineItem.itemId).session(context.session);

    if (!item) {
      throw new AppError(`Item not found: ${lineItem.itemName}`, 404);
    }

    if (item.itemType !== "product" || !item.trackInventory) {
      continue;
    }

    const quantityChange = roundCurrency(lineItem.quantity * config.quantityDelta);
    const availableStock = roundCurrency(
      item.stock.currentQuantity - item.stock.reservedQuantity,
    );

    if (quantityChange < 0 && !item.stock.allowNegativeStock) {
      const requiredQuantity = Math.abs(quantityChange);

      if (availableStock < requiredQuantity) {
        throw new AppError(
          `Insufficient available stock for ${item.name}. Available: ${availableStock}, Required: ${requiredQuantity}`,
          400,
        );
      }
    }

    const newQuantity = roundCurrency(item.stock.currentQuantity + quantityChange);

    const updatedItem = await Item.findOneAndUpdate(
      {
        _id: item._id,
        __v: item.__v,
        owner: context.ownerId,
      },
      {
        $inc: {
          "stock.currentQuantity": quantityChange,
          __v: 1,
        },
      },
      {
        new: true,
        session: context.session,
        runValidators: true,
      },
    );

    if (!updatedItem) {
      throw new AppError(
        `Item ${item.name} was modified by another operation. Please try again.`,
        409,
      );
    }

    await StockMovement.create(
      [
        {
          owner: context.ownerId,
          shopId: context.shopId ?? null,
          item: item._id,
          type: config.movementType,
          quantity: lineItem.quantity,
          referenceType: config.referenceType,
          referenceId: context.transactionId,
          previousQuantity: item.stock.currentQuantity,
          newQuantity,
          createdBy: context.userId,
          metadata: {
            itemName: lineItem.itemName,
            transactionNumber: context.transactionNumber,
            unitPrice: lineItem.unitPrice ?? null,
            ...metadata,
          },
        },
      ],
      { session: context.session },
    );
  }
}

export async function reserveDraftSaleInventory(
  actor: InventoryActor,
  lineItems: TransactionLineItemInput[],
  session: ClientSession,
) {
  await adjustReservedQuantity(actor, lineItems, session, 1);
}

export async function releaseDraftSaleInventory(
  actor: InventoryActor,
  lineItems: TransactionLineItemInput[],
  session: ClientSession,
) {
  await adjustReservedQuantity(actor, lineItems, session, -1);
}

export async function applyConfirmedTransactionInventory(
  context: InventoryContext,
  type: TransactionInventoryType,
  lineItems: TransactionLineItemInput[],
) {
  await applyInventoryChange(
    CONFIRMED_MOVEMENT_CONFIG,
    context,
    type,
    lineItems,
    {
      changeReason: "transaction-confirmed",
      transactionType: type,
    },
  );
}

export async function reverseConfirmedTransactionInventory(
  context: InventoryContext,
  type: TransactionInventoryType,
  lineItems: TransactionLineItemInput[],
) {
  await applyInventoryChange(
    CANCELLATION_MOVEMENT_CONFIG,
    context,
    type,
    lineItems,
    {
      changeReason: "transaction-cancelled",
      transactionType: type,
    },
  );
}
