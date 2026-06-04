import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('payables-aging')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const asOfDateParam = searchParams.get('asOfDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    // Get suppliers with negative current balance (you owe them)
    const supplierMatch: any = {
      owner: ownerId,
      isArchived: false,
      partyType: { $in: ['supplier', 'both'] },
      currentBalance: { $lt: 0 },
    };
    if (shopId) supplierMatch.shopId = shopId;

    const suppliers = await Party.find(supplierMatch)
      .select('displayName phoneNumber currentBalance creditLimit')
      .sort({ currentBalance: 1 })
      .lean();

    // For each supplier, get their purchase transactions to calculate aging
    const agingBuckets = [
      { label: '0-30 days', min: 0, max: 30, total: 0 },
      { label: '31-60 days', min: 31, max: 60, total: 0 },
      { label: '61-90 days', min: 61, max: 90, total: 0 },
      { label: '90+ days', min: 91, max: Infinity, total: 0 },
    ];

    const supplierAging = await Promise.all(
      suppliers.map(async (supplier) => {
        const txMatch: any = {
          owner: ownerId,
          party: supplier._id,
          type: 'purchase',
          status: 'confirmed',
          'summary.dueAmount': { $gt: 0 },
        };
        if (shopId) txMatch.shopId = shopId;

        const purchases = await Transaction.find(txMatch)
          .select('transactionDate summary.dueAmount summary.grandTotal')
          .sort({ transactionDate: -1 })
          .lean();

        // Bucket the dues
        const buckets = agingBuckets.map(b => ({ ...b, total: 0 }));
        let totalDue = 0;

        for (const p of purchases) {
          const dueDate = p.dueDate || p.transactionDate;
          const daysOverdue = Math.floor((asOfDate.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const amount = p.summary?.dueAmount || 0;
          totalDue += amount;

          for (const bucket of buckets) {
            if (daysOverdue >= bucket.min && daysOverdue <= bucket.max) {
              bucket.total += amount;
              break;
            }
          }
          // If not overdue yet (negative days), put in 0-30
          if (daysOverdue < 0) {
            buckets[0].total += amount;
          }
        }

        return {
          _id: supplier._id,
          displayName: supplier.displayName,
          phoneNumber: supplier.phoneNumber,
          currentBalance: Math.abs(supplier.currentBalance),
          creditLimit: supplier.creditLimit,
          totalDue: roundCurrency(totalDue),
          buckets: buckets.map(b => ({ ...b, total: roundCurrency(b.total) })),
        };
      })
    );

    // Aggregate bucket totals
    const bucketTotals = agingBuckets.map(b => ({ label: b.label, total: 0 }));
    let grandTotalDue = 0;
    for (const s of supplierAging) {
      grandTotalDue += s.totalDue;
      for (let i = 0; i < bucketTotals.length; i++) {
        bucketTotals[i].total += s.buckets[i].total;
      }
    }

    return NextResponse.json({
      suppliers: supplierAging.sort((a, b) => b.totalDue - a.totalDue),
      agingBuckets: bucketTotals.map(b => ({ ...b, total: roundCurrency(b.total) })),
      totals: {
        totalSuppliers: supplierAging.length,
        grandTotalDue: roundCurrency(grandTotalDue),
      },
    });
  } catch (error) {
    console.error('Payables aging report error:', error);
    return NextResponse.json({ error: 'Failed to load payables aging report' }, { status: 500 });
  }
}
