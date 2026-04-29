import mongoose, { type Model, Schema, Types } from "mongoose";
import { mongooseDocumentTransform } from "@/lib/utils";

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT", "ADJUST", "RETURN_IN", "RETURN_OUT"] as const;
export const STOCK_MOVEMENT_REFERENCE_TYPES = ["PURCHASE", "SALE", "STOCK_TAKE", "MANUAL", "OPENING"] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export type StockMovementReferenceType = (typeof STOCK_MOVEMENT_REFERENCE_TYPES)[number];

export interface IStockMovement {
  owner: Types.ObjectId;
  item: Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  referenceType: StockMovementReferenceType;
  referenceId?: Types.ObjectId;
  reason?: string | null;
  previousQuantity: number;
  newQuantity: number;
  createdBy: Types.ObjectId;
  metadata: Map<string, unknown>;
}

type StockMovementModel = Model<IStockMovement>;

// Helper to block any update operation (ensures true immutability)
const blockUpdate = function (next: (err?: Error) => void) {
  next(new Error("Stock movements cannot be modified after creation"));
};

const stockMovementSchema = new Schema<IStockMovement, StockMovementModel>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: STOCK_MOVEMENT_TYPES,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (this: any, v: number) {
          if (this.type === "OUT" || this.type === "RETURN_OUT") {
            return v > 0;
          }
          return v >= 0;
        },
        message: "Quantity must be > 0 for OUT/RETURN_OUT movements",
      },
    },
    referenceType: {
      type: String,
      enum: STOCK_MOVEMENT_REFERENCE_TYPES,
      required: true,
      index: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      ref: function (this: IStockMovement) {
        const modelMap: Record<StockMovementReferenceType, string> = {
          PURCHASE: "Transaction",
          SALE: "Transaction",
          STOCK_TAKE: "StockTake",
          MANUAL: "Manual",
          OPENING: "Opening",
        };
        return modelMap[this.referenceType];
      } as any,
      default: null,
    },
    reason: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
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

// Indexes for common query patterns
stockMovementSchema.index({ owner: 1, item: 1, createdAt: -1 });
stockMovementSchema.index({ owner: 1, referenceType: 1, referenceId: 1 });

// ========== IMMUTABILITY ENFORCEMENT ==========
// 1. Block document updates via .save()
stockMovementSchema.pre("save" as any, function (this: any, next: (err?: Error) => void) {
  if (!this.isNew) {
    return next(new Error("Stock movements cannot be modified after creation"));
  }
  next();
});

// 2. Block all update operations (direct queries)
stockMovementSchema.pre("updateOne" as any, blockUpdate);
stockMovementSchema.pre("updateMany" as any, blockUpdate);
stockMovementSchema.pre("findOneAndUpdate" as any, blockUpdate);
stockMovementSchema.pre("replaceOne" as any, blockUpdate);
// ==============================================

// ========== ITEM STOCK SYNCHRONIZATION ==========
stockMovementSchema.post("save" as any, async function (doc: any) {
  // Update item current stock when new movement is created
  await mongoose.model("Item").findByIdAndUpdate(doc.item, {
    $inc: {
      "stock.currentQuantity": doc.type === "IN" || doc.type === "RETURN_IN" ? doc.quantity : -doc.quantity
    }
  });
});

// Model initialisation (Next.js hot‑reloading safe)
const StockMovement =
  (mongoose.models.StockMovement as StockMovementModel | undefined) ??
  mongoose.model<IStockMovement, StockMovementModel>("StockMovement", stockMovementSchema);

export default StockMovement;
