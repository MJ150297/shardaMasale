import { requireUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Item, { type IItem } from '@/models/Item';
import ItemsClient from './items-client';

export default async function ItemsPage() {
  const user = await requireUser();
  
  await connectToDatabase();
  
  const items = await Item.find({ owner: user.id })
    .sort({ createdAt: -1 })
    .lean();

  const serializedItems = items.map(item => ({
    ...item,
    _id: item._id.toString(),
    owner: item.owner.toString(),
    // @ts-expect-error - timestamps exist on lean document even if not on interface
    createdAt: item.createdAt.toISOString(),
    // @ts-expect-error - timestamps exist on lean document even if not on interface
    updatedAt: item.updatedAt.toISOString(),
  })) as unknown as (IItem & { _id: string })[];

  return <ItemsClient items={serializedItems} />;
}