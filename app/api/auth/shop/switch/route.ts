import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shopId } = await request.json();

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    // Verify user has access to this shop
    const shop = await Shop.findOne({
      _id: shopId,
      ownerId: session.user.id,
      isActive: true
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      activeShopId: shopId,
      shop: {
        id: shop._id.toString(),
        name: shop.name,
        displayName: shop.displayName
      }
    });

  } catch (error) {
    console.error("Shop switch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}