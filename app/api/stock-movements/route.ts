import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import dbConnect from "@/lib/db";
import StockMovement from "@/models/StockMovement";

export async function GET(request: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const type = searchParams.get("type");
    const referenceType = searchParams.get("referenceType");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    await dbConnect();

    const filter: any = {
      owner: user.id,
    };

    if (itemId) {
      filter.item = itemId;
    }

    if (type) {
      filter.type = type;
    }

    if (referenceType) {
      filter.referenceType = referenceType;
    }

    const movements = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("item", "name sku")
      .lean();

    const total = await StockMovement.countDocuments(filter);

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Stock movements fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}