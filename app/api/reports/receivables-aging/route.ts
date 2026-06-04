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
    if (!features.advancedReports || !isAdvancedReport('receivables-aging')) {
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

    // Get customers with positive current balance (they owe you)
    const customerMatch: any = {
      owner: ownerId,
      isArchived: false,
      partyType: { $in: ['customer', 'both'] },
      currentBalance: { $gt: 0 },
    };
    if (shopId) customerMatch.shopId = shopId;

    const customers = await Party.find(customerMatch)
      .select('displayName phoneNumber currentBalance creditLimit')
      .sort({ currentBalance: -1 })
      .lean();

    const agingBuckets = [
      { label: '0-30 days', min: 0, max: 30, total: 0 },
      { label: '31-60 days', min: 31, max: 60, total: 0 },
      { label: '61-90 days', min: 61, max: 90, total: 0 },
      { label: '90+ days', min: 91, max: Infinity, total: 0 },
    ];

    const customerAging = await Promise.all(
      customers.map(async (customer) => {
        const txMatch: any = {
          owner: ownerId,
          party: customer._id,
          type: 'sale',
          status: 'confirmed',
          'summary.dueAmount': { $gt: 0 },
        };
        if (shopId) txMatch.shopId = shopId;

        const sales = await Transaction.find(txMatch)
          .select('transactionDate dueDate summary.dueAmount summary.grandTotal')
          .sort({ transactionDate: -1 })
          .lean();

        const buckets = agingBuckets.map(b => ({ ...b, total: 0 }));
        let totalDue = 0;

        for (const s of sales) {
          const dueDate = s.dueDate || s.transactionDate;
          const daysOverdue = Math.floor((asOfDate.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
          const amount = s.summary?.dueAmount || 0;
          totalDue += amount;

          let bucketed = false;
          for (const bucket of buckets) {
            if (daysOverdue >= bucket.min && daysOverdue <= bucket.max) {
              bucket.total += amount;
              bucketed = true;
              break;
            }
          }
          if (!bucketed) {
            buckets[0].total += amount;
          }
        }

        return {
          _id: customer._id,
          displayName: customer.displayName,
          phoneNumber: customer.phoneNumber,
          currentBalance: customer.currentBalance,
          creditLimit: customer.creditLimit,
          totalDue: roundCurrency(totalDue),
          buckets: buckets.map(b => ({ ...b, total: roundCurrency(b.total) })),
        };
      })
    );

    const bucketTotals = agingBuckets.map(b => ({ label: b.label, total: 0 }));
    let grandTotalDue = 0;
    for (const c of customerAging) {
      grandTotalDue += c.totalDue;
      for (let i = 0; i < bucketTotals.length; i++) {
        bucketTotals[i].total += c.buckets[i].total;
      }
    }

    return NextResponse.json({
      customers: customerAging.sort((a, b) => b.totalDue - a.totalDue),
      agingBuckets: bucketTotals.map(b => ({ ...b, total: roundCurrency(b.total) })),
      totals: {
        totalCustomers: customerAging.length,
        grandTotalDue: roundCurrency(grandTotalDue),
        creditUtilization: customers.length > 0
          ? roundCurrency(
              customers.reduce((s, c) => s + c.currentBalance, 0) /
              Math.max(customers.reduce((s, c) => s + (c.creditLimit || 1), 0), 1) * 100
            )
          : 0,
      },
    });
  } catch (error) {
    console.error('Receivables aging report error:', error);
    return NextResponse.json({ error: 'Failed to load receivables aging report' }, { status: 500 });
  }
}
