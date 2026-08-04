import { requireUser } from '@/lib/auth';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import Item from '@/models/Item';
import Transaction from '@/models/Transaction';
import Settings from '@/models/Settings';
import DashboardClient from './dashboard-client';
import { getPartyId, getPartyName, getPartyPhone, getInvoiceId, type PartyLike } from '@/lib/party-helpers';
import type { ShareBusinessProfile, ShareMessageTemplates } from '@/lib/share-messages';

interface RecentTransactionRecord {
  _id: string | { toString(): string };
  transactionNumber: string;
  type: string;
  party?: PartyLike | string | null;
  invoiceId?: string | { _id?: string | { toString(): string }; id?: string | null } | null;
  summary: {
    grandTotal: number;
  };
  paymentStatus: string;
  transactionDate: string | Date;
  createdAt: string | Date;
}

export default async function DashboardPage() {
  const user = await requireUser();
  await dbConnect();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Common shop filter for multi-tenant queries
  const ownerId = new mongoose.Types.ObjectId(user.id);
  const shopFilter = user.activeShopId
    ? { shopId: new mongoose.Types.ObjectId(user.activeShopId) }
    : {};

  // Fetch shop name from settings (business profile legal name) with cascading fallback
  let shopSettings = await Settings.findOne({
    owner: user.id,
    ...(user.activeShopId ? { shopId: user.activeShopId } : { shopId: null }),
  })
    .select('business billing.footerText billing.shareMessageTemplates')
    .lean();

  // Cascading fallback: if shop-level settings not found, try owner-level
  if (!shopSettings && user.activeShopId) {
    shopSettings = await Settings.findOne({
      owner: user.id,
      shopId: null,
    })
      .select('business billing.footerText billing.shareMessageTemplates')
      .lean();
  }

  const shopBusiness = (shopSettings as {
    business?: ShareBusinessProfile;
    billing?: { footerText?: string | null; shareMessageTemplates?: ShareMessageTemplates | null };
  } | null)?.business;
  const shopName = shopBusiness?.displayName || shopBusiness?.legalName || 'Sharda Masale Shop Management System';
  const businessProfile: ShareBusinessProfile | null = shopBusiness
    ? {
        ...shopBusiness,
        footerText: (shopSettings as { billing?: { footerText?: string | null } } | null)?.billing?.footerText ?? null,
      }
    : null;
  const shareMessageTemplates = (shopSettings as {
    billing?: { shareMessageTemplates?: ShareMessageTemplates | null };
  } | null)?.billing?.shareMessageTemplates ?? null;

  // Run all queries in parallel
  const [
    totalItems,
    lowStockCount,
    todayTransactions,
    todayRevenue,
    dueTodayResult,
    overdueResult,
    outstandingResult,
    monthlySalesResult,
    lastMonthSalesResult,
  ] = await Promise.all([
    // Total active items
    Item.countDocuments({ owner: user.id, status: 'active' }),
    
    // Low stock items
    Item.countDocuments({
      owner: user.id,
      status: 'active',
      trackInventory: true,
      $expr: { $lte: ["$stock.currentQuantity", "$stock.reorderLevel"] }
    }),
    
    // Today transactions count
    Transaction.countDocuments({
      owner: ownerId,
      ...shopFilter,
      createdAt: { $gte: todayStart }
    }),
    
    // Today revenue (sum of sales)
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          type: 'sale',
          status: 'confirmed',
          createdAt: { $gte: todayStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$summary.grandTotal" }
        }
      }
    ]),

    // Due Today: transactions with dueDate today and unpaid/partial status
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          status: 'confirmed',
          dueDate: { $gte: todayStart, $lte: todayEnd },
          paymentStatus: { $in: ['unpaid', 'partial'] },
        }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalDue: { $sum: '$summary.dueAmount' },
        }
      }
    ]),

    // Overdue: transactions past due date with unpaid/partial status
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          status: 'confirmed',
          dueDate: { $lt: todayStart, $ne: null },
          paymentStatus: { $in: ['unpaid', 'partial'] },
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalDue: { $sum: '$summary.dueAmount' },
        }
      }
    ]),

    // Outstanding Dues: all unpaid/partial transactions
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          status: 'confirmed',
          paymentStatus: { $in: ['unpaid', 'partial'] },
          'summary.dueAmount': { $gt: 0 },
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalDue: { $sum: '$summary.dueAmount' },
        }
      }
    ]),

    // This month's sales
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          type: 'sale',
          status: 'confirmed',
          transactionDate: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.grandTotal' },
        }
      }
    ]),

    // Last month's sales (for comparison)
    Transaction.aggregate([
      {
        $match: {
          owner: ownerId,
          ...shopFilter,
          type: 'sale',
          status: 'confirmed',
          transactionDate: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.grandTotal' },
        }
      }
    ]),
  ]);

  const revenueAmount = todayRevenue[0]?.total || 0;

  // Process due today stats
  const dueTodayStats = { unpaid: 0, partial: 0, total: 0, totalDue: 0 };
  for (const entry of dueTodayResult) {
    if (entry._id === 'unpaid') dueTodayStats.unpaid = entry.count;
    if (entry._id === 'partial') dueTodayStats.partial = entry.count;
    dueTodayStats.totalDue += entry.totalDue || 0;
  }
  dueTodayStats.total = dueTodayStats.unpaid + dueTodayStats.partial;

  // Process overdue stats
  const overdueStats = {
    count: overdueResult[0]?.count || 0,
    totalDue: overdueResult[0]?.totalDue || 0,
  };

  // Process outstanding dues stats
  const outstandingStats = {
    count: outstandingResult[0]?.count || 0,
    totalDue: outstandingResult[0]?.totalDue || 0,
  };

  // Process monthly sales
  const thisMonthSales = monthlySalesResult[0]?.total || 0;
  const lastMonthSales = lastMonthSalesResult[0]?.total || 0;

  // Fetch actual low stock items
  const lowStockItems = await Item.find({
    owner: user.id,
    status: 'active',
    trackInventory: true,
    $expr: { $lte: ["$stock.currentQuantity", "$stock.reorderLevel"] }
  })
  .select('name sku stock.currentQuantity stock.reorderLevel')
  .limit(10)
  .lean();

  // Fetch recent transactions
  const recentTransactions = await Transaction.find({
    owner: user.id,
    status: 'confirmed',
    ...(user.activeShopId ? { shopId: user.activeShopId } : {}),
  })
  .sort({ createdAt: -1 })
  .limit(4)
  .populate('party', 'displayName name phoneNumber alternatePhoneNumber phone contactPerson.phoneNumber contactPerson.name')
  .select('transactionNumber party invoiceId summary.grandTotal paymentStatus createdAt type transactionDate')
  .lean();

  // Convert ObjectId to string for client serialization
  const serializedLowStockItems = lowStockItems.map(item => ({
    ...item,
    _id: item._id.toString()
  }));

  const serializedRecentTransactions = (recentTransactions as unknown as RecentTransactionRecord[]).map((tx) => ({
    transactionId: typeof tx._id === 'string' ? tx._id : tx._id.toString(),
    id: tx.transactionNumber,
    type: tx.type,
    customer: getPartyName(tx.party, 'Cash Sale'),
    partyId: getPartyId(tx.party),
    invoiceId: getInvoiceId(tx.invoiceId),
    customerPhone: getPartyPhone(tx.party),
    amount: `₹ ${tx.summary.grandTotal.toLocaleString('en-IN')}`,
    paymentStatus: tx.paymentStatus,
    date: new Date(tx.transactionDate).toLocaleDateString('en-IN'),
    dateIso: new Date(tx.transactionDate).toISOString(),
    time: new Date(tx.createdAt).toLocaleString()
  }));

  return (
    <DashboardClient 
      userName={user.name}
      shopName={shopName}
      businessProfile={businessProfile}
      shareMessageTemplates={shareMessageTemplates}
      stats={{
        totalItems,
        lowStockCount,
        todayTransactions,
        todayRevenue: revenueAmount,
      }}
      dueToday={dueTodayStats}
      overdue={overdueStats}
      outstanding={outstandingStats}
      monthlySales={thisMonthSales}
      lastMonthSales={lastMonthSales}
      lowStockItems={serializedLowStockItems}
      recentTransactions={serializedRecentTransactions}
    />
  );
}
