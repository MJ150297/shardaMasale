import { requireUser } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Item from '@/models/Item';
import Transaction from '@/models/Transaction';
import DashboardClient from './dashboard-client';
import { getPartyId, getPartyName, getPartyPhone, type PartyLike } from '@/lib/party-helpers';

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

function getInvoiceId(
  invoice?: string | { _id?: string | { toString(): string }; id?: string | null } | null,
): string | null {
  if (!invoice) {
    return null;
  }

  if (typeof invoice === 'string') {
    return invoice;
  }

  const invoiceId = invoice._id ?? invoice.id;

  if (!invoiceId) {
    return null;
  }

  return typeof invoiceId === 'string' ? invoiceId : invoiceId.toString();
}

export default async function DashboardPage() {
  const user = await requireUser();
  await dbConnect();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Run all queries in parallel
  const [
    totalItems,
    lowStockCount,
    todayTransactions,
    todayRevenue
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
      owner: user.id,
      createdAt: { $gte: todayStart }
    }),
    
    // Today revenue (sum of sales)
    Transaction.aggregate([
      {
        $match: {
          owner: user.id,
          type: 'sale',
          status: 'confirmed',
          createdAt: { $gte: todayStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$summary.totalAmount" }
        }
      }
    ])
  ]);

  const revenueAmount = todayRevenue[0]?.total || 0;

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
      stats={{
        totalItems,
        lowStockCount,
        todayTransactions,
        todayRevenue: revenueAmount
      }}
      lowStockItems={serializedLowStockItems}
      recentTransactions={serializedRecentTransactions}
    />
  );
}
