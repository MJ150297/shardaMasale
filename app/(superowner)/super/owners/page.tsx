import { requireSuperOwner } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import Shop from "@/models/Shop";
import OwnersClient from "./owners-client";

export default async function OwnersManagementPage() {
  await requireSuperOwner();
  await connectToDatabase();

  // Get all shops grouped by ownerId for efficient lookup
  const shopsByOwner = await Shop.aggregate([
    { $group: { _id: '$ownerId', shopIds: { $push: '$_id' } } },
  ]);

  const ownerShopMap = new Map<string, string[]>();
  for (const group of shopsByOwner) {
    ownerShopMap.set(
      group._id.toString(),
      group.shopIds.map((s: any) => s.toString())
    );
  }

  const owners = await User.find({ role: 'owner' })
    .select('name email status createdAt lastLoginAt allowedShops subscription')
    .sort({ createdAt: -1 })
    .lean({ virtuals: true })
    .then(items => items.map(item => {
      const plain = JSON.parse(JSON.stringify(item));
      const id = plain._id ?? item._id.toString();
      const userAllowed = plain.allowedShops?.map((s: any) => s.toString()) ?? [];
      // If allowedShops is empty, auto-populate from shops owned by this owner
      const actualShops = userAllowed.length > 0
        ? userAllowed
        : (ownerShopMap.get(id) ?? []);
      return {
        ...plain,
        _id: id,
        allowedShops: actualShops,
        subscription: plain.subscription ?? undefined,
      };
    }));

  const shops = await Shop.find({})
    .select('name displayName isActive')
    .sort({ name: 1 })
    .lean()
    .then(items => items.map(item => ({
      _id: item._id.toString(),
      name: item.name,
      displayName: item.displayName ?? null,
      isActive: item.isActive,
    })));

  return (
    <OwnersClient initialOwners={owners} shops={shops} />
  );
}