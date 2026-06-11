import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireUser, requireActiveBusinessSubscription } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Settings from "@/models/Settings";

function normalizeBillingSettings(settings: Record<string, unknown> | null | undefined) {
  if (!settings) {
    return settings;
  }

  const billing = (settings.billing as Record<string, unknown> | undefined) || {};
  const salePrefix = (billing.salePrefix as string | undefined)
    || (billing.quotationPrefix as string | undefined)
    || 'SALE';
  const legacyFreeBilling = { ...billing };
  delete legacyFreeBilling.quotationPrefix;

  const business = (settings.business as Record<string, unknown> | undefined) || {};

  return {
    ...settings,
    billing: {
      ...legacyFreeBilling,
      salePrefix,
      footerText: legacyFreeBilling.footerText ?? null,
    },
    business: {
      ...business,
      logo: business.logo ?? null,
    },
  };
}

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

    // Use raw collection to bypass global shop-scoping plugin that overrides { shopId: null }
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database connection not available" }, { status: 500 });
    }
    const rawQuery: Record<string, unknown> = { owner: new mongoose.Types.ObjectId(user.id) };
    if (shopId) {
      rawQuery.shopId = new mongoose.Types.ObjectId(shopId);
    } else {
      rawQuery.shopId = null;
    }
    let settings = await db.collection('settings').findOne(rawQuery);

    if (!settings) {
      if (shopId) {
        // Cascading: try owner-level settings first (without shopId) — bypass plugin
        const ownerSettings = await db.collection('settings').findOne({ 
          owner: new mongoose.Types.ObjectId(user.id), 
          shopId: null 
        });
        if (ownerSettings) {
          return NextResponse.json(normalizeBillingSettings({ ...ownerSettings, shopId }));
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

    return NextResponse.json(normalizeBillingSettings(settings as Record<string, unknown>));
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
