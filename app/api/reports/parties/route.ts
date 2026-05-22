import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const partyType = searchParams.get('partyType');

    const match: any = { owner: user.id, isArchived: false };
    if (shopId) match.shopId = shopId;
    if (partyType && partyType !== 'all') match.partyType = partyType;

    // Get all parties with their balances
    const parties = await Party.find(match)
      .select('displayName partyType status currentBalance creditLimit phoneNumber email')
      .sort({ displayName: 1 })
      .lean();

    // Get transaction volume per party (within date range if specified)
    const txMatch: any = { owner: user.id, status: 'confirmed' };
    if (shopId) txMatch.shopId = shopId;
    if (startDate || endDate) {
      txMatch.transactionDate = {};
      if (startDate) txMatch.transactionDate.$gte = new Date(startDate);
      if (endDate) txMatch.transactionDate.$lte = new Date(endDate);
    }

    const transactionVolumes = await Transaction.aggregate([
      { $match: txMatch },
      {
        $group: {
          _id: '$party',
          totalSales: {
            $sum: {
              $cond: [{ $eq: ['$type', 'sale'] }, '$summary.grandTotal', 0],
            },
          },
          totalPurchases: {
            $sum: {
              $cond: [{ $eq: ['$type', 'purchase'] }, '$summary.grandTotal', 0],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const volumeMap = new Map<string, { totalSales: number; totalPurchases: number; transactionCount: number }>();
    for (const v of transactionVolumes) {
      if (v._id) {
        volumeMap.set(v._id.toString(), {
          totalSales: v.totalSales || 0,
          totalPurchases: v.totalPurchases || 0,
          transactionCount: v.transactionCount || 0,
        });
      }
    }

    // Merge transaction volumes into parties
    const partiesWithVolume = parties.map((party) => {
      const partyId = party._id.toString();
      const volume = volumeMap.get(partyId) || { totalSales: 0, totalPurchases: 0, transactionCount: 0 };
      return {
        _id: party._id,
        displayName: party.displayName,
        partyType: party.partyType,
        status: party.status,
        currentBalance: party.currentBalance,
        creditLimit: party.creditLimit,
        phoneNumber: party.phoneNumber,
        email: party.email,
        totalSales: volume.totalSales,
        totalPurchases: volume.totalPurchases,
        transactionCount: volume.transactionCount,
      };
    });

    // Summary stats
    let totalReceivables = 0;
    let totalPayables = 0;
    let totalSalesAll = 0;
    let totalPurchasesAll = 0;

    for (const p of partiesWithVolume) {
      if (p.currentBalance > 0) totalReceivables += p.currentBalance;
      else totalPayables += Math.abs(p.currentBalance);
      totalSalesAll += p.totalSales;
      totalPurchasesAll += p.totalPurchases;
    }

    const customerCount = partiesWithVolume.filter((p) => p.partyType === 'customer' || p.partyType === 'both').length;
    const supplierCount = partiesWithVolume.filter((p) => p.partyType === 'supplier' || p.partyType === 'both').length;

    return NextResponse.json({
      parties: partiesWithVolume,
      summary: {
        totalParties: partiesWithVolume.length,
        customers: customerCount,
        suppliers: supplierCount,
        totalReceivables: roundCurrency(totalReceivables),
        totalPayables: roundCurrency(totalPayables),
        totalSales: roundCurrency(totalSalesAll),
        totalPurchases: roundCurrency(totalPurchasesAll),
      },
    });
  } catch (error) {
    console.error('Party report error:', error);
    return NextResponse.json({ error: 'Failed to load party report' }, { status: 500 });
  }
}