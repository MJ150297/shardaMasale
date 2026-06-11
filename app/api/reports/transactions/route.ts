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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const query: any = { owner: user.id };
    
    if (shopId) query.shopId = shopId;
    if (type && type !== 'all') query.type = type;
    if (status && status !== 'all') query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('party', 'displayName')
      .lean();

    // Calculate totals from all matching documents
    const [totalsResult] = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, '$summary.grandTotal', 0] } },
          totalPurchases: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$summary.grandTotal', 0] } },
          salesCount: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, 1, 0] } },
          purchasesCount: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, 1, 0] } },
          totalAmount: { $sum: '$summary.grandTotal' },
        },
      },
    ]);

    const totals = totalsResult || {
      totalSales: 0,
      totalPurchases: 0,
      salesCount: 0,
      purchasesCount: 0,
      totalAmount: 0,
    };

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      transactions,
      totals,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Transaction report error:', error);
    return NextResponse.json({ error: 'Failed to load transaction report' }, { status: 500 });
  }
}
