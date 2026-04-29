import { requireCustomer } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Item from '@/models/Item';
import CustomerDashboardClient from './customer-dashboard-client';

export default async function CustomerDashboardPage() {
  const user = await requireCustomer();
  
  await connectToDatabase();
  
  const featuredItems = await Item.find({ 
    owner: user.belongsTo,
    status: 'active',
  })
    .limit(6)
    .sort({ createdAt: -1 })
    .lean();

  const serializedItems = featuredItems.map(item => ({
    ...item,
    _id: item._id.toString(),
  }));

  return <CustomerDashboardClient items={serializedItems} userName={user.name} />;
}