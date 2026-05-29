import mongoose from 'mongoose';

import { AppError } from '@/lib/utils';

export async function getNextCounterSequence(
  collectionName: string,
  query: Record<string, unknown>,
  startingSequence: number,
): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError('Database connection not available', 500);
  }

  const initialSequence = Math.max(startingSequence, 1);

  const counter = await db.collection(collectionName).findOneAndUpdate(
    query,
    [
      {
        $set: {
          ...query,
          sequence: {
            $add: [
              { $ifNull: ['$sequence', initialSequence - 1] },
              1,
            ],
          },
        },
      },
    ],
    {
      upsert: true,
      returnDocument: 'after',
      includeResultMetadata: true,
    },
  ) as unknown as { value?: { sequence: number } } | null;

  return counter?.value?.sequence ?? initialSequence;
}
