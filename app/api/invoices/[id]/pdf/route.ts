import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Invoice from '@/models/Invoice';
import InvoicePDF from '@/modules/billing/invoice-pdf';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const user = await requireBusinessUser();
    await connectToDatabase();

    const invoice = await Invoice.findOne({
      _id: params.id,
      owner: user.id
    })
    .populate('transactionId')
    .populate({
      path: 'transactionId',
      populate: {
        path: 'party'
      }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const transaction = invoice.transactionId as any;

    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(transaction.transactionDate).toLocaleDateString('en-IN'),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '',
      customer: {
        name: transaction.party?.displayName || transaction.party?.name || 'Guest Customer',
        phone: transaction.party?.phone,
        email: transaction.party?.email,
        address: transaction.party?.address,
      },
      lineItems: transaction.lineItems.map((item: any) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: transaction.summary.subtotal,
      discountTotal: transaction.summary.discountTotal,
      taxTotal: transaction.summary.taxTotal,
      grandTotal: transaction.summary.grandTotal,
      notes: invoice.notes,
      termsAndConditions: invoice.termsAndConditions,
    };

    // @ts-ignore - react-pdf types incompatibility
    const pdfBuffer = await renderToBuffer(
      // @ts-ignore - react-pdf types incompatibility
      React.createElement(InvoicePDF, { invoice: invoiceData })
    );

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    // Safe HTTP status code handling with proper validation and clamping
    const status = Number(error.status) || 500;
    const validStatus = Math.min(Math.max(Math.trunc(status), 200), 599);
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: validStatus });
  }
}