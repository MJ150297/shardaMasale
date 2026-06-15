import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import {
  AppError,
  generateDraftNumber,
  generateTransactionNumber,
  roundCurrency,
} from '@/lib/utils';
import { getNextCounterSequence } from '@/lib/document-numbering';
import { getBalanceDelta, updatePartyBalance } from '@/lib/party-balance';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';
import Item from '@/models/Item';
import Party from '@/models/Party';
import StockMovement from '@/models/StockMovement';
import { validateQuantityForUnit } from '@/lib/unit-utils';

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

const createInvoiceSchema = z.object({
  party: z.preprocess(
    (val) => (val === undefined || val === null ? '' : val),
    z.string().min(1, "Party is required")
  ),
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
    totalDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
    totalDiscountValue: z.preprocess(
      (val) => (val === null || val === undefined ? null : Number(val)),
      z.number().min(0).nullable().optional(),
    ),
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
    const party = searchParams.get('party');
    const settlement = searchParams.get('settlement');

    const query: Record<string, unknown> = { owner: user.id };
    
    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }
    
    if (status) {
      const statusValues = status.split(',').map(s => s.trim()).filter(Boolean);
      query.status = statusValues.length === 1 ? statusValues[0] : { $in: statusValues };
    }

    const transactionMatch: Record<string, unknown> = {};

    if (party) {
      transactionMatch.party = party;
    }

    // Overdue tab: dynamically check transactions with dueDate < today and unpaid/partial
    if (status === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Include invoices already marked overdue, plus sent invoices whose transaction is past due
      query.status = { $in: ['sent', 'overdue'] };
      transactionMatch.paymentStatus = { $in: ['unpaid', 'partial'] };
      transactionMatch.status = 'confirmed';
      transactionMatch.dueDate = { $lt: today };
    }

    if (settlement === 'open') {
      transactionMatch.paymentStatus = { $in: ['unpaid', 'partial'] };
      transactionMatch.status = 'confirmed';
      query.status = { $in: ['sent', 'overdue'] };
    }

    let invoiceQuery = Invoice.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "transactionId",
        match: Object.keys(transactionMatch).length > 0 ? transactionMatch : undefined,
        populate: { path: "party", select: "displayName name phone phoneNumber alternatePhoneNumber contactPerson.name contactPerson.phoneNumber email billingAddress" },
      });

    if (Object.keys(transactionMatch).length === 0) {
      invoiceQuery = invoiceQuery.skip((page - 1) * limit).limit(limit);
    }

    const invoices = await invoiceQuery.lean();

    const filteredInvoices =
      Object.keys(transactionMatch).length > 0
        ? invoices.filter((invoice) => invoice.transactionId)
        : invoices;

    const total =
      Object.keys(transactionMatch).length > 0
        ? filteredInvoices.length
        : await Invoice.countDocuments(query);

    return NextResponse.json({
      data: filteredInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    // Safe HTTP status code handling with proper validation and clamping
    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
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
    const { user, features } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    // Check monthly transaction limit (invoices count as transactions)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthTransactionCount = await Transaction.countDocuments({
      owner: user.id,
      createdAt: { $gte: currentMonthStart },
    });
    if (currentMonthTransactionCount >= features.maxMonthlyTransactions) {
      throw new AppError(
        `You've reached the maximum limit of ${features.maxMonthlyTransactions} transactions/invoices this month on your plan. Please upgrade to continue.`,
        403
      );
    }

    // Require an active shop for creating invoices
    if (!user.activeShopId) {
      throw new AppError('Please select or create a shop before creating invoices', 400);
    }

    const body = await request.json();
    const validated = createInvoiceSchema.parse(body);

    // Load draft prefix from settings for draft documents
    let draftPrefix: string | undefined;
    if (validated.status === 'draft') {
      const db = mongoose.connection.db;
      const settingsDoc = db
        ? await db.collection('settings').findOne({
            owner: new mongoose.Types.ObjectId(user.id),
            shopId: user.activeShopId
              ? new mongoose.Types.ObjectId(user.activeShopId)
              : null,
          })
        : null;
      draftPrefix = (settingsDoc?.billing as { draftPrefix?: string })?.draftPrefix;
    }

    const invoiceNumber = validated.status === 'draft'
      ? generateDraftNumber('INV', draftPrefix)
      : await buildFinalInvoiceNumber(user.id, user.activeShopId);
    const transactionNumber = validated.status === 'draft'
      ? generateDraftNumber('SALE', draftPrefix)
      : await buildFinalSaleTransactionNumber(user.id, user.activeShopId);

    // First create transaction
    const [transaction] = await Transaction.create([{
      type: "sale",
      ...validated,
      owner: user.id,
      transactionNumber,
      createdBy: user.id,
      updatedBy: user.id,
      metadata: {
        draftMode: validated.status === 'draft' ? 'classic' : 'posted',
        draftInventoryReserved: false,
      },
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
      sentAt: validated.status === "confirmed" ? new Date() : null,
      createdBy: user.id,
      updatedBy: user.id,
    }], { session });

    // Validate line item quantities against item units
    const lineItemsToCheck = validated.lineItems.filter((li) => li.item);
    if (lineItemsToCheck.length > 0) {
      const itemIds = lineItemsToCheck.map((li) => li.item!);
      const dbItems = await Item.find({
        _id: { $in: itemIds },
        owner: user.id,
      }).session(session).lean();

      for (const lineItem of lineItemsToCheck) {
        const dbItem = dbItems.find((i) => i._id.toString() === lineItem.item);
        if (dbItem) {
          const unit = (dbItem as any).unitOfMeasure || 'pcs';
          const error = validateQuantityForUnit(
            lineItem.quantity,
            unit,
            lineItem.itemName,
          );
          if (error) {
            throw new AppError(error, 400);
          }
        }
      }
    }

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

    // Compute grand total and update party balance for confirmed invoices
    if (validated.status === "confirmed") {
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      for (const item of validated.lineItems) {
        const lineSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
        subtotal += lineSubtotal;
        discountTotal += Number(item.discountAmount || 0);
        const taxableAmount = lineSubtotal - Number(item.discountAmount || 0);
        taxTotal += taxableAmount * (Number(item.taxRate || 0) / 100);
      }
      const grandTotal = roundCurrency(subtotal - discountTotal + taxTotal + (validated.summary.roundOff || 0));
      const paidAmount = validated.summary.paidAmount ?? 0;

      // Check credit limit
      if (validated.party && grandTotal > 0) {
        const party = await Party.findOne({
          _id: validated.party,
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

        // Update party balance
        const delta = getBalanceDelta("sale", grandTotal, paidAmount);
        await updatePartyBalance(validated.party, delta, user.id, session);
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

  } catch (error: unknown) {
    await session.abortTransaction();

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }

    // Safe HTTP status code handling with proper validation and clamping
    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}

export async function handleGenerateInvoice(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
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

    const invoiceNumber = await buildFinalInvoiceNumber(user.id, user.activeShopId);

    const settingsCollection = mongoose.connection.db?.collection('settings');
    const settingsDoc = settingsCollection
      ? await settingsCollection.findOne({
          owner: new mongoose.Types.ObjectId(user.id),
          shopId: user.activeShopId ? new mongoose.Types.ObjectId(user.activeShopId) : null,
        })
      : null;
    const billing = settingsDoc?.billing as { termsAndConditions?: string | null } | undefined;
    const defaultTerms = billing?.termsAndConditions || null;

    // Create invoice record
    const [invoice] = await Invoice.create([{
      transactionId: transaction._id,
      owner: user.id,
      shopId: user.activeShopId ?? null,
      invoiceNumber,
      dueDate: transaction.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      termsAndConditions: defaultTerms,
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

  } catch (error: unknown) {
    await session.abortTransaction();
    
    // Safe HTTP status code handling with proper validation and clamping
    const status = getSafeStatus(error);
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate invoice' },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}
