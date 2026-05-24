import { NextResponse } from "next/server";

import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { auth, requireSuperOwner } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    await requireSuperOwner();

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await User.findById(userId);

    if (!targetUser || targetUser.role === 'superOwner') {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      impersonating: true,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role
      }
    });

  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    return NextResponse.json({
      success: true,
      impersonating: false
    });

  } catch (error) {
    console.error("Stop impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}