import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requireSuperOwner } from "@/lib/auth";
import User from "@/models/User";
import Shop from "@/models/Shop";
import { hashPassword } from "@/lib/utils";
import mongoose from "mongoose";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperOwner();
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid owner ID" },
        { status: 400 }
      );
    }

    const existingOwner = await User.findOne({ _id: id, role: "owner" });
    if (!existingOwner) {
      return NextResponse.json(
        { error: "Owner not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Basic info fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) {
      // Check email uniqueness if changed
      if (body.email !== existingOwner.email) {
        const emailOwner = await User.findOne({ email: body.email, _id: { $ne: id } });
        if (emailOwner) {
          return NextResponse.json(
            { error: "A user with this email already exists" },
            { status: 409 }
          );
        }
      }
      updateData.email = body.email;
    }
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.status !== undefined) {
      if (!["active", "inactive", "suspended"].includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    // Password reset
    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(body.password);
    }

    // Subscription update
    if (body.subscription) {
      const sub = body.subscription;
      if (sub.plan && !["free", "trial", "paid", "enterprise"].includes(sub.plan)) {
        return NextResponse.json(
          { error: "Invalid subscription plan" },
          { status: 400 }
        );
      }
      if (sub.status && !["active", "trial", "expired", "suspended"].includes(sub.status)) {
        return NextResponse.json(
          { error: "Invalid subscription status" },
          { status: 400 }
        );
      }
      const existingSub = existingOwner.subscription
        ? JSON.parse(JSON.stringify(existingOwner.subscription))
        : {};
      updateData.subscription = {
        ...existingSub,
        ...(sub.plan ? { plan: sub.plan } : {}),
        ...(sub.status ? { status: sub.status } : {}),
        ...(sub.expiryDate ? { expiryDate: new Date(sub.expiryDate) } : {}),
        ...(sub.trialEndsAt ? { trialEndsAt: new Date(sub.trialEndsAt) } : {}),
      };
    }

    // Shop allocation — validate and update
    if (body.allowedShops !== undefined) {
      if (!Array.isArray(body.allowedShops)) {
        return NextResponse.json(
          { error: "allowedShops must be an array" },
          { status: 400 }
        );
      }

      // Validate all shop IDs exist
      const validShopIds = body.allowedShops.filter((s: string) =>
        mongoose.Types.ObjectId.isValid(s)
      );

      if (validShopIds.length !== body.allowedShops.length) {
        return NextResponse.json(
          { error: "One or more shop IDs are invalid" },
          { status: 400 }
        );
      }

      const shopsExist = await Shop.countDocuments({
        _id: { $in: validShopIds },
      });

      if (shopsExist !== validShopIds.length) {
        return NextResponse.json(
          { error: "One or more shops do not exist" },
          { status: 400 }
        );
      }

      updateData.allowedShops = validShopIds.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    const updatedOwner = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!updatedOwner) {
      return NextResponse.json(
        { error: "Failed to update owner" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      owner: {
        ...updatedOwner.toJSON(),
        _id: updatedOwner._id.toString(),
      },
    });
  } catch (error: any) {
    console.error("Update owner error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update owner" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperOwner();
    await connectToDatabase();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid owner ID" },
        { status: 400 }
      );
    }

    const owner = await User.findOne({ _id: id, role: "owner" })
      .select("-passwordHash")
      .lean();

    if (!owner) {
      return NextResponse.json(
        { error: "Owner not found" },
        { status: 404 }
      );
    }

    // If allowedShops is empty, auto-populate from shops owned by this owner
    let allowedShops = owner.allowedShops?.map((s: any) => s.toString()) ?? [];
    if (allowedShops.length === 0) {
      const ownedShops = await Shop.find({ ownerId: id }).select('_id').lean();
      allowedShops = ownedShops.map((s: any) => s._id.toString());
    }

    return NextResponse.json({
      owner: {
        ...owner,
        _id: owner._id.toString(),
        allowedShops,
      },
    });
  } catch (error: any) {
    console.error("Fetch owner error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch owner" },
      { status: 500 }
    );
  }
}