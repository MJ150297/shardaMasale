import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import Notification from '@/models/Notification';

export async function GET(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    const query: any = { owner: user.id };

    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ owner: user.id, read: false });

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireBusinessUser();
    await connectToDatabase();

    // Mark all notifications as read
    await Notification.updateMany(
      { owner: user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}