'use client';

import { useState } from 'react';
import { Receipt, Loader2, ReceiptIndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreatePaymentInDialog from '@/components/create-payment-in-dialog';
import CreatePaymentOutDialog from '@/components/create-payment-out-dialog';
import TransactionDetailDialog from '@/components/transaction-detail-dialog';
import { toast } from 'sonner';
import { buildEnterpriseShareMessage, type ShareBusinessProfile, type ShareLineItem, type ShareMessageTemplates, type ShareSummary } from '@/lib/share-messages';
import { getPartyId, getPartyName, getPartyPhone, getInvoiceId } from '@/lib/party-helpers';

// --- Types ---

export interface RecentTransactionItem {
  _id: string;
  transactionId?: string;
  transactionNumber: string;
  type: string;
  customer: string;
  partyId?: string | null;
  invoiceId?: string | null;
  customerPhone?: string | null;
  amount: number; // numeric amount
  amountFormatted?: string;
  paymentStatus: string;
  date: string;
  dateIso?: string;
}

export interface DetailedTransactionRecord {
  _id: string;
  transactionNumber: string;
  type: string;
  status: string;
  paymentStatus: string;
  party?: Record<string, unknown> | null;
  transactionDate: string | Date;
  dueDate?: string | Date | null;
  lineItems?: Array<{
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
    itemType?: string;
  }>;
  additionalCharges?: Array<{ name: string; amount: number }>;
  summary?: {
    subtotal?: number;
    discountTotal?: number;
    taxTotal?: number;
    roundOff?: number;
    grandTotal: number;
    paidAmount: number;
    dueAmount: number;
  };
  payment?: {
    method?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  } | null;
  notes?: string | null;
  tags?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
    status: string;
  } | string | null;
}

export interface RecentTransactionsCardProps {
  transactions: RecentTransactionItem[];
  currentPage: number;
  totalPages: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onMutate: () => void;
  /** Optional — if provided, Share button will be available */
  businessProfile?: ShareBusinessProfile | null;
  shareMessageTemplates?: ShareMessageTemplates | null;
  shopName?: string;
  title?: string;
  viewAllLink?: string;
  /** Optional date filter component to render in the header */
  dateFilterComponent?: React.ReactNode;
}

// --- Component ---

export default function RecentTransactionsCard({
  transactions,
  currentPage,
  totalPages,
  total,
  isLoading,
  onPageChange,
  onMutate,
  businessProfile,
  shareMessageTemplates,
  shopName,
  title = 'Latest Transactions',
  viewAllLink,
  dateFilterComponent,
}: RecentTransactionsCardProps) {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDetailTransaction, setSelectedDetailTransaction] = useState<Record<string, unknown> | null>(null);
  const [sharingTransactionId, setSharingTransactionId] = useState<string | null>(null);

  const handleViewTransaction = async (transaction: RecentTransactionItem) => {
    try {
      const url = transaction.transactionId
        ? `/api/transactions/${transaction.transactionId}`
        : null;
      if (!url) return;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch transaction details');

      const fullTransaction: DetailedTransactionRecord = (await res.json()).data || (await res.json());

      const dialogData: Record<string, unknown> = {
        _id: fullTransaction._id,
        transactionNumber: fullTransaction.transactionNumber,
        type: fullTransaction.type,
        status: fullTransaction.status,
        paymentStatus: fullTransaction.paymentStatus,
        party: fullTransaction.party
          ? {
              id: getPartyId(fullTransaction.party) || '',
              name: getPartyName(fullTransaction.party),
              phone: getPartyPhone(fullTransaction.party) || undefined,
            }
          : null,
        transactionDate: fullTransaction.transactionDate,
        dueDate: fullTransaction.dueDate,
        lineItems: fullTransaction.lineItems?.map((item) => ({
          ...item,
          itemType: item.itemType as 'product' | 'service' | undefined,
        })),
        summary: fullTransaction.summary,
        notes: fullTransaction.notes,
        tags: fullTransaction.tags,
        createdAt: fullTransaction.createdAt,
        updatedAt: fullTransaction.updatedAt,
        invoiceId: fullTransaction.invoiceId
          ? (typeof fullTransaction.invoiceId === 'string'
              ? { _id: fullTransaction.invoiceId, invoiceNumber: '', status: 'sent' as const }
              : {
                  _id: fullTransaction.invoiceId._id,
                  invoiceNumber: fullTransaction.invoiceId.invoiceNumber,
                  status: fullTransaction.invoiceId.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
                }
            )
          : null,
      };

      setSelectedDetailTransaction(dialogData);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
      toast.error('Could not load transaction details');
    }
  };

  const handleShareTransaction = async (transaction: RecentTransactionItem) => {
    const phone = transaction.customerPhone?.replace(/\D/g, '');

    if (!phone) {
      toast.error(`No phone number found for ${transaction.customer}.`);
      return;
    }

    const shareKey = transaction.transactionId || transaction._id;
    setSharingTransactionId(shareKey);

    try {
      let detailedTransaction: DetailedTransactionRecord | null = null;
      if (transaction.transactionId) {
        const response = await fetch(`/api/transactions/${transaction.transactionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transaction details');
        }
        const payload = await response.json();
        detailedTransaction = payload.data || payload;
      }

      const message = buildEnterpriseShareMessage({
        kind: detailedTransaction?.type || transaction.type,
        business: businessProfile || (shopName ? { legalName: shopName } : null),
        templates: shareMessageTemplates,
        referenceNumber: detailedTransaction?.invoiceId && typeof detailedTransaction.invoiceId !== 'string'
          ? detailedTransaction.invoiceId.invoiceNumber
          : transaction.transactionNumber,
        referenceLabel: detailedTransaction?.invoiceId && typeof detailedTransaction.invoiceId !== 'string' ? 'Invoice No.' : 'Transaction No.',
        secondaryReferenceNumber: detailedTransaction?.invoiceId && typeof detailedTransaction.invoiceId !== 'string' ? detailedTransaction.transactionNumber : undefined,
        secondaryReferenceLabel: detailedTransaction?.invoiceId && typeof detailedTransaction.invoiceId !== 'string' ? 'Transaction No.' : undefined,
        documentDate: detailedTransaction?.transactionDate || transaction.dateIso || transaction.date,
        dueDate: detailedTransaction?.dueDate,
        documentStatus: detailedTransaction?.status,
        paymentStatus: detailedTransaction?.paymentStatus || transaction.paymentStatus,
        party: detailedTransaction?.party
          ? {
              displayName: (detailedTransaction.party as Record<string, unknown>).displayName as string || (detailedTransaction.party as Record<string, unknown>).name as string,
              name: (detailedTransaction.party as Record<string, unknown>).name as string || (detailedTransaction.party as Record<string, unknown>).displayName as string,
              phone: (detailedTransaction.party as Record<string, unknown>).phone as string || (detailedTransaction.party as Record<string, unknown>).phoneNumber as string,
              phoneNumber: (detailedTransaction.party as Record<string, unknown>).phoneNumber as string || (detailedTransaction.party as Record<string, unknown>).phone as string,
              email: (detailedTransaction.party as Record<string, unknown>).email as string | undefined,
            }
          : {
              displayName: transaction.customer,
              name: transaction.customer,
              phoneNumber: transaction.customerPhone || undefined,
            },
        lineItems: detailedTransaction?.lineItems as ShareLineItem[] | undefined,
        additionalCharges: detailedTransaction?.additionalCharges,
        summary: detailedTransaction?.summary as ShareSummary | undefined,
        payment: detailedTransaction?.payment || undefined,
        notes: detailedTransaction?.notes || undefined,
      });

      const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to build share message:', error);
      toast.error('Could not prepare the share message.');
    } finally {
      setSharingTransactionId(null);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'purchase': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'sale-return': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'purchase-return': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'payment-in': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'payment-out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between">
          {dateFilterComponent ? (
            <div className="flex-1">{dateFilterComponent}</div>
          ) : (
            <div />
          )}
          <div className="text-right">
            {viewAllLink && (
              <a
                href={viewAllLink}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-1 inline-block"
              >
                View all
              </a>
            )}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {isLoading && transactions.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 md:px-6 py-3 md:py-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto" />
                </div>
              </div>
            </div>
          ))
        ) : transactions.length === 0 ? (
          <div className="px-4 md:px-6 py-8 text-center text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No transactions found</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction._id}
              className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => handleViewTransaction(transaction)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  handleViewTransaction(transaction);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                        <span className="hidden sm:inline">{transaction.transactionNumber} - </span>
                        {transaction.customer}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadgeClass(transaction.type)}`}>
                          {transaction.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
                      {transaction.amountFormatted || `₹ ${(transaction.amount || 0).toLocaleString('en-IN')}`}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        transaction.paymentStatus === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : transaction.paymentStatus === 'partial'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : transaction.paymentStatus === 'unpaid'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {transaction.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Action buttons for unpaid/partial transactions */}
                {(transaction.paymentStatus === 'unpaid' || transaction.paymentStatus === 'partial') && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                    {transaction.type === 'sale' || transaction.type === 'sale-return' ? (
                      <CreatePaymentInDialog
                        initialPartyId={transaction.partyId}
                        initialPartyName={transaction.customer}
                        initialPartyPhone={transaction.customerPhone}
                        initialSelectedInvoiceIds={
                          transaction.invoiceId ? [transaction.invoiceId] : []
                        }
                        onCreated={() => onMutate()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                          <ReceiptIndianRupee className="h-4 w-4 mr-1.5 shrink-0" />
                          Record Payment
                        </Button>
                      </CreatePaymentInDialog>
                    ) : (
                      <CreatePaymentOutDialog
                        initialPartyId={transaction.partyId}
                        initialPartyName={transaction.customer}
                        initialPartyPhone={transaction.customerPhone}
                        initialSelectedTransactionIds={
                          transaction.transactionId ? [transaction.transactionId] : []
                        }
                        onCreated={() => onMutate()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                        >
                          <ReceiptIndianRupee className="h-4 w-4 mr-1.5 shrink-0" />
                          Record Payment
                        </Button>
                      </CreatePaymentOutDialog>
                    )}

                    {businessProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-9 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                        onClick={() => handleShareTransaction(transaction)}
                        disabled={sharingTransactionId === (transaction.transactionId || transaction._id)}
                      >
                        {sharingTransactionId === (transaction.transactionId || transaction._id) ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                          </svg>
                        )}
                        Share
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages} ({total} total)
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || isLoading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        transaction={selectedDetailTransaction as any}
      />
    </div>
  );
}