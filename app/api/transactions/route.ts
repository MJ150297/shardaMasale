import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { generateTransactionNumber } from '@/lib/utils';
import {
  applyConfirmedTransactionInventory,
  reserveDraftSaleInventory,
} from '@/lib/transaction-inventory';
import Transaction from '@/models/Transaction';

const createTransactionSchema = z.object({
  type: z.enum(["sale", "purchase", "sale-return", "purchase-return", "payment-in", "payment-out", "adjustment", "opening-balance"]),
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().default(() => new Date()),
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
  })).default([]),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    grandTotal: z.coerce.number().min(0).optional(),
    paidAmount: z.coerce.number().min(0).default(0),
  }).default(() => ({ roundOff: 0, paidAmount: 0 })),
  payment: z.object({
    method: z.enum(["cash", "card", "upi", "bank-transfer", "cheque", "other"]).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "confirmed", "cancelled"]).default("draft"),
});

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const party = searchParams.get('party');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: any = { owner: user.id };
    
    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (party) query.party = party;
    if (startDate && endDate) {
      query.transactionDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('party', 'displayName phoneNumber email')
      .populate('lineItems.item', 'itemType')
      .populate('invoiceId', 'invoiceNumber status')
      .lean();

    const total = await Transaction.countDocuments(query);

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: validStatus });
  }
}

export async function POST(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json();
    const validated = createTransactionSchema.parse(body);

    const transactionNumber = await generateTransactionNumber(validated.type, user.id);

    // Create transaction record inside transaction
    const [transaction] = await Transaction.create([{
      ...validated,
      owner: user.id,
      transactionNumber,
      createdBy: user.id,
      updatedBy: user.id,
    }], { session });

    if (validated.type === "sale" && validated.status === "draft") {
      await reserveDraftSaleInventory(
        {
          ownerId: user.id,
          userId: user.id,
          shopId: user.activeShopId ?? null,
        },
        validated.lineItems,
        session,
      );
    }

    if (validated.status === "confirmed") {
      await applyConfirmedTransactionInventory(
        {
          ownerId: user.id,
          userId: user.id,
          shopId: user.activeShopId ?? null,
          session,
          transactionId: transaction._id.toString(),
          transactionNumber,
        },
        validated.type,
        validated.lineItems,
      );
    }

    await session.commitTransaction();

    return NextResponse.json({
      data: transaction,
      message: 'Transaction created successfully',
    }, { status: 201 });

  } catch (error: any) {
    await session.abortTransaction();

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }

    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: validStatus });
  } finally {
    session.endSession();
  }
}
