import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireOwner, requireActiveBusinessSubscription } from '@/lib/auth';
import { isAdvancedReport } from '@/lib/subscription-features';
import connectToDatabase from '@/lib/db';
import Transaction from '@/models/Transaction';
import { roundCurrency } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const user = await requireOwner();
    const { features } = await requireActiveBusinessSubscription();
    if (!features.advancedReports || !isAdvancedReport('tax')) {
      return NextResponse.json(
        { error: 'Advanced reports are not available on your plan. Upgrade to access this report.' },
        { status: 403 }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const ownerId = new Types.ObjectId(user.id);
    const shopId = shopIdParam ? new Types.ObjectId(shopIdParam) : null;

    const match: any = { owner: ownerId, status: 'confirmed' };
    if (shopId) match.shopId = shopId;
    if (startDate || endDate) {
      match.transactionDate = {};
      if (startDate) match.transactionDate.$gte = new Date(startDate);
      if (endDate) match.transactionDate.$lte = new Date(endDate);
    }

    // ===================== OUTPUT TAX (Sales) =====================
    // Unwind line items from sale transactions to get tax details
    const outputTax = await Transaction.aggregate([
      { $match: { ...match, type: 'sale' } },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: {
            taxRate: '$lineItems.taxRate',
            hsnCode: '$lineItems.sku', // SKU as proxy for HSN
          },
          taxableAmount: { $sum: { $subtract: [{ $multiply: ['$lineItems.quantity', '$lineItems.unitPrice'] }, '$lineItems.discountAmount'] } },
          taxAmount: { $sum: '$lineItems.taxAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.taxRate': -1 } },
    ]);

    // ===================== INPUT TAX (Purchases) =====================
    const inputTax = await Transaction.aggregate([
      { $match: { ...match, type: 'purchase' } },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: {
            taxRate: '$lineItems.taxRate',
            hsnCode: '$lineItems.sku',
          },
          taxableAmount: { $sum: { $subtract: [{ $multiply: ['$lineItems.quantity', '$lineItems.unitPrice'] }, '$lineItems.discountAmount'] } },
          taxAmount: { $sum: '$lineItems.taxAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.taxRate': -1 } },
    ]);

    // ===================== SUMMARY =====================
    const totalOutputTax = outputTax.reduce((sum: number, t: any) => sum + t.taxAmount, 0);
    const totalInputTax = inputTax.reduce((sum: number, t: any) => sum + t.taxAmount, 0);
    const netTaxLiability = roundCurrency(totalOutputTax - totalInputTax);

    // Tax rate slab summary
    const rateSlabs = new Map<number, { rate: number; outputTaxable: number; outputTax: number; inputTaxable: number; inputTax: number }>();
    
    for (const t of outputTax) {
      const rate = t._id.taxRate;
      if (!rateSlabs.has(rate)) {
        rateSlabs.set(rate, { rate, outputTaxable: 0, outputTax: 0, inputTaxable: 0, inputTax: 0 });
      }
      const slab = rateSlabs.get(rate)!;
      slab.outputTaxable += t.taxableAmount;
      slab.outputTax += t.taxAmount;
    }
    
    for (const t of inputTax) {
      const rate = t._id.taxRate;
      if (!rateSlabs.has(rate)) {
        rateSlabs.set(rate, { rate, outputTaxable: 0, outputTax: 0, inputTaxable: 0, inputTax: 0 });
      }
      const slab = rateSlabs.get(rate)!;
      slab.inputTaxable += t.taxableAmount;
      slab.inputTax += t.taxAmount;
    }

    const taxSlabs = Array.from(rateSlabs.values()).map(s => ({
      ...s,
      outputTaxable: roundCurrency(s.outputTaxable),
      outputTax: roundCurrency(s.outputTax),
      inputTaxable: roundCurrency(s.inputTaxable),
      inputTax: roundCurrency(s.inputTax),
      netTax: roundCurrency(s.outputTax - s.inputTax),
    })).sort((a, b) => b.rate - a.rate);

    // Get sale and purchase totals for reference
    const saleTotal = await Transaction.aggregate([
      { $match: { ...match, type: 'sale' } },
      { $group: { _id: null, total: { $sum: '$summary.grandTotal' } } },
    ]);
    const purchaseTotal = await Transaction.aggregate([
      { $match: { ...match, type: 'purchase' } },
      { $group: { _id: null, total: { $sum: '$summary.grandTotal' } } },
    ]);

    return NextResponse.json({
      summary: {
        totalSales: roundCurrency(saleTotal[0]?.total || 0),
        totalPurchases: roundCurrency(purchaseTotal[0]?.total || 0),
        totalOutputTax: roundCurrency(totalOutputTax),
        totalInputTax: roundCurrency(totalInputTax),
        netTaxLiability,
        isPayable: netTaxLiability > 0,
      },
      taxSlabs,
      outputTaxBreakdown: outputTax.map((t: any) => ({
        taxRate: t._id.taxRate,
        hsnCode: t._id.hsnCode || 'N/A',
        taxableAmount: roundCurrency(t.taxableAmount),
        taxAmount: roundCurrency(t.taxAmount),
        count: t.count,
      })),
      inputTaxBreakdown: inputTax.map((t: any) => ({
        taxRate: t._id.taxRate,
        hsnCode: t._id.hsnCode || 'N/A',
        taxableAmount: roundCurrency(t.taxableAmount),
        taxAmount: roundCurrency(t.taxAmount),
        count: t.count,
      })),
    });
  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json({ error: 'Failed to load tax report' }, { status: 500 });
  }
}
