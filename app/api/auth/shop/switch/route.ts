import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";
import { AuthenticatedToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const token = await getToken({ req: request as any }) as AuthenticatedToken;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shopId } = await request.json();

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    // Verify user has access to this shop
    const shop = await Shop.findOne({
      _id: shopId,
      ownerId: token.sub,
      isActive: true
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found or access denied" }, { status: 404 });
    }

    // Update token with new active shop
    token.activeShopId = shopId;

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