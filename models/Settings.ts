import mongoose, { type Model, Schema, Types } from "mongoose";

import {
  mongooseDocumentTransform,
  normalizeEmail,
  normalizePhoneNumber,
} from "@/lib/utils";
import { DEFAULT_SHARE_MESSAGE_TEMPLATES, type ShareMessageTemplates } from "@/lib/share-messages";

export interface SettingsAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BusinessProfileSettings {
  legalName: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address: SettingsAddress;
  logo?: string | null;
}

export interface LocalizationSettings {
  currency: string;
  timezone: string;
  language: string;
  dateFormat: string;
}

export interface InventorySettings {
  lowStockThreshold: number;
  allowNegativeStock: boolean;
  trackBatches: boolean;
  trackExpiry: boolean;
  defaultUnit: string;
}

export interface BillingSettings {
  invoicePrefix: string;
  purchasePrefix: string;
  paymentPrefix: string;
  salePrefix: string;
  draftPrefix: string;
  nextInvoiceSequence: number;
  nextPurchaseSequence: number;
  nextPaymentSequence: number;
  nextSaleSequence: number;
  autoRoundOff: boolean;
  showSubItemsInInvoice: boolean;
  authorisedSignature?: string | null;
  termsAndConditions?: string | null;
  footerText?: string | null;
  shareMessageTemplates?: ShareMessageTemplates;
}

export interface TaxationSettings {
  pricesIncludeTax: boolean;
  defaultTaxRate: number;
  taxLabel: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireTwoFactor: boolean;
}

export interface NotificationSettings {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  lowStockAlerts: boolean;
  duePaymentAlerts: boolean;
  dailySummary: boolean;
  subscriptionExpiringAlerts: boolean;
  subscriptionExpiredAlerts: boolean;
  invoiceOverdueAlerts: boolean;
  invoiceDueSoonAlerts: boolean;
  paymentReceivedAlerts: boolean;
  creditLimitWarningAlerts: boolean;
  systemAnnouncements: boolean;
  quietHours: { start: string; end: string };
  digestMode: string;
  digestEmailEnabled: boolean;
  notifyRoles: Record<string, boolean>;
  retentionDays?: number;
  archiveAfterDays?: number;
}

export interface PosSettings {
  defaultWalkInCustomerName: string;
  enableBarcodeScanner: boolean;
  printAfterSale: boolean;
}

export interface ISettings {
  owner: Types.ObjectId;
  shopId?: Types.ObjectId | null;
  business: BusinessProfileSettings;
  localization: LocalizationSettings;
  inventory: InventorySettings;
  billing: BillingSettings;
  taxation: TaxationSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  pos: PosSettings;
  enabledModules: string[];
  featureFlags: Record<string, boolean>;
  metadata: Record<string, unknown>;
}

type SettingsModel = Model<ISettings>;

const addressSchema = new Schema<SettingsAddress>(
  {
    line1: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    postalCode: {
      type: String,
      default: "",
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

const settingsSchema = new Schema<ISettings, SettingsModel>(
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
    business: {
      type: new Schema<BusinessProfileSettings>(
        {
          legalName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 200,
          },
          displayName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 160,
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
          website: {
            type: String,
            default: null,
            trim: true,
            maxlength: 200,
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
          address: {
            type: addressSchema,
            required: true,
          },
          logo: {
            type: String,
            default: null,
          },
        },
        { _id: false },
      ),
      required: true,
    },
    localization: {
      type: new Schema<LocalizationSettings>(
        {
          currency: {
            type: String,
            default: "INR",
            trim: true,
            uppercase: true,
            minlength: 3,
            maxlength: 3,
          },
          timezone: {
            type: String,
            default: "Asia/Kolkata",
            trim: true,
          },
          language: {
            type: String,
            default: "en",
            trim: true,
          },
          dateFormat: {
            type: String,
            default: "dd/MM/yyyy",
            trim: true,
          },
        },
        { _id: false },
      ),
      default: () => ({
        currency: "INR",
        timezone: "Asia/Kolkata",
        language: "en",
        dateFormat: "dd/MM/yyyy",
      }),
    },
    inventory: {
      type: new Schema<InventorySettings>(
        {
          lowStockThreshold: {
            type: Number,
            default: 5,
            min: 0,
          },
          allowNegativeStock: {
            type: Boolean,
            default: false,
          },
          trackBatches: {
            type: Boolean,
            default: false,
          },
          trackExpiry: {
            type: Boolean,
            default: false,
          },
          defaultUnit: {
            type: String,
            default: "pcs",
            trim: true,
            lowercase: true,
            maxlength: 20,
          },
        },
        { _id: false },
      ),
      default: () => ({
        lowStockThreshold: 5,
        allowNegativeStock: false,
        trackBatches: false,
        trackExpiry: false,
        defaultUnit: "pcs",
      }),
    },
    billing: {
      type: new Schema<BillingSettings>(
        {
          invoicePrefix: {
            type: String,
            default: "INV",
            trim: true,
            uppercase: true,
            maxlength: 12,
          },
          purchasePrefix: {
            type: String,
            default: "PUR",
            trim: true,
            uppercase: true,
            maxlength: 12,
          },
          paymentPrefix: {
            type: String,
            default: "PAY",
            trim: true,
            uppercase: true,
            maxlength: 12,
          },
          salePrefix: {
            type: String,
            default: "SALE",
            trim: true,
            uppercase: true,
            maxlength: 12,
          },
          draftPrefix: {
            type: String,
            default: "DRAFT",
            trim: true,
            uppercase: true,
            maxlength: 12,
          },
          nextInvoiceSequence: {
            type: Number,
            default: 1,
            min: 1,
          },
          nextPurchaseSequence: {
            type: Number,
            default: 1,
            min: 1,
          },
          nextPaymentSequence: {
            type: Number,
            default: 1,
            min: 1,
          },
          nextSaleSequence: {
            type: Number,
            default: 1,
            min: 1,
          },
          autoRoundOff: {
            type: Boolean,
            default: true,
          },
          showSubItemsInInvoice: {
            type: Boolean,
            default: false,
          },
          authorisedSignature: {
            type: String,
            default: null,
          },
          termsAndConditions: {
            type: String,
            default: null,
            trim: true,
            maxlength: 2_000,
          },
          footerText: {
            type: String,
            default: null,
            trim: true,
            maxlength: 500,
          },
          shareMessageTemplates: {
            type: new Schema<ShareMessageTemplates>(
              {
                invoice: {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES.invoice,
                },
                sale: {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES.sale,
                },
                purchase: {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES.purchase,
                },
                'sale-return': {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES['sale-return'],
                },
                'purchase-return': {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES['purchase-return'],
                },
                'payment-in': {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES['payment-in'],
                },
                'payment-out': {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES['payment-out'],
                },
                adjustment: {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES.adjustment,
                },
                'opening-balance': {
                  type: String,
                  default: DEFAULT_SHARE_MESSAGE_TEMPLATES['opening-balance'],
                },
              },
              { _id: false },
            ),
            default: () => ({ ...DEFAULT_SHARE_MESSAGE_TEMPLATES }),
          },
        },
        { _id: false },
      ),
      default: () => ({
        invoicePrefix: "INV",
        purchasePrefix: "PUR",
        paymentPrefix: "PAY",
        salePrefix: "SALE",
        draftPrefix: "DRAFT",
        nextInvoiceSequence: 1,
        nextPurchaseSequence: 1,
        nextPaymentSequence: 1,
        nextSaleSequence: 1,
        autoRoundOff: true,
        showSubItemsInInvoice: false,
        authorisedSignature: null,
        termsAndConditions: null,
        footerText: null,
        shareMessageTemplates: { ...DEFAULT_SHARE_MESSAGE_TEMPLATES },
      }),
    },
    taxation: {
      type: new Schema<TaxationSettings>(
        {
          pricesIncludeTax: {
            type: Boolean,
            default: false,
          },
          defaultTaxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
          },
          taxLabel: {
            type: String,
            default: "GST",
            trim: true,
            uppercase: true,
            maxlength: 20,
          },
        },
        { _id: false },
      ),
      default: () => ({
        pricesIncludeTax: false,
        defaultTaxRate: 0,
        taxLabel: "GST",
      }),
    },
    security: {
      type: new Schema<SecuritySettings>(
        {
          sessionTimeoutMinutes: {
            type: Number,
            default: 480,
            min: 15,
          },
          maxLoginAttempts: {
            type: Number,
            default: 5,
            min: 3,
          },
          passwordMinLength: {
            type: Number,
            default: 8,
            min: 8,
          },
          requireTwoFactor: {
            type: Boolean,
            default: false,
          },
        },
        { _id: false },
      ),
      default: () => ({
        sessionTimeoutMinutes: 480,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        requireTwoFactor: false,
      }),
    },
    notifications: {
      type: new Schema<NotificationSettings>(
        {
          emailEnabled: {
            type: Boolean,
            default: false,
          },
          lowStockAlerts: {
            type: Boolean,
            default: true,
          },
          duePaymentAlerts: {
            type: Boolean,
            default: true,
          },
          dailySummary: {
            type: Boolean,
            default: false,
          },
          retentionDays: {
            type: Number,
            default: 90,
            min: 1,
          },
          archiveAfterDays: {
            type: Number,
            default: 30,
            min: 1,
          },
        },
        { _id: false },
      ),
      default: () => ({
        emailEnabled: false,
        lowStockAlerts: true,
        duePaymentAlerts: true,
        dailySummary: false,
        retentionDays: 90,
        archiveAfterDays: 30,
      }),
    },
    pos: {
      type: new Schema<PosSettings>(
        {
          defaultWalkInCustomerName: {
            type: String,
            default: "Walk-in Customer",
            trim: true,
            maxlength: 120,
          },
          enableBarcodeScanner: {
            type: Boolean,
            default: true,
          },
          printAfterSale: {
            type: Boolean,
            default: false,
          },
        },
        { _id: false },
      ),
      default: () => ({
        defaultWalkInCustomerName: "Walk-in Customer",
        enableBarcodeScanner: true,
        printAfterSale: false,
      }),
    },
    enabledModules: {
      type: [String],
      default: ["inventory", "billing", "crm", "reports"],
    },
    featureFlags: {
      type: Schema.Types.Mixed,
      default: {},
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

settingsSchema.pre("validate", function preValidate() {
  if (this.business.email) {
    this.business.email = normalizeEmail(this.business.email);
  }

  if (this.business.phoneNumber) {
    this.business.phoneNumber = normalizePhoneNumber(this.business.phoneNumber);
  }

  this.billing.invoicePrefix = this.billing.invoicePrefix.trim().toUpperCase();
  this.billing.purchasePrefix = this.billing.purchasePrefix.trim().toUpperCase();
  this.billing.paymentPrefix = this.billing.paymentPrefix.trim().toUpperCase();
  this.billing.salePrefix = this.billing.salePrefix.trim().toUpperCase();
  this.billing.draftPrefix = this.billing.draftPrefix.trim().toUpperCase();
});

const Settings =
  (mongoose.models.Settings as SettingsModel | undefined) ??
  mongoose.model<ISettings, SettingsModel>("Settings", settingsSchema);

export default Settings;
