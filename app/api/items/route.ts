import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError, roundCurrency } from '@/lib/utils';
import Item from '@/models/Item';
import Transaction from '@/models/Transaction';
import { validateQuantityForUnit } from '@/lib/unit-utils';

const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  itemType: z.enum(['product', 'service', 'compound']).default('product'),
  bundleType: z.enum(['product', 'service']).nullable().optional(),
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
  status: z.enum(['active', 'discontinued']).default('active'),
  components: z.array(z.object({
    item: z.string(),
    quantity: z.coerce.number().min(0.01),
  })).optional(),
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
    const { user, features } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const body = await request.json();
    const validatedData = createItemSchema.parse(body);

    // Check subscription item limit
    const currentItemCount = await Item.countDocuments({ owner: user.id });
    if (currentItemCount >= features.maxItems) {
      throw new AppError(
        `You've reached the maximum limit of ${features.maxItems} items on your ${features.maxItems === Infinity ? 'current' : ''} plan. Please upgrade to add more items.`,
        403
      );
    }

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

    // Require an active shop for creating items
    if (!user.activeShopId) {
      throw new AppError('Please select or create a shop before adding items', 400);
    }

    // For compound items, validate that component items exist and belong to same owner
    if (validatedData.itemType === 'compound' && validatedData.components) {
      if (validatedData.components.length === 0) {
        throw new AppError('Compound items must have at least one component', 400);
      }

      const componentIds = validatedData.components.map(c => c.item);
      const componentItems = await Item.find({
        _id: { $in: componentIds },
        owner: user.id,
      });

      if (componentItems.length !== componentIds.length) {
        throw new AppError('One or more component items not found', 400);
      }

      // Validate no nesting
      const hasNestedCompound = componentItems.some(
        (ci: any) => ci.itemType === 'compound',
      );
      if (hasNestedCompound) {
        throw new AppError('Compound items cannot contain other compound items', 400);
      }

      // Validate component quantities against their units
      for (const comp of validatedData.components) {
        const componentItem = componentItems.find(
          (ci: any) => ci._id.toString() === comp.item,
        );
        if (componentItem) {
          const unit = componentItem.unitOfMeasure || 'pcs';
          const validationError = validateQuantityForUnit(comp.quantity, unit, componentItem.name);
          if (validationError) {
            throw new AppError(validationError, 400);
          }
        }
      }
    }

    // Create the item
    const item = new Item({
      ...normalizeItemTaxRates(validatedData),
      owner: user.id,
      shopId: user.activeShopId,
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

    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }

    if (type && ['product', 'service', 'compound'].includes(type)) {
      query.itemType = type;
    }

    if (status && ['active', 'discontinued'].includes(status)) {
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

    // Compute service usage counts for service-type items
    const serviceItemIds = items
      .filter(i => i.itemType === 'service')
      .map(i => i._id);

    let serviceUsageMap = new Map<string, number>();

    if (serviceItemIds.length > 0) {
      const usageCounts = await Transaction.aggregate([
        {
          $match: {
            type: 'sale',
            status: 'confirmed',
            'lineItems.item': { $in: serviceItemIds },
          },
        },
        { $unwind: '$lineItems' },
        {
          $match: {
            'lineItems.item': { $in: serviceItemIds },
          },
        },
        {
          $group: {
            _id: '$lineItems.item',
            totalQuantity: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
          },
        },
      ]);

      for (const entry of usageCounts) {
        serviceUsageMap.set(entry._id.toString(), entry.totalQuantity);
      }
    }

    const itemsWithUsage = items.map(item => ({
      ...item,
      serviceUsageCount:
        item.itemType === 'service'
          ? (serviceUsageMap.get(item._id.toString()) || 0)
          : undefined,
    }));

    return NextResponse.json({
      items: itemsWithUsage,
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
    const { user } = await requireActiveBusinessSubscription();
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
    // Use raw data to check which fields were actually sent by the client,
    // since Zod partial() applies default values to sub-schemas when the parent key is present
    // (e.g. { pricing: { sellingPrice: 150 } } becomes costPrice: 0, purchasePrice: 0 after Zod parse)
    const rawData = data as Record<string, unknown>;

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

    // If updating itemType to compound, or components changed, validate
    const itemType = validatedData.itemType || item.itemType;
    const components = validatedData.components ?? (rawData.components !== undefined ? [] : undefined);

    if (itemType === 'compound' && components !== undefined) {
      if (components.length === 0) {
        throw new AppError('Compound items must have at least one component', 400);
      }

      const componentIds = components.map((c: { item: string }) => c.item);
      const componentItems = await Item.find({
        _id: { $in: componentIds },
        owner: user.id,
      });

      if (componentItems.length !== componentIds.length) {
        throw new AppError('One or more component items not found', 400);
      }

      const hasNestedCompound = componentItems.some(
        (ci: any) => ci.itemType === 'compound',
      );
      if (hasNestedCompound) {
        throw new AppError('Compound items cannot contain other compound items', 400);
      }
    }

    // Build $set for targeted partial updates — only fields actually present in raw request data
    const setFields: Record<string, any> = {};

    if ('name' in rawData) setFields.name = validatedData.name;
    if ('description' in rawData) setFields.description = validatedData.description;
    if ('itemType' in rawData) setFields.itemType = validatedData.itemType;
    if ('bundleType' in rawData) setFields.bundleType = validatedData.bundleType ?? null;
    if ('category' in rawData) setFields.category = validatedData.category;
    if ('brand' in rawData) setFields.brand = validatedData.brand;
    if ('unitOfMeasure' in rawData) setFields.unitOfMeasure = validatedData.unitOfMeasure;
    if ('sku' in rawData) setFields.sku = validatedData.sku?.trim().toUpperCase() || null;
    if ('barcode' in rawData) setFields.barcode = validatedData.barcode?.trim() || null;
    if ('hsnCode' in rawData) setFields.hsnCode = validatedData.hsnCode;
    if ('sacCode' in rawData) setFields.sacCode = validatedData.sacCode;
    if ('purchaseTaxRate' in rawData) setFields.purchaseTaxRate = validatedData.purchaseTaxRate;
    if ('saleTaxRate' in rawData) setFields.saleTaxRate = validatedData.saleTaxRate;
    if ('taxRate' in rawData) setFields.taxRate = validatedData.taxRate;
    if ('status' in rawData) setFields.status = validatedData.status;
    if ('trackInventory' in rawData) setFields.trackInventory = validatedData.trackInventory;
    if ('trackBatch' in rawData) setFields.trackBatch = validatedData.trackBatch;
    if ('trackExpiry' in rawData) setFields.trackExpiry = validatedData.trackExpiry;
    if ('batchNumber' in rawData) setFields.batchNumber = validatedData.batchNumber;
    if ('expiryDate' in rawData) setFields.expiryDate = validatedData.expiryDate;
    if ('tags' in rawData) setFields.tags = validatedData.tags;

    // Handle components
    if (components !== undefined) {
      setFields.components = components;
    }

    // Handle pricing subdocument fields — check raw pricing data for individual field presence
    const rawPricing = rawData.pricing as Record<string, unknown> | undefined;
    if (rawPricing) {
      if ('costPrice' in rawPricing) setFields['pricing.costPrice'] = validatedData.pricing!.costPrice;
      if ('purchasePrice' in rawPricing) setFields['pricing.purchasePrice'] = validatedData.pricing!.purchasePrice;
      if ('sellingPrice' in rawPricing) setFields['pricing.sellingPrice'] = validatedData.pricing!.sellingPrice;
      if ('mrp' in rawPricing) setFields['pricing.mrp'] = validatedData.pricing!.mrp;
    }

    // Handle stock subdocument fields — check raw stock data for individual field presence
    const rawStock = rawData.stock as Record<string, unknown> | undefined;
    if (rawStock) {
      if ('openingQuantity' in rawStock) setFields['stock.openingQuantity'] = validatedData.stock!.openingQuantity;
      if ('reorderLevel' in rawStock) setFields['stock.reorderLevel'] = validatedData.stock!.reorderLevel;
      if ('reorderQuantity' in rawStock) setFields['stock.reorderQuantity'] = validatedData.stock!.reorderQuantity;
      if ('allowNegativeStock' in rawStock) setFields['stock.allowNegativeStock'] = validatedData.stock!.allowNegativeStock;
      if ('location' in rawStock) setFields['stock.location'] = validatedData.stock!.location;
    }

    const updatedItem = await Item.findByIdAndUpdate(
      id,
      { $set: setFields },
      { returnDocument: 'after', runValidators: true }
    );

    // Auto-recalculate pricing of all compound items that reference this item
    if (updatedItem && updatedItem.itemType !== 'compound') {
      const compoundItems = await Item.find({
        'components.item': updatedItem._id,
        itemType: 'compound',
      });

      for (const compoundItem of compoundItems) {
        const componentIds = compoundItem.components.map(
          (c: { item: any }) => c.item
        );
        const componentItems = await Item.find({
          _id: { $in: componentIds },
        });

        let totalCostPrice = 0;
        let totalSellingPrice = 0;
        let totalPurchasePrice = 0;

        for (const comp of compoundItem.components) {
          const componentItem = componentItems.find(
            (ci: any) => ci._id.toString() === comp.item.toString()
          );
          if (!componentItem) continue;

          // Skip discontinued items from pricing calculation
          if (componentItem.status === 'discontinued') continue;

          totalCostPrice +=
            (componentItem.pricing?.costPrice || 0) * comp.quantity;
          totalSellingPrice +=
            (componentItem.pricing?.sellingPrice || 0) * comp.quantity;
          totalPurchasePrice +=
            (componentItem.pricing?.purchasePrice || 0) * comp.quantity;
        }

        await Item.updateOne(
          { _id: compoundItem._id },
          {
            $set: {
              'pricing.costPrice': roundCurrency(totalCostPrice),
              'pricing.sellingPrice': roundCurrency(totalSellingPrice),
              'pricing.purchasePrice': roundCurrency(totalPurchasePrice),
            },
          }
        );
      }
    }

    // Re-fetch the updated item to return the latest data
    const finalItem = await Item.findById(id);

    return NextResponse.json(finalItem);
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
    const { user } = await requireActiveBusinessSubscription();
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