import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('sales-returns')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, type: 'sale-return', status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    const returns = await Transaction.find(match)
      .populate('party', 'displayName phoneNumber')
      .select('transactionNumber transactionDate lineItems summary.grandTotal summary.paidAmount party notes')
      .sort({ transactionDate: -1 })
      .lean();

    // Summary stats
    const totalReturns = returns.length;
    const totalReturnAmount = returns.reduce((sum: number, r: any) => sum + (r.summary?.grandTotal || 0), 0);
    const totalRefunded = returns.reduce((sum: number, r: any) => sum + (r.summary?.paidAmount || 0), 0);
    const outstandingRefunds = roundCurrency(totalReturnAmount - totalRefunded);

    return NextResponse.json({
      returns: returns.map((r: any) => ({
        _id: r._id,
        transactionNumber: r.transactionNumber,
        transactionDate: r.transactionDate,
        party: r.party || null,
        items: r.lineItems?.map((li: any) => ({
          name: li.itemName,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          lineTotal: li.lineTotal,
        })) || [],
        grandTotal: r.summary?.grandTotal || 0,
        refunded: r.summary?.paidAmount || 0,
        notes: r.notes,
      })),
      summary: {
        totalReturns,
        totalReturnAmount: roundCurrency(totalReturnAmount),
        totalRefunded: roundCurrency(totalRefunded),
        outstandingRefunds,
      },
    });
  } catch (error) {
    console.error('Sales returns report error:', error);
    return NextResponse.json({ error: 'Failed to load sales returns report' }, { status: 500 });
  }
}
