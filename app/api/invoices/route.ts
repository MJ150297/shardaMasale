import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';
import Item from '@/models/Item';
import StockMovement from '@/models/StockMovement';


async function generateInvoiceNumber(ownerId: string): Promise<string> {
  // Get last 2 digits of current year
  const now = new Date();
  const shortYear = now.getFullYear().toString().slice(-2);
  
  const prefix = `INV-${shortYear}`;
  
  // Atomic counter implementation with database lock
  // This ensures sequential numbering with no gaps even under concurrent load
  
  if (!mongoose.connection.db) {
    throw new AppError('Database connection not available', 500);
  }

  const counter = await mongoose.connection.db.collection('invoice_counters').findOneAndUpdate(
    { owner: ownerId, prefix },
    { $inc: { sequence: 1 } },
    { 
      upsert: true, 
      returnDocument: 'after',
      includeResultMetadata: true
    }
  ) as unknown as { value?: { sequence: number } } | null;
  
  let sequenceNumber = 1;
  
  if (counter?.value) {
    sequenceNumber = counter.value.sequence;
  }
  
  // Format as INV-261, INV-262, INV-263 etc.
  return `${prefix}${sequenceNumber}`;
}

const createInvoiceSchema = z.object({
  party: z.string().optional().nullable(),
  transactionDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date(),
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
  additionalCharges: z.array(z.object({
    name: z.string().min(1, "Charge name is required"),
    amount: z.coerce.number().min(0, "Amount must be positive"),
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
  termsAndConditions: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const query: any = { owner: user.id };
    
    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }
    
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "transactionId",
        populate: { path: "party", select: "displayName name phone email billingAddress" },
      })
      .lean();

    const total = await Invoice.countDocuments(query);

    return NextResponse.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: validStatus });
  }
}

export async function PATCH(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const url = new URL(request.url);
    const invoiceId = url.pathname.split('/').pop();
    const body = await request.json();
    const { action } = body;

    const invoice = await Invoice.findOne({ _id: invoiceId, owner: user.id }).session(session);
    
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

      // Also cancel linked transaction
      await Transaction.findOneAndUpdate(
        { _id: invoice.transactionId },
        { $set: { status: 'cancelled' } },
        { session }
      );

      // Reverse stock movements
      const stockMovements = await StockMovement.find({
        referenceId: invoice.transactionId,
        referenceType: 'SALE'
      }).session(session);

      for (const movement of stockMovements) {
        // Reverse stock
        await Item.findOneAndUpdate(
          { _id: movement.item },
          { $inc: { "stock.currentQuantity": movement.quantity } },
          { session }
        );

        // Create reverse movement
        await StockMovement.create([{
          owner: user.id,
          item: movement.item,
          type: "IN",
          quantity: movement.quantity,
          referenceType: "INVOICE_CANCEL",
          referenceId: invoice._id,
          previousQuantity: movement.newQuantity,
          newQuantity: movement.previousQuantity,
          createdBy: user.id,
          metadata: {
            originalMovement: movement._id,
            invoiceNumber: invoice.invoiceNumber
          }
        }], { session });
      }
    }

    if (action === 'mark-paid') {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.updatedBy = new mongoose.Types.ObjectId(user.id);

      await invoice.save({ session });

      // Mark transaction payment status as paid
      await Transaction.findOneAndUpdate(
        { _id: invoice.transactionId },
        { 
          $set: { 
            paymentStatus: 'paid',
            "summary.paidAmount": "$summary.grandTotal",
            "summary.dueAmount": 0
          } 
        },
        { session }
      );
    }

    await session.commitTransaction();

    return NextResponse.json({
      data: invoice,
      message: `Invoice ${action === 'cancel' ? 'cancelled' : 'marked as paid'} successfully`,
    });

  } catch (error: any) {
    await session.abortTransaction();
    
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: validStatus });
  } finally {
    session.endSession();
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  
  if (url.pathname.endsWith('/generate')) {
    return handleGenerateInvoice(request);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json();
    const validated = createInvoiceSchema.parse(body);

    const invoiceNumber = await generateInvoiceNumber(user.id);

    // First create transaction
    const [transaction] = await Transaction.create([{
      type: "sale",
      ...validated,
      owner: user.id,
      transactionNumber: invoiceNumber,
      createdBy: user.id,
      updatedBy: user.id,
    }], { session });

    // Create invoice record
    const [invoice] = await Invoice.create([{
      transactionId: transaction._id,
      owner: user.id,
      shopId: user.activeShopId ?? null,
      invoiceNumber,
      dueDate: validated.dueDate,
      termsAndConditions: validated.termsAndConditions,
      notes: validated.notes,
      status: validated.status === "confirmed" ? "sent" : "draft",
      createdBy: user.id,
      updatedBy: user.id,
    }], { session });

    // Process stock updates if confirmed
    if (validated.status === "confirmed") {
      for (const lineItem of validated.lineItems) {
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
            newQuantity: newQuantity,
            createdBy: user.id,
            metadata: {
              invoiceNumber,
              unitPrice: lineItem.unitPrice
            }
          }], { session });

          await Item.findOneAndUpdate(
            { _id: item._id, __v: item.__v },
            {
              $inc: {
                "stock.currentQuantity": -lineItem.quantity,
                __v: 1
              }
            },
            { session }
          );
        }
      }
    }

    // Update the transaction with the invoice reference
    await Transaction.findOneAndUpdate(
      { _id: transaction._id },
      { $set: { invoiceId: invoice._id } },
      { session }
    );

    await session.commitTransaction();

    return NextResponse.json({
      data: { invoice, transaction },
      message: 'Invoice created successfully',
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

export async function handleGenerateInvoice(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json();
    const { transactionId } = body;

    // Find existing transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      owner: user.id,
      type: 'sale',
      status: 'confirmed'
    }).session(session);

    if (!transaction) {
      throw new AppError('Transaction not found or not eligible for invoice generation', 404);
    }

    // Check if invoice already exists for this transaction
    const existingInvoice = await Invoice.findOne({ transactionId: transaction._id }).session(session);
    if (existingInvoice) {
      throw new AppError('Invoice already exists for this transaction', 409);
    }

    const invoiceNumber = await generateInvoiceNumber(user.id);

    // Create invoice record
    const [invoice] = await Invoice.create([{
      transactionId: transaction._id,
      owner: user.id,
      shopId: user.activeShopId ?? null,
      invoiceNumber,
      dueDate: transaction.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      termsAndConditions: null,
      notes: transaction.notes,
      status: 'sent',
      createdBy: user.id,
      updatedBy: user.id,
    }], { session });

    // Update the transaction with the invoice reference
    await Transaction.findOneAndUpdate(
      { _id: transaction._id },
      { $set: { invoiceId: invoice._id } },
      { session }
    );

    await session.commitTransaction();

    return NextResponse.json({
      data: { invoice },
      message: 'Invoice generated successfully',
    }, { status: 201 });

  } catch (error: any) {
    await session.abortTransaction();
    
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Failed to generate invoice' }, { status: validStatus });
  } finally {
    session.endSession();
  }
}