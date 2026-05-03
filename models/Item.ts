import mongoose, { type Model, Schema, Types } from "mongoose";

import {
  mongooseDocumentTransform,
  roundCurrency,
  slugify,
} from "@/lib/utils";
import StockMovement from "./StockMovement";

export const ITEM_TYPES = ["product", "service"] as const;
export const ITEM_STATUSES = ["draft", "active", "discontinued", "archived"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface ItemPricing {
  costPrice: number;
  purchasePrice: number;
  sellingPrice: number;
  mrp?: number | null;
}

export interface ItemStock {
  openingQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  allowNegativeStock: boolean;
  location?: string | null;
}

export interface IItem {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  batchNumber?: string | null;
  expiryDate?: Date | null;
  itemType: ItemType;
  status: ItemStatus;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  unitOfMeasure: string;
  hsnCode?: string | null;
  sacCode?: string | null;
  purchaseTaxRate?: number;
  saleTaxRate?: number;
  taxRate?: number;
  pricing: ItemPricing;
  stock: ItemStock;
  trackInventory: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
}

type ItemModel = Model<IItem>;

const pricingSchema = new Schema<ItemPricing>(
  {
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    mrp: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false },
);

const stockSchema = new Schema<ItemStock>(
  {
    openingQuantity: {
      type: Number,
      default: 0,
    },
    currentQuantity: {
      type: Number,
      default: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowNegativeStock: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
      default: null,
      trim: true,
      maxlength: 160,
    },
  },
  { _id: false },
);

const itemSchema = new Schema<IItem, ItemModel>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    sku: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    barcode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    itemType: {
      type: String,
      enum: ITEM_TYPES,
      default: "product",
      index: true,
    },
    status: {
      type: String,
      enum: ITEM_STATUSES,
      default: "active",
      index: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2_000,
    },
    category: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    brand: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    unitOfMeasure: {
      type: String,
      required: true,
      default: "pcs",
      trim: true,
      lowercase: true,
      maxlength: 20,
    },
    hsnCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    sacCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    taxRate: {
      type: Number,
      default: undefined,
      min: 0,
      max: 100,
    },
    purchaseTaxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    saleTaxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    pricing: {
      type: pricingSchema,
      default: () => ({
        costPrice: 0,
        purchasePrice: 0,
        sellingPrice: 0,
        mrp: null,
      }),
    },
    stock: {
      type: stockSchema,
      default: () => ({
        openingQuantity: 0,
        currentQuantity: 0,
        reservedQuantity: 0,
        reorderLevel: 0,
        reorderQuantity: 0,
        allowNegativeStock: false,
        location: null,
      }),
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    trackBatch: {
      type: Boolean,
      default: false,
    },
    trackExpiry: {
      type: Boolean,
      default: false,
    },
    batchNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
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

itemSchema.index({ owner: 1, slug: 1 }, { unique: true });
itemSchema.index({ owner: 1, status: 1, category: 1 });
itemSchema.index(
  { owner: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: "string" } },
  },
);
itemSchema.index(
  { owner: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string" } },
  },
);
itemSchema.index({
  name: "text",
  description: "text",
  category: "text",
  brand: "text",
  sku: "text",
  barcode: "text",
});

itemSchema.virtual("availableQuantity").get(function availableQuantity() {
  return roundCurrency(this.stock.currentQuantity - this.stock.reservedQuantity);
});

itemSchema.pre("validate", function preValidate() {
  if (!this.slug) {
    this.slug = slugify(this.name);
  } else {
    this.slug = slugify(this.slug);
  }

  if (this.sku != null) {
    this.sku = this.sku.trim().toUpperCase();
    if (this.sku === "") {
      this.sku = null;
    }
  }

  if (this.barcode != null) {
    this.barcode = this.barcode.trim();
    if (this.barcode === "") {
      this.barcode = null;
    }
  }

  // Auto copy opening quantity to current quantity when creating new item
  if (this.isNew && this.itemType === "product" && this.stock.currentQuantity === 0) {
    this.stock.currentQuantity = this.stock.openingQuantity;
  }

  if (this.itemType === "service") {
    this.trackInventory = false;
    this.stock.currentQuantity = 0;
    this.stock.openingQuantity = 0;
    this.stock.reservedQuantity = 0;
  }

  const legacyTaxRate = this.taxRate;
  const purchaseTaxRate =
    this.purchaseTaxRate ?? legacyTaxRate ?? this.saleTaxRate ?? 0;
  const saleTaxRate =
    this.saleTaxRate ?? legacyTaxRate ?? this.purchaseTaxRate ?? 0;

  this.purchaseTaxRate = roundCurrency(purchaseTaxRate);
  this.saleTaxRate = roundCurrency(saleTaxRate);
  this.taxRate = this.saleTaxRate;
  this.pricing.costPrice = roundCurrency(this.pricing.costPrice);
  this.pricing.purchasePrice = roundCurrency(this.pricing.purchasePrice);
  this.pricing.sellingPrice = roundCurrency(this.pricing.sellingPrice);
  this.pricing.mrp =
    this.pricing.mrp == null ? null : roundCurrency(this.pricing.mrp);
});

// ========== OPENING STOCK MOVEMENT ==========
itemSchema.post("save" as any, async function (doc: any) {
  // Create opening stock movement when item is created
  if (doc.isNew && doc.itemType === "product" && doc.stock.openingQuantity > 0) {
    const StockMovement = mongoose.model("StockMovement");
    
    await StockMovement.create({
      owner: doc.owner,
      item: doc._id,
      type: "IN",
      quantity: doc.stock.openingQuantity,
      referenceType: "OPENING",
      referenceId: doc._id,
      previousQuantity: 0,
      newQuantity: doc.stock.openingQuantity,
      createdBy: doc.owner,
      metadata: {}
    });
  }
});

const Item =
  (mongoose.models.Item as ItemModel | undefined) ??
  mongoose.model<IItem, ItemModel>("Item", itemSchema);

export default Item;
