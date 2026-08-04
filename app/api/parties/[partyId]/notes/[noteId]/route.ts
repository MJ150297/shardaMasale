import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db';
import { requireActiveBusinessSubscription } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Party from '@/models/Party';

const NOTE_CATEGORIES = ['general', 'follow-up', 'important', 'payment', 'delivery'] as const;

const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000).optional(),
  category: z.enum(NOTE_CATEGORIES).optional(),
  tags: z.array(z.string().max(50)).optional(),
  pinned: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ partyId: string; noteId: string }> }
) {
  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const { partyId, noteId } = await params;

    const party = await Party.findOne({
      _id: partyId,
      owner: user.id,
      isArchived: false,
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    const body = await request.json();
    const validated = updateNoteSchema.parse(body);

    const note = (party.notesList as any)?.id(noteId);

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    // If content is being updated, push old content to history
    if (validated.content !== undefined && validated.content !== note.content) {
      note.history.push({
        content: note.content,
        editedAt: new Date(),
      });
      note.content = validated.content;
    }

    if (validated.category !== undefined) {
      note.category = validated.category;
    }

    if (validated.tags !== undefined) {
      note.tags = validated.tags;
    }

    if (validated.pinned !== undefined) {
      note.pinned = validated.pinned;
    }

    await party.save();

    return NextResponse.json({
      _id: note._id.toString(),
      content: note.content,
      category: note.category,
      tags: note.tags,
      pinned: note.pinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      history: (note.history || []).map((h: any) => ({
        content: h.content,
        editedAt: h.editedAt,
      })),
    });
  } catch (error) {
    console.error('Error updating note:', error);

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ partyId: string; noteId: string }> }
) {
  try {
    const { user } = await requireActiveBusinessSubscription();
    await connectToDatabase();

    const { partyId, noteId } = await params;

    const party = await Party.findOne({
      _id: partyId,
      owner: user.id,
      isArchived: false,
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    const note = (party.notesList as any)?.id(noteId);

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    note.deleteOne();
    await party.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);

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