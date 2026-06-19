import mongoose, { type Model, Schema, Types } from "mongoose";

import {
  mongooseDocumentTransform,
  roundCurrency,
  slugify,
} from "@/lib/utils";
import StockMovement from "./StockMovement";

export const ITEM_TYPES = ["product", "service", "compound"] as const;
export const BUNDLE_TYPES = ["product", "service"] as const;
export const ITEM_STATUSES = ["active", "discontinued"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type BundleType = (typeof BUNDLE_TYPES)[number];
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

export interface ItemComponent {
  item: Types.ObjectId;
  quantity: number;
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
  bundleType?: BundleType | null;
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
  components: ItemComponent[];
  priceCalculation: "auto-sum";
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

const componentSchema = new Schema<ItemComponent>(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
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
    bundleType: {
      type: String,
      enum: BUNDLE_TYPES,
      default: null,
      sparse: true,
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
    components: {
      type: [componentSchema],
      default: [],
    },
    priceCalculation: {
      type: String,
      enum: ["auto-sum"],
      default: "auto-sum",
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

itemSchema.pre("validate", async function preValidate() {
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

  // Clear bundleType for non-compound items
  if (this.itemType !== "compound") {
    this.bundleType = null;
  }

  if (this.itemType === "service") {
    this.trackInventory = false;
    this.stock.currentQuantity = 0;
    this.stock.openingQuantity = 0;
    this.stock.reservedQuantity = 0;
  }

  // Compound item defaults
  if (this.itemType === "compound") {
    // Default bundleType to "service" if not set
    if (!this.bundleType) {
      this.bundleType = "service";
    }

    if (this.bundleType === "service") {
      // Service bundles: no inventory tracking
      this.trackInventory = false;
      this.stock.currentQuantity = 0;
      this.stock.openingQuantity = 0;
      this.stock.reservedQuantity = 0;
    } else {
      // Product bundles: allow inventory tracking like regular products
      if (this.isNew && this.stock.currentQuantity === 0) {
        this.stock.currentQuantity = this.stock.openingQuantity;
      }
    }

    this.priceCalculation = "auto-sum";

    // Validate components: no nesting, at least 1 component
    if (!this.components || this.components.length === 0) {
      throw new Error("Compound items must have at least one component");
    }

    // Fetch all component items to validate and auto-calculate pricing
    const componentIds = this.components.map((c) => c.item);
    const componentItems = await mongoose.model("Item").find({
      _id: { $in: componentIds },
      owner: this.owner,
    });

    if (componentItems.length !== componentIds.length) {
      throw new Error("One or more component items not found");
    }

    // Validate no nesting
    const hasNestedCompound = componentItems.some(
      (ci: any) => ci.itemType === "compound",
    );
    if (hasNestedCompound) {
      throw new Error("Compound items cannot contain other compound items");
    }

    // Auto-calculate pricing from components
    let totalCostPrice = 0;
    let totalSellingPrice = 0;
    let totalPurchasePrice = 0;

    for (const comp of this.components) {
      const componentItem = componentItems.find(
        (ci: any) => ci._id.toString() === comp.item.toString(),
      );
      if (!componentItem) continue;

      // Skip discontinued items from pricing calculation
      if ((componentItem as any).status === 'discontinued') continue;

      totalCostPrice += (componentItem.pricing.costPrice || 0) * comp.quantity;
      totalSellingPrice += (componentItem.pricing.sellingPrice || 0) * comp.quantity;
      totalPurchasePrice += (componentItem.pricing.purchasePrice || 0) * comp.quantity;
    }

    this.pricing.costPrice = roundCurrency(totalCostPrice);
    this.pricing.sellingPrice = roundCurrency(totalSellingPrice);
    this.pricing.purchasePrice = roundCurrency(totalPurchasePrice);
    this.pricing.mrp = null;
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
  const shouldCreateOpeningStock =
    doc.isNew &&
    doc.stock.openingQuantity > 0 &&
    (doc.itemType === "product" ||
      (doc.itemType === "compound" && doc.bundleType === "product"));

  if (shouldCreateOpeningStock) {
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
      metadata: {},
    });
  }
});

// ========== AUTO-RECALCULATE COMPOUND PRICING ==========
// When any item is updated (e.g., component status changed to discontinued),
// automatically recalculate pricing of all compound items that reference it
itemSchema.post("save" as any, async function (doc: any) {
  try {
    // Skip if this is a compound item (already handled in pre-validate)
    if (doc.itemType === "compound") return;

    // Find all compound items that reference this item as a component
    const compoundItems = await mongoose
      .model("Item")
      .find({ "components.item": doc._id, itemType: "compound" })
      .select("components owner pricing");

    for (const compoundItem of compoundItems) {
      if (!compoundItem.components || compoundItem.components.length === 0) continue;

      // Fetch all component items to recalculate pricing
      const componentIds = compoundItem.components.map(
        (c: any) => c.item
      );
      const componentItems = await mongoose
        .model("Item")
        .find({ _id: { $in: componentIds } });

      let totalCostPrice = 0;
      let totalSellingPrice = 0;
      let totalPurchasePrice = 0;

      for (const comp of compoundItem.components) {
        const componentItem = componentItems.find(
          (ci: any) => ci._id.toString() === comp.item.toString()
        );
        if (!componentItem) continue;

        // Skip discontinued items from pricing calculation
        if ((componentItem as any).status === "discontinued") continue;

        totalCostPrice +=
          (componentItem.pricing?.costPrice || 0) * comp.quantity;
        totalSellingPrice +=
          (componentItem.pricing?.sellingPrice || 0) * comp.quantity;
        totalPurchasePrice +=
          (componentItem.pricing?.purchasePrice || 0) * comp.quantity;
      }

      // Update the compound item's pricing directly without triggering another save
      await mongoose.model("Item").updateOne(
        { _id: compoundItem._id },
        {
          $set: {
            "pricing.costPrice": roundCurrency(totalCostPrice),
            "pricing.sellingPrice": roundCurrency(totalSellingPrice),
            "pricing.purchasePrice": roundCurrency(totalPurchasePrice),
          },
        }
      );
    }
  } catch (error) {
    console.error("Error recalculating compound pricing:", error);
  }
});

// ========== AUTO-RECALCULATE COMPOUND PRICING (findOneAndUpdate) ==========
// The API uses findByIdAndUpdate which bypasses post("save") hooks.
// This hook runs after findOneAndUpdate/updateOne operations.
itemSchema.post("findOneAndUpdate" as any, async function (doc: any) {
  try {
    if (!doc) return;
    // doc is the updated document
    // Skip compound items (already handled in pre-validate when saved)
    if (doc.itemType === "compound") return;

    // Find all compound items that reference this item as a component
    const compoundItems = await mongoose
      .model("Item")
      .find({ "components.item": doc._id, itemType: "compound" })
      .select("components owner pricing");

    for (const compoundItem of compoundItems) {
      if (!compoundItem.components || compoundItem.components.length === 0) continue;

      // Fetch all component items to recalculate pricing
      const componentIds = compoundItem.components.map(
        (c: any) => c.item
      );
      const componentItems = await mongoose
        .model("Item")
        .find({ _id: { $in: componentIds } });

      let totalCostPrice = 0;
      let totalSellingPrice = 0;
      let totalPurchasePrice = 0;

      for (const comp of compoundItem.components) {
        const componentItem = componentItems.find(
          (ci: any) => ci._id.toString() === comp.item.toString()
        );
        if (!componentItem) continue;

        // Skip discontinued items from pricing calculation
        if ((componentItem as any).status === "discontinued") continue;

        totalCostPrice +=
          (componentItem.pricing?.costPrice || 0) * comp.quantity;
        totalSellingPrice +=
          (componentItem.pricing?.sellingPrice || 0) * comp.quantity;
        totalPurchasePrice +=
          (componentItem.pricing?.purchasePrice || 0) * comp.quantity;
      }

      // Update the compound item's pricing directly
      await mongoose.model("Item").updateOne(
        { _id: compoundItem._id },
        {
          $set: {
            "pricing.costPrice": roundCurrency(totalCostPrice),
            "pricing.sellingPrice": roundCurrency(totalSellingPrice),
            "pricing.purchasePrice": roundCurrency(totalPurchasePrice),
          },
        }
      );
    }
  } catch (error) {
    console.error("Error recalculating compound pricing (findOneAndUpdate):", error);
  }
});

const Item =
  (mongoose.models.Item as ItemModel | undefined) ??
  mongoose.model<IItem, ItemModel>("Item", itemSchema);

export default Item;