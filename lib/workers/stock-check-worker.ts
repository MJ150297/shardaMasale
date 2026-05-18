import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import Item from '@/models/Item';
import { publishNotification } from '@/lib/notifications/notification-service';

/**
 * Stock Check Worker - Runs every hour to check for low stock items
 * Creates notifications when items fall below reorder level
 */
export class StockCheckWorker {
  private static isRunning = false;

  public static start() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      await this.runStockCheck();
    });

    console.log('✅ Stock Check Worker scheduled to run every hour');
  }

  public static async runStockCheck() {
    if (this.isRunning) {
      console.log('⏭️ Stock check already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔍 Running stock level check...');

      await connectToDatabase();

      // Find all items below or equal to reorder level
      const lowStockItems = await Item.find({
        trackInventory: true,
        status: 'active',
        'stock.reorderLevel': { $gt: 0 },
        $expr: {
          $lte: ['$stock.currentQuantity', '$stock.reorderLevel']
        }
      }).lean();

      console.log(`📋 Found ${lowStockItems.length} items with low stock`);

      for (const item of lowStockItems) {
        // dedup handled by publishNotification service; proceed to publish

        // Publish low stock notification through the centralized notification service
        await publishNotification({
          eventKey: 'item.low_stock',
          recipientUserIds: [item.owner.toString()],
          businessOwnerId: item.owner.toString(),
          shopId: item.shopId?.toString() ?? null,
          entityType: 'Item',
          entityId: item._id.toString(),
          payload: {
            itemId: item._id.toString(),
            itemName: item.name,
            sku: item.sku,
            currentQuantity: item.stock.currentQuantity,
            reorderLevel: item.stock.reorderLevel,
            unitOfMeasure: item.unitOfMeasure,
            shopId: item.shopId?.toString() ?? null,
          },
        });

        console.log(`✅ Created low stock notification for: ${item.name}`);
      }

      console.log('✅ Stock check completed successfully');
    } catch (error) {
      console.error('❌ Error during stock check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Manual trigger for testing
  public static async triggerManually() {
    console.log('🔧 Manually triggering stock check...');
    await this.runStockCheck();
  }
}

// Auto start worker in production
if (process.env.NODE_ENV === 'production') {
  StockCheckWorker.start();
}