import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import Transaction from '@/models/Transaction';

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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const transaction = await Transaction.findOne({
      _id: id,
      owner: user.id,
    }).populate('party', 'name phone email').lean();

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: transaction,
    });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const body = await request.json();
    const validated = updateTransactionSchema.parse(body);

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, owner: user.id },
      {
        ...validated,
        updatedBy: user.id,
      },
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: transaction,
      message: 'Transaction updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();
    const { id } = await context.params;

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      owner: user.id,
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Transaction deleted successfully',
    });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}