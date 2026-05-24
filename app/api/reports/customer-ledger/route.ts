import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import Party from '@/models/Party';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const partyId = searchParams.get('partyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    // If partyId specified, get ledger for that party
    // Otherwise, list all parties with their balances for the selector
    const partyMatch: any = { owner: ownerId, isArchived: false };
    if (shopId) partyMatch.shopId = shopId;

    if (!partyId) {
      const parties = await Party.find(partyMatch)
        .select('displayName partyType currentBalance phoneNumber')
        .sort({ displayName: 1 })
        .lean();

      return NextResponse.json({
        parties: parties.map(p => ({
          _id: p._id,
          displayName: p.displayName,
          partyType: p.partyType,
          currentBalance: p.currentBalance,
          phoneNumber: p.phoneNumber,
        })),
        selectedParty: null,
        ledger: [],
      });
    }

    // Get the selected party
    const party = await Party.findById(partyId)
      .select('displayName partyType currentBalance creditLimit phoneNumber email')
      .lean();

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    // Get all transactions for this party
    const txMatch: any = {
      owner: ownerId,
      party: new Types.ObjectId(partyId),
      status: { $in: ['confirmed', 'draft'] },
    };
    if (shopId) txMatch.shopId = shopId;
    if (startDate || endDate) {
      txMatch.transactionDate = {};
      if (startDate) txMatch.transactionDate.$gte = new Date(startDate);
      if (endDate) txMatch.transactionDate.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(txMatch)
      .populate('party', 'displayName')
      .select('transactionNumber type transactionDate summary.grandTotal summary.paidAmount summary.dueAmount lineItems')
      .sort({ transactionDate: 1 })
      .lean();

    // Calculate running balance
    let runningBalance = party.openingBalance || 0;
    const ledger = transactions.map((tx: any) => {
      const isSale = tx.type === 'sale' || tx.type === 'sale-return';
      const isPurchase = tx.type === 'purchase' || tx.type === 'purchase-return';
      const isPaymentIn = tx.type === 'payment-in';
      const isPaymentOut = tx.type === 'payment-out';

      let debit = 0; // Amount customer owes (increases balance)
      let credit = 0; // Amount customer pays (decreases balance)

      if (tx.type === 'sale') debit = tx.summary?.grandTotal || 0;
      else if (tx.type === 'sale-return') credit = tx.summary?.grandTotal || 0;
      else if (tx.type === 'payment-in') credit = tx.summary?.grandTotal || 0;
      else if (tx.type === 'payment-out') debit = tx.summary?.grandTotal || 0;
      else if (tx.type === 'purchase') credit = tx.summary?.grandTotal || 0;
      else if (tx.type === 'purchase-return') debit = tx.summary?.grandTotal || 0;

      runningBalance = roundCurrency(runningBalance + debit - credit);

      return {
        _id: tx._id,
        date: tx.transactionDate,
        transactionNumber: tx.transactionNumber,
        type: tx.type,
        items: tx.lineItems?.map((li: any) => li.itemName).join(', ') || '',
        debit: roundCurrency(debit),
        credit: roundCurrency(credit),
        balance: runningBalance,
      };
    });

    return NextResponse.json({
      selectedParty: {
        _id: party._id,
        displayName: party.displayName,
        partyType: party.partyType,
        currentBalance: party.currentBalance,
        creditLimit: party.creditLimit,
        phoneNumber: party.phoneNumber,
        email: party.email,
      },
      ledger,
      summary: {
        openingBalance: party.openingBalance || 0,
        totalDebit: roundCurrency(ledger.reduce((s: number, l: any) => s + l.debit, 0)),
        totalCredit: roundCurrency(ledger.reduce((s: number, l: any) => s + l.credit, 0)),
        closingBalance: runningBalance,
      },
    });
  } catch (error) {
    console.error('Customer ledger error:', error);
    return NextResponse.json({ error: 'Failed to load customer ledger' }, { status: 500 });
  }
}