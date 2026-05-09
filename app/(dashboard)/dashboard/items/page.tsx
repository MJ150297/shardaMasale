import { requireUser } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Item, { type IItem } from '@/models/Item';
import Transaction from '@/models/Transaction';
import ItemsClient from './items-client';

export default async function ItemsPage() {
  const user = await requireUser();
  
  await connectToDatabase();
  
  const items = await Item.find({ owner: user.id })
    .sort({ createdAt: -1 })
    .lean();

  // Compute service usage counts for service-type items
  const serviceItemIds = items
    .filter(i => i.itemType === 'service')
    .map(i => i._id);

  let serviceUsageMap = new Map<string, number>();

  if (serviceItemIds.length > 0) {
    const usageCounts = await Transaction.aggregate([
      {
        $match: {
          type: 'sale',
          status: 'confirmed',
          'lineItems.item': { $in: serviceItemIds },
        },
      },
      { $unwind: '$lineItems' },
      {
        $match: {
          'lineItems.item': { $in: serviceItemIds },
        },
      },
      {
        $group: {
          _id: '$lineItems.item',
          totalQuantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
        },
      },
    ]);

    for (const entry of usageCounts) {
      serviceUsageMap.set(entry._id.toString(), entry.totalQuantity);
    }
  }

  const serializedItems = items.map(item => ({
    ...item,
    _id: item._id.toString(),
    owner: item.owner.toString(),
    // @ts-expect-error - timestamps exist on lean document even if not on interface
    createdAt: item.createdAt.toISOString(),
    // @ts-expect-error - timestamps exist on lean document even if not on interface
    updatedAt: item.updatedAt.toISOString(),
    serviceUsageCount:
      item.itemType === 'service'
        ? (serviceUsageMap.get(item._id.toString()) || 0)
        : undefined,
  })) as unknown as (IItem & { _id: string; serviceUsageCount?: number })[];

  return <ItemsClient items={serializedItems} />;
}
