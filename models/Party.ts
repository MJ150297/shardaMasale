import mongoose, { type Model, Schema, Types } from "mongoose";

import {
  mongooseDocumentTransform,
  normalizeEmail,
  normalizePhoneNumber,
} from "@/lib/utils";

export const PARTY_TYPES = ["customer", "supplier", "both"] as const;
export const PARTY_STATUSES = ["active", "inactive", "blocked"] as const;
export const TAX_TREATMENTS = [
  "registered",
  "unregistered",
  "consumer",
  "overseas",
] as const;

export type PartyType = (typeof PARTY_TYPES)[number];
export type PartyStatus = (typeof PARTY_STATUSES)[number];
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

export interface PartyAddress {
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PartyContactPerson {
  name: string;
  designation?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface IParty {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  displayName: string;
  legalName?: string | null;
  partyType: PartyType;
  status: PartyStatus;
  email?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxTreatment: TaxTreatment;
  billingAddress?: PartyAddress | null;
  shippingAddress?: PartyAddress | null;
  contactPerson?: PartyContactPerson | null;
  creditLimit: number;
  openingBalance: number;
  currentBalance: number;
  tags: string[];
  notes?: string | null;
  isArchived: boolean;
  metadata: Record<string, unknown>;
}

type PartyModel = Model<IParty>;

const addressSchema = new Schema<PartyAddress>(
  {
    line1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    line2: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    landmark: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: "India",
      maxlength: 100,
    },
  },
  { _id: false },
);

const contactPersonSchema = new Schema<PartyContactPerson>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    designation: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
  },
  { _id: false },
);

const partySchema = new Schema<IParty, PartyModel>(
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
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    legalName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    partyType: {
      type: String,
      enum: PARTY_TYPES,
      default: "customer",
      index: true,
    },
    status: {
      type: String,
      enum: PARTY_STATUSES,
      default: "active",
      index: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    alternatePhoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    gstin: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    pan: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    taxTreatment: {
      type: String,
      enum: TAX_TREATMENTS,
      default: "unregistered",
    },
    billingAddress: {
      type: addressSchema,
      default: null,
    },
    shippingAddress: {
      type: addressSchema,
      default: null,
    },
    contactPerson: {
      type: contactPersonSchema,
      default: null,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2_000,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
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

partySchema.index({ owner: 1, displayName: 1 });
partySchema.index({ owner: 1, partyType: 1, status: 1 });
partySchema.index(
  { owner: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  },
);

partySchema.pre("validate", function preValidate() {
  if (this.email != null) {
    this.email = normalizeEmail(this.email);
    if (this.email === "") {
      this.email = null;
    }
  }

  if (this.phoneNumber) {
    this.phoneNumber = normalizePhoneNumber(this.phoneNumber);
  }

  if (this.alternatePhoneNumber) {
    this.alternatePhoneNumber = normalizePhoneNumber(this.alternatePhoneNumber);
  }

  if (this.contactPerson?.email != null) {
    this.contactPerson.email = normalizeEmail(this.contactPerson.email);
    if (this.contactPerson.email === "") {
      this.contactPerson.email = null;
    }
  }

  if (this.contactPerson?.phoneNumber) {
    this.contactPerson.phoneNumber = normalizePhoneNumber(
      this.contactPerson.phoneNumber,
    );
  }
});

const Party =
  (mongoose.models.Party as PartyModel | undefined) ??
  mongoose.model<IParty, PartyModel>("Party", partySchema);

export default Party;
