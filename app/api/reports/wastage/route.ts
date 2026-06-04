import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import StockMovement from '@/models/StockMovement';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('wastage')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const ownerId = new Types.ObjectId(user.id);

    const match: any = { owner: ownerId };
    if (shopId) match.shopId = new Types.ObjectId(shopId);
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Get all non-standard movements (ADJUST, and any with reason containing wastage/damage)
    const movements = await StockMovement.find(match)
      .sort({ createdAt: -1 })
      .populate('item', 'name sku pricing.costPrice')
      .lean();

    // Classify movements into wastage, damage, shrinkage, adjustment
    const classified = {
      wastage: { items: [] as any[], totalQty: 0, totalValue: 0 },
      damage: { items: [] as any[], totalQty: 0, totalValue: 0 },
      shrinkage: { items: [] as any[], totalQty: 0, totalValue: 0 },
      stockTake: { items: [] as any[], totalQty: 0, totalValue: 0 },
      other: { items: [] as any[], totalQty: 0, totalValue: 0 },
    };

    for (const movement of movements) {
      const reason = (movement.reason || '').toLowerCase();
      const reasonType = (movement.metadata as any)?.reason || '';
      const qty = movement.quantity;
      const unitCost = (movement.item as any)?.pricing?.costPrice || 0;
      const value = roundCurrency(qty * unitCost);

      const entry = {
        _id: movement._id,
        date: (movement as any).createdAt,
        item: movement.item,
        quantity: qty,
        value,
        reason: movement.reason || '',
        type: movement.type,
        referenceType: movement.referenceType,
      };

      if (reason.includes('wastage') || reasonType.includes('wastage') || movement.type === 'ADJUST' && (reason.includes('expire') || reason.includes('expiry'))) {
        classified.wastage.items.push(entry);
        classified.wastage.totalQty += qty;
        classified.wastage.totalValue += value;
      } else if (reason.includes('damage') || reasonType.includes('damage')) {
        classified.damage.items.push(entry);
        classified.damage.totalQty += qty;
        classified.damage.totalValue += value;
      } else if (reason.includes('shrinkage') || reasonType.includes('shrinkage') || reason.includes('theft') || reason.includes('missing')) {
        classified.shrinkage.items.push(entry);
        classified.shrinkage.totalQty += qty;
        classified.shrinkage.totalValue += value;
      } else if (movement.referenceType === 'STOCK_TAKE') {
        classified.stockTake.items.push(entry);
        classified.stockTake.totalQty += qty;
        classified.stockTake.totalValue += value;
      } else if (movement.type === 'ADJUST') {
        classified.other.items.push(entry);
        classified.other.totalQty += qty;
        classified.other.totalValue += value;
      }
    }

    // Summary
    const summary = {
      totalLossValue: roundCurrency(
        classified.wastage.totalValue + classified.damage.totalValue +
        classified.shrinkage.totalValue + classified.other.totalValue
      ),
      totalLossQty: classified.wastage.totalQty + classified.damage.totalQty +
        classified.shrinkage.totalQty + classified.other.totalQty,
      wastage: { ...classified.wastage, totalValue: roundCurrency(classified.wastage.totalValue) },
      damage: { ...classified.damage, totalValue: roundCurrency(classified.damage.totalValue) },
      shrinkage: { ...classified.shrinkage, totalValue: roundCurrency(classified.shrinkage.totalValue) },
      stockTake: { ...classified.stockTake, totalValue: roundCurrency(classified.stockTake.totalValue) },
      other: { ...classified.other, totalValue: roundCurrency(classified.other.totalValue) },
    };

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Wastage report error:', error);
    return NextResponse.json({ error: 'Failed to load wastage report' }, { status: 500 });
  }
}
