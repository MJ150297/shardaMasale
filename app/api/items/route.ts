import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Item from '@/models/Item';

const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  itemType: z.enum(['product', 'service']).default('product'),
  category: z.string().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().min(1).max(20).default('pcs'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  purchaseTaxRate: z.coerce.number().min(0).max(100).default(0),
  saleTaxRate: z.coerce.number().min(0).max(100).default(0),
  pricing: z.object({
    costPrice: z.coerce.number().min(0).default(0),
    purchasePrice: z.coerce.number().min(0).default(0),
    sellingPrice: z.coerce.number().min(0),
    mrp: z.coerce.number().min(0).optional(),
  }),
  stock: z.object({
    openingQuantity: z.coerce.number().min(0).default(0),
    reorderLevel: z.coerce.number().min(0).default(0),
    reorderQuantity: z.coerce.number().min(0).default(0),
    allowNegativeStock: z.boolean().default(false),
    location: z.string().optional(),
  }).optional(),
  trackInventory: z.boolean().default(true),
  trackBatch: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  batchNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'active', 'discontinued', 'archived']).default('active'),
});

function normalizeItemTaxRates<T extends {
  taxRate?: number;
  purchaseTaxRate?: number;
  saleTaxRate?: number;
}>(data: T, existingItem?: { taxRate?: number; purchaseTaxRate?: number; saleTaxRate?: number }) {
  const fallbackTaxRate = existingItem?.taxRate ?? 0;
  const fallbackPurchaseTaxRate = existingItem?.purchaseTaxRate ?? existingItem?.taxRate ?? 0;
  const fallbackSaleTaxRate = existingItem?.saleTaxRate ?? existingItem?.taxRate ?? 0;

  const purchaseTaxRate =
    data.purchaseTaxRate ?? data.taxRate ?? fallbackPurchaseTaxRate ?? fallbackTaxRate;
  const saleTaxRate =
    data.saleTaxRate ?? data.taxRate ?? fallbackSaleTaxRate ?? fallbackTaxRate;

  return {
    ...data,
    purchaseTaxRate,
    saleTaxRate,
    taxRate: saleTaxRate,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json();
    const validatedData = createItemSchema.parse(body);

    // Check for duplicate SKU if provided
    if (validatedData.sku) {
      const existingItem = await Item.findOne({
        owner: user.id,
        sku: validatedData.sku.toUpperCase().trim(),
      });
      if (existingItem) {
        throw new AppError('SKU already exists', 400);
      }
    }

    // Check for duplicate barcode if provided
    if (validatedData.barcode) {
      const existingItem = await Item.findOne({
        owner: user.id,
        barcode: validatedData.barcode.trim(),
      });
      if (existingItem) {
        throw new AppError('Barcode already exists', 400);
      }
    }

    // Create the item
    const item = new Item({
      ...normalizeItemTaxRates(validatedData),
      owner: user.id,
    });

    await item.save();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const query: any = { owner: user.id };

    if (type && ['product', 'service'].includes(type)) {
      query.itemType = type;
    }

    if (status && ['draft', 'active', 'discontinued', 'archived'].includes(status)) {
      query.status = status;
    }

    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    if (search) {
      query.$text = { $search: search };
    }

    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Item.countDocuments(query);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { id, ...data } = await request.json();
    
    if (!id) {
      throw new AppError('Item ID is required', 400);
    }

    const item = await Item.findOne({ _id: id, owner: user.id });
    
    if (!item) {
      throw new AppError('Item not found', 404);
    }

    const validatedData = createItemSchema.partial().parse(data);

    // Check for duplicate SKU if provided and changed
    if (validatedData.sku && validatedData.sku !== item.sku) {
      const existingItem = await Item.findOne({
        owner: user.id,
        sku: validatedData.sku.toUpperCase().trim(),
        _id: { $ne: id }
      });
      if (existingItem) {
        throw new AppError('SKU already exists', 400);
      }
    }

    // Check for duplicate barcode if provided and changed
    if (validatedData.barcode && validatedData.barcode !== item.barcode) {
      const existingItem = await Item.findOne({
        owner: user.id,
        barcode: validatedData.barcode.trim(),
        _id: { $ne: id }
      });
      if (existingItem) {
        throw new AppError('Barcode already exists', 400);
      }
    }

    const updatedItem = await Item.findByIdAndUpdate(
      id,
      normalizeItemTaxRates(validatedData, item),
      { new: true }
    );

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      throw new AppError('Item ID is required', 400);
    }

    const item = await Item.findOne({ _id: id, owner: user.id });
    
    if (!item) {
      throw new AppError('Item not found', 404);
    }

    await Item.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
