import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import {
  AppError,
  generateTransactionNumber,
} from '@/lib/utils';
import {
  applyConfirmedTransactionInventory,
  releaseDraftSaleInventory,
  reverseConfirmedTransactionInventory,
} from '@/lib/transaction-inventory';
import { getNextCounterSequence } from '@/lib/document-numbering';
import { getBalanceDelta, updatePartyBalance } from '@/lib/party-balance';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';

type TransactionNumberingConfig = {
  prefixMap: Record<string, string>;
  sequenceMap: Record<string, number>;
};

async function loadTransactionNumberingConfig(
  ownerId: string,
  shopId?: string | null,
): Promise<TransactionNumberingConfig> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError('Database connection not available', 500);
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const settingsCollection = db.collection('settings');
  const shopSettingsDoc = shopId
    ? await settingsCollection.findOne({
        owner: ownerObjectId,
        shopId: new mongoose.Types.ObjectId(shopId),
      })
    : null;
  const fallbackSettingsDoc = shopSettingsDoc || await settingsCollection.findOne({
    owner: ownerObjectId,
    shopId: null,
  });
  const billingSettings = fallbackSettingsDoc?.billing as Record<string, unknown> | undefined;

  return {
    prefixMap: {
      sale:
        (billingSettings?.salePrefix as string)
        || (billingSettings?.quotationPrefix as string)
        || 'SALE',
      purchase: (billingSettings?.purchasePrefix as string) || 'PUR',
      payment: (billingSettings?.paymentPrefix as string) || 'PAY',
      invoice: (billingSettings?.invoicePrefix as string) || 'INV',
    },
    sequenceMap: {
      sale: Number(billingSettings?.nextSaleSequence) || 1,
      purchase: Number(billingSettings?.nextPurchaseSequence) || 1,
      payment: Number(billingSettings?.nextPaymentSequence) || 1,
      invoice: Number(billingSettings?.nextInvoiceSequence) || 1,
    },
  };
}

async function buildFinalTransactionNumber({
  ownerId,
  shopId,
  transactionType,
}: {
  ownerId: string;
  shopId?: string | null;
  transactionType: string;
}): Promise<string> {
  const { prefixMap, sequenceMap } = await loadTransactionNumberingConfig(ownerId, shopId);
  const transactionTypeKeyMap: Record<string, keyof typeof prefixMap> = {
    sale: 'sale',
    purchase: 'purchase',
    'payment-in': 'payment',
    'payment-out': 'payment',
  };

  const transactionTypeKey = transactionTypeKeyMap[transactionType];
  const prefixOverride = transactionTypeKey ? prefixMap[transactionTypeKey] : undefined;

  if (!transactionTypeKey) {
    return generateTransactionNumber(transactionType, ownerId, prefixOverride);
  }

  const sequenceNumber = await getNextCounterSequence(
    'transaction_counters',
    {
      owner: new mongoose.Types.ObjectId(ownerId),
      type: transactionTypeKey,
      prefix: prefixOverride,
    },
    sequenceMap[transactionTypeKey],
  );

  return generateTransactionNumber(
    transactionType,
    ownerId,
    prefixOverride,
    sequenceNumber,
  );
}

async function buildFinalInvoiceNumber({
  ownerId,
  shopId,
}: {
  ownerId: string;
  shopId?: string | null;
}): Promise<string> {
  const { prefixMap, sequenceMap } = await loadTransactionNumberingConfig(ownerId, shopId);
  const prefixOverride = prefixMap.invoice;
  const sequenceNumber = await getNextCounterSequence(
    'invoice_counters',
    {
      owner: new mongoose.Types.ObjectId(ownerId),
      prefix: prefixOverride,
    },
    sequenceMap.invoice,
  );

  return generateTransactionNumber('invoice', ownerId, prefixOverride, sequenceNumber);
}

const updateTransactionSchema = z.object({
  type: z.enum(["sale", "purchase", "sale-return", "purchase-return", "payment-in", "payment-out", "adjustment", "opening-balance"]).optional(),
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
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
    method: z.enum(["cash", "card", "upi", "bank-transfer", "cheque", "other"]).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "confirmed", "cancelled"]).optional(),
});

function derivePaymentStatus({
  status,
  grandTotal,
  paidAmount,
}: {
  status: "draft" | "confirmed" | "cancelled";
  grandTotal: number;
  paidAmount: number;
}) {
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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const transaction = await Transaction.findOne({
      _id: id,
      owner: user.id,
    }).populate('party', 'displayName phoneNumber email').lean();

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: transaction,
    });
  } catch (error: unknown) {
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error
        ? Number((error as { status?: number }).status) || 500
        : 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();
    const { id } = await context.params;

    const body = await request.json();
    const validated = updateTransactionSchema.parse(body);
    const updatePayload = Object.fromEntries(
      Object.entries(validated).filter(([key, value]) => key !== 'status' && value !== undefined),
    ) as Record<string, unknown>;

    const transaction = await Transaction.findOne({
      _id: id,
      owner: user.id,
    }).session(session);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    const nextStatus = validated.status ?? transaction.status;
    const hasEditableUpdates = Object.keys(updatePayload).length > 0;

    if (transaction.status !== 'draft' && hasEditableUpdates) {
      throw new AppError(
        'Only draft transactions can be edited. Confirmed transactions can only be cancelled.',
        400,
      );
    }

    if (hasEditableUpdates) {
      Object.assign(transaction, updatePayload);
      transaction.updatedBy = new mongoose.Types.ObjectId(user.id);
      await transaction.save({ session });
    }

    if (nextStatus === transaction.status) {
      await session.commitTransaction();

      return NextResponse.json({
        data: transaction,
        message: 'No status change applied',
      });
    }

    if (transaction.status === 'cancelled') {
      throw new AppError('Cancelled transactions cannot be modified', 400);
    }

    if (transaction.status === 'draft' && nextStatus === 'confirmed') {
      transaction.transactionNumber = await buildFinalTransactionNumber({
        ownerId: user.id,
        shopId: user.activeShopId ?? null,
        transactionType: transaction.type,
      });

      if (
        transaction.party &&
        (transaction.type === 'sale' || transaction.type === 'purchase-return') &&
        transaction.summary.grandTotal > 0
      ) {
        const party = await Party.findOne({
          _id: transaction.party,
          owner: user.id,
        }).session(session);

        if (party && party.creditLimit > 0) {
          const delta = getBalanceDelta(
            transaction.type as Parameters<typeof getBalanceDelta>[0],
            transaction.summary.grandTotal,
            transaction.summary.paidAmount,
          );
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

      if (
        transaction.type === 'sale' &&
        transaction.metadata?.draftInventoryReserved !== false
      ) {
        await releaseDraftSaleInventory(
          {
            ownerId: user.id,
            userId: user.id,
            shopId: user.activeShopId ?? null,
          },
          transaction.lineItems,
          session,
        );
      }

      if (transaction.invoiceId) {
        const linkedInvoice = await Invoice.findOne({
          _id: transaction.invoiceId,
          owner: user.id,
        }).session(session);

        if (linkedInvoice && linkedInvoice.status === 'draft') {
          linkedInvoice.invoiceNumber = await buildFinalInvoiceNumber({
            ownerId: user.id,
            shopId: user.activeShopId ?? null,
          });
          linkedInvoice.status = 'sent';
          linkedInvoice.sentAt = new Date();
          linkedInvoice.updatedBy = new mongoose.Types.ObjectId(user.id);
          await linkedInvoice.save({ session });
        }
      }

      await applyConfirmedTransactionInventory(
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
        const partyId = transaction.party.toString();
        const delta = getBalanceDelta(
          transaction.type as Parameters<typeof getBalanceDelta>[0],
          transaction.summary.grandTotal,
          transaction.summary.paidAmount,
        );
        await updatePartyBalance(partyId, delta, user.id, session);
      }
    } else if (transaction.status === 'draft' && nextStatus === 'cancelled') {
      if (
        transaction.type === 'sale' &&
        transaction.metadata?.draftInventoryReserved !== false
      ) {
        await releaseDraftSaleInventory(
          {
            ownerId: user.id,
            userId: user.id,
            shopId: user.activeShopId ?? null,
          },
          transaction.lineItems,
          session,
        );
      }
    } else if (transaction.status === 'confirmed' && nextStatus === 'cancelled') {
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
        const partyId = transaction.party.toString();
        const delta = getBalanceDelta(
          transaction.type as Parameters<typeof getBalanceDelta>[0],
          transaction.summary.grandTotal,
          transaction.summary.paidAmount,
        );
        await updatePartyBalance(partyId, -delta, user.id, session);
      }

      if (transaction.invoiceId) {
        const linkedInvoice = await Invoice.findOne({
          _id: transaction.invoiceId,
          owner: user.id,
        }).session(session);

        if (linkedInvoice && linkedInvoice.status !== 'cancelled' && linkedInvoice.status !== 'paid') {
          linkedInvoice.status = 'cancelled';
          linkedInvoice.cancelledAt = new Date();
          linkedInvoice.updatedBy = new mongoose.Types.ObjectId(user.id);
          await linkedInvoice.save({ session });
        }
      }
    } else {
      throw new AppError(
        `Unsupported status transition from ${transaction.status} to ${nextStatus}`,
        400,
      );
    }

    const updatedTransaction = await Transaction.findOneAndUpdate(
      { _id: id, owner: user.id },
      {
        status: nextStatus,
        transactionNumber: transaction.transactionNumber,
        paymentStatus: derivePaymentStatus({
          status: nextStatus,
          grandTotal: transaction.summary.grandTotal,
          paidAmount: transaction.summary.paidAmount,
        }),
        updatedBy: new mongoose.Types.ObjectId(user.id),
      },
      { new: true, runValidators: true, session },
    );

    await session.commitTransaction();

    return NextResponse.json({
      data: updatedTransaction,
      message: 'Transaction status updated successfully',
    });
  } catch (error: unknown) {
    await session.abortTransaction();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    const status =
      typeof error === 'object' &&
      error !== null &&
      ('status' in error || 'statusCode' in error)
        ? Number((error as { status?: number; statusCode?: number }).status ?? (error as { status?: number; statusCode?: number }).statusCode) || 500
        : 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();
    const { id } = await context.params;

    const transaction = await Transaction.findOne({
      _id: id,
      owner: user.id,
    }).session(session);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (transaction.status !== 'draft') {
      throw new AppError('Only draft transactions can be deleted. Cancel confirmed transactions instead.', 400);
    }

    if (
      transaction.type === 'sale' &&
      transaction.metadata?.draftInventoryReserved !== false
    ) {
      await releaseDraftSaleInventory(
        {
          ownerId: user.id,
          userId: user.id,
          shopId: user.activeShopId ?? null,
        },
        transaction.lineItems,
        session,
      );
    }

    await Transaction.findOneAndDelete({
      _id: id,
      owner: user.id,
    }).session(session);

    await session.commitTransaction();

    return NextResponse.json({
      message: 'Transaction deleted successfully',
    });
  } catch (error: unknown) {
    await session.abortTransaction();
    const status =
      typeof error === 'object' &&
      error !== null &&
      ('status' in error || 'statusCode' in error)
        ? Number((error as { status?: number; statusCode?: number }).status ?? (error as { status?: number; statusCode?: number }).statusCode) || 500
        : 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}
