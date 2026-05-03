import mongoose, { type Model, Schema, Types } from "mongoose";

import {
  calculateLineTotal,
  mongooseDocumentTransform,
  roundCurrency,
} from "@/lib/utils";
import "./Party";

export const TRANSACTION_TYPES = [
  "sale",
  "purchase",
  "sale-return",
  "purchase-return",
  "payment-in",
  "payment-out",
  "adjustment",
  "opening-balance",
] as const;

export const TRANSACTION_STATUSES = ["draft", "confirmed", "cancelled"] as const;
export const PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "void",
  "not-applicable",
] as const;
export const PAYMENT_METHODS = [
  "cash",
  "card",
  "upi",
  "bank-transfer",
  "cheque",
  "other",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface TransactionLineItem {
  item?: Types.ObjectId | null;
  itemName: string;
  sku?: string | null;
  description?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costPrice?: number | null;
}

export interface TransactionSummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
}

export interface TransactionPaymentDetails {
  method?: PaymentMethod | null;
  referenceNumber?: string | null;
  notes?: string | null;
  receivedAt?: Date | null;
}

export interface ITransaction {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  transactionNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentStatus: PaymentStatus;
  party?: Types.ObjectId | null;
  transactionDate: Date;
  dueDate?: Date | null;
  lineItems: TransactionLineItem[];
  summary: TransactionSummary;
  payment?: TransactionPaymentDetails | null;
  notes?: string | null;
  tags: string[];
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  metadata: Record<string, unknown>;
}

type TransactionModel = Model<ITransaction>;

const lineItemSchema = new Schema<TransactionLineItem>(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sku: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 20,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false },
);

const summarySchema = new Schema<TransactionSummary>(
  {
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const paymentDetailsSchema = new Schema<TransactionPaymentDetails>(
  {
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: null,
    },
    referenceNumber: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const transactionSchema = new Schema<ITransaction, TransactionModel>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
      index: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: "draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true,
    },
    party: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      default: null,
      index: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    lineItems: {
      type: [lineItemSchema],
      default: [],
    },
    summary: {
      type: summarySchema,
      default: () => ({
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        roundOff: 0,
        grandTotal: 0,
        paidAmount: 0,
        dueAmount: 0,
      }),
    },
    payment: {
      type: paymentDetailsSchema,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2_000,
    },
    tags: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
    toObject: {
      virtuals: true,
      transform: mongooseDocumentTransform,
    },
  },
);

transactionSchema.index({ owner: 1, transactionNumber: 1 }, { unique: true });
transactionSchema.index({ owner: 1, type: 1, status: 1, transactionDate: -1 });
transactionSchema.index({ owner: 1, party: 1, transactionDate: -1 });

function derivePaymentStatus({
  status,
  grandTotal,
  paidAmount,
}: {
  status: TransactionStatus;
  grandTotal: number;
  paidAmount: number;
}): PaymentStatus {
  if (status === "cancelled") {
    return "void";
  }

  if (grandTotal === 0) {
    return paidAmount > 0 ? "paid" : "not-applicable";
  }

  if (paidAmount <= 0) {
    return "unpaid";
  }

  if (paidAmount < grandTotal) {
    return "partial";
  }

  return "paid";
}

transactionSchema.pre("validate", function preValidate() {
  this.transactionNumber = this.transactionNumber.trim().toUpperCase();

  for (const lineItem of this.lineItems) {
    lineItem.itemName = lineItem.itemName.trim();
    lineItem.unit = lineItem.unit.trim().toLowerCase();
    lineItem.sku = lineItem.sku ? lineItem.sku.trim().toUpperCase() : null;
    lineItem.description = lineItem.description?.trim() || null;
    lineItem.quantity = roundCurrency(lineItem.quantity);
    lineItem.unitPrice = roundCurrency(lineItem.unitPrice);
    lineItem.discountAmount = roundCurrency(lineItem.discountAmount);
    lineItem.taxRate = roundCurrency(lineItem.taxRate);
    lineItem.costPrice =
      lineItem.costPrice === null || lineItem.costPrice === undefined
        ? null
        : roundCurrency(lineItem.costPrice);

    const taxableAmount = roundCurrency(
      lineItem.quantity * lineItem.unitPrice - lineItem.discountAmount,
    );

    lineItem.taxAmount = roundCurrency(
      taxableAmount * (lineItem.taxRate / 100),
    );
    lineItem.lineTotal = calculateLineTotal({
      quantity: lineItem.quantity,
      unitPrice: lineItem.unitPrice,
      discountAmount: lineItem.discountAmount,
      taxAmount: lineItem.taxAmount,
    });
  }

  const subtotal = roundCurrency(
    this.lineItems.reduce(
      (total, lineItem) => total + lineItem.quantity * lineItem.unitPrice,
      0,
    ),
  );
  const discountTotal = roundCurrency(
    this.lineItems.reduce((total, lineItem) => total + lineItem.discountAmount, 0),
  );
  const taxTotal = roundCurrency(
    this.lineItems.reduce((total, lineItem) => total + lineItem.taxAmount, 0),
  );
  const roundOff = roundCurrency(this.summary?.roundOff ?? 0);
  const computedGrandTotal = roundCurrency(
    subtotal - discountTotal + taxTotal + roundOff,
  );
  const existingGrandTotal = roundCurrency(this.summary?.grandTotal ?? 0);
  const grandTotal =
    this.lineItems.length > 0 ? computedGrandTotal : existingGrandTotal;
  const paidAmount = roundCurrency(this.summary?.paidAmount ?? 0);
  const dueAmount = Math.max(roundCurrency(grandTotal - paidAmount), 0);

  this.summary = {
    subtotal,
    discountTotal,
    taxTotal,
    roundOff,
    grandTotal,
    paidAmount,
    dueAmount,
  };

  this.paymentStatus = derivePaymentStatus({
    status: this.status,
    grandTotal,
    paidAmount,
  });
});

// ========== IMMUTABILITY ENFORCEMENT ==========
transactionSchema.pre("save" as any, async function (this: any) {
  if (!this.isNew) {
    const original = this.$original();
    if (original && original.status !== "draft") {
      // Block any modifications once transaction is no longer draft
      if (JSON.stringify(this.lineItems) !== JSON.stringify(original.lineItems)) {
        throw new Error("Cannot modify line items once transaction is confirmed or cancelled");
      }
      
      const protectedFields = ["type", "transactionDate", "party", "status"];
      for (const field of protectedFields) {
        if (this[field] !== original[field]) {
          throw new Error(`Cannot modify ${field} once transaction is confirmed or cancelled`);
        }
      }
    }
  }
  
  // Stock validation when confirming transaction
  if (this.status === "confirmed" && this.isModified("status")) {
    const movementTypeMap: Record<string, string> = {
      "sale": "OUT",
      "purchase-return": "RETURN_OUT"
    };
    
    if (movementTypeMap[this.type]) {
      // Only validate stock for OUT movements
      for (const lineItem of this.lineItems) {
        if (!lineItem.item) continue;
        
        const item: any = await mongoose.model("Item").findById(lineItem.item);
        if (item && item.trackInventory && !item.stock.allowNegativeStock) {
          const availableStock = item.stock.currentQuantity - item.stock.reservedQuantity;
          if (availableStock < lineItem.quantity) {
            throw new Error(`Insufficient stock for item ${lineItem.itemName}: ${availableStock} available, ${lineItem.quantity} required`);
          }
        }
      }
    }
  }
});

// Inventory mutations are handled in the route handlers so reservation, stock
// movement, and transaction updates all happen in one explicit DB transaction.

const Transaction =
  (mongoose.models.Transaction as TransactionModel | undefined) ??
  mongoose.model<ITransaction, TransactionModel>(
    "Transaction",
    transactionSchema,
  );

export default Transaction;
