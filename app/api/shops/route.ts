import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";
import User from "@/models/User";
import { checkUserSubscription } from "@/lib/subscription";
import type { AuthenticatedToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const token = await getToken({ req: request as any }) as AuthenticatedToken;

    if (!token || !token.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (token.role === 'superOwner') {
      // Super owner can see all active shops
      const shops = await Shop.find({ isActive: true })
        .select('_id name displayName')
        .sort({ name: 1 })
        .lean();

      return NextResponse.json({
        shops: shops.map(shop => ({
          id: shop._id.toString(),
          name: shop.name,
          displayName: shop.displayName,
        })),
        hasOwnedShops: shops.length > 0,
      });
    }

    if (token.role === 'customer') {
      // Customers don't get shop access
      return NextResponse.json({ shops: [], hasOwnedShops: false });
    }

    // Business users: check allowedShops for access control
    const user = await User.findById(token.sub).select('allowedShops').lean();

    // Count shops this user owns via Shop.ownerId (for access-revoked detection)
    const ownedShopCount = await Shop.countDocuments({ ownerId: token.sub });
    const hasOwnedShops = ownedShopCount > 0;

    // If allowedShops is explicitly set (non-empty), restrict to those
    if (user?.allowedShops && user.allowedShops.length > 0) {
      const allowedIds = user.allowedShops.map((s: any) => s.toString());
      const shops = await Shop.find({
        _id: { $in: allowedIds },
        isActive: true,
      })
        .select('_id name displayName')
        .sort({ name: 1 })
        .lean();

      return NextResponse.json({
        shops: shops.map(shop => ({
          id: shop._id.toString(),
          name: shop.name,
          displayName: shop.displayName,
        })),
        hasOwnedShops,
      });
    }

    // No allowedShops set — return user's own shops via ownerId (default behavior)
    const shops = await Shop.find({ ownerId: token.sub, isActive: true })
      .select('_id name displayName')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      shops: shops.map(shop => ({
        id: shop._id.toString(),
        name: shop.name,
        displayName: shop.displayName,
      })),
      hasOwnedShops,
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const token = await getToken({ req: request as any }) as AuthenticatedToken;

    if (!token || !token.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (token.role === 'customer') {
      return NextResponse.json({ error: "Customers cannot create shops" }, { status: 403 });
    }

    // Subscription check: ensure user has an active subscription and hasn't hit the shop limit
    // (customer is already ruled out above)
    if (token.role !== 'superOwner') {
      const subResult = await checkUserSubscription(token.sub);

      if (!subResult.ok) {
        return NextResponse.json(
          { error: subResult.reason ?? "Your subscription is not active." },
          { status: 403 }
        );
      }

      const features = subResult.features;

      // Check shop limit
      if (features.maxShops !== Infinity) {
        const currentShopCount = await Shop.countDocuments({ ownerId: token.sub });
        if (currentShopCount >= features.maxShops) {
          return NextResponse.json(
            {
              error: `Your ${subResult.plan} plan allows a maximum of ${features.maxShops} shop(s). Upgrade your plan to create more shops.`,
            },
            { status: 403 }
          );
        }
      }
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json(
        { error: "Shop name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (body.currency && (typeof body.currency !== 'string' || body.currency.length !== 3)) {
      return NextResponse.json(
        { error: "Currency must be a 3-letter code" },
        { status: 400 }
      );
    }

    // Check for duplicate name within the same owner
    const existingShop = await Shop.findOne({
      ownerId: token.sub,
      name: { $regex: `^${body.name.trim()}$`, $options: 'i' },
    });

    if (existingShop) {
      return NextResponse.json(
        { error: "A shop with this name already exists" },
        { status: 409 }
      );
    }

    const shop = await Shop.create({
      ownerId: token.sub,
      name: body.name.trim(),
      displayName: body.displayName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      currency: (body.currency || 'INR').toUpperCase().trim(),
      timezone: body.timezone || 'Asia/Kolkata',
    });

    return NextResponse.json(
      {
        id: shop._id.toString(),
        name: shop.name,
        displayName: shop.displayName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating shop:", error);
    return NextResponse.json({ error: "Failed to create shop" }, { status: 500 });
  }
}
