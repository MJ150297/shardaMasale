import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: any = { owner: user.id };
    
    if (shopId) query.shop = shopId;
    if (type && type !== 'all') query.type = type;
    if (status && status !== 'all') query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('party', 'displayName')
      .lean();

    // Calculate totals
    const totals = transactions.reduce((acc, t) => {
      if (t.type === 'sale') {
        acc.totalSales += t.summary.grandTotal || 0;
        acc.salesCount += 1;
      } else if (t.type === 'purchase') {
        acc.totalPurchases += t.summary.grandTotal || 0;
        acc.purchasesCount += 1;
      }
      acc.totalAmount += t.summary.grandTotal || 0;
      return acc;
    }, {
      totalSales: 0,
      totalPurchases: 0,
      salesCount: 0,
      purchasesCount: 0,
      totalAmount: 0
    });

    return NextResponse.json({
      transactions,
      totals
    });

  } catch (error) {
    console.error('Transaction report error:', error);
    return NextResponse.json({ error: 'Failed to load transaction report' }, { status: 500 });
  }
}
