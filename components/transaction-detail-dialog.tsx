'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowUpRight, ArrowDownLeft, Tag, CreditCard, IndianRupee, ShoppingCart, CalendarDays, Package, Info, BadgeCheck, AlertCircle, Phone, Mail } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';

// Types matching the Transaction interface used across the app
export interface TransactionLineItem {
  id?: string;
  item?: string | null;
  itemName: string;
  sku?: string | null;
  description?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costPrice?: number | null;
  itemType?: 'product' | 'service';
}

export interface TransactionSummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
}

export interface TransactionDialogData {
  id?: string;
  _id?: string;
  transactionNumber: string;
  type: 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'payment-in' | 'payment-out' | 'adjustment' | 'opening-balance';
  status: 'draft' | 'confirmed' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';
  party?: {
    id: string;
    name?: string;
    displayName?: string;
    phone?: string;
    phoneNumber?: string;
    email?: string;
  } | null;
  transactionDate: string | Date;
  dueDate?: string | Date | null;
  lineItems: TransactionLineItem[];
  summary: TransactionSummary;
  notes?: string | null;
  tags: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  } | null;
}

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionDialogData | null;
}

function getPartyName(party?: TransactionDialogData['party']) {
  return party?.displayName || party?.name || '-';
}

function getTypeBadgeClass(type: string) {
  switch (type) {
    case 'sale': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'purchase': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'sale-return': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'purchase-return': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'payment-in': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'payment-out': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none! w-[95vw] md:w-[90vw] p-0 bg-white/90 max-h-[85vh] overflow-y-auto">
        <DialogTitle className="sr-only">
          Transaction Details - {transaction.transactionNumber}
        </DialogTitle>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">Transaction Details</h2>
            <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono truncate">
              {transaction.transactionNumber}
            </span>
          </div>
        </div>

        {/* ===== MOBILE LAYOUT (< md) ===== */}
        <div className="md:hidden space-y-4 p-4">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={`${getTypeBadgeClass(transaction.type)} text-xs px-2.5 py-1`}>
              {transaction.type === 'sale' ? <ArrowUpRight className="h-3 w-3 mr-1 inline" /> :
               transaction.type === 'purchase' ? <ArrowDownLeft className="h-3 w-3 mr-1 inline" /> :
               <Tag className="h-3 w-3 mr-1 inline" />}
              {transaction.type.replace('-', ' ')}
            </Badge>
            <Badge className={`${getStatusBadgeClass(transaction.status)} text-xs px-2.5 py-1`}>
              {transaction.status === 'confirmed' ? <BadgeCheck className="h-3 w-3 mr-1 inline" /> :
               transaction.status === 'cancelled' ? <AlertCircle className="h-3 w-3 mr-1 inline" /> :
               <Info className="h-3 w-3 mr-1 inline" />}
              {transaction.status}
            </Badge>
            {(transaction.paymentStatus === 'paid' || transaction.paymentStatus === 'partial' || transaction.paymentStatus === 'unpaid') && (
              <Badge className={`${getPaymentBadgeClass(transaction.paymentStatus)} text-xs px-2.5 py-1`}>
                <CreditCard className="h-3 w-3 mr-1 inline" />
                {transaction.paymentStatus === 'paid' ? 'Paid' :
                 transaction.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
              </Badge>
            )}
            {transaction.invoiceId && (
              <Badge className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1">
                <FileText className="h-3 w-3 mr-1 inline" />
                {transaction.invoiceId.invoiceNumber}
              </Badge>
            )}
          </div>

          {/* Party Card */}
          <div className="bg-muted/30 rounded-lg border p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              Party
            </h4>
            <p className="font-medium text-sm">{getPartyName(transaction.party)}</p>
            {(transaction.party?.phoneNumber || transaction.party?.phone) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0" />
                {transaction.party.phoneNumber || transaction.party.phone}
              </p>
            )}
            {transaction.party?.email && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0" />
                {transaction.party.email}
              </p>
            )}
            {!transaction.party && (
              <p className="text-xs text-muted-foreground italic">No party</p>
            )}
          </div>

          {/* Timeline + Financial Compact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg border p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Timeline
              </h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{formatDate(transaction.transactionDate)}</span></div>
                {transaction.dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span className="font-medium">{formatDate(transaction.dueDate)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{formatDate(transaction.createdAt)}</span></div>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg border p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                Total
              </h4>
              <p className="text-base font-bold">₹{transaction.summary.grandTotal?.toFixed(2)}</p>
              <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                <div className="flex justify-between"><span>Paid</span><span className="text-green-600 font-medium">₹{transaction.summary.paidAmount?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Due</span><span className={(transaction.summary.dueAmount || 0) > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>₹{transaction.summary.dueAmount?.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-muted/30 rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-background/50">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Items ({transaction.lineItems.length})
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Qty</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Rate</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.lineItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No items</td></tr>
                  ) : (
                    transaction.lineItems.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{item.itemName}</span>
                          {item.sku && <p className="text-[9px] text-muted-foreground/60 font-mono">SKU: {item.sku}</p>}
                        </td>
                        <td className="px-2 py-1.5 text-center">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right">₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right font-medium">₹{Number(item.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Financial breakdown under the table on mobile */}
            <div className="border-t px-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{transaction.summary.subtotal?.toFixed(2)}</span></div>
              {transaction.summary.discountTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-₹{transaction.summary.discountTotal?.toFixed(2)}</span></div>}
              {transaction.summary.taxTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{transaction.summary.taxTotal?.toFixed(2)}</span></div>}
              {transaction.summary.roundOff !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span>₹{transaction.summary.roundOff?.toFixed(2)}</span></div>}
            </div>
          </div>

          {/* Tags / Notes */}
          {(transaction.notes || (transaction.tags && transaction.tags.length > 0)) && (
            <div className="bg-muted/30 rounded-lg border p-3">
              {transaction.tags && transaction.tags.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {transaction.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {transaction.notes && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Notes
                  </h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{transaction.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Invoice PDF button */}
          {transaction.invoiceId && (
            <Button variant="outline" size="sm" className="w-full text-sm" onClick={() => window.open(`/api/invoices/${transaction.invoiceId!._id}/pdf`, '_blank')}>
              <FileText className="h-4 w-4 mr-2" />
              View Invoice PDF
            </Button>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* ===== DESKTOP LAYOUT (md+) ===== */}
        <div className="hidden md:block">
          <div className="grid grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-0">
            {/* LEFT COLUMN */}
            <div className="p-5 xl:p-6 border-r min-h-0">
              {/* Party & Timeline grid */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-muted/30 rounded-lg border p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Party Information
                  </h4>
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-foreground">{getPartyName(transaction.party)}</p>
                    {(transaction.party?.phoneNumber || transaction.party?.phone) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{transaction.party.phoneNumber || transaction.party.phone}</span>
                      </div>
                    )}
                    {transaction.party?.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span>{transaction.party.email}</span>
                      </div>
                    )}
                    {!transaction.party && (
                      <p className="text-sm text-muted-foreground italic">No party associated</p>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg border p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Timeline
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{formatDate(transaction.transactionDate)}</span>
                    </div>
                    {transaction.dueDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Due</span>
                        <span className="font-medium">{formatDate(transaction.dueDate)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{formatDate(transaction.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-medium">{formatDate(transaction.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Line Items ({transaction.lineItems.length})
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[320px] xl:max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-14">Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground whitespace-nowrap w-20">Rate</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-14">Disc.</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-14">Tax</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transaction.lineItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                              No line items in this transaction
                            </td>
                          </tr>
                        ) : (
                          transaction.lineItems.map((item, index) => (
                            <tr key={index} className="border-b last:border-b-0 hover:bg-muted/20">
                              <td className="px-3 py-2 text-xs text-muted-foreground text-center">{index + 1}</td>
                              <td className="px-3 py-2">
                                <span className="font-medium text-sm">{item.itemName}</span>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{item.description}</p>
                                )}
                                {item.sku && (
                                  <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">SKU: {item.sku}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-sm whitespace-nowrap">
                                {Number(item.quantity).toFixed(2)} <span className="text-xs text-muted-foreground">{item.unit}</span>
                              </td>
                              <td className="px-3 py-2 text-right text-sm whitespace-nowrap">₹{Number(item.unitPrice).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-sm whitespace-nowrap">
                                {item.discountAmount > 0 ? <span className="text-red-500">-₹{Number(item.discountAmount).toFixed(2)}</span> : '-'}
                              </td>
                              <td className="px-3 py-2 text-right text-sm whitespace-nowrap">
                                {item.taxRate > 0 ? <span className="text-amber-600">{item.taxRate}%</span> : '-'}
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium whitespace-nowrap">₹{Number(item.lineTotal).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="p-5 xl:p-6 space-y-5">
              {/* Status */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${getTypeBadgeClass(transaction.type)} text-xs px-3 py-1`}>
                  {transaction.type === 'sale' ? <ArrowUpRight className="h-3 w-3 mr-1 inline" /> :
                   transaction.type === 'purchase' ? <ArrowDownLeft className="h-3 w-3 mr-1 inline" /> :
                   <Tag className="h-3 w-3 mr-1 inline" />}
                  {transaction.type.replace('-', ' ')}
                </Badge>
                <Badge className={`${getStatusBadgeClass(transaction.status)} text-xs px-3 py-1`}>
                  {transaction.status === 'confirmed' ? <BadgeCheck className="h-3 w-3 mr-1 inline" /> :
                   transaction.status === 'cancelled' ? <AlertCircle className="h-3 w-3 mr-1 inline" /> :
                   <Info className="h-3 w-3 mr-1 inline" />}
                  {transaction.status}
                </Badge>
                {(transaction.paymentStatus === 'paid' || transaction.paymentStatus === 'partial' || transaction.paymentStatus === 'unpaid') && (
                  <Badge className={`${getPaymentBadgeClass(transaction.paymentStatus)} text-xs px-3 py-1`}>
                    <CreditCard className="h-3 w-3 mr-1 inline" />
                    {transaction.paymentStatus === 'paid' ? 'Paid' :
                     transaction.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                  </Badge>
                )}
              </div>

              {/* Financial Summary */}
              <div className="bg-muted/30 rounded-lg border p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5" />
                  Financial Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{transaction.summary.subtotal?.toFixed(2)}</span>
                  </div>
                  {transaction.summary.discountTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-500">-₹{transaction.summary.discountTotal?.toFixed(2)}</span>
                    </div>
                  )}
                  {transaction.summary.taxTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">GST Total</span>
                      <span>₹{transaction.summary.taxTotal?.toFixed(2)}</span>
                    </div>
                  )}
                  {transaction.summary.roundOff !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Round Off</span>
                      <span>₹{transaction.summary.roundOff?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>Grand Total</span>
                      <span>₹{transaction.summary.grandTotal?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-muted/30 rounded-lg border p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Payment
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Paid Amount</span>
                    <span className="text-green-600 font-medium">₹{transaction.summary.paidAmount?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due Amount</span>
                    <span className={`font-medium ${(transaction.summary.dueAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{transaction.summary.dueAmount?.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={`${getPaymentBadgeClass(transaction.paymentStatus)}`}>
                        {transaction.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags / Notes */}
              {(transaction.notes || (transaction.tags && transaction.tags.length > 0)) && (
                <div className="bg-muted/30 rounded-lg border p-4">
                  {transaction.tags && transaction.tags.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {transaction.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {transaction.notes && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" />
                        Notes
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{transaction.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Invoice link */}
              {transaction.invoiceId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(`/api/invoices/${transaction.invoiceId!._id}/pdf`, '_blank')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoice PDF
                </Button>
              )}

              {/* Close */}
              <div className="flex justify-end pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}