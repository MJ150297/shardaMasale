import cron from 'node-cron';
import connectToDatabase from '@/lib/db';
import Invoice from '@/models/Invoice';
import { publishNotification } from '@/lib/notifications/notification-service';

/**
 * Invoice Overdue Worker - Runs daily at midnight
 * Checks invoices with due date passed and marks them as overdue
 */
export class InvoiceOverdueWorker {
  private static isRunning = false;

  public static start() {
    // Run every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
      await this.runOverdueCheck();
      await this.sendReminders();
    });

    console.log('✅ Invoice Overdue Worker scheduled to run daily at 10:00 AM');
  }

  public static async sendReminders() {
    if (this.isRunning) return;

    try {
      console.log('🔍 Running invoice reminder check...');
      await connectToDatabase();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysBefore = new Date(today);
      sevenDaysBefore.setDate(today.getDate() + 7);

      const sevenDaysAfter = new Date(today);
      sevenDaysAfter.setDate(today.getDate() - 7);

      // 1. Reminder 7 days before due date
      const dueIn7Days = await Invoice.find({
        status: 'sent',
        dueDate: { $gte: today, $lt: sevenDaysBefore },
        'reminders.7daysBefore': { $ne: true }
      }).populate('transactionId party') as any[];

      // 2. Reminder on due date
      const dueToday = await Invoice.find({
        status: 'sent',
        dueDate: { $gte: today, $lt: new Date(today.getTime() + 24*60*60*1000) },
        'reminders.onDueDate': { $ne: true }
      }).populate('transactionId party') as any[];

      // 3. Reminder 7 days overdue
      const overdue7Days = await Invoice.find({
        status: 'overdue',
        dueDate: { $lte: sevenDaysAfter },
        'reminders.7daysOverdue': { $ne: true }
      }).populate('transactionId party') as any[];

      console.log(`📋 Sending ${dueIn7Days.length} 7d before reminders`);
      console.log(`📋 Sending ${dueToday.length} due today reminders`);
      console.log(`📋 Sending ${overdue7Days.length} 7d overdue reminders`);

      // Send WhatsApp reminders
      for (const invoice of [...dueIn7Days, ...dueToday, ...overdue7Days]) {
        if (invoice.transactionId?.party?.phone) {
          await this.sendWhatsAppReminder(invoice);
        }
      }

      console.log('✅ Invoice reminders sent successfully');
    } catch (error) {
      console.error('❌ Error sending invoice reminders:', error);
    }
  }

  private static async sendWhatsAppReminder(invoice: any) {
    try {
      const amount = invoice.transactionId?.summary?.grandTotal || 0;
      const dueDate = new Date(invoice.dueDate as any).toLocaleDateString('en-IN');
      
      const message = `*Reminder: Invoice ${invoice.invoiceNumber}*\n\nAmount: ₹ ${amount.toFixed(2)}\nDue Date: ${dueDate}\n\nThank you.`;

      // WhatsApp API integration will be added here
      console.log(`📱 WhatsApp reminder sent to ${invoice.transactionId.party.phone}: ${invoice.invoiceNumber}`);

      // Update reminder flags
      if (!invoice.reminders) invoice.reminders = {};
      
      const today = new Date();
      const diffDays = Math.ceil((new Date(invoice.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        invoice.reminders['7daysBefore'] = true;
      } else if (diffDays === 0) {
        invoice.reminders['onDueDate'] = true;
      } else if (diffDays <= -7) {
        invoice.reminders['7daysOverdue'] = true;
      }

      invoice.lastReminderSent = new Date();
      await invoice.save();

    } catch (error) {
      console.error(`❌ Failed to send reminder for invoice ${invoice.invoiceNumber}:`, error);
    }
  }

  public static async runOverdueCheck() {
    if (this.isRunning) {
      console.log('⏭️ Invoice overdue check already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔍 Running invoice overdue check...');

      await connectToDatabase();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all invoices where due date < today and status is sent
      const overdueInvoices = await Invoice.find({
        status: 'sent',
        dueDate: { $lt: today },
      }).populate('transactionId') as any[];

      console.log(`📋 Found ${overdueInvoices.length} overdue invoices`);

      for (const invoice of overdueInvoices) {
        // Update invoice status to overdue
        invoice.status = 'overdue';
        await invoice.save();

        // Publish overdue invoice notification through the centralized notification service
        await publishNotification({
          eventKey: 'invoice.overdue',
          recipientUserIds: [(invoice as any).owner.toString()],
          businessOwnerId: (invoice as any).owner.toString(),
          shopId: null,
          entityType: 'Invoice',
          entityId: invoice._id.toString(),
          payload: {
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            amount: invoice.transactionId?.summary?.grandTotal,
          },
        });

        console.log(`✅ Marked invoice ${invoice.invoiceNumber} as overdue`);
      }

      console.log('✅ Invoice overdue check completed successfully');
    } catch (error: any) {
      console.error('❌ Error during invoice overdue check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Manual trigger for testing
}