import mongoose, { type HydratedDocument, type Model, Schema } from "mongoose";

import { mongooseDocumentTransform } from "@/lib/utils";

export interface IShopAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IShopSettings {
  invoicePrefix: string;
  purchasePrefix: string;
  paymentPrefix: string;
  quotationPrefix: string;
}

export interface IShop {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: IShopAddress | null;
  currency: string;
  timezone: string;
  isActive: boolean;
  settings: IShopSettings;
  metadata: Record<string, unknown>;
}

export interface ShopMethods {}

export type ShopDocument = HydratedDocument<IShop, ShopMethods>;
type ShopModel = Model<IShop, object, ShopMethods>;

const shopAddressSchema = new Schema<IShopAddress>({
  line1: {
    type: String,
    required: true,
    trim: true,
  },
  line2: {
    type: String,
    default: null,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
  postalCode: {
    type: String,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const shopSettingsSchema = new Schema<IShopSettings>({
  invoicePrefix: {
    type: String,
    default: "INV",
    trim: true,
    uppercase: true,
  },
  purchasePrefix: {
    type: String,
    default: "PUR",
    trim: true,
    uppercase: true,
  },
  paymentPrefix: {
    type: String,
    default: "PAY",
    trim: true,
    uppercase: true,
  },
  quotationPrefix: {
    type: String,
    default: "QTN",
    trim: true,
    uppercase: true,
  },
}, { _id: false });

const shopSchema = new Schema<IShop, ShopModel, ShopMethods>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    displayName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 160,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    address: {
      type: shopAddressSchema,
      default: null,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    settings: {
      type: shopSettingsSchema,
      default: () => ({}),
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

shopSchema.index({ ownerId: 1, name: 1 }, { unique: true });

const Shop =
  (mongoose.models.Shop as ShopModel | undefined) ??
  mongoose.model<IShop, ShopModel>("Shop", shopSchema);

export default Shop;