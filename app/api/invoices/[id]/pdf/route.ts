import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError } from '@/lib/utils';
import Invoice from '@/models/Invoice';
import Settings from '@/models/Settings';
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

    // Fetch business settings for shop or owner
    const query: Record<string, unknown> = { owner: user.id };
    if (user.activeShopId) {
      query.shopId = user.activeShopId;
    } else {
      query.shopId = null;
    }
    let settings = await Settings.findOne(query).lean();
    // Fallback to owner-level settings if no shop-level settings exist
    if (!settings && user.activeShopId) {
      settings = await Settings.findOne({ owner: user.id, shopId: null }).lean();
    }

    const business = settings?.business;

    // Build a formatted address string
    let businessAddress = '';
    if (business?.address) {
      const addr = business.address;
      businessAddress = [addr.line1, addr.city, addr.state].filter(Boolean).join(', ');
    }

    // Read logo and convert to base64 data URI
    let logoDataUri: string | undefined;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const ext = path.extname('logo.png').slice(1);
        logoDataUri = `data:image/${ext};base64,${logoBuffer.toString('base64')}`;
      }
    } catch {
      // Logo is optional, silently skip if it fails
    }

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
      business: {
        displayName: business?.displayName,
        legalName: business?.legalName,
        address: businessAddress,
        gstin: business?.gstin,
        phoneNumber: business?.phoneNumber,
        email: business?.email,
      },
      logoDataUri,
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