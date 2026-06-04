import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import Item from '@/models/Item';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('balance-sheet')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const asOfDate = searchParams.get('asOfDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const dateFilter: any = {};
    if (asOfDate) {
      dateFilter.$lte = new Date(asOfDate);
    }

    // ===================== ASSETS =====================

    // 1. Current Assets: Cash in hand/bank
    // Sum of paid amounts from sales minus purchases (simplified cash position)
    const cashMatch: any = { owner: ownerId, status: 'confirmed' };
    if (shopId) cashMatch.shopId = shopId;

    const cashInflow = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'sale' } },
      { $group: { _id: null, total: { $sum: '$summary.paidAmount' } } },
    ]);
    const cashOutflow = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'purchase' } },
      { $group: { _id: null, total: { $sum: '$summary.paidAmount' } } },
    ]);

    const cashInBank = roundCurrency(
      (cashInflow[0]?.total || 0) - (cashOutflow[0]?.total || 0)
    );

    // Also include payment-in transactions (loans, investments, etc.)
    const otherInflow = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'payment-in' } },
      { $group: { _id: null, total: { $sum: '$summary.grandTotal' } } },
    ]);
    const otherOutflow = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'payment-out' } },
      { $group: { _id: null, total: { $sum: '$summary.grandTotal' } } },
    ]);

    const totalCash = roundCurrency(
      cashInBank +
      (otherInflow[0]?.total || 0) -
      (otherOutflow[0]?.total || 0)
    );

    // 2. Accounts Receivable (what customers owe)
    const receivableMatch: any = {
      owner: ownerId,
      isArchived: false,
      partyType: { $in: ['customer', 'both'] },
      currentBalance: { $gt: 0 },
    };
    if (shopId) receivableMatch.shopId = shopId;

    const receivablesAgg = await Party.aggregate([
      { $match: receivableMatch },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]);
    const accountsReceivable = roundCurrency(receivablesAgg[0]?.total || 0);

    // Also include due amounts from unpaid invoices
    const dueInvoices = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'sale', 'summary.dueAmount': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$summary.dueAmount' } } },
    ]);
    const invoiceReceivables = roundCurrency(dueInvoices[0]?.total || 0);

    // Use the larger of party balance vs invoice dues for receivables
    const totalReceivables = roundCurrency(
      Math.max(accountsReceivable, invoiceReceivables)
    );

    // 3. Inventory Value (current stock at cost price)
    const itemMatch: any = { owner: user.id, trackInventory: true };
    if (shopIdParam) itemMatch.shopId = shopIdParam;

    const inventoryItems = await Item.find(itemMatch)
      .select('stock.currentQuantity pricing.costPrice pricing.sellingPrice')
      .lean();

    const inventoryValue = roundCurrency(
      inventoryItems.reduce(
        (sum, item) => sum + (item.stock.currentQuantity * item.pricing.costPrice),
        0
      )
    );
    const inventorySellValue = roundCurrency(
      inventoryItems.reduce(
        (sum, item) => sum + (item.stock.currentQuantity * item.pricing.sellingPrice),
        0
      )
    );

    // Total Assets
    const totalAssets = roundCurrency(totalCash + totalReceivables + inventoryValue);

    // ===================== LIABILITIES =====================

    // 1. Accounts Payable (what you owe suppliers)
    const payableMatch: any = {
      owner: ownerId,
      isArchived: false,
      partyType: { $in: ['supplier', 'both'] },
      currentBalance: { $lt: 0 },
    };
    if (shopId) payableMatch.shopId = shopId;

    const payablesAgg = await Party.aggregate([
      { $match: payableMatch },
      { $group: { _id: null, total: { $sum: '$currentBalance' } } },
    ]);
    const accountsPayable = roundCurrency(Math.abs(payablesAgg[0]?.total || 0));

    // 2. Unpaid purchase dues
    const purchaseDues = await Transaction.aggregate([
      { $match: { ...cashMatch, type: 'purchase', 'summary.dueAmount': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$summary.dueAmount' } } },
    ]);
    const totalLiabilities = roundCurrency(
      accountsPayable + (purchaseDues[0]?.total || 0)
    );

    // ===================== EQUITY =====================
    // Equity = Total Assets - Total Liabilities (accounting equation)
    const equity = roundCurrency(totalAssets - totalLiabilities);

    // ===================== BREAKDOWNS =====================

    const cashBreakdown = {
      cashInBank: roundCurrency(cashInBank),
      otherInflows: roundCurrency(otherInflow[0]?.total || 0),
      otherOutflows: roundCurrency(otherOutflow[0]?.total || 0),
      totalCash,
    };

    const assetBreakdown = {
      cashAndBank: totalCash,
      accountsReceivable: totalReceivables,
      inventory: { costValue: inventoryValue, sellValue: inventorySellValue },
      totalAssets,
    };

    const liabilityBreakdown = {
      accountsPayable,
      unpaidPurchases: roundCurrency(purchaseDues[0]?.total || 0),
      totalLiabilities,
    };

    return NextResponse.json({
      asOn: asOfDate || new Date().toISOString(),
      assets: assetBreakdown,
      liabilities: liabilityBreakdown,
      equity,
      cashBreakdown,
      summary: {
        totalAssets,
        totalLiabilities,
        equity,
        debtToEquity: totalLiabilities > 0
          ? (totalLiabilities / (equity || 1)).toFixed(2)
          : '0.00',
        currentRatio: totalLiabilities > 0
          ? (totalCash / totalLiabilities).toFixed(2)
          : 'N/A',
      },
    });
  } catch (error) {
    console.error('Balance sheet error:', error);
    return NextResponse.json({ error: 'Failed to load balance sheet' }, { status: 500 });
  }
}
