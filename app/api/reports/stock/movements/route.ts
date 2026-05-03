import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import StockMovement from '@/models/StockMovement';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const itemId = searchParams.get('itemId');
    const type = searchParams.get('type');
    const referenceType = searchParams.get('referenceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query: any = { owner: user.id };
    if (shopId) query.shopId = shopId;
    if (itemId) query.item = itemId;
    if (type) query.type = type;
    if (referenceType) query.referenceType = referenceType;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('item', 'name sku')
        .populate('createdBy', 'name email')
        .lean(),
      StockMovement.countDocuments(query)
    ]);

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Stock movements error:', error);
    return NextResponse.json({ error: 'Failed to load stock movements' }, { status: 500 });
  }
}