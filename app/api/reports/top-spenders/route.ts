import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('top-spenders')) {
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'totalSpent'; // totalSpent, frequency, avgOrder

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, type: 'sale', status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    // Aggregate sales by party
    const customerSales = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$party',
          totalSpent: { $sum: '$summary.grandTotal' },
          transactionCount: { $sum: 1 },
          firstPurchase: { $min: '$transactionDate' },
          lastPurchase: { $max: '$transactionDate' },
          totalItems: { $sum: { $sum: '$lineItems.quantity' } },
        },
      },
      {
        $lookup: {
          from: 'parties',
          localField: '_id',
          foreignField: '_id',
          as: 'party',
        },
      },
      { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'party.partyType': { $in: ['customer', 'both'] } },
            { party: { $exists: false } },
          ],
        },
      },
    ]);

    // Build customer list with derived metrics
    const now = new Date();
    const customers = customerSales
      .filter((c: any) => c._id) // Must have a party
      .map((c: any) => {
        const totalSpent = c.totalSpent || 0;
        const frequency = c.transactionCount || 0;
        const avgOrderValue = frequency > 0 ? roundCurrency(totalSpent / frequency) : 0;
        const lastDate = c.lastPurchase ? new Date(c.lastPurchase) : null;
        const daysSinceLastPurchase = lastDate
          ? Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Loyalty tier based on total spent
        let tier = 'Bronze';
        if (totalSpent >= 100000) tier = 'Platinum';
        else if (totalSpent >= 50000) tier = 'Gold';
        else if (totalSpent >= 10000) tier = 'Silver';

        return {
          _id: c._id,
          displayName: c.party?.displayName || 'Unknown',
          phoneNumber: c.party?.phoneNumber || '',
          partyType: c.party?.partyType || 'customer',
          totalSpent: roundCurrency(totalSpent),
          transactionCount: frequency,
          avgOrderValue,
          totalItems: c.totalItems || 0,
          firstPurchase: c.firstPurchase,
          lastPurchase: c.lastPurchase,
          daysSinceLastPurchase,
          loyaltyTier: tier,
          isActive: daysSinceLastPurchase <= 90,
        };
      });

    // Sort
    const sorted = customers.sort((a: any, b: any) => {
      if (sortBy === 'frequency') return b.transactionCount - a.transactionCount;
      if (sortBy === 'avgOrder') return b.avgOrderValue - a.avgOrderValue;
      return b.totalSpent - a.totalSpent;
    });

    const topCustomers = sorted.slice(0, limit);

    // Loyalty tier distribution
    const tierDistribution = {
      Platinum: customers.filter((c: any) => c.loyaltyTier === 'Platinum').length,
      Gold: customers.filter((c: any) => c.loyaltyTier === 'Gold').length,
      Silver: customers.filter((c: any) => c.loyaltyTier === 'Silver').length,
      Bronze: customers.filter((c: any) => c.loyaltyTier === 'Bronze').length,
    };

    return NextResponse.json({
      customers: topCustomers,
      summary: {
        totalCustomers: customers.length,
        totalRevenue: roundCurrency(customers.reduce((s: number, c: any) => s + c.totalSpent, 0)),
        avgCustomerValue: customers.length > 0
          ? roundCurrency(customers.reduce((s: number, c: any) => s + c.totalSpent, 0) / customers.length)
          : 0,
        totalTransactions: customers.reduce((s: number, c: any) => s + c.transactionCount, 0),
        activeCustomers: customers.filter((c: any) => c.isActive).length,
        tierDistribution,
      },
      sortBy,
    });
  } catch (error) {
    console.error('Top spenders report error:', error);
    return NextResponse.json({ error: 'Failed to load top spenders report' }, { status: 500 });
  }
}
