#!/usr/bin/env node

/**
 * One-time script to backfill invoiceId references on Transaction documents
 * for invoices that were created before the invoiceId field was added.
 * 
 * Usage: npx tsx scripts/backfill-invoice-ids.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function backfillInvoiceIds() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not configured in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Get the Invoice and Transaction collections directly
    const db = mongoose.connection.db!;
    const invoices = db.collection('invoices');
    const transactions = db.collection('transactions');

    // Find all invoices
    const allInvoices = await invoices.find({}).toArray();
    console.log(`ℹ️  Found ${allInvoices.length} invoices to process`);

    let updated = 0;
    let skipped = 0;

    for (const invoice of allInvoices) {
      const transactionId = invoice.transactionId;

      if (!transactionId) {
        console.log(`  ⏭️  Invoice ${invoice.invoiceNumber} has no transactionId, skipping`);
        skipped++;
        continue;
      }

      const result = await transactions.findOneAndUpdate(
        { _id: transactionId, invoiceId: { $exists: false } },
        { $set: { invoiceId: invoice._id } },
      );

      if (result) {
        console.log(`  ✅ Updated transaction ${transactionId} with invoice ${invoice.invoiceNumber}`);
        updated++;
      } else {
        console.log(`  ⏭️  Transaction ${transactionId} already has invoiceId or not found`);
        skipped++;
      }
    }

    console.log('');
    console.log('✅ Backfill complete!');
    console.log(`   Updated: ${updated} transactions`);
    console.log(`   Skipped: ${skipped} transactions`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

backfillInvoiceIds();