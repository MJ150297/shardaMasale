import { NextResponse } from 'next/server';
import { requireBusinessUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Party from '@/models/Party';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId') || user.activeShopId;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const partyType = searchParams.get('partyType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Filter parties by created-at date range
    const match: any = { owner: user.id, isArchived: false };
    if (shopId) match.shopId = shopId;
    if (partyType && partyType !== 'all') match.partyType = partyType;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Get total count for pagination
    const total = await Party.countDocuments(match);

    // Get parties within the date range with their balances (paginated)
    const parties = await Party.find(match)
      .select('displayName partyType status currentBalance creditLimit phoneNumber email')
      .sort({ displayName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get transaction volume per party (no date filter — shows lifetime volume for these parties)
    // Using .find() instead of .aggregate() because Mongoose global plugins (like shopId scoping)
    // do NOT apply to aggregation pipelines, which can cause incorrect data.
    const txMatch: any = { owner: user.id, status: 'confirmed' };
    if (shopId) txMatch.shopId = shopId;
    if (parties.length > 0) {
      txMatch.party = { $in: parties.map(p => p._id) };
    }

    const transactions = await Transaction.find(txMatch)
      .select('type summary.grandTotal party')
      .lean();

    // Group by party manually
    const volumeMap = new Map<string, { totalSales: number; totalPurchases: number; transactionCount: number }>();
    for (const tx of transactions) {
      const partyId = tx.party?.toString();
      if (!partyId) continue;
      const entry = volumeMap.get(partyId) || { totalSales: 0, totalPurchases: 0, transactionCount: 0 };
      if (tx.type === 'sale') entry.totalSales += (tx.summary?.grandTotal || 0);
      if (tx.type === 'purchase') entry.totalPurchases += (tx.summary?.grandTotal || 0);
      entry.transactionCount++;
      volumeMap.set(partyId, entry);
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

    // Calculate totals across all matched parties for summary (use aggregation for accuracy)
    const [summaryResult] = await Party.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalParties: { $sum: 1 },
          customers: {
            $sum: {
              $cond: [{ $in: ['$partyType', ['customer', 'both']] }, 1, 0],
            },
          },
          suppliers: {
            $sum: {
              $cond: [{ $in: ['$partyType', ['supplier', 'both']] }, 1, 0],
            },
          },
          totalReceivables: { $sum: { $max: ['$currentBalance', 0] } },
          totalPayables: { $sum: { $abs: { $min: ['$currentBalance', 0] } } },
        },
      },
    ]);

    // Build summary
    let totalSalesAll = 0;
    let totalPurchasesAll = 0;
    for (const p of partiesWithVolume) {
      totalSalesAll += p.totalSales;
      totalPurchasesAll += p.totalPurchases;
    }

    const summary = summaryResult
      ? {
          totalParties: summaryResult.totalParties,
          customers: summaryResult.customers,
          suppliers: summaryResult.suppliers,
          totalReceivables: roundCurrency(summaryResult.totalReceivables),
          totalPayables: roundCurrency(summaryResult.totalPayables),
          totalSales: roundCurrency(totalSalesAll),
          totalPurchases: roundCurrency(totalPurchasesAll),
        }
      : {
          totalParties: 0,
          customers: 0,
          suppliers: 0,
          totalReceivables: 0,
          totalPayables: 0,
          totalSales: 0,
          totalPurchases: 0,
        };

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      parties: partiesWithVolume,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Party report error:', error);
    return NextResponse.json({ error: 'Failed to load party report' }, { status: 500 });
  }
}