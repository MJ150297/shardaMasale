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
    if (!features.advancedReports || !isAdvancedReport('sales-by-item')) {
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
    const category = searchParams.get('category');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, type: 'sale', status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    // Unwind line items and group by item
    const salesByItem = await Transaction.aggregate([
      { $match: match },
      { $unwind: '$lineItems' },
      {
        $lookup: {
          from: 'items',
          localField: 'lineItems.item',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            itemId: '$lineItems.item',
            itemName: '$lineItems.itemName',
            sku: '$lineItems.sku',
            category: { $ifNull: ['$itemDetails.category', 'Uncategorized'] },
          },
          unitsSold: { $sum: '$lineItems.quantity' },
          revenue: { $sum: '$lineItems.lineTotal' },
          discountGiven: { $sum: '$lineItems.discountAmount' },
          costOfGoods: { $sum: { $multiply: ['$lineItems.quantity', { $ifNull: ['$lineItems.costPrice', 0] }] } },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Group by category
    const categoryMap = new Map<string, {
      category: string;
      totalRevenue: number;
      totalCost: number;
      unitsSold: number;
      itemCount: number;
    }>();

    const itemsWithProfit = salesByItem.map((item: any) => {
      const profit = roundCurrency(item.revenue - item.costOfGoods);
      const margin = item.revenue > 0 ? ((profit / item.revenue) * 100).toFixed(1) : '0.0';

      const cat = item._id.category || 'Uncategorized';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, totalRevenue: 0, totalCost: 0, unitsSold: 0, itemCount: 0 });
      }
      const entry = categoryMap.get(cat)!;
      entry.totalRevenue += item.revenue;
      entry.totalCost += item.costOfGoods;
      entry.unitsSold += item.unitsSold;
      entry.itemCount += 1;

      return {
        itemId: item._id.itemId,
        itemName: item._id.itemName,
        sku: item._id.sku || 'N/A',
        category: cat,
        unitsSold: item.unitsSold,
        revenue: roundCurrency(item.revenue),
        discountGiven: roundCurrency(item.discountGiven),
        costOfGoods: roundCurrency(item.costOfGoods),
        profit,
        margin: `${margin}%`,
        transactionCount: item.transactionCount,
      };
    });

    const categorySummary = Array.from(categoryMap.values()).map(c => ({
      ...c,
      totalRevenue: roundCurrency(c.totalRevenue),
      totalCost: roundCurrency(c.totalCost),
      profit: roundCurrency(c.totalRevenue - c.totalCost),
      margin: c.totalRevenue > 0 ? `${((c.totalRevenue - c.totalCost) / c.totalRevenue * 100).toFixed(1)}%` : '0.0%',
    }));

    // Totals
    const totals = {
      totalRevenue: roundCurrency(itemsWithProfit.reduce((s: number, i: any) => s + i.revenue, 0)),
      totalCost: roundCurrency(itemsWithProfit.reduce((s: number, i: any) => s + i.costOfGoods, 0)),
      totalProfit: roundCurrency(itemsWithProfit.reduce((s: number, i: any) => s + i.profit, 0)),
      totalUnits: itemsWithProfit.reduce((s: number, i: any) => s + i.unitsSold, 0),
      totalTransactions: itemsWithProfit.reduce((s: number, i: any) => s + i.transactionCount, 0),
    };

    // Filter by category if specified
    const filteredItems = category
      ? itemsWithProfit.filter((i: any) => i.category === category)
      : itemsWithProfit;

    return NextResponse.json({
      items: filteredItems,
      categorySummary,
      totals,
      categories: categorySummary.map((c: any) => c.category),
    });
  } catch (error) {
    console.error('Sales by item report error:', error);
    return NextResponse.json({ error: 'Failed to load sales by item report' }, { status: 500 });
  }
}
