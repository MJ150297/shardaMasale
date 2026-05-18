import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import NotificationModel from '@/models/Notification';

/**
 * Notification Retention Worker
 * Archives stale notifications and deletes those that have expired.
 */
export class NotificationRetentionWorker {
  private static isRunning = false;

  public static start() {
    cron.schedule('0 3 * * *', async () => {
      await this.cleanupNotifications();
    });

    console.log('✅ Notification Retention Worker scheduled to run daily at 03:00 AM');
  }

  public static async cleanupNotifications() {
    if (this.isRunning) {
      console.log('⏭️ Notification retention cleanup already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔍 Running notification retention cleanup...');

      await connectToDatabase();

      const now = new Date();

      const archivedResult = await NotificationModel.updateMany(
        {
          archivedAt: null,
          autoArchiveAt: { $lte: now },
        },
        {
          $set: {
            archivedAt: now,
          },
        },
      );

      const deletedResult = await NotificationModel.deleteMany({
        expiresAt: { $lte: now },
      });

      console.log(
        `✅ Archived ${archivedResult.modifiedCount} notifications and deleted ${deletedResult.deletedCount} expired notifications`,
      );
    } catch (error) {
      console.error('❌ Notification retention cleanup failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

if (process.env.NODE_ENV === 'production') {
  NotificationRetentionWorker.start();
}
