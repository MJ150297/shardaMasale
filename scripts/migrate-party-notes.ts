/**
 * Migration script: Convert old string `notes` field to new `notesList` array format.
 * 
 * Run with: npx tsx scripts/migrate-party-notes.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Party from '../models/Party';

dotenv.config();

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.error('MONGODB_URI or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Find all parties that have a non-null `notes` string but no `notesList` entries
  const parties = await Party.find({
    notes: { $nin: [null, ''] },
    $or: [
      { notesList: { $exists: false } },
      { notesList: { $size: 0 } },
    ],
  });

  console.log(`Found ${parties.length} parties with legacy string notes`);

  let migrated = 0;
  for (const party of parties) {
    try {
      if (!party.notes) continue;

      // Convert the old string note to a structured note
      (party.notesList as any) = [{
        content: party.notes,
        category: 'general',
        tags: [],
        pinned: false,
        history: [],
      }];

      // Clear the old field
      party.notes = null;

      await party.save();
      migrated++;
      console.log(`  ✓ Migrated party: ${party.displayName} (${party._id})`);
    } catch (error) {
      console.error(`  ✗ Failed to migrate party ${party._id}:`, error);
    }
  }

  console.log(`\nMigration complete. ${migrated}/${parties.length} parties migrated.`);
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});