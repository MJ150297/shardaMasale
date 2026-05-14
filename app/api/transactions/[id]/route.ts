import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import {
  applyConfirmedTransactionInventory,
  releaseDraftSaleInventory,
  reverseConfirmedTransactionInventory,
} from '@/lib/transaction-inventory';
import { getBalanceDelta, updatePartyBalance } from '@/lib/party-balance';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';

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
  } catch (error: any) {
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: validStatus });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const body = await request.json();
    const validated = updateTransactionSchema.parse(body);
    const hasNonStatusUpdates = Object.entries(validated).some(
      ([key, value]) => key !== 'status' && value !== undefined,
    );

    if (hasNonStatusUpdates) {
      throw new AppError(
        'Transaction editing is not implemented yet. You can confirm, cancel, or delete drafts for now.',
        400,
      );
    }

    const transaction = await Transaction.findOne({
      _id: id,
      owner: user.id,
    }).session(session);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    const nextStatus = validated.status ?? transaction.status;

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
      // Check credit limit for sale and purchase-return transactions
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
            transaction.type as any,
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

      if (transaction.type === 'sale') {
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

      // Update party balance on confirm
      if (transaction.party) {
        const partyId = transaction.party.toString();
        const delta = getBalanceDelta(
          transaction.type as any,
          transaction.summary.grandTotal,
          transaction.summary.paidAmount,
        );
        await updatePartyBalance(partyId, delta, user.id, session);
      }
    } else if (transaction.status === 'draft' && nextStatus === 'cancelled') {
      if (transaction.type === 'sale') {
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

      // Reverse party balance on cancellation
      if (transaction.party) {
        const partyId = transaction.party.toString();
        const delta = getBalanceDelta(
          transaction.type as any,
          transaction.summary.grandTotal,
          transaction.summary.paidAmount,
        );
        await updatePartyBalance(partyId, -delta, user.id, session);
      }

      // Auto-cancel linked invoice if it exists
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
        paymentStatus: derivePaymentStatus({
          status: nextStatus,
          grandTotal: transaction.summary.grandTotal,
          paidAmount: transaction.summary.paidAmount,
        }),
        updatedBy: user.id,
      },
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    return NextResponse.json({
      data: updatedTransaction,
      message: 'Transaction status updated successfully',
    });
  } catch (error: any) {
    await session.abortTransaction();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    const status = error.status || error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  } finally {
    session.endSession();
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
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

    if (transaction.type === 'sale') {
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
  } catch (error: any) {
    await session.abortTransaction();
    const status = error.status || error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  } finally {
    session.endSession();
  }
}
