import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getServerAuthSession, requireUser } from "@/lib/auth";
import { getPlanFeatures } from "@/lib/subscription";
import Shop from "@/models/Shop";
import Item from "@/models/Item";
import Party from "@/models/Party";
import Transaction from "@/models/Transaction";

export async function GET() {
  try {
    const user = await requireUser();

    // Only business users have usage limits
    if (user.role === "customer" || user.role === "superOwner") {
      return NextResponse.json({
        shops: 0,
        maxShops: Infinity,
        items: 0,
        maxItems: Infinity,
        parties: 0,
        maxParties: Infinity,
      });
    }

    await connectToDatabase();

    const session = await getServerAuthSession();
    const plan = session?.user?.subscription?.plan ?? "free";
    const features = getPlanFeatures(plan);

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    // Get owned shops
    const ownedShopIds = await Shop.find({ ownerId: user.id }).distinct("_id");
    const shopCount = ownedShopIds.length;

    // Get counts within owned shops
    const itemCount = await Item.countDocuments({
      shopId: { $in: ownedShopIds },
    });

    const partyCount = await Party.countDocuments({
      shopId: { $in: ownedShopIds },
    });

    // Monthly transaction count
    const transactionCount = await Transaction.countDocuments({
      shopId: { $in: ownedShopIds },
      createdAt: { $gte: currentMonthStart },
    });

    return NextResponse.json({
      shops: shopCount,
      maxShops: features.maxShops,
      items: itemCount,
      maxItems: features.maxItems,
      parties: partyCount,
      maxParties: features.maxParties,
      monthlyTransactions: transactionCount,
      maxMonthlyTransactions: features.maxMonthlyTransactions,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    if (error?.digest?.startsWith("NEXT_NOT_FOUND")) throw error;
    console.error("Error fetching subscription usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}