import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser, requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Party from '@/models/Party';

const billingAddressSchema = z.object({
  line1: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  line2: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  landmark: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  city: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  state: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  postalCode: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  country: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
}).optional().nullable();

const createPartySchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(160),
  legalName: z.string().optional().nullable(),
  partyType: z.enum(['customer', 'supplier', 'both']).default('customer'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  alternatePhoneNumber: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  taxTreatment: z.enum(['registered', 'unregistered', 'consumer', 'overseas']).default('unregistered'),
  address: z.string().max(300).optional().nullable(),
  billingAddress: billingAddressSchema,
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const { user, features } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const body = await request.json();
    const validatedData = createPartySchema.parse(body);

    // Check subscription party limit
    const currentPartyCount = await Party.countDocuments({ owner: user.id, isArchived: false });
    if (currentPartyCount >= features.maxParties) {
      throw new AppError(
        `You've reached the maximum limit of ${features.maxParties} parties on your plan. Please upgrade to add more.`,
        403
      );
    }

    // Check for duplicate email if provided
    if (validatedData.email) {
      const existingParty = await Party.findOne({
        owner: user.id,
        email: validatedData.email.toLowerCase().trim(),
      });

      if (existingParty) {
        throw new AppError('A party with this email already exists', 400);
      }
    }

    // Require an active shop for creating parties
    if (!user.activeShopId) {
      throw new AppError('Please select or create a shop before adding parties', 400);
    }

    // Create the party — set currentBalance to openingBalance
    const party = new Party({
      ...validatedData,
      owner: user.id,
      shopId: user.activeShopId,
      currentBalance: validatedData.openingBalance || 0,
    });

    await party.save();

    return NextResponse.json(
      {
        ...party.toJSON(),
        _id: party._id.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating party:', error);

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
    const limit = parseInt(searchParams.get('limit') || '50');
    const partyType = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: Record<string, unknown> = { owner: user.id, isArchived: false };

    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    }

    if (partyType && ['customer', 'supplier', 'both'].includes(partyType)) {
      query.partyType = partyType;
    }

    if (status && ['active', 'inactive', 'blocked'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const parties = await Party.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Party.countDocuments(query);

    return NextResponse.json({
      parties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching parties:', error);
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

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      throw new AppError('Party ID is required', 400);
    }

    const party = await Party.findOne({
      _id: id,
      owner: user.id,
      isArchived: false,
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Map frontend field names to database fields
    if (updateData.name) {
      updateData.displayName = updateData.name;
      delete updateData.name;
    }

    // Validate and update
    Object.assign(party, updateData);
    await party.save();

    return NextResponse.json({
      ...party.toJSON(),
      _id: party._id.toString(),
    });
  } catch (error) {
    console.error('Error updating party:', error);

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
      throw new AppError('Party ID is required', 400);
    }

    const party = await Party.findOne({
      _id: id,
      owner: user.id,
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Soft delete - mark as archived
    party.isArchived = true;
    await party.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting party:', error);

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
