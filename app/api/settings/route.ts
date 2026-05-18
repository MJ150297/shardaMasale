import { NextResponse } from "next/server";
import { requireOwner, requireUser, requireActiveBusinessSubscription } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Settings from "@/models/Settings";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");

    const query: Record<string, unknown> = { owner: user.id };
    if (shopId) {
      query.shopId = shopId;
    } else {
      query.shopId = null;
    }

    let settings = await Settings.findOne(query).lean();

    if (!settings) {
      if (shopId) {
        // Cascading: try owner-level settings first (without shopId)
        const ownerSettings = await Settings.findOne({ owner: user.id, shopId: null }).lean();
        if (ownerSettings) {
          return NextResponse.json({ ...ownerSettings, shopId });
        }
      }

      // Create default settings at the owner level
      settings = await Settings.create({
        owner: user.id,
        ...(shopId ? { shopId } : {}),
        business: {
          legalName: "",
          displayName: "",
          address: {
            line1: "",
            city: "",
            state: "",
            postalCode: "",
            country: "India",
          },
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");

    const query: Record<string, unknown> = { owner: user.id };
    if (shopId) {
      query.shopId = shopId;
    } else {
      query.shopId = null;
    }

    const rawUpdateData = await request.json();

    // Strip fields that must not be part of the update payload
    // _id collision happens when the cascading GET returns owner-level _id
    const updateData = { ...rawUpdateData };
    delete updateData._id;
    delete updateData.owner;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;

    const settings = await Settings.findOneAndUpdate(
      query,
      updateData,
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
