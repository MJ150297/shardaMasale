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

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, type: 'sale', status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    const sales = await Transaction.find(match)
      .select('transactionNumber transactionDate summary.grandTotal summary.paidAmount summary.dueAmount payment.method')
      .sort({ transactionDate: -1 })
      .lean();

    // Group by day with payment method breakdown
    const dailyMap = new Map<string, {
      date: string;
      totalSales: number;
      totalPaid: number;
      totalDue: number;
      invoiceCount: number;
      cash: number;
      card: number;
      upi: number;
      bankTransfer: number;
      cheque: number;
      other: number;
    }>();

    for (const sale of sales) {
      const d = new Date(sale.transactionDate);
      const key = d.toISOString().split('T')[0];

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: key,
          totalSales: 0,
          totalPaid: 0,
          totalDue: 0,
          invoiceCount: 0,
          cash: 0,
          card: 0,
          upi: 0,
          bankTransfer: 0,
          cheque: 0,
          other: 0,
        });
      }

      const entry = dailyMap.get(key)!;
      entry.totalSales += sale.summary.grandTotal || 0;
      entry.totalPaid += sale.summary.paidAmount || 0;
      entry.totalDue += sale.summary.dueAmount || 0;
      entry.invoiceCount += 1;

      const method = (sale.payment as any)?.method || 'other';
      const amount = sale.summary.paidAmount || 0;
      if (method === 'cash') entry.cash += amount;
      else if (method === 'card') entry.card += amount;
      else if (method === 'upi') entry.upi += amount;
      else if (method === 'bank-transfer') entry.bankTransfer += amount;
      else if (method === 'cheque') entry.cheque += amount;
      else entry.other += amount;
    }

    const dailyBreakdown = Array.from(dailyMap.values())
      .map(d => ({
        ...d,
        totalSales: roundCurrency(d.totalSales),
        totalPaid: roundCurrency(d.totalPaid),
        totalDue: roundCurrency(d.totalDue),
        cash: roundCurrency(d.cash),
        card: roundCurrency(d.card),
        upi: roundCurrency(d.upi),
        bankTransfer: roundCurrency(d.bankTransfer),
        cheque: roundCurrency(d.cheque),
        other: roundCurrency(d.other),
        avgTicketSize: d.invoiceCount > 0 ? roundCurrency(d.totalSales / d.invoiceCount) : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Grand totals
    const totals = dailyBreakdown.reduce(
      (acc, d) => ({
        totalSales: acc.totalSales + d.totalSales,
        totalPaid: acc.totalPaid + d.totalPaid,
        totalDue: acc.totalDue + d.totalDue,
        totalInvoices: acc.totalInvoices + d.invoiceCount,
        cash: acc.cash + d.cash,
        card: acc.card + d.card,
        upi: acc.upi + d.upi,
        bankTransfer: acc.bankTransfer + d.bankTransfer,
        cheque: acc.cheque + d.cheque,
        other: acc.other + d.other,
      }),
      { totalSales: 0, totalPaid: 0, totalDue: 0, totalInvoices: 0, cash: 0, card: 0, upi: 0, bankTransfer: 0, cheque: 0, other: 0 }
    );

    return NextResponse.json({
      dailyBreakdown,
      totals: {
        ...totals,
        totalSales: roundCurrency(totals.totalSales),
        totalPaid: roundCurrency(totals.totalPaid),
        totalDue: roundCurrency(totals.totalDue),
        cash: roundCurrency(totals.cash),
        card: roundCurrency(totals.card),
        upi: roundCurrency(totals.upi),
        bankTransfer: roundCurrency(totals.bankTransfer),
        cheque: roundCurrency(totals.cheque),
        other: roundCurrency(totals.other),
        avgTicketSize: totals.totalInvoices > 0 ? roundCurrency(totals.totalSales / totals.totalInvoices) : 0,
      },
    });
  } catch (error) {
    console.error('Daily sales report error:', error);
    return NextResponse.json({ error: 'Failed to load daily sales report' }, { status: 500 });
  }
}