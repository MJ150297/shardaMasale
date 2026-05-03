import { NextResponse } from "next/server";
import { requireOwner, requireUser } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Settings from "@/models/Settings";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");

    if (!shopId) {
      return NextResponse.json(
        { error: "Shop ID is required" },
        { status: 400 }
      );
    }

    let settings = await Settings.findOne({
      owner: user.id,
      shopId,
    }).lean();

    // Create default settings if not exists
    if (!settings) {
      settings = await Settings.create({
        owner: user.id,
        shopId,
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
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");

    if (!shopId) {
      return NextResponse.json(
        { error: "Shop ID is required" },
        { status: 400 }
      );
    }

    const updateData = await request.json();

    const settings = await Settings.findOneAndUpdate(
      { owner: user.id, shopId },
      updateData,
      { new: true, upsert: true, runValidators: true }
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