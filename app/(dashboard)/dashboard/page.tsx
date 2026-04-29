import { requireUser } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Item from '@/models/Item';
import Transaction from '@/models/Transaction';
import DashboardClient from './dashboard-client';

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

  // Convert ObjectId to string for client serialization
  const serializedLowStockItems = lowStockItems.map(item => ({
    ...item,
    _id: item._id.toString()
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
    />
  );
}
