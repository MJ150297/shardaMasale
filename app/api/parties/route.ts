import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Party from '@/models/Party';

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
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json();
    const validatedData = createPartySchema.parse(body);

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

    // Create the party
    const party = new Party({
      ...validatedData,
      owner: user.id,
    });

    await party.save();

    return NextResponse.json(party, { status: 201 });
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

    const query: any = { owner: user.id, isArchived: false };

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
    const user = await requireBusinessUser();
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

    return NextResponse.json(party);
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
    const user = await requireBusinessUser();
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
