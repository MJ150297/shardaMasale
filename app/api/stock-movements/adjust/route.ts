import { NextResponse } from "next/server";
import { requireUser, requireActiveBusinessSubscription } from "@/lib/auth";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import Item from "@/models/Item";
import StockMovement from "@/models/StockMovement";

export async function POST(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user } = await requireActiveBusinessSubscription();
    const body = await request.json();

    const { itemId, adjustedQuantity, reason } = body;

    if (!itemId || adjustedQuantity === undefined) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Item ID and adjusted quantity are required" }, { status: 400 });
    }

    if (typeof adjustedQuantity !== "number" || isNaN(adjustedQuantity)) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Adjusted quantity must be a valid number" }, { status: 400 });
    }

    await dbConnect();

    // Find item with current version for optimistic locking
    const item = await Item.findById(itemId).session(session);

    if (!item || item.owner.toString() !== user.id) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.itemType === "service" || !item.trackInventory) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Inventory tracking not enabled for this item" }, { status: 400 });
    }

    const difference = adjustedQuantity - item.stock.currentQuantity;

    if (difference === 0) {
      await session.abortTransaction();
      return NextResponse.json({ error: "No adjustment needed" }, { status: 400 });
    }

    // Validate negative stock
    if (adjustedQuantity < 0 && !item.stock.allowNegativeStock) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Negative stock is not allowed for this item" }, { status: 400 });
    }

    // Create adjustment movement inside transaction
    await StockMovement.create([{
      owner: user.id,
      item: itemId,
      type: "ADJUST",
      quantity: Math.abs(difference),
      referenceType: "MANUAL",
      reason: reason || null,
      previousQuantity: item.stock.currentQuantity,
      newQuantity: adjustedQuantity,
      createdBy: user.id,
      metadata: {
        difference,
        note: "Manual stock adjustment"
      }
    }], { session });

    // Atomic update with optimistic concurrency check
    const updatedItem = await Item.findOneAndUpdate(
      {
        _id: itemId,
        __v: item.__v, // Ensure no concurrent modifications
        owner: user.id
      },
      {
        $set: {
          "stock.currentQuantity": adjustedQuantity
        },
        $inc: { __v: 1 }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );

    if (!updatedItem) {
      await session.abortTransaction();
      return NextResponse.json({
        error: "Stock was modified by another user. Please refresh and try again."
      }, { status: 409 });
    }

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: "Stock adjusted successfully",
      difference,
      previousQuantity: item.stock.currentQuantity,
      adjustedQuantity,
      newVersion: updatedItem.__v
    });

  } catch (error: any) {
    await session.abortTransaction();
    console.error("Stock adjustment error:", error);
    
    if (error.name === 'VersionError') {
      return NextResponse.json({
        error: "Stock was modified by another user. Please refresh and try again."
      }, { status: 409 });
    }
    
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 });
  } finally {
    session.endSession();
  }
}
