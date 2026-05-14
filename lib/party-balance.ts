import Party from '@/models/Party';
import { roundCurrency } from '@/lib/utils';
import type { ClientSession } from 'mongoose';

type BalanceTransactionType =
  | 'sale'
  | 'purchase'
  | 'sale-return'
  | 'purchase-return'
  | 'payment-in'
  | 'payment-out'
  | 'adjustment'
  | 'opening-balance';

/**
 * Computes the balance delta for a given transaction type.
 * From the business's perspective: positive = party owes business, negative = business owes party.
 */
export function getBalanceDelta(
  type: BalanceTransactionType,
  grandTotal: number,
  paidAmount: number,
): number {
  switch (type) {
    case 'sale':
      return roundCurrency(grandTotal);
    case 'sale-return':
      return roundCurrency(-grandTotal);
    case 'payment-in':
      return roundCurrency(-paidAmount);
    case 'purchase':
      return roundCurrency(-grandTotal);
    case 'purchase-return':
      return roundCurrency(grandTotal);
    case 'payment-out':
      return roundCurrency(paidAmount);
    case 'adjustment':
    case 'opening-balance':
      return 0;
    default:
      return 0;
  }
}

/**
 * Updates the party's currentBalance by the given delta.
 * Should be called inside a transaction session.
 */
export async function updatePartyBalance(
  partyId: string,
  delta: number,
  ownerId: string,
  session: ClientSession,
) {
  if (delta === 0) return;

  await Party.findOneAndUpdate(
    {
      _id: partyId,
      owner: ownerId,
    },
    {
      $inc: { currentBalance: delta },
    },
    { session },
  );
}