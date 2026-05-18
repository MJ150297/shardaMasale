import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import { publishNotification } from '@/lib/notifications/notification-service';

/**
 * Customer Inactivity Worker - checks for customers without recent business activity
 * and notifies the business owner when a customer has not been invoiced or transacted
 * with for 100 days.
 */
export class CustomerInactivityWorker {
  private static isRunning = false;

  public static start() {
    cron.schedule('0 4 * * *', async () => {
      await this.runInactivityCheck();
    });

    console.log('✅ Customer Inactivity Worker scheduled to run daily at 04:00 AM');
  }

  public static async runInactivityCheck() {
    if (this.isRunning) {
      console.log('⏭️ Customer inactivity check already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔍 Running customer inactivity check...');

      await connectToDatabase();

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 100);

      const recentPartyIds = await Transaction.find(
        {
          party: { $ne: null },
          type: { $in: ['sale', 'purchase', 'sale-return', 'purchase-return'] },
          status: 'confirmed',
          transactionDate: { $gte: cutoff },
        },
        'party',
      )
        .distinct('party')
        .exec();

      const inactiveCustomers = await Party.find({
        partyType: 'customer',
        status: 'active',
        isArchived: false,
        _id: { $nin: recentPartyIds },
      }).lean();

      console.log(`📋 Found ${inactiveCustomers.length} inactive customers`);

      for (const customer of inactiveCustomers) {
        try {
          await publishNotification({
            eventKey: 'party.inactive',
            recipientUserIds: [customer.owner.toString()],
            businessOwnerId: customer.owner.toString(),
            shopId: customer.shopId?.toString() ?? null,
            entityType: 'Party',
            entityId: customer._id.toString(),
            payload: {
              partyId: customer._id.toString(),
              partyName: customer.displayName,
              inactivityDays: 100,
            },
          });

          console.log(`✅ Created inactivity notification for customer: ${customer.displayName}`);
        } catch (notifyError) {
          console.error(
            `❌ Failed to create inactivity notification for customer ${customer.displayName}:`,
            notifyError,
          );
        }
      }

      console.log('✅ Customer inactivity check completed');
    } catch (error) {
      console.error('❌ Error during customer inactivity check:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

if (process.env.NODE_ENV === 'production') {
  CustomerInactivityWorker.start();
}
