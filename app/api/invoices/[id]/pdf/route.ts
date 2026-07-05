import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import fs from 'fs';
import path from 'path';
import connectToDatabase from '@/lib/db';
import { requireBusinessUser } from '@/lib/auth';
import { AppError, numberToWords } from '@/lib/utils';
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
    const billingSettings = settings?.billing;
    const defaultTerms = billingSettings?.termsAndConditions || null;
    const showSubItems = (billingSettings as any)?.showSubItemsInInvoice === true;
    const settingsLogo = (settings?.business as any)?.logo || null;
    const authorisedSignature = (billingSettings as any)?.authorisedSignature || null;

    // Build a formatted business address string
    let businessAddress = '';
    if (business?.address) {
      const addr = business.address;
      businessAddress = [addr.line1, addr.city, addr.state].filter(Boolean).join(', ');
    }

    // Build a formatted customer billing address from the structured billingAddress object
    let customerAddress = '';
    const billingAddr = transaction.party?.billingAddress;
    if (billingAddr?.line1) {
      const lineParts = [billingAddr.line1, billingAddr.line2, billingAddr.landmark].filter(Boolean);
      customerAddress = lineParts.join(', ');
      const cityLine = [billingAddr.city, billingAddr.state].filter(Boolean).join(', ');
      if (cityLine) customerAddress += '\n' + cityLine;
    }

    // Use per-shop/business logo from settings, fall back to public/logo.png
    let logoDataUri: string | undefined = settingsLogo || undefined;
    if (!logoDataUri) {
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
    }

    // Build enriched line items with HSN codes and descriptions
    // Optionally expand compound items into sub-items for the PDF
    const enrichedLineItems: any[] = [];
    const { default: Item } = await import('@/models/Item');

    for (const item of transaction.lineItems) {
      let hsnCode: string | undefined;
      let description: string | undefined;
      let subItems: any[] | undefined;

      // Try to get HSN code and item type from the Item model if item reference exists
      if (item.item) {
        try {
          const itemDoc = await Item.findById(item.item).lean();
          if (itemDoc) {
            hsnCode = (itemDoc as any).hsnCode || undefined;

            // If showSubItems is enabled and this is a compound item, expand its components
            if (showSubItems && (itemDoc as any).itemType === 'compound') {
              const components = (itemDoc as any).components || [];
              if (components.length > 0) {
                // Fetch all component items to get names and prices
                const componentIds = components.map((c: any) => c.item);
                const componentItems = await Item.find({
                  _id: { $in: componentIds },
                }).lean();

                subItems = components.map((comp: any) => {
                  const compItem = componentItems.find(
                    (ci: any) => ci._id.toString() === comp.item.toString()
                  );
                  return {
                    itemName: compItem ? (compItem as any).name : 'Unknown Component',
                    quantity: comp.quantity * (item.quantity || 1),
                    unitPrice: compItem
                      ? ((compItem as any).pricing?.sellingPrice || 0)
                      : 0,
                    discountAmount: 0,
                    lineTotal: compItem
                      ? ((compItem as any).pricing?.sellingPrice || 0) * comp.quantity * (item.quantity || 1)
                      : 0,
                    hsnCode: compItem ? (compItem as any).hsnCode || undefined : undefined,
                    description: undefined,
                    taxRate: compItem
                      ? ((compItem as any).saleTaxRate || (compItem as any).taxRate || 0)
                      : 0,
                  };
                });
              }
            }
          }
        } catch {
          // Silently continue
        }
      }

      // Use description from transaction line item if available
      description = item.description || undefined;

      enrichedLineItems.push({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        lineTotal: item.lineTotal,
        hsnCode,
        itemHsn: hsnCode,
        description,
        taxRate: item.taxRate || 0,
        subItems,
      });
    }

    // Compute amount in words
    const grandTotal = transaction.summary.grandTotal || 0;
    const amountInWords = numberToWords(grandTotal);

    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(transaction.transactionDate).toLocaleDateString('en-IN'),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '',
      customer: {
        name: transaction.party?.displayName || transaction.party?.name || 'Guest Customer',
        phone: transaction.party?.phoneNumber,
        email: transaction.party?.email,
        address: customerAddress,
      },
      lineItems: enrichedLineItems,
      additionalCharges: (transaction.additionalCharges || []).map((charge: any) => ({
        name: charge.name,
        amount: Number(charge.amount),
      })),
      subtotal: transaction.summary.subtotal,
      discountTotal: transaction.summary.discountTotal,
      taxTotal: transaction.summary.taxTotal,
      roundOff: transaction.summary.roundOff,
      totalDiscount: transaction.summary.totalDiscount,
      totalDiscountType: transaction.summary.totalDiscountType,
      totalDiscountValue: transaction.summary.totalDiscountValue,
      grandTotal,
      paidAmount: transaction.summary.paidAmount,
      dueAmount: transaction.summary.dueAmount,
      payment: transaction.payment ? {
        method: transaction.payment.method,
        referenceNumber: transaction.payment.referenceNumber,
        notes: transaction.payment.notes,
      } : undefined,
      termsAndConditions: invoice.termsAndConditions || defaultTerms || null,
      business: {
        displayName: business?.displayName,
        legalName: business?.legalName,
        address: businessAddress,
        gstin: business?.gstin,
        pan: business?.pan,
        phoneNumber: business?.phoneNumber,
        email: business?.email,
        website: business?.website,
      },
      footerText: billingSettings?.footerText || null,
      logoDataUri,
      authorisedSignature,
      amountInWords,
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
