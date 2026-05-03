import mongoose, { type Model, Schema, Types } from "mongoose";
import { mongooseDocumentTransform } from "@/lib/utils";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice {
  transactionId: Types.ObjectId;
  invoiceNumber: string;
  status: InvoiceStatus;
  dueDate: Date;
  termsAndConditions?: string | null;
  notes?: string | null;
  sentAt?: Date | null;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

type InvoiceModel = Model<IInvoice>;

const invoiceSchema = new Schema<IInvoice, InvoiceModel>(
  {
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: "draft",
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    termsAndConditions: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  }
);

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

// Auto populate transaction
invoiceSchema.pre(/^find/, function (this: any, next: any) {
  this.populate({
    path: "transactionId",
    populate: { path: "party", select: "name phone email billingAddress" },
  });
  next();
});

const Invoice =
  (mongoose.models.Invoice as InvoiceModel | undefined) ??
  mongoose.model<IInvoice, InvoiceModel>("Invoice", invoiceSchema);

export default Invoice;