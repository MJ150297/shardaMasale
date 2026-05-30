import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireBusinessUser } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default to last 6 months if no dates provided
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 6));
    const end = endDate ? new Date(endDate) : new Date();

    // Build match filter
    const matchFilter: Record<string, unknown> = {
      owner: new mongoose.Types.ObjectId(user.id),
      type: "sale",
      status: "confirmed",
      transactionDate: {
        $gte: start,
        $lte: end,
      },
    };

    if (user.activeShopId) {
      matchFilter.shopId = new mongoose.Types.ObjectId(user.activeShopId);
    }

    // Run both aggregations in parallel
    const [monthlySalesResult, monthlyOrdersResult] = await Promise.all([
      // Monthly Sales Revenue
      Transaction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              year: { $year: "$transactionDate" },
              month: { $month: "$transactionDate" },
            },
            sales: { $sum: "$summary.grandTotal" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Monthly Order Count
      Transaction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              year: { $year: "$transactionDate" },
              month: { $month: "$transactionDate" },
            },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    // Build a complete list of months in the range, filling in zeros for missing months
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthsInRange: { year: number; month: number }[] = [];
    let current = new Date(start);
    while (current <= end) {
      monthsInRange.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      });
      current.setMonth(current.getMonth() + 1);
    }

    // Build lookup maps
    const salesMap = new Map<string, number>();
    for (const item of monthlySalesResult) {
      const key = `${item._id.year}-${item._id.month}`;
      salesMap.set(key, Math.round(item.sales));
    }

    const ordersMap = new Map<string, number>();
    for (const item of monthlyOrdersResult) {
      const key = `${item._id.year}-${item._id.month}`;
      ordersMap.set(key, item.orders);
    }

    // Build final merged array
    const chartData = monthsInRange.map(({ year, month }) => {
      const key = `${year}-${month}`;
      return {
        name: monthNames[month - 1],
        sales: salesMap.get(key) || 0,
        orders: ordersMap.get(key) || 0,
      };
    });

    return NextResponse.json({ data: chartData });
  } catch (error) {
    console.error("Error fetching dashboard chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}