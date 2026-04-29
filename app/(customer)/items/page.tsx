import { requireCustomer } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Item from '@/models/Item';
import ItemsBrowseClient from './items-client';

export default async function ItemsBrowsePage() {
  const user = await requireCustomer();
  
  await connectToDatabase();
  
  const items = await Item.find({ 
    owner: user.belongsTo,
    status: 'active',
  })
    .sort({ createdAt: -1 })
    .lean();

  const serializedItems = items.map(item => ({
    ...item,
    _id: item._id.toString(),
  }));

  return <ItemsBrowseClient items={serializedItems} />;
}