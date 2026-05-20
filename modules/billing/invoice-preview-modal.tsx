'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Download, Printer } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import InvoiceShareSheet from '@/components/invoice-share-sheet';
import { useActiveShop } from '@/components/providers/shop-provider';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onDownload: () => void;
  onPrint: () => void;
}

interface BusinessSettings {
  displayName?: string;
  legalName?: string;
  email?: string;
  phoneNumber?: string;
  gstin?: string;
  pan?: string;
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export default function InvoicePreviewModal({
  open,
  onOpenChange,
  invoice,
  onDownload,
  onPrint
}: InvoicePreviewModalProps) {
  const { activeShopId } = useActiveShop();
  const [business, setBusiness] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    if (!open) return;

    const fetchSettings = async () => {
      try {
        const queryParam = activeShopId ? `?shopId=${activeShopId}` : '';
        const res = await fetch(`/api/settings${queryParam}`);
        if (res.ok) {
          const settings = await res.json();
          setBusiness(settings.business);
        }
      } catch (error) {
        console.error('Failed to fetch business settings:', error);
      }
    };
    fetchSettings();
  }, [open, activeShopId]);

  const businessName = business?.displayName || business?.legalName || 'BUSINESS NAME';
  const businessAddress = business?.address
    ? [business.address.line1, business.address.city, business.address.state]
        .filter(Boolean)
        .join(', ')
    : 'Business Address';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none! w-[95vw] sm:w-[90vw] max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="p-3 sm:p-4 border-b flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-sm sm:text-base truncate pr-2">Invoice: {invoice?.invoiceNumber}</DialogTitle>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <InvoiceShareSheet
              invoice={{
                id: invoice?.id || invoice?._id || invoice?.invoiceNumber,
                invoiceNumber: invoice?.invoiceNumber,
                grandTotal: invoice?.totalAmount || invoice?.transactionId?.summary?.grandTotal || invoice?.summary?.grandTotal || 0,
                dueDate: invoice?.dueDate,
                party: invoice?.transactionId?.party || invoice?.party,
                // Pass the full transaction data for image capture
                transactionId: invoice?.transactionId,
                lineItems: invoice?.transactionId?.lineItems || invoice?.lineItems,
                additionalCharges: invoice?.transactionId?.additionalCharges || invoice?.additionalCharges,
                subtotal: invoice?.transactionId?.summary?.subtotal || invoice?.summary?.subtotal,
                discountTotal: invoice?.transactionId?.summary?.discountTotal || invoice?.summary?.discountTotal,
                taxTotal: invoice?.transactionId?.summary?.taxTotal || invoice?.summary?.taxTotal,
                notes: invoice?.notes,
                termsAndConditions: invoice?.termsAndConditions,
              }}
              variant="button"
            />
            <Button size="sm" onClick={onDownload} className="px-2 sm:px-3">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button size="sm" onClick={onPrint} className="px-2 sm:px-3">
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-100 flex-1">
          <div className="max-w-3xl mx-auto shadow-xl rounded-md">
            <div className="relative bg-white p-4 sm:p-8 md:p-12 rounded-md overflow-hidden sm:aspect-[1/1.414]">
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <Image
                src="/logo.png"
                alt=""
                width={300}
                height={300}
                className="opacity-10 object-contain"
                style={{ maxWidth: '60%', maxHeight: '60%', width: 'auto', height: 'auto' }}
                priority
              />
            </div>
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{businessName}</h2>
                <p className="text-sm text-gray-500">{businessAddress}</p>
                {business?.gstin && (
                  <p className="text-sm text-gray-500">GSTIN: {business.gstin}</p>
                )}
                {business?.phoneNumber && (
                  <p className="text-sm text-gray-500">Phone: {business.phoneNumber}</p>
                )}
                {business?.email && (
                  <p className="text-sm text-gray-500">Email: {business.email}</p>
                )}
              </div>
              <div className="text-left sm:text-right">
                <h1 className="text-2xl sm:text-3xl font-bold text-blue-600">INVOICE</h1>
                <div className="mt-2 sm:mt-3 text-sm text-gray-600 space-y-0.5 sm:space-y-1">
                  <p>Invoice #: {invoice?.invoiceNumber}</p>
                  <p>Date: {invoice?.transactionId?.transactionDate ? formatDate(invoice.transactionId.transactionDate) : ''}</p>
                  <p>Due Date: {invoice?.dueDate ? formatDate(invoice.dueDate) : ''}</p>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <h3 className="font-semibold text-sm border-b pb-1 mb-2">Bill To</h3>
              <div className="text-sm">
                <p className="font-medium">{invoice?.transactionId?.party?.displayName || invoice?.transactionId?.party?.name}</p>
                {(invoice?.transactionId?.party?.phoneNumber || invoice?.transactionId?.party?.phone) && (
                  <p className="text-gray-500">{invoice?.transactionId?.party?.phoneNumber || invoice?.transactionId?.party?.phone}</p>
                )}
                {invoice?.transactionId?.party?.email && (
                  <p className="text-gray-500">{invoice?.transactionId?.party?.email}</p>
                )}
                {(() => {
                  const party = invoice?.transactionId?.party;
                  const addressStr = party?.address;
                  const billingAddr = party?.billingAddress;
                  if (addressStr) {
                    return <p className="text-gray-500">{addressStr}</p>;
                  }
                  if (billingAddr) {
                    const parts = [billingAddr.line1, billingAddr.city, billingAddr.state, billingAddr.postalCode].filter(Boolean);
                    return parts.length > 0 ? <p className="text-gray-500">{parts.join(', ')}</p> : null;
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-2 font-medium">Item</th>
                  <th className="text-center py-2 px-2 font-medium">Qty</th>
                  <th className="text-right py-2 px-2 font-medium">Price</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice?.transactionId?.lineItems?.map((item: any, index: number) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-2">{item.itemName}</td>
                    <td className="py-3 px-2 text-center">{item.quantity}</td>
                    <td className="py-3 px-2 text-right">₹{item.unitPrice.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">₹{item.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Summary */}
            <div className="ml-auto w-full sm:w-1/2 md:w-1/3 text-sm">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>₹{invoice?.transactionId?.summary?.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Discount</span>
                <span>- ₹{invoice?.transactionId?.summary?.discountTotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax</span>
                <span>₹{invoice?.transactionId?.summary?.taxTotal?.toFixed(2)}</span>
              </div>
              {invoice?.transactionId?.additionalCharges?.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <p className="font-semibold text-xs text-gray-600 mb-1">Additional Charges</p>
                  {invoice.transactionId.additionalCharges.map((charge: any, index: number) => (
                    <div key={index} className="flex justify-between py-0.5 text-xs">
                      <span>{charge.name}</span>
                      <span>₹{Number(charge.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-black font-bold text-base mt-2">
                <span>Total</span>
                <span>₹{invoice?.transactionId?.summary?.grandTotal?.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            {invoice?.notes && (
              <div className="mt-8">
                <h4 className="font-semibold text-sm border-b pb-1 mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}

            {invoice?.termsAndConditions && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm border-b pb-1 mb-2">Terms & Conditions</h4>
                <p className="text-sm text-gray-600">{invoice.termsAndConditions}</p>
              </div>
            )}

            <div className="mt-12 pt-8 border-t text-center text-xs text-gray-500">
              <p>Thank you for your business!</p>
            </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}