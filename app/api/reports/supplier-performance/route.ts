import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import StockMovement from '@/models/StockMovement';
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

    // Get all suppliers
    const supplierMatch: any = {
      owner: ownerId,
      isArchived: false,
      partyType: { $in: ['supplier', 'both'] },
    };
    if (shopId) supplierMatch.shopId = shopId;

    const suppliers = await Party.find(supplierMatch)
      .select('displayName phoneNumber currentBalance')
      .lean();

    const txMatch: any = { owner: ownerId, type: 'purchase', status: 'confirmed' };
    if (shopId) txMatch.shopId = shopId;
    if (startDate || endDate) {
      txMatch.transactionDate = {};
      if (startDate) txMatch.transactionDate.$gte = new Date(startDate);
      if (endDate) txMatch.transactionDate.$lte = new Date(endDate);
    }

    const performance = await Promise.all(
      suppliers.map(async (supplier) => {
        // Get all purchase transactions for this supplier
        const purchases = await Transaction.find({
          ...txMatch,
          party: supplier._id,
        })
          .select('transactionDate createdAt lineItems summary.grandTotal')
          .sort({ createdAt: 1 })
          .lean();

        if (purchases.length === 0) {
          return {
            _id: supplier._id,
            displayName: supplier.displayName,
            phoneNumber: supplier.phoneNumber,
            currentBalance: Math.abs(supplier.currentBalance),
            totalOrders: 0,
            totalAmount: 0,
            avgLeadTime: 0,
            onTimeDeliveries: 0,
            lateDeliveries: 0,
            itemsOrdered: 0,
            performance: 'N/A',
          };
        }

        // Calculate lead times (days between creation and transaction date)
        let totalLeadDays = 0;
        let onTimeCount = 0;
        let lateCount = 0;
        let totalItemsOrdered = 0;

        for (const p of purchases) {
          const created = new Date((p as any).createdAt);
          const received = new Date(p.transactionDate);
          const diffDays = Math.max(0, Math.floor((received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
          totalLeadDays += diffDays;

          // Assume > 7 days lead time is "late" (configurable threshold)
          if (diffDays <= 7) onTimeCount++;
          else lateCount++;

          totalItemsOrdered += (p.lineItems || []).reduce((sum: number, li: any) => sum + (li.quantity || 0), 0);
        }

        const avgLeadTime = purchases.length > 0 ? roundCurrency(totalLeadDays / purchases.length) : 0;
        const totalAmount = purchases.reduce((sum: number, p: any) => sum + (p.summary?.grandTotal || 0), 0);
        const performanceScore = lateCount > 0
          ? roundCurrency((onTimeCount / purchases.length) * 100)
          : 100;

        return {
          _id: supplier._id,
          displayName: supplier.displayName,
          phoneNumber: supplier.phoneNumber,
          currentBalance: roundCurrency(Math.abs(supplier.currentBalance)),
          totalOrders: purchases.length,
          totalAmount: roundCurrency(totalAmount),
          avgLeadTime: `${avgLeadTime} days`,
          onTimeDeliveries: onTimeCount,
          lateDeliveries: lateCount,
          itemsOrdered: totalItemsOrdered,
          performance: `${performanceScore}%`,
        };
      })
    );

    // Sort by performance (best first)
    const sorted = performance
      .filter(p => p.totalOrders > 0)
      .sort((a, b) => {
        const aScore = parseInt(a.performance);
        const bScore = parseInt(b.performance);
        return bScore - aScore;
      });

    return NextResponse.json({
      suppliers: sorted,
      summary: {
        totalSuppliers: sorted.length,
        totalOrders: sorted.reduce((s: number, p: any) => s + p.totalOrders, 0),
        totalAmount: roundCurrency(sorted.reduce((s: number, p: any) => s + p.totalAmount, 0)),
        avgOverallLeadTime: sorted.length > 0
          ? roundCurrency(sorted.reduce((s: number, p: any) => s + parseFloat(p.avgLeadTime), 0) / sorted.length)
          : 0,
        onTimeRate: sorted.length > 0
          ? roundCurrency(
              sorted.reduce((s: number, p: any) => s + p.onTimeDeliveries, 0) /
              sorted.reduce((s: number, p: any) => s + p.totalOrders, 0) * 100
            )
          : 0,
      },
    });
  } catch (error) {
    console.error('Supplier performance report error:', error);
    return NextResponse.json({ error: 'Failed to load supplier performance report' }, { status: 500 });
  }
}