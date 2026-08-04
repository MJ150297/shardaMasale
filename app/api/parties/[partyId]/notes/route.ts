import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Party from '@/models/Party';

const NOTE_CATEGORIES = ['general', 'follow-up', 'important', 'payment', 'delivery'] as const;

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000),
  category: z.enum(NOTE_CATEGORIES).default('general'),
  tags: z.array(z.string().max(50)).default([]),
  pinned: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> }
) {
  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const { partyId } = await params;

    const party = await Party.findOne({
      _id: partyId,
      owner: user.id,
      isArchived: false,
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    const body = await request.json();
    const validated = createNoteSchema.parse(body);

    // Ensure notesList exists
    if (!party.notesList) {
      party.notesList = [] as any;
    }

    (party.notesList as any).push({
      content: validated.content,
      category: validated.category,
      tags: validated.tags,
      pinned: validated.pinned,
      history: [],
    });

    await party.save();

    const createdNote = (party.notesList as any)[party.notesList.length - 1];

    return NextResponse.json(
      {
        _id: createdNote._id.toString(),
        content: createdNote.content,
        category: createdNote.category,
        tags: createdNote.tags,
        pinned: createdNote.pinned,
        createdAt: createdNote.createdAt,
        updatedAt: createdNote.updatedAt,
        history: createdNote.history || [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating note:', error);

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> }
) {
  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const { partyId } = await params;

    const party = await Party.findOne({
      _id: partyId,
      owner: user.id,
      isArchived: false,
    }).lean();

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    const notes = (party.notesList || []).map((note: any) => ({
      _id: note._id.toString(),
      content: note.content,
      category: note.category,
      tags: note.tags || [],
      pinned: note.pinned || false,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      history: (note.history || []).map((h: any) => ({
        content: h.content,
        editedAt: h.editedAt,
      })),
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);

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