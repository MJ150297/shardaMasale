import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Shop from "@/models/Shop";
import User from "@/models/User";
import { checkUserSubscription } from "@/lib/subscription";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const singleShopId = searchParams.get('id');

    const userId = session.user.id;
    const userRole = session.user.role;

    // If a specific shop ID is requested, return that single shop (owner/access check)
    if (singleShopId) {
      const shop = await Shop.findById(singleShopId).lean();

      if (!shop) {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }

      // Check access: superOwner can see any, others must own or have allowed access
      if (userRole !== 'superOwner') {
        const user = await User.findById(userId).select('allowedShops').lean();
        const allowedIds = (user?.allowedShops || []).map((s: any) => s.toString());
        const isOwner = shop.ownerId.toString() === userId;
        const isAllowed = allowedIds.includes(shop._id.toString());

        if (!isOwner && !isAllowed) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
      }

      return NextResponse.json({
        shop: {
          id: shop._id.toString(),
          name: shop.name,
          displayName: shop.displayName,
          email: shop.email,
          phone: shop.phone,
          currency: shop.currency,
          timezone: shop.timezone,
          isActive: shop.isActive,
        },
      });
    }

    if (userRole === 'superOwner') {
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

    if (userRole === 'customer') {
      // Customers don't get shop access
      return NextResponse.json({ shops: [], hasOwnedShops: false });
    }

    // Business users: check allowedShops for access control
    const user = await User.findById(userId).select('allowedShops').lean();

    // Count shops this user owns via Shop.ownerId (for access-revoked detection)
    const ownedShopCount = await Shop.countDocuments({ ownerId: userId });
    const hasOwnedShops = ownedShopCount > 0;

    // If allowedShops is explicitly set (non-empty), restrict to those,
    // but also include shops the user owns via ownerId (safety net for existing shops)
    if (user?.allowedShops && user.allowedShops.length > 0) {
      const allowedIds = user.allowedShops.map((s: any) => s.toString());
      const shops = await Shop.find({
        isActive: true,
        $or: [
          { _id: { $in: allowedIds } },
          { ownerId: userId },
        ],
      })
        .select('_id name displayName')
        .sort({ name: 1 })
        .lean();

      // Deduplicate by id
      const seen = new Set<string>();
      const uniqueShops = shops.filter(shop => {
        const id = shop._id.toString();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      return NextResponse.json({
        shops: uniqueShops.map(shop => ({
          id: shop._id.toString(),
          name: shop.name,
          displayName: shop.displayName,
        })),
        hasOwnedShops,
      });
    }

    // No allowedShops set — return user's own shops via ownerId (default behavior)
    const shops = await Shop.find({ ownerId: userId, isActive: true })
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

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    if (userRole === 'customer') {
      return NextResponse.json({ error: "Customers cannot create shops" }, { status: 403 });
    }

    // Subscription check: ensure user has an active subscription and hasn't hit the shop limit
    // (customer is already ruled out above)
    if (userRole !== 'superOwner') {
      const subResult = await checkUserSubscription(userId);

      if (!subResult.ok) {
        return NextResponse.json(
          { error: subResult.reason ?? "Your subscription is not active." },
          { status: 403 }
        );
      }

      const features = subResult.features;

      // Check shop limit
      if (features.maxShops !== Infinity) {
        const currentShopCount = await Shop.countDocuments({ ownerId: userId });
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
      ownerId: userId,
      name: { $regex: `^${body.name.trim()}$`, $options: 'i' },
    });

    if (existingShop) {
      return NextResponse.json(
        { error: "A shop with this name already exists" },
        { status: 409 }
      );
    }

    const shop = await Shop.create({
      ownerId: userId,
      name: body.name.trim(),
      displayName: body.displayName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      currency: (body.currency || 'INR').toUpperCase().trim(),
      timezone: body.timezone || 'Asia/Kolkata',
    });

    // Automatically add the new shop to the user's allowedShops
    await User.findByIdAndUpdate(userId, {
      $addToSet: { allowedShops: shop._id },
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

export async function PUT(request: Request) {
  try {
    await connectToDatabase();

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('id');

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Fetch the shop to verify access
    const shop = await Shop.findById(shopId).lean();

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // Check access: owner or superOwner can update
    if (userRole !== 'superOwner' && shop.ownerId.toString() !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2) {
        return NextResponse.json(
          { error: "Shop name must be at least 2 characters" },
          { status: 400 }
        );
      }

      // Check for duplicate name (exclude current shop)
      const duplicateShop = await Shop.findOne({
        _id: { $ne: shopId },
        ownerId: userId,
        name: { $regex: `^${body.name.trim()}$`, $options: 'i' },
      });

      if (duplicateShop) {
        return NextResponse.json(
          { error: "A shop with this name already exists" },
          { status: 409 }
        );
      }
    }

    if (body.currency && (typeof body.currency !== 'string' || body.currency.length !== 3)) {
      return NextResponse.json(
        { error: "Currency must be a 3-letter code" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.displayName !== undefined) updateData.displayName = body.displayName?.trim() || null;
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.currency !== undefined) updateData.currency = body.currency.toUpperCase().trim();
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    await Shop.findByIdAndUpdate(shopId, { $set: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating shop:", error);
    return NextResponse.json({ error: "Failed to update shop" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectToDatabase();

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('id');

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    const shop = await Shop.findById(shopId).lean();

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // Only owner or superOwner can delete
    if (userRole !== 'superOwner' && shop.ownerId.toString() !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft delete - mark as inactive
    await Shop.findByIdAndUpdate(shopId, { $set: { isActive: false } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shop:", error);
    return NextResponse.json({ error: "Failed to delete shop" }, { status: 500 });
  }
}