import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { requireSuperOwner } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    await requireSuperOwner();

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await User.findById(userId);

    if (!targetUser || targetUser.role === 'superOwner') {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = await getToken({ req: request as any });

    if (token) {
      // Store original super owner identity
      token.originalUserId = token.sub;
      token.originalUserRole = token.role;

      // Impersonate target user
      token.sub = targetUser._id.toString();
      token.name = targetUser.name;
      token.email = targetUser.email;
      token.role = targetUser.role;
      token.timezone = targetUser.timezone;
      token.currency = targetUser.currency;
      token.activeShopId = null;
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
    const token = await getToken({ req: request as any }) as any;

    if (token && token.originalUserId) {
      // Restore original super owner identity
      token.sub = token.originalUserId;
      token.role = token.originalUserRole;

      delete token.originalUserId;
      delete token.originalUserRole;
    }

    return NextResponse.json({
      success: true,
      impersonating: false
    });

  } catch (error) {
    console.error("Stop impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}