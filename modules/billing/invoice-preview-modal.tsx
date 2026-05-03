'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import Invoice from '@/models/Invoice';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onDownload: () => void;
  onPrint: () => void;
}

export default function InvoicePreviewModal({
  open,
  onOpenChange,
  invoice,
  onDownload,
  onPrint
}: InvoicePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
          <DialogTitle>Invoice Preview: {invoice?.invoiceNumber}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button size="sm" onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-8 bg-gray-100">
          <div className="max-w-3xl mx-auto bg-white shadow-xl p-12 rounded-md" style={{ aspectRatio: '1 / 1.414' }}>
            
            {/* Header */}
            <div className="flex justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">BUSINESS NAME</h2>
                <p className="text-sm text-gray-500">Business Address</p>
                <p className="text-sm text-gray-500">GSTIN: XXXXXXXXXX</p>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-blue-600">INVOICE</h1>
                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  <p>Invoice #: {invoice?.invoiceNumber}</p>
                  <p>Date: {invoice?.transactionId?.transactionDate ? new Date(invoice.transactionId.transactionDate).toLocaleDateString() : ''}</p>
                  <p>Due Date: {invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}</p>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <h3 className="font-semibold text-sm border-b pb-1 mb-2">Bill To</h3>
              <div className="text-sm">
                <p className="font-medium">{invoice?.transactionId?.party?.displayName || invoice?.transactionId?.party?.name}</p>
                <p className="text-gray-500">{invoice?.transactionId?.party?.phone}</p>
                <p className="text-gray-500">{invoice?.transactionId?.party?.address}</p>
              </div>
            </div>

            {/* Items Table */}
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

            {/* Summary */}
            <div className="ml-auto w-1/3 text-sm">
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

            <div className="mt-12 pt-8 border-t text-center text-xs text-gray-500">
              <p>Thank you for your business!</p>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}