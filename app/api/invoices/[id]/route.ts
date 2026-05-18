import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import { reverseConfirmedTransactionInventory } from '@/lib/transaction-inventory';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';

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
        // Use the proper inventory reversal utility (consistent with transaction PUT handler)
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

        // Update transaction status and paymentStatus atomically
        transaction.status = 'cancelled';
        transaction.paymentStatus = "void";
        transaction.updatedBy = new mongoose.Types.ObjectId(user.id);
        await transaction.save({ session });
      }
    }

    if (action === 'mark-paid') {
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

    if (action !== 'cancel' && action !== 'mark-paid') {
      throw new AppError(`Unknown action: ${action}`, 400);
    }

    await session.commitTransaction();

    return NextResponse.json({
      data: invoice,
      message: `Invoice ${action === 'cancel' ? 'cancelled' : 'marked as paid'} successfully`,
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