import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requireSuperOwner } from "@/lib/auth";
import User from "@/models/User";
import { hashPassword } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    await requireSuperOwner();
    await connectToDatabase();

    const body = await request.json();
    const { name, email, phoneNumber } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password before saving (bypasses mongoose minlength validation)
    const hashedPassword = await hashPassword(body.password);

    // Create owner user
    const owner = await User.create({
      name,
      email,
      phoneNumber,
      passwordHash: hashedPassword,
      role: "owner",
      status: "active",
    });

    return NextResponse.json({
      success: true,
      owner: {
        ...owner.toSafeObject(),
        _id: owner._id.toString(),
        createdAt: owner.createdAt,
        updatedAt: owner.updatedAt,
        lastLoginAt: owner.lastLoginAt,
        allowedShops: owner.allowedShops?.map((shopId) => shopId.toString()) ?? [],
        subscription: owner.subscription ?? undefined,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create owner";
    console.error("Create owner error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireSuperOwner();
    await connectToDatabase();

    const owners = await User.find({ role: 'owner' })
      .select('name email status createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ owners });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch owners";
    console.error("Fetch owners error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
