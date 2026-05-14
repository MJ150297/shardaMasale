import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import Invoice from '@/models/Invoice';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const user = await requireBusinessUser();
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const { method } = body;

    // Update the invoice with share tracking info
    await Invoice.findOneAndUpdate(
      { _id: params.id, owner: user.id },
      {
        $set: { updatedBy: user.id },
        // If invoices were first sent via this share, track sentAt
        $setOnInsert: {},
      }
    );

    return NextResponse.json({
      success: true,
      message: method ? `Share via ${method} tracked` : 'Share tracked',
    });
  } catch (error: any) {
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json(
      { error: error.message || 'Failed to track share' },
      { status: validStatus }
    );
  }
}