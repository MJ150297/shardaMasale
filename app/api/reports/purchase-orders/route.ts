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
    const status = searchParams.get('status');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, type: 'purchase' };
    if (shopId) match.shopId = shopId;
    if (status && status !== 'all') match.status = status;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    const purchases = await Transaction.find(match)
      .populate('party', 'displayName phoneNumber')
      .select('transactionNumber transactionDate status paymentStatus lineItems summary.grandTotal summary.paidAmount summary.dueAmount party')
      .sort({ transactionDate: -1 })
      .lean();

    const orders = purchases.map((p: any) => ({
      _id: p._id,
      orderNumber: p.transactionNumber,
      date: p.transactionDate,
      supplier: p.party || null,
      status: p.status,
      paymentStatus: p.paymentStatus,
      items: p.lineItems?.map((li: any) => ({
        name: li.itemName,
        sku: li.sku,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        lineTotal: li.lineTotal,
      })) || [],
      totalAmount: p.summary?.grandTotal || 0,
      paidAmount: p.summary?.paidAmount || 0,
      dueAmount: p.summary?.dueAmount || 0,
    }));

    const statusCounts = { draft: 0, confirmed: 0, cancelled: 0 };
    const paymentStatusCounts: Record<string, number> = {};
    
    for (const o of orders) {
      if (o.status in statusCounts) (statusCounts as any)[o.status] += 1;
      paymentStatusCounts[o.paymentStatus] = (paymentStatusCounts[o.paymentStatus] || 0) + 1;
    }

    const totals = {
      totalOrders: orders.length,
      totalAmount: roundCurrency(orders.reduce((s: number, o: any) => s + o.totalAmount, 0)),
      totalPaid: roundCurrency(orders.reduce((s: number, o: any) => s + o.paidAmount, 0)),
      totalDue: roundCurrency(orders.reduce((s: number, o: any) => s + o.dueAmount, 0)),
      statusCounts,
      paymentStatusCounts,
    };

    return NextResponse.json({ orders, totals });
  } catch (error) {
    console.error('Purchase orders report error:', error);
    return NextResponse.json({ error: 'Failed to load purchase orders report' }, { status: 500 });
  }
}