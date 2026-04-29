import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError, roundCurrency, generateTransactionNumber } from '@/lib/utils';
import Transaction from '@/models/Transaction';
import Item from '@/models/Item';
import StockMovement from '@/models/StockMovement';

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

    const query: any = { owner: user.id };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await Transaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('party', 'name phone')
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
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
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

    // Process stock updates for inventory affecting transaction types
    const inventoryAffectingTypes = ["sale", "purchase", "sale-return", "purchase-return"];
    
    if (inventoryAffectingTypes.includes(validated.type) && validated.status === "confirmed") {
      // Determine stock direction
      let stockMultiplier = 0;
      let movementType = "";
      
      switch(validated.type) {
        case "sale":
          stockMultiplier = -1;
          movementType = "OUT";
          break;
        case "purchase":
          stockMultiplier = 1;
          movementType = "IN";
          break;
        case "sale-return":
          stockMultiplier = 1;
          movementType = "IN";
          break;
        case "purchase-return":
          stockMultiplier = -1;
          movementType = "OUT";
          break;
      }

      // Process each line item
      for (const lineItem of validated.lineItems) {
        if (!lineItem.item || lineItem.quantity <= 0) continue;

        // Find item with current version
        const item = await Item.findById(lineItem.item).session(session);
        if (!item) {
          throw new AppError(`Item not found: ${lineItem.itemName}`, 404);
        }

        if (item.itemType === "product" && item.trackInventory) {
          const quantityChange = lineItem.quantity * stockMultiplier;
          const newQuantity = item.stock.currentQuantity + quantityChange;

          // Validate negative stock
          if (newQuantity < 0 && !item.stock.allowNegativeStock) {
            throw new AppError(`Insufficient stock for ${item.name}. Available: ${item.stock.currentQuantity}, Required: ${lineItem.quantity}`, 400);
          }

          // Create stock movement
          await StockMovement.create([{
            owner: user.id,
            item: item._id,
            type: movementType,
            quantity: lineItem.quantity,
            referenceType: "TRANSACTION",
            referenceId: transaction._id,
            previousQuantity: item.stock.currentQuantity,
            newQuantity: newQuantity,
            createdBy: user.id,
            metadata: {
              transactionType: validated.type,
              transactionNumber: transactionNumber,
              unitPrice: lineItem.unitPrice
            }
          }], { session });

          // Atomic update item stock with optimistic concurrency check
          const updatedItem = await Item.findOneAndUpdate(
            {
              _id: item._id,
              __v: item.__v,
              owner: user.id
            },
            {
              $inc: {
                "stock.currentQuantity": quantityChange,
                __v: 1
              }
            },
            {
              new: true,
              session,
              runValidators: true
            }
          );

          if (!updatedItem) {
            throw new AppError(`Item ${item.name} was modified by another operation. Please try again.`, 409);
          }
        }
      }
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

    const status = error.status || 500;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  } finally {
    session.endSession();
  }
}
