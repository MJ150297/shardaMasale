import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'daily';

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    // Get all confirmed transactions for cash flow analysis
    const transactions = await Transaction.find(match)
      .select('type transactionDate summary.paidAmount summary.grandTotal payment.method')
      .sort({ transactionDate: 1 })
      .lean();

    // Group by period and classify cash flows
    const periodMap = new Map<string, {
      date: string;
      operatingIn: number;
      operatingOut: number;
      sales: number;
      purchases: number;
      salesReturns: number;
      purchaseReturns: number;
      paymentIn: number;
      paymentOut: number;
      cashIn: { cash: number; card: number; upi: number; bankTransfer: number; cheque: number; other: number };
      netCashFlow: number;
    }>();

    for (const tx of transactions) {
      const d = new Date(tx.transactionDate);
      let key: string;
      switch (period) {
        case 'weekly': {
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'monthly':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = `${d.getFullYear()}`;
          break;
        default:
          key = d.toISOString().split('T')[0];
      }

      if (!periodMap.has(key)) {
        periodMap.set(key, {
          date: key,
          operatingIn: 0,
          operatingOut: 0,
          sales: 0,
          purchases: 0,
          salesReturns: 0,
          purchaseReturns: 0,
          paymentIn: 0,
          paymentOut: 0,
          cashIn: { cash: 0, card: 0, upi: 0, bankTransfer: 0, cheque: 0, other: 0 },
          netCashFlow: 0,
        });
      }

      const entry = periodMap.get(key)!;
      const amount = tx.summary.paidAmount || tx.summary.grandTotal || 0;
      const method = (tx.payment as any)?.method || 'other';

      switch (tx.type) {
        case 'sale':
          entry.operatingIn += amount;
          entry.sales += amount;
          // Track payment method
          if (method in entry.cashIn) {
            (entry.cashIn as any)[method] += amount;
          } else {
            entry.cashIn.other += amount;
          }
          break;
        case 'purchase':
          entry.operatingOut += amount;
          entry.purchases += amount;
          break;
        case 'sale-return':
          entry.operatingOut += amount;
          entry.salesReturns += amount;
          break;
        case 'purchase-return':
          entry.operatingIn += amount;
          entry.purchaseReturns += amount;
          break;
        case 'payment-in':
          entry.paymentIn += amount;
          break;
        case 'payment-out':
          entry.paymentOut += amount;
          break;
      }

      entry.netCashFlow = roundCurrency(
        entry.operatingIn + entry.paymentIn - entry.operatingOut - entry.paymentOut
      );
    }

    // Calculate totals
    const summary = Array.from(periodMap.values());
    const totals = summary.reduce(
      (acc, p) => ({
        totalOperatingIn: acc.totalOperatingIn + p.operatingIn,
        totalOperatingOut: acc.totalOperatingOut + p.operatingOut,
        totalPaymentIn: acc.totalPaymentIn + p.paymentIn,
        totalPaymentOut: acc.totalPaymentOut + p.paymentOut,
        netCashFlow: acc.netCashFlow + p.netCashFlow,
      }),
      { totalOperatingIn: 0, totalOperatingOut: 0, totalPaymentIn: 0, totalPaymentOut: 0, netCashFlow: 0 }
    );

    return NextResponse.json({
      summary,
      totals: {
        ...totals,
        totalOperatingIn: roundCurrency(totals.totalOperatingIn),
        totalOperatingOut: roundCurrency(totals.totalOperatingOut),
        totalPaymentIn: roundCurrency(totals.totalPaymentIn),
        totalPaymentOut: roundCurrency(totals.totalPaymentOut),
        netCashFlow: roundCurrency(totals.netCashFlow),
      },
    });
  } catch (error) {
    console.error('Cash flow report error:', error);
    return NextResponse.json({ error: 'Failed to load cash flow report' }, { status: 500 });
  }
}