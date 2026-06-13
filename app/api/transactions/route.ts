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
import {
  applyConfirmedTransactionInventory,
} from '@/lib/transaction-inventory';
import { getBalanceDelta, updatePartyBalance } from '@/lib/party-balance';
import { getNextCounterSequence } from '@/lib/document-numbering';
import Item from '@/models/Item';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';
import { allocateInvoiceSettlements } from '@/lib/payment-settlement';
import { validateQuantityForUnit } from '@/lib/unit-utils';

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

const transactionTypesThatRequireParty = [
  'sale',
  'purchase',
  'sale-return',
  'purchase-return',
  'payment-in',
  'payment-out',
] as const;

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
  additionalCharges: z.array(z.object({
    name: z.string().min(1, "Charge name is required"),
    amount: z.coerce.number().min(0, "Amount must be positive"),
  })).default([]),
  summary: z.object({
    roundOff: z.coerce.number().default(0),
    grandTotal: z.coerce.number().min(0).optional(),
    paidAmount: z.coerce.number().min(0).default(0),
    totalDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
    totalDiscountValue: z.coerce.number().min(0).optional().nullable(),
  }).default(() => ({ roundOff: 0, paidAmount: 0 })),
  payment: z.object({
    method: z.enum(["cash", "card", "upi", "bank-transfer", "cheque", "other"]).optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).optional().nullable(),
  appliedInvoiceIds: z.array(z.string()).default([]),
  appliedTransactionIds: z.array(z.string()).default([]),
  paymentDiscountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "confirmed", "cancelled"]).default("draft"),
}).superRefine((value, ctx) => {
  const requiresParty = transactionTypesThatRequireParty.includes(
    value.type as (typeof transactionTypesThatRequireParty)[number],
  );

  if (requiresParty && (!value.party || value.party.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['party'],
      message: 'Party is required',
    });
  }
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
    const settlement = searchParams.get('settlement');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: Record<string, unknown> = { owner: user.id };
    
    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }
    
    if (type) query.type = type;
    if (status) {
      // Support comma-separated status values (e.g. "confirmed,draft")
      const statusValues = status.split(',').map(s => s.trim()).filter(Boolean);
      query.status = statusValues.length === 1 ? statusValues[0] : { $in: statusValues };
    }
    if (party) query.party = party;
    if (settlement === 'open') {
      query.status = 'confirmed';
      query.paymentStatus = { $in: ['unpaid', 'partial'] };
    }
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
      .populate('party', 'displayName name phoneNumber alternatePhoneNumber phone contactPerson.phoneNumber contactPerson.name email')
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
  } catch (error: unknown) {
    console.error('Error fetching transactions:', error);
    // Safe HTTP status code handling with proper validation and clamping
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error
        ? Number((error as { status?: number }).status) || 500
        : 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: validStatus },
    );
  }
}

export async function POST(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user, features } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const body = await request.json();
    const validated = createTransactionSchema.parse(body);
    const {
      appliedInvoiceIds,
      appliedTransactionIds,
      paymentDiscountAmount,
      ...transactionInput
    } = validated;

    // Check monthly transaction limit
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthTransactionCount = await Transaction.countDocuments({
      owner: user.id,
      createdAt: { $gte: currentMonthStart },
    });
    if (currentMonthTransactionCount >= features.maxMonthlyTransactions) {
      throw new AppError(
        `You've reached the maximum limit of ${features.maxMonthlyTransactions} transactions this month on your plan. Please upgrade to continue.`,
        403
      );
    }

    // Require an active shop for creating transactions
    if (!user.activeShopId) {
      throw new AppError('Please select or create a shop before creating transactions', 400);
    }

    // Validate line item quantities against item units
    const lineItemsToCheck = transactionInput.lineItems.filter((li: any) => li.item);
    if (lineItemsToCheck.length > 0) {
      const itemIds = lineItemsToCheck.map((li: any) => li.item);
      const dbItems = await Item.find({
        _id: { $in: itemIds },
        owner: user.id,
      }).lean();

      for (const lineItem of lineItemsToCheck) {
        const dbItem = dbItems.find((i: any) => i._id.toString() === lineItem.item);
        if (dbItem) {
          const unit = dbItem.unitOfMeasure || 'pcs';
          const error = validateQuantityForUnit(
            lineItem.quantity,
            unit,
            dbItem.name,
          );
          if (error) {
            throw new AppError(error, 400);
          }
        }
      }
    }

    const cashAmount = roundCurrency(
      transactionInput.summary.paidAmount ?? transactionInput.summary.grandTotal ?? 0,
    );
    const discountAmount = roundCurrency(paymentDiscountAmount);

    if (transactionInput.type === "payment-in") {
      if (cashAmount <= 0 && discountAmount <= 0) {
        throw new AppError("Enter a payment amount or discount to continue", 400);
      }

      if (discountAmount > 0 && appliedInvoiceIds.length === 0) {
        throw new AppError("Select at least one invoice before applying a discount", 400);
      }

      if (appliedInvoiceIds.length > 0 && !transactionInput.party) {
        throw new AppError("Select a customer before applying payment to invoices", 400);
      }

      if (
        transactionInput.status !== "confirmed" &&
        (appliedInvoiceIds.length > 0 || discountAmount > 0)
      ) {
        throw new AppError(
          "Invoice-linked payment settlements must be confirmed directly",
          400,
        );
      }
    } else if (transactionInput.type === "payment-out") {
      if (cashAmount <= 0) {
        throw new AppError("Enter a payment amount to continue", 400);
      }

      if (discountAmount > 0) {
        throw new AppError("Supplier payment settlements do not support discounts yet", 400);
      }

      if (appliedTransactionIds.length > 0 && !transactionInput.party) {
        throw new AppError("Select a supplier before applying payment to purchases", 400);
      }

      if (
        transactionInput.status !== "confirmed" &&
        appliedTransactionIds.length > 0
      ) {
        throw new AppError(
          "Purchase-linked payment settlements must be confirmed directly",
          400,
        );
      }
    }

    // Load draft prefix from settings for draft documents
    let draftPrefix: string | undefined;
    if (transactionInput.status === 'draft') {
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

    const transactionNumber = transactionInput.status === 'draft'
      ? generateDraftNumber(`TXN-${transactionInput.type}`, draftPrefix)
      : await buildFinalTransactionNumber({
          ownerId: user.id,
          shopId: user.activeShopId ?? null,
          transactionType: transactionInput.type,
        });

    let settlementMetadata: Record<string, unknown> = {};
    const invoicesToUpdate = new Map<
      string,
      {
        invoice: InstanceType<typeof Invoice>;
        transaction: InstanceType<typeof Transaction>;
      }
    >();
    const purchaseTransactionsToUpdate = new Map<
      string,
      InstanceType<typeof Transaction>
    >();

    if (
      transactionInput.type === "payment-in" &&
      transactionInput.status === "confirmed" &&
      appliedInvoiceIds.length > 0
    ) {
      const invoices = await Invoice.find({
        _id: { $in: appliedInvoiceIds },
        owner: user.id,
        ...(user.activeShopId ? { shopId: user.activeShopId } : {}),
        status: { $in: ["sent", "overdue"] },
      }).session(session);

      if (invoices.length === 0) {
        throw new AppError("No open invoices found for the selected customer", 404);
      }

      const relatedTransactions = await Transaction.find({
        _id: { $in: invoices.map((invoice) => invoice.transactionId) },
        owner: user.id,
        party: transactionInput.party,
        status: "confirmed",
        paymentStatus: { $in: ["unpaid", "partial"] },
      }).session(session);

      const transactionsById = new Map(
        relatedTransactions.map((transaction) => [
          transaction._id.toString(),
          transaction,
        ]),
      );

      const openInvoices = invoices
        .map((invoice) => {
          const linkedTransaction = transactionsById.get(
            invoice.transactionId.toString(),
          );

          if (!linkedTransaction) {
            return null;
          }

          return {
            invoice,
            transaction: linkedTransaction,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            invoice: InstanceType<typeof Invoice>;
            transaction: InstanceType<typeof Transaction>;
          } => entry !== null,
        )
        .sort((left, right) => {
          const leftTime = new Date(
            left.invoice.dueDate || left.transaction.transactionDate,
          ).getTime();
          const rightTime = new Date(
            right.invoice.dueDate || right.transaction.transactionDate,
          ).getTime();

          return leftTime - rightTime;
        });

      if (openInvoices.length === 0) {
        throw new AppError(
          "The selected invoices are not open for this customer anymore",
          400,
        );
      }

      const settlementResult = allocateInvoiceSettlements(
        openInvoices.map(({ invoice, transaction }) => ({
          invoiceId: invoice._id.toString(),
          dueAmount: transaction.summary.dueAmount,
        })),
        cashAmount,
        discountAmount,
      );

      const appliedSettlements = settlementResult.allocations.filter(
        (allocation) => allocation.settledAmount > 0,
      );

      if (appliedSettlements.length === 0) {
        throw new AppError(
          "The entered amount and discount do not settle any selected invoice",
          400,
        );
      }

      for (const entry of openInvoices) {
        invoicesToUpdate.set(entry.invoice._id.toString(), entry);
      }

      settlementMetadata = {
        settlementCashAmount: cashAmount,
        settlementDiscountAmount: settlementResult.totalDiscountAmount,
        settlementTotalAmount: settlementResult.totalSettledAmount,
        unappliedCashAmount: settlementResult.remainingCashAmount,
        unappliedDiscountAmount: settlementResult.remainingDiscountAmount,
        invoiceSettlements: appliedSettlements.map((allocation) => {
          const matchedInvoice = invoicesToUpdate.get(allocation.invoiceId);

          return {
            invoiceId: allocation.invoiceId,
            invoiceNumber: matchedInvoice?.invoice.invoiceNumber ?? null,
            transactionId: matchedInvoice?.transaction._id.toString() ?? null,
            transactionNumber:
              matchedInvoice?.transaction.transactionNumber ?? null,
            appliedAmount: allocation.appliedAmount,
            discountAmount: allocation.discountAmount,
            settledAmount: allocation.settledAmount,
            remainingDueAmount: allocation.remainingDueAmount,
          };
        }),
      };
    }

    if (
      transactionInput.type === "payment-out" &&
      transactionInput.status === "confirmed" &&
      appliedTransactionIds.length > 0
    ) {
      const openPurchaseTransactions = await Transaction.find({
        _id: { $in: appliedTransactionIds },
        owner: user.id,
        ...(user.activeShopId ? { shopId: user.activeShopId } : {}),
        type: "purchase",
        party: transactionInput.party,
        status: "confirmed",
        paymentStatus: { $in: ["unpaid", "partial"] },
      })
        .sort({ dueDate: 1, transactionDate: 1, createdAt: 1 })
        .session(session);

      if (openPurchaseTransactions.length === 0) {
        throw new AppError("No open purchases found for the selected supplier", 404);
      }

      const settlementResult = allocateInvoiceSettlements(
        openPurchaseTransactions.map((purchaseTransaction) => ({
          invoiceId: purchaseTransaction._id.toString(),
          dueAmount: purchaseTransaction.summary.dueAmount,
        })),
        cashAmount,
        0,
      );

      const appliedSettlements = settlementResult.allocations.filter(
        (allocation) => allocation.settledAmount > 0,
      );

      if (appliedSettlements.length === 0) {
        throw new AppError(
          "The entered amount does not settle any selected purchase",
          400,
        );
      }

      for (const purchaseTransaction of openPurchaseTransactions) {
        purchaseTransactionsToUpdate.set(
          purchaseTransaction._id.toString(),
          purchaseTransaction,
        );
      }

      settlementMetadata = {
        settlementCashAmount: cashAmount,
        settlementDiscountAmount: 0,
        settlementTotalAmount: settlementResult.totalSettledAmount,
        unappliedCashAmount: settlementResult.remainingCashAmount,
        unappliedDiscountAmount: 0,
        purchaseSettlements: appliedSettlements.map((allocation) => {
          const matchedTransaction = purchaseTransactionsToUpdate.get(
            allocation.invoiceId,
          );

          return {
            transactionId: allocation.invoiceId,
            transactionNumber: matchedTransaction?.transactionNumber ?? null,
            appliedAmount: allocation.appliedAmount,
            discountAmount: 0,
            settledAmount: allocation.settledAmount,
            remainingDueAmount: allocation.remainingDueAmount,
          };
        }),
      };
    }

    // Compute grand total if not provided
    const grandTotal = transactionInput.summary.grandTotal ?? (() => {
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      for (const item of transactionInput.lineItems) {
        const lineSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
        subtotal += lineSubtotal;
        discountTotal += Number(item.discountAmount || 0);
        const taxableAmount = lineSubtotal - Number(item.discountAmount || 0);
        taxTotal += taxableAmount * (Number(item.taxRate || 0) / 100);
      }

      // Compute total discount (percentage or fixed)
      const totalDiscountType = transactionInput.summary?.totalDiscountType || null;
      const totalDiscountValue = Number(transactionInput.summary?.totalDiscountValue) || 0;
      let totalDiscount = 0;
      if (totalDiscountType === "percentage") {
        totalDiscount = roundCurrency((subtotal - discountTotal) * (Math.min(totalDiscountValue, 100) / 100));
      } else if (totalDiscountType === "fixed") {
        totalDiscount = roundCurrency(Math.min(totalDiscountValue, Math.max(subtotal - discountTotal, 0)));
      }

      // Additional charges total
      const additionalChargesTotal = roundCurrency(
        (transactionInput.additionalCharges || []).reduce(
          (total, charge) => total + (Number(charge.amount) || 0),
          0,
        ),
      );

      return roundCurrency(subtotal - discountTotal - totalDiscount + taxTotal + (transactionInput.summary.roundOff || 0) + additionalChargesTotal);
    })();

    const paidAmount = transactionInput.summary.paidAmount ?? 0;

    // Check credit limit for sale and purchase-return transactions
    if (
      transactionInput.status === "confirmed" &&
      transactionInput.party &&
      (transactionInput.type === "sale" || transactionInput.type === "purchase-return") &&
      grandTotal > 0
    ) {
      const party = await Party.findOne({
        _id: transactionInput.party,
        owner: user.id,
      }).session(session);

      if (party && party.creditLimit > 0) {
        // Calculate what balance would be after this transaction
        const delta = getBalanceDelta(
          transactionInput.type,
          grandTotal,
          paidAmount,
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

    // Create transaction record inside transaction
    const [transaction] = await Transaction.create([{
      ...transactionInput,
      owner: user.id,
      shopId: user.activeShopId,
      transactionNumber,
      createdBy: user.id,
      updatedBy: user.id,
      metadata: {
        ...settlementMetadata,
        draftMode: transactionInput.status === 'draft' ? 'classic' : 'posted',
        draftInventoryReserved: false,
      },
    }], { session });

    if (transactionInput.status === "confirmed") {
      await applyConfirmedTransactionInventory(
        {
          ownerId: user.id,
          userId: user.id,
          shopId: user.activeShopId ?? null,
          session,
          transactionId: transaction._id.toString(),
          transactionNumber,
        },
        transactionInput.type,
        transactionInput.lineItems,
      );

      // Update party balance for confirmed transactions with a party
      if (transactionInput.party) {
        const delta = getBalanceDelta(transactionInput.type, grandTotal, paidAmount);
        await updatePartyBalance(transactionInput.party, delta, user.id, session);
      }
    }

    if (
      transactionInput.type === "payment-in" &&
      transactionInput.status === "confirmed" &&
      settlementMetadata.invoiceSettlements &&
      Array.isArray(settlementMetadata.invoiceSettlements)
    ) {
      for (const settlement of settlementMetadata.invoiceSettlements as Array<{
        invoiceId: string;
        settledAmount: number;
      }>) {
        const matchedEntry = invoicesToUpdate.get(settlement.invoiceId);

        if (!matchedEntry) {
          continue;
        }

        matchedEntry.transaction.summary.paidAmount = roundCurrency(
          matchedEntry.transaction.summary.paidAmount + settlement.settledAmount,
        );
        matchedEntry.transaction.updatedBy = new mongoose.Types.ObjectId(user.id);
        await matchedEntry.transaction.save({ session });

        matchedEntry.invoice.updatedBy = new mongoose.Types.ObjectId(user.id);
        if (matchedEntry.transaction.summary.dueAmount <= 0) {
          matchedEntry.invoice.status = "paid";
          matchedEntry.invoice.paidAt = transactionInput.transactionDate;
        } else {
          matchedEntry.invoice.status =
            matchedEntry.invoice.dueDate < transactionInput.transactionDate
              ? "overdue"
              : "sent";
          matchedEntry.invoice.paidAt = null;
        }
        await matchedEntry.invoice.save({ session });
      }
    }

    if (
      transactionInput.type === "payment-out" &&
      transactionInput.status === "confirmed" &&
      settlementMetadata.purchaseSettlements &&
      Array.isArray(settlementMetadata.purchaseSettlements)
    ) {
      for (const settlement of settlementMetadata.purchaseSettlements as Array<{
        transactionId: string;
        settledAmount: number;
      }>) {
        const matchedTransaction = purchaseTransactionsToUpdate.get(
          settlement.transactionId,
        );

        if (!matchedTransaction) {
          continue;
        }

        matchedTransaction.summary.paidAmount = roundCurrency(
          matchedTransaction.summary.paidAmount + settlement.settledAmount,
        );
        matchedTransaction.updatedBy = new mongoose.Types.ObjectId(user.id);
        await matchedTransaction.save({ session });
      }
    }

    await session.commitTransaction();

    return NextResponse.json({
      data: transaction,
      message: 'Transaction created successfully',
    }, { status: 201 });

  } catch (error: unknown) {
    await session.abortTransaction();

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }

    // Safe HTTP status code handling with proper validation and clamping
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error
        ? Number((error as { status?: number }).status) || 500
        : 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: validStatus },
    );
  } finally {
    session.endSession();
  }
}
