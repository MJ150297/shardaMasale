import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import Notification from '@/models/Notification';

/**
 * Subscription Expiry Worker - Runs daily at midnight
 * Checks for:
 *  1. Trial subscriptions that have expired → mark as expired
 *  2. Paid subscriptions past expiryDate → mark as expired
 *  3. Subscriptions about to expire in 7 days → send notification
 */
export class SubscriptionExpiryWorker {
  private static isRunning = false;

  public static start() {
    // Run every day at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      await this.processExpiredTrials();
      await this.processExpiredSubscriptions();
      await this.sendExpiryWarnings();
    });

    console.log('✅ Subscription Expiry Worker scheduled to run daily at 2:00 AM');
  }

  /**
   * Mark trial subscriptions as expired when trialEndsAt has passed.
   */
  public static async processExpiredTrials() {
    if (this.isRunning) return;

    try {
      console.log('🔍 Checking for expired trial subscriptions...');
      await connectToDatabase();

      const now = new Date();

      const expiredTrials = await User.find({
        'subscription.status': 'trial',
        'subscription.trialEndsAt': { $lt: now },
      }).select('_id name email subscription');

      console.log(`📋 Found ${expiredTrials.length} expired trial subscriptions`);

      for (const user of expiredTrials) {
        if (user.subscription) {
          user.subscription.status = 'expired';
          await user.save();
        }

        // Create notification for the owner
        try {
          await Notification.create({
            owner: user._id,
            type: 'subscription_expired',
            title: 'Trial Period Expired',
            message:
              'Your free trial has ended. Please upgrade to a paid plan to continue using all features.',
            metadata: {
              userId: user._id.toString(),
              previousPlan: 'trial',
              newStatus: 'expired',
            },
          });
        } catch (notifError) {
          console.error(
            `Failed to create expiry notification for user ${user._id}:`,
            notifError,
          );
        }

        console.log(`✅ Expired trial for user ${user.email} (${user._id})`);
      }

      console.log('✅ Expired trial processing completed');
    } catch (error: any) {
      console.error('❌ Error processing expired trials:', error);
    }
  }

  /**
   * Mark paid/active subscriptions as expired when expiryDate has passed.
   */
  public static async processExpiredSubscriptions() {
    try {
      console.log('🔍 Checking for expired paid subscriptions...');
      await connectToDatabase();

      const now = new Date();

      const expiredSubscriptions = await User.find({
        'subscription.status': 'active',
        'subscription.expiryDate': { $lt: now },
        'subscription.plan': { $in: ['paid', 'enterprise'] },
      }).select('_id name email subscription');

      console.log(
        `📋 Found ${expiredSubscriptions.length} expired paid subscriptions`,
      );

      for (const user of expiredSubscriptions) {
        if (user.subscription) {
          user.subscription.status = 'expired';
          await user.save();
        }

        try {
          await Notification.create({
            owner: user._id,
            type: 'subscription_expired',
            title: 'Subscription Expired',
            message:
              'Your subscription has expired. Please renew to restore full access.',
            metadata: {
              userId: user._id.toString(),
              previousPlan: user.subscription?.plan ?? 'unknown',
              newStatus: 'expired',
            },
          });
        } catch (notifError) {
          console.error(
            `Failed to create expiry notification for user ${user._id}:`,
            notifError,
          );
        }

        console.log(`✅ Expired subscription for user ${user.email} (${user._id})`);
      }

      console.log('✅ Expired subscription processing completed');
    } catch (error: any) {
      console.error('❌ Error processing expired subscriptions:', error);
    }
  }

  /**
   * Send warning notifications for subscriptions expiring within 7 days.
   */
  public static async sendExpiryWarnings() {
    try {
      console.log('🔍 Checking for subscriptions expiring within 7 days...');
      await connectToDatabase();

      const now = new Date();
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(now.getDate() + 7);

      // Trial ending soon
      const expiringTrials = await User.find({
        'subscription.status': 'trial',
        'subscription.trialEndsAt': {
          $gte: now,
          $lte: sevenDaysFromNow,
        },
      }).select('_id name email subscription');

      // Paid subscriptions ending soon
      const expiringSubscriptions = await User.find({
        'subscription.status': 'active',
        'subscription.expiryDate': {
          $gte: now,
          $lte: sevenDaysFromNow,
        },
        'subscription.plan': { $in: ['paid', 'enterprise'] },
      }).select('_id name email subscription');

      console.log(`📋 Found ${expiringTrials.length} trials and ${expiringSubscriptions.length} subscriptions expiring soon`);

      for (const user of [...expiringTrials, ...expiringSubscriptions]) {
        const isTrial = user.subscription?.status === 'trial';
        const endDate = isTrial
          ? user.subscription?.trialEndsAt
          : user.subscription?.expiryDate;
        const daysRemaining = endDate
          ? Math.ceil(
              (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

        try {
          await Notification.create({
            owner: user._id,
            type: 'subscription_expiry_warning',
            title: isTrial
              ? 'Trial Period Ending Soon'
              : 'Subscription Expiring Soon',
            message: isTrial
              ? `Your free trial ends in ${daysRemaining} day(s). Upgrade now to avoid interruption.`
              : `Your ${user.subscription?.plan} subscription expires in ${daysRemaining} day(s). Renew to keep your business running.`,
            metadata: {
              userId: user._id.toString(),
              plan: user.subscription?.plan ?? 'unknown',
              status: user.subscription?.status ?? 'unknown',
              daysRemaining,
              expiresAt: endDate?.toISOString(),
            },
          });
        } catch (notifError) {
          console.error(
            `Failed to create expiry warning for user ${user._id}:`,
            notifError,
          );
        }
      }

      console.log('✅ Expiry warning notifications sent');
    } catch (error: any) {
      console.error('❌ Error sending expiry warnings:', error);
    }
  }
}