import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError, generateTransactionNumber } from '@/lib/utils';
import { getNextCounterSequence } from '@/lib/document-numbering';
import { reverseConfirmedTransactionInventory } from '@/lib/transaction-inventory';
import { getBalanceDelta, updatePartyBalance } from '@/lib/party-balance';
import Item from '@/models/Item';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';
import StockMovement from '@/models/StockMovement';

const updateInvoiceSchema = z.object({
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  lineItems: z.array(z.object({
    item: z.string().optional().nullable(),
    itemName: z.string().min(1).max(200),
    sku: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    unit: z.string().min(1).max(20),
    quantity: z.coerce.number().min(0),
    unitPrice: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(0),
    costPrice: z.coerce.number().optional().nullable(),
  })).optional(),
  additionalCharges: z.array(z.object({
    name: z.string().min(1, 'Charge name is required'),
    amount: z.coerce.number().min(0, 'Amount must be positive'),
  })).optional(),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    paidAmount: z.coerce.number().min(0).default(0),
    totalDiscountType: z.enum(['percentage', 'fixed']).optional().nullable(),
    totalDiscountValue: z.preprocess(
      (val) => (val === null || val === undefined ? null : Number(val)),
      z.number().min(0).nullable().optional(),
    ),
  }).optional(),
  payment: z.object({
    method: z.enum(['cash', 'card', 'upi', 'bank-transfer', 'cheque', 'other']).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
});

type InvoiceNumberingConfig = {
  prefixMap: {
    invoice: string;
    sale: string;
  };
  sequenceMap: {
    invoice: number;
    sale: number;
  };
};

async function loadInvoiceNumberingConfig(
  ownerId: string,
  shopId?: string | null,
): Promise<InvoiceNumberingConfig> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError('Database connection not available', 500);
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const settingsDoc = shopId
    ? await db.collection('settings').findOne({
        owner: ownerObjectId,
        shopId: new mongoose.Types.ObjectId(shopId),
      })
    : await db.collection('settings').findOne({
        owner: ownerObjectId,
        shopId: null,
      });
  const fallbackSettingsDoc = settingsDoc || await db.collection('settings').findOne({
    owner: ownerObjectId,
    shopId: null,
  });
  const billing = fallbackSettingsDoc?.billing as {
    invoicePrefix?: string;
    salePrefix?: string;
    quotationPrefix?: string;
    nextInvoiceSequence?: number;
    nextSaleSequence?: number;
  } | undefined;

  return {
    prefixMap: {
      invoice: billing?.invoicePrefix || 'INV',
      sale: billing?.salePrefix || billing?.quotationPrefix || 'SALE',
    },
    sequenceMap: {
      invoice: billing?.nextInvoiceSequence || 1,
      sale: billing?.nextSaleSequence || 1,
    },
  };
}

async function buildFinalInvoiceNumber(
  ownerId: string,
  shopId?: string | null,
): Promise<string> {
  const { prefixMap, sequenceMap } = await loadInvoiceNumberingConfig(ownerId, shopId);
  const sequenceNumber = await getNextCounterSequence(
    'invoice_counters',
    {
      owner: new mongoose.Types.ObjectId(ownerId),
      prefix: prefixMap.invoice,
    },
    sequenceMap.invoice,
  );

  return generateTransactionNumber('invoice', ownerId, prefixMap.invoice, sequenceNumber);
}

async function buildFinalSaleTransactionNumber(
  ownerId: string,
  shopId?: string | null,
): Promise<string> {
  const { prefixMap, sequenceMap } = await loadInvoiceNumberingConfig(ownerId, shopId);
  const sequenceNumber = await getNextCounterSequence(
    'transaction_counters',
    {
      owner: new mongoose.Types.ObjectId(ownerId),
      type: 'sale',
      prefix: prefixMap.sale,
    },
    sequenceMap.sale,
  );

  return generateTransactionNumber('sale', ownerId, prefixMap.sale, sequenceNumber);
}

function getSafeStatus(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error
  ) {
    return Number((error as { status?: number }).status) || 500;
  }

  return 500;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const invoice = await Invoice.findOne({
      _id: id,
      owner: user.id,
    })
      .populate({
        path: "transactionId",
        populate: { path: "party", select: "displayName name phone phoneNumber alternatePhoneNumber contactPerson.name contactPerson.phoneNumber email billingAddress" },
      })
      .lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: invoice,
    });
  } catch (error: unknown) {
    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();
    const { id } = await context.params;

    const body = await request.json();
    const validated = updateInvoiceSchema.parse(body);

    const invoice = await Invoice.findOne({ _id: id, owner: user.id }).session(session);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status !== 'draft') {
      throw new AppError('Only draft invoices can be edited', 400);
    }

    if (validated.status && validated.status !== 'draft') {
      throw new AppError('Draft invoices can only be edited before confirmation', 400);
    }

    const transaction = await Transaction.findOne({
      _id: invoice.transactionId,
      owner: user.id,
    }).session(session);

    if (!transaction) {
      throw new AppError('Linked transaction not found', 404);
    }

    // Invoice-only fields that exist on the Invoice model
    const invoiceUpdates: Record<string, unknown> = {};

    // Transaction-only fields that exist on the Transaction model
    const transactionUpdates: Record<string, unknown> = {};

    // Fields that belong on Transaction only (not on Invoice model)
    const transactionOnlyFields = [
      'party',
      'transactionDate',
      'lineItems',
      'additionalCharges',
      'summary',
      'payment',
      'tags',
    ] as const;

    // Fields shared between both (exist on Invoice model)
    const sharedFields = [
      'dueDate',
      'notes',
    ] as const;

    for (const field of transactionOnlyFields) {
      const value = validated[field];
      if (value !== undefined) {
        transactionUpdates[field] = value;
      }
    }

    for (const field of sharedFields) {
      const value = validated[field];
      if (value !== undefined) {
        invoiceUpdates[field] = value;
        transactionUpdates[field] = value;
      }
    }

    if (validated.termsAndConditions !== undefined) {
      invoiceUpdates.termsAndConditions = validated.termsAndConditions;
    }

    Object.assign(transaction, transactionUpdates);
    Object.assign(invoice, invoiceUpdates);

    invoice.updatedBy = new mongoose.Types.ObjectId(user.id);
    transaction.updatedBy = new mongoose.Types.ObjectId(user.id);

    await transaction.save({ session });
    await invoice.save({ session });

    await session.commitTransaction();

    return NextResponse.json({
      data: { invoice, transaction },
      message: 'Draft invoice updated successfully',
    });
  } catch (error: unknown) {
    await session.abortTransaction();

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }

    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Draft update failed' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();
    const { id } = await context.params;

    const body = await request.json();
    const { action } = body;

    const invoice = await Invoice.findOne({ _id: id, owner: user.id }).session(session);

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'cancelled') {
      throw new AppError('Invoice is already cancelled', 400);
    }

    if (action === 'confirm') {
      if (invoice.status !== 'draft') {
        throw new AppError('Only draft invoices can be confirmed', 400);
      }

      const transaction = await Transaction.findOne({
        _id: invoice.transactionId,
        owner: user.id,
      }).session(session);

      if (!transaction) {
        throw new AppError('Linked transaction not found', 404);
      }

      if (invoice.status === 'draft') {
        invoice.invoiceNumber = await buildFinalInvoiceNumber(user.id, user.activeShopId);
      }

      if (transaction.status === 'draft') {
        transaction.transactionNumber = await buildFinalSaleTransactionNumber(
          user.id,
          user.activeShopId ?? null,
        );
      }

      for (const lineItem of transaction.lineItems) {
        if (!lineItem.item || lineItem.quantity <= 0) continue;

        const item = await Item.findById(lineItem.item).session(session);
        if (!item) {
          throw new AppError(`Item not found: ${lineItem.itemName}`, 404);
        }

        if (item.itemType === "product" && item.trackInventory) {
          const newQuantity = item.stock.currentQuantity - lineItem.quantity;

          if (newQuantity < 0 && !item.stock.allowNegativeStock) {
            throw new AppError(`Insufficient stock for ${item.name}. Available: ${item.stock.currentQuantity}, Required: ${lineItem.quantity}`, 400);
          }

          await StockMovement.create([{
            owner: user.id,
            item: item._id,
            type: "OUT",
            quantity: lineItem.quantity,
            referenceType: "SALE",
            referenceId: transaction._id,
            previousQuantity: item.stock.currentQuantity,
            newQuantity,
            createdBy: user.id,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              unitPrice: lineItem.unitPrice,
            },
          }], { session });

          await Item.findOneAndUpdate(
            { _id: item._id, __v: item.__v },
            {
              $inc: {
                "stock.currentQuantity": -lineItem.quantity,
                __v: 1,
              },
            },
            { session },
          );
        }
      }

      const grandTotal = transaction.summary.grandTotal;
      const paidAmount = transaction.summary.paidAmount ?? 0;

      if (transaction.party && grandTotal > 0) {
        const party = await Party.findOne({
          _id: transaction.party,
          owner: user.id,
        }).session(session);

        if (party && party.creditLimit > 0) {
          const delta = getBalanceDelta("sale", grandTotal, paidAmount);
          const projectedBalance = (party.currentBalance || 0) + delta;

          if (projectedBalance > party.creditLimit) {
            throw new AppError(
              `Credit limit exceeded. Current balance: ₹${(party.currentBalance || 0).toFixed(2)}, ` +
              `this transaction: ₹${delta.toFixed(2)}, ` +
              `credit limit: ₹${party.creditLimit.toFixed(2)}. ` +
              `Available credit: ₹${Math.max(0, party.creditLimit - (party.currentBalance || 0)).toFixed(2)}`,
              400,
            );
          }
        }
      }

      if (invoice.status === 'draft') {
        invoice.status = 'sent';
        invoice.sentAt = new Date();
        invoice.updatedBy = new mongoose.Types.ObjectId(user.id);
        await invoice.save({ session });
      }

      await Transaction.findOneAndUpdate(
        { _id: transaction._id, owner: user.id },
        {
          status: 'confirmed',
          paymentStatus: paidAmount <= 0
            ? "unpaid"
            : paidAmount < grandTotal
              ? "partial"
              : "paid",
          invoiceId: invoice._id,
          transactionNumber: transaction.transactionNumber,
          updatedBy: new mongoose.Types.ObjectId(user.id),
        },
        { session, runValidators: true },
      );

      if (transaction.party && grandTotal > 0) {
        const delta = getBalanceDelta("sale", grandTotal, paidAmount);
        await updatePartyBalance(transaction.party.toString(), delta, user.id, session);
      }
    }

    if (action === 'cancel') {
      // Cancel invoice
      invoice.status = 'cancelled';
      invoice.cancelledAt = new Date();
      invoice.updatedBy = new mongoose.Types.ObjectId(user.id);

      await invoice.save({ session });

      // Cancel linked transaction with proper paymentStatus update
      const transaction = await Transaction.findOne({
        _id: invoice.transactionId,
        owner: user.id,
      }).session(session);

      if (transaction) {
        if (transaction.status === 'confirmed') {
          await reverseConfirmedTransactionInventory(
            {
              ownerId: user.id,
              userId: user.id,
              shopId: user.activeShopId ?? null,
              session,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
            },
            transaction.type,
            transaction.lineItems,
          );

          if (transaction.party) {
            const grandTotal = transaction.summary.grandTotal;
            const paidAmount = transaction.summary.paidAmount ?? 0;
            const delta = getBalanceDelta("sale", grandTotal, paidAmount);
            await updatePartyBalance(transaction.party.toString(), -delta, user.id, session);
          }
        }

        await Transaction.findOneAndUpdate(
          { _id: transaction._id, owner: user.id },
          {
            status: 'cancelled',
            paymentStatus: "void",
            updatedBy: new mongoose.Types.ObjectId(user.id),
          },
          { session, runValidators: true },
        );
      }
    }

    if (action === 'mark-paid') {
      if (invoice.status === 'draft') {
        throw new AppError('Draft invoices must be confirmed before they can be marked paid', 400);
      }
      if (invoice.status === 'paid') {
        throw new AppError('Invoice is already paid', 400);
      }

      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.updatedBy = new mongoose.Types.ObjectId(user.id);

      await invoice.save({ session });

      // Update linked transaction paidAmount and paymentStatus
      const transaction = await Transaction.findOne({
        _id: invoice.transactionId,
        owner: user.id,
      }).session(session);

      if (transaction) {
        transaction.summary.paidAmount = transaction.summary.grandTotal;
        transaction.summary.dueAmount = 0;
        transaction.paymentStatus = "paid";
        transaction.updatedBy = new mongoose.Types.ObjectId(user.id);
        await transaction.save({ session });
      }
    }

    if (action !== 'cancel' && action !== 'mark-paid' && action !== 'confirm') {
      throw new AppError(`Unknown action: ${action}`, 400);
    }

    await session.commitTransaction();

    return NextResponse.json({
      data: invoice,
      message:
        action === 'cancel'
          ? 'Invoice cancelled successfully'
          : action === 'mark-paid'
            ? 'Invoice marked as paid successfully'
            : 'Invoice confirmed successfully',
    });

  } catch (error: unknown) {
    await session.abortTransaction();

    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}
