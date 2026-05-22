import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import Invoice from '@/models/Invoice';
import Party from '@/models/Party';
import Item from '@/models/Item';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const baseMatch: any = { owner: ownerId, status: 'confirmed' };
    if (shopId) baseMatch.shopId = shopId;

    const dateMatch: any = { ...baseMatch };
    if (startDate || endDate) {
      dateMatch.transactionDate = {};
      if (startDate) dateMatch.transactionDate.$gte = new Date(startDate);
      if (endDate) dateMatch.transactionDate.$lte = new Date(endDate);
    }

    // Sales & Purchases aggregated in one query
    const transactionAgg = await Transaction.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$summary.grandTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    const salesData = transactionAgg.find((t: any) => t._id === 'sale');
    const purchaseData = transactionAgg.find((t: any) => t._id === 'purchase');
    const totalSales = salesData?.total || 0;
    const totalPurchases = purchaseData?.total || 0;
    const salesCount = salesData?.count || 0;
    const purchasesCount = purchaseData?.count || 0;

    // Net profit: sales - purchases (simplified)
    const netProfit = roundCurrency(totalSales - totalPurchases);

    // Invoice stats
    const invoiceMatch: any = { owner: ownerId };
    if (shopId) invoiceMatch.shopId = shopId;
    if (startDate || endDate) {
      invoiceMatch.createdAt = {};
      if (startDate) invoiceMatch.createdAt.$gte = new Date(startDate);
      if (endDate) invoiceMatch.createdAt.$lte = new Date(endDate);
    }

    const invoiceAgg = await Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const pendingInvoices = invoiceAgg.find((i: any) => i._id === 'sent')?.count || 0;
    const paidInvoices = invoiceAgg.find((i: any) => i._id === 'paid')?.count || 0;
    const overdueInvoices = invoiceAgg.find((i: any) => i._id === 'overdue')?.count || 0;
    const draftInvoices = invoiceAgg.find((i: any) => i._id === 'draft')?.count || 0;

    // Overdue invoice total amount — join with transactions
    const overdueInvoiceAmounts = await Invoice.aggregate([
      { $match: { ...invoiceMatch, status: 'overdue' } },
      {
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      },
      { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: '$transaction.summary.dueAmount' },
        },
      },
    ]);

    const totalOverdueAmount = overdueInvoiceAmounts[0]?.totalOverdue || 0;

    // Party stats
    const partyMatch: any = { owner: ownerId, isArchived: false };
    if (shopId) partyMatch.shopId = shopId;

    const partyAgg = await Party.aggregate([
      { $match: partyMatch },
      {
        $group: {
          _id: '$partyType',
          count: { $sum: 1 },
          totalBalance: { $sum: '$currentBalance' },
        },
      },
    ]);

    const customers = partyAgg.find((p: any) => p._id === 'customer');
    const suppliers = partyAgg.find((p: any) => p._id === 'supplier');

    // Total receivables (positive balance = customer owes you) from customers
    // Current balance > 0 means party owes you (receivable), < 0 means you owe them (payable)
    const receivableParties = await Party.aggregate([
      {
        $match: {
          ...partyMatch,
          partyType: { $in: ['customer', 'both'] },
          currentBalance: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]);
    const payableParties = await Party.aggregate([
      {
        $match: {
          ...partyMatch,
          partyType: { $in: ['supplier', 'both'] },
          currentBalance: { $lt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]);

    const totalReceivables = receivableParties[0]?.total || 0;
    const totalPayables = Math.abs(payableParties[0]?.total || 0);

    // Low stock items count — uses countDocuments (regular find), so string IDs work fine
    const itemMatch: any = { owner: user.id, trackInventory: true };
    if (shopIdParam) itemMatch.shopId = shopIdParam;
    const lowStockItems = await Item.countDocuments({
      ...itemMatch,
      $expr: {
        $and: [
          { $gt: ['$stock.currentQuantity', 0] },
          { $lte: ['$stock.currentQuantity', '$stock.reorderLevel'] },
        ],
      },
    });
    const outOfStockItems = await Item.countDocuments({
      ...itemMatch,
      'stock.currentQuantity': { $lte: 0 },
    });

    return NextResponse.json({
      sales: { total: totalSales, count: salesCount },
      purchases: { total: totalPurchases, count: purchasesCount },
      netProfit,
      invoices: {
        draft: draftInvoices,
        sent: pendingInvoices,
        paid: paidInvoices,
        overdue: overdueInvoices,
        totalOverdueAmount: roundCurrency(totalOverdueAmount),
      },
      parties: {
        customers: customers?.count || 0,
        suppliers: suppliers?.count || 0,
        both: 0,
        totalReceivables: roundCurrency(totalReceivables),
        totalPayables: roundCurrency(totalPayables),
      },
      inventory: {
        lowStock: lowStockItems,
        outOfStock: outOfStockItems,
      },
    });
  } catch (error) {
    console.error('Snapshot report error:', error);
    return NextResponse.json({ error: 'Failed to load snapshot' }, { status: 500 });
  }
}