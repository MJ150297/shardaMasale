import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Invoice from '@/models/Invoice';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId };
    if (shopId) match.shopId = shopId;
    if (status && status !== 'all') match.status = status;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Get invoices with linked transaction data
    const invoices = await Invoice.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      },
      { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'parties',
          localField: 'transaction.party',
          foreignField: '_id',
          as: 'party',
        },
      },
      { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          invoiceNumber: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1,
          paidAt: 1,
          'transaction.summary.grandTotal': 1,
          'transaction.summary.paidAmount': 1,
          'transaction.summary.dueAmount': 1,
          'party.displayName': 1,
          'party.phoneNumber': 1,
        },
      },
    ]);

    // Summary stats — use same ownerId for aggregation
    const statsMatch: any = { owner: ownerId };
    if (shopId) statsMatch.shopId = shopId;
    if (startDate || endDate) {
      statsMatch.createdAt = {};
      if (startDate) statsMatch.createdAt.$gte = new Date(startDate);
      if (endDate) statsMatch.createdAt.$lte = new Date(endDate);
    }

    const invoiceStats = await Invoice.aggregate([
      { $match: statsMatch },
      {
        $lookup: {
          from: 'transactions',
          localField: 'transactionId',
          foreignField: '_id',
          as: 'transaction',
        },
      },
      { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$transaction.summary.grandTotal' },
          totalDue: { $sum: '$transaction.summary.dueAmount' },
        },
      },
    ]);

    const totalInvoices = invoices.length;
    const totalAmount = invoiceStats.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
    const totalDue = invoiceStats.reduce((sum: number, s: any) => sum + (s.totalDue || 0), 0);

    const paidStats = invoiceStats.find((s: any) => s._id === 'paid');
    const overdueStats = invoiceStats.find((s: any) => s._id === 'overdue');

    return NextResponse.json({
      invoices,
      summary: {
        totalInvoices,
        totalAmount: roundCurrency(totalAmount),
        totalDue: roundCurrency(totalDue),
        paidCount: paidStats?.count || 0,
        paidAmount: roundCurrency(paidStats?.totalAmount || 0),
        overdueCount: overdueStats?.count || 0,
        overdueAmount: roundCurrency(overdueStats?.totalAmount || 0),
      },
    });
  } catch (error) {
    console.error('Invoice report error:', error);
    return NextResponse.json({ error: 'Failed to load invoice report' }, { status: 500 });
  }
}