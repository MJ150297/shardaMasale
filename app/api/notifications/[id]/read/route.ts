import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import Notification from '@/models/Notification';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const user = await requireBusinessUser();
    await connectToDatabase();

    const notification = await Notification.findOne({
      _id: params.id,
      owner: user.id
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}