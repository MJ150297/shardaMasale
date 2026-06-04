import { NextResponse } from 'next/server';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Item from '@/models/Item';
import StockMovement from '@/models/StockMovement';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('stock-aging')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    const query: any = { owner: user.id, trackInventory: true, itemType: 'product' };
    if (shopId) query.shopId = shopId;

    const items = await Item.find(query)
      .select('name sku category stock.currentQuantity stock.reorderLevel pricing.costPrice pricing.sellingPrice')
      .lean();

    const now = new Date();
    const agingBuckets = [
      { label: '0-30 days', min: 0, max: 30 },
      { label: '31-60 days', min: 31, max: 60 },
      { label: '61-90 days', min: 61, max: 90 },
      { label: '91-180 days', min: 91, max: 180 },
      { label: '180+ days', min: 181, max: Infinity },
    ];

    const bucketMap = new Map<string, { count: number; totalQty: number; totalValue: number; items: any[] }>();
    for (const b of agingBuckets) {
      bucketMap.set(b.label, { count: 0, totalQty: 0, totalValue: 0, items: [] });
    }

    const itemsWithAging = await Promise.all(
      items.map(async (item) => {
        // Find the last IN movement for this item
        const lastInMovement = await StockMovement.findOne({
          item: item._id,
          type: { $in: ['IN', 'RETURN_IN'] },
        })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .lean();

        const lastReceivedDate = (lastInMovement as any)?.createdAt || (item as any).createdAt || now;
        const daysInStock = Math.floor((now.getTime() - new Date(lastReceivedDate).getTime()) / (1000 * 60 * 60 * 24));
        const stockValue = roundCurrency(item.stock.currentQuantity * item.pricing.costPrice);

        // Determine bucket
        let bucketLabel = '180+ days';
        for (const b of agingBuckets) {
          if (daysInStock >= b.min && daysInStock <= b.max) {
            bucketLabel = b.label;
            break;
          }
        }

        const agingInfo = {
          _id: item._id.toString(),
          name: item.name,
          sku: item.sku || 'N/A',
          category: item.category || 'Uncategorized',
          currentQuantity: item.stock.currentQuantity,
          reorderLevel: item.stock.reorderLevel,
          costPrice: item.pricing.costPrice,
          sellingPrice: item.pricing.sellingPrice,
          stockValue,
          daysInStock,
          lastReceivedDate,
          bucket: bucketLabel,
        };

        const bucket = bucketMap.get(bucketLabel);
        if (bucket) {
          bucket.count += 1;
          bucket.totalQty += item.stock.currentQuantity;
          bucket.totalValue += stockValue;
          bucket.items.push(agingInfo);
        }

        return agingInfo;
      })
    );

    const agingSummary = Array.from(bucketMap.values()).map(b => ({
      ...b,
      totalValue: roundCurrency(b.totalValue),
    }));

    // Slow-moving: items aged 90+ days
    const slowMovingItems = itemsWithAging.filter(i => i.daysInStock >= 90);

    return NextResponse.json({
      items: itemsWithAging.sort((a, b) => b.daysInStock - a.daysInStock),
      agingSummary,
      slowMovingItems: slowMovingItems.sort((a, b) => b.daysInStock - a.daysInStock),
      totals: {
        totalItems: items.length,
        totalStockValue: roundCurrency(itemsWithAging.reduce((s, i) => s + i.stockValue, 0)),
        slowMovingCount: slowMovingItems.length,
        slowMovingValue: roundCurrency(slowMovingItems.reduce((s, i) => s + i.stockValue, 0)),
      },
    });
  } catch (error) {
    console.error('Stock aging report error:', error);
    return NextResponse.json({ error: 'Failed to load stock aging report' }, { status: 500 });
  }
}
