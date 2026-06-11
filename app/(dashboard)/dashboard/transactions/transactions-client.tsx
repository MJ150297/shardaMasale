'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, Printer, FileText, ChevronLeft, ChevronRight, MoreHorizontal, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { formatDate } from '@/lib/date-utils';
import DataTableToolbar from '@/components/data-table-toolbar';
import TransactionDetailDialog from '@/components/transaction-detail-dialog';
import CreateSaleDialog from '@/components/create-sale-dialog';
import CreatePurchaseDialog from '@/components/create-purchase-dialog';
import CreatePaymentInDialog from '@/components/create-payment-in-dialog';
import CreatePaymentOutDialog from '@/components/create-payment-out-dialog';
import CreateSaleReturnDialog from '@/components/create-sale-return-dialog';
import CreatePurchaseReturnDialog from '@/components/create-purchase-return-dialog';
import TransactionForm from '@/components/transaction-form';
import InvoicePreviewModal from '@/modules/billing/invoice-preview-modal';
import RequireShopGuard from '@/components/require-shop-guard';

interface TransactionLineItem {
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

interface TransactionSummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
}

interface Transaction {
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
  additionalCharges?: Array<{ name: string; amount: number }>;
  summary: TransactionSummary;
  payment?: {
    method?: 'cash' | 'card' | 'upi' | 'bank-transfer' | 'cheque' | 'other' | null;
    referenceNumber?: string | null;
    notes?: string | null;
  } | null;
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

interface Invoice {
  id?: string;
  _id?: string;
  invoiceNumber: string;
  transactionId: Transaction;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string | Date;
  totalAmount?: number;
  party?: {
    id: string;
    displayName?: string;
    name?: string;
  } | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getPartyName(party?: Transaction['party']) {
  return party?.displayName || party?.name || '-';
}

function getTransactionId(transaction: Transaction) {
  return transaction.id || transaction._id || transaction.transactionNumber;
}

function getTransactionItemType(transaction: Transaction) {
  if (!transaction.lineItems || transaction.lineItems.length === 0) {
    return '-';
  }

  let hasProduct = false;
  let hasService = false;

  for (const item of transaction.lineItems) {
    // @ts-ignore - itemType populated from API nested populate
    const itemType = item.item?.itemType || item.itemType;
    if (itemType === 'service') {
      hasService = true;
    } else {
      hasProduct = true;
    }
  }

  if (hasProduct && hasService) {
    return 'Mixed';
  } else if (hasService) {
    return 'Service';
  } else {
    return 'Product';
  }
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

function getItemTypeBadgeClass(type: string) {
  switch (type.toLowerCase()) {
    case 'product': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'service': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'mixed': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState<'payment-in' | 'payment-out' | null>(null);
  const [invoiceToPreview, setInvoiceToPreview] = useState<Invoice | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (searchQuery === '') return true;

      const query = searchQuery.toLowerCase();
      return (
        transaction.transactionNumber.toLowerCase().includes(query) ||
        getPartyName(transaction.party).toLowerCase().includes(query) ||
        transaction.type.toLowerCase().includes(query)
      );
    });
  }, [transactions, searchQuery]);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [draftTransactionToEdit, setDraftTransactionToEdit] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentInEditOpen, setPaymentInEditOpen] = useState(false);
  const [paymentInEditTransaction, setPaymentInEditTransaction] = useState<Transaction | null>(null);
  const [paymentOutEditOpen, setPaymentOutEditOpen] = useState(false);
  const [paymentOutEditTransaction, setPaymentOutEditTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [pagination.page, filters]);

  async function loadTransactions() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
      });

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();

      if (res.ok) {
        setTransactions(
          (data.data || []).map((transaction: Transaction) => ({
            ...transaction,
            id: transaction.id || transaction._id || transaction.transactionNumber,
          }))
        );
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTransaction() {
    if (!transactionToDelete) return;

    try {
      setIsDeleting(true);
      const transactionId = getTransactionId(transactionToDelete);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTransactions(prev => prev.filter(t => getTransactionId(t) !== transactionId));
        setDeleteDialogOpen(false);
        setTransactionToDelete(null);
        toast.success('Transaction deleted successfully');
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleStatusUpdate(
    transaction: Transaction,
    status: 'confirmed' | 'cancelled',
  ) {
    try {
      const transactionId = getTransactionId(transaction);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update transaction status');
      }

      await loadTransactions();
      toast.success(
        status === 'confirmed'
          ? 'Draft confirmed successfully'
          : 'Transaction cancelled successfully',
      );
    } catch (error) {
      console.error('Failed to update transaction status:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to update transaction status',
      );
    }
  }

  function getTransactionEditMode(type: Transaction['type']) {
    switch (type) {
      case 'sale':
      case 'purchase':
      case 'sale-return':
      case 'purchase-return':
      case 'payment-in':
      case 'payment-out':
        return type;
      default:
        return null;
    }
  }

  function mapTransactionToFormValues(transaction: Transaction) {
    const narrowType = (
      transaction.type === 'sale' || transaction.type === 'purchase' ||
      transaction.type === 'sale-return' || transaction.type === 'purchase-return'
    ) ? transaction.type : 'sale';

    return {
      type: narrowType,
      party: (transaction.party as { _id?: string } | null)?._id || transaction.party?.id || '',
      transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate) : new Date(),
      dueDate: transaction.dueDate ? new Date(transaction.dueDate) : null,
      lineItems: transaction.lineItems.map((item) => ({
        item: item.item ?? null,
        itemName: item.itemName,
        sku: item.sku ?? null,
        description: item.description ?? null,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxRate: item.taxRate,
        costPrice: item.costPrice ?? null,
      })),
      additionalCharges: transaction.additionalCharges ?? [],
      summary: {
        roundOff: transaction.summary.roundOff ?? 0,
        paidAmount: transaction.summary.paidAmount ?? 0,
        totalDiscountType: (transaction as Transaction & {
          summary: TransactionSummary & {
            totalDiscountType?: 'percentage' | 'fixed' | null;
            totalDiscountValue?: number | null;
          };
        }).summary.totalDiscountType ?? null,
        totalDiscountValue: (transaction as Transaction & {
          summary: TransactionSummary & {
            totalDiscountType?: 'percentage' | 'fixed' | null;
            totalDiscountValue?: number | null;
          };
        }).summary.totalDiscountValue ?? null,
      },
      payment: transaction.payment ?? null,
      notes: transaction.notes ?? null,
      tags: transaction.tags ?? [],
      status: transaction.status,
    };
  }

  const draftTransactionInitialValues = useMemo(
    () => (draftTransactionToEdit ? mapTransactionToFormValues(draftTransactionToEdit) : null),
    [draftTransactionToEdit],
  );

  function handleEditDraft(transaction: Transaction) {
    if (transaction.type === 'payment-in') {
      setPaymentInEditTransaction(transaction);
      setPaymentInEditOpen(true);
      return;
    }

    if (transaction.type === 'payment-out') {
      setPaymentOutEditTransaction(transaction);
      setPaymentOutEditOpen(true);
      return;
    }

    const editMode = getTransactionEditMode(transaction.type);
    if (!editMode) {
      toast.info('Editing this draft type is not wired yet');
      return;
    }

    setDraftTransactionToEdit(transaction);
    setEditDialogOpen(true);
  }

  function handleCancelClick(transaction: Transaction) {
    setTransactionToCancel(transaction);
    setCancelDialogOpen(true);
  }

  async function handleConfirmCancel() {
    if (!transactionToCancel) return;
    setIsCancelling(true);
    try {
      const transactionId = getTransactionId(transactionToCancel);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel transaction');
      }

      await loadTransactions();
      toast.success('Transaction cancelled successfully');
      setCancelDialogOpen(false);
      setTransactionToCancel(null);
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel transaction',
      );
    } finally {
      setIsCancelling(false);
    }
  }

  function viewTransaction(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setViewDialogOpen(true);
  }

  function confirmDelete(transaction: Transaction) {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  }

  async function generateInvoiceForTransaction(transaction: Transaction) {
    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: getTransactionId(transaction) }),
      });

      if (response.ok) {
        toast.success('Invoice generated successfully');
        await loadTransactions();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to generate invoice');
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice');
    }
  }

  async function handleViewInvoice(invoiceId: string) {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Failed to load invoice');
      const data = await res.json();
      setInvoiceToPreview(data.data || data);
    } catch (error) {
      toast.error('Could not load invoice details');
      console.error(error);
    }
  }

  function downloadInvoice(invoice: Invoice) {
    toast.info('Downloading invoice...');
    window.open(`/api/invoices/${invoice._id}/pdf`, '_blank');
  }

  function printInvoice(invoice: Invoice) {
    toast.info('Preparing invoice for print...');
    const printWindow = window.open(`/api/invoices/${invoice._id}/pdf#toolbar=0`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View and manage all sales, purchases and payments</p>
        </div>
        <RequireShopGuard>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Transaction
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white/80">
              <CreateSaleDialog onSaleCreated={loadTransactions}>
                <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                  New Sale
                </DropdownMenuItem>
              </CreateSaleDialog>
              <CreatePurchaseDialog onPurchaseCreated={loadTransactions}>
                <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                  New Purchase
                </DropdownMenuItem>
              </CreatePurchaseDialog>
              <CreateSaleReturnDialog onSaleReturnCreated={loadTransactions}>
                <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                  Sale Return
                </DropdownMenuItem>
              </CreateSaleReturnDialog>
              <CreatePurchaseReturnDialog onPurchaseReturnCreated={loadTransactions}>
                <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                  Purchase Return
                </DropdownMenuItem>
              </CreatePurchaseReturnDialog>
              <div className="h-px bg-gray-200 my-1" />
              <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); setPaymentDialogOpen('payment-in'); }}>
                Payment In (Receive)
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); setPaymentDialogOpen('payment-out'); }}>
                Payment Out (Pay)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RequireShopGuard>

        {paymentDialogOpen === 'payment-in' && (
          <CreatePaymentInDialog
            open={true}
            onOpenChange={(open) => { if (!open) setPaymentDialogOpen(null); }}
            onCreated={() => { setPaymentDialogOpen(null); loadTransactions(); }}
          />
        )}
        {paymentDialogOpen === 'payment-out' && (
          <CreatePaymentOutDialog
            open={true}
            onOpenChange={(open) => { if (!open) setPaymentDialogOpen(null); }}
            onCreated={() => { setPaymentDialogOpen(null); loadTransactions(); }}
          />
        )}
      </div>

      <Tabs defaultValue="" value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))} className="w-full">
        <TabsList variant="segmented" className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="">All Types</TabsTrigger>
          <TabsTrigger value="sale">Sales</TabsTrigger>
          <TabsTrigger value="purchase">Purchases</TabsTrigger>
          <TabsTrigger value="sale-return">Sales Returns</TabsTrigger>
          <TabsTrigger value="purchase-return">Purchase Returns</TabsTrigger>
          <TabsTrigger value="payment-in">Payments In</TabsTrigger>
          <TabsTrigger value="payment-out">Payments Out</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTableToolbar
        onSearch={setSearchQuery}
        searchPlaceholder="Search transactions by number, party name..."
      />

      {/* Flexbox Card Layout */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-medium">No transactions found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Record your first sale or purchase to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredTransactions.map((transaction) => (
              <div
                key={getTransactionId(transaction)}
                className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => viewTransaction(transaction)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    viewTransaction(transaction);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {/* Left: Icon + Info */}
                    <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                          <span className="hidden sm:inline">{transaction.transactionNumber} - </span>{getPartyName(transaction.party)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadgeClass(transaction.type)}`}>
                            {transaction.type}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(transaction.transactionDate)}
                          </span>
                          {(() => {
                            const itemType = getTransactionItemType(transaction);
                            return itemType !== '-' ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium hidden md:inline ${getItemTypeBadgeClass(itemType)}`}>
                                {itemType}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount + Badges + Actions */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                      {/* Amount - desktop only */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
                          ₹{transaction.summary.grandTotal?.toFixed(2) || '0.00'}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(transaction.status)}`}>
                        {transaction.status}
                      </span>

                      {/* Payment status badge */}
                      {(transaction.paymentStatus === 'paid' || transaction.paymentStatus === 'partial' || transaction.paymentStatus === 'unpaid') && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline ${getPaymentBadgeClass(transaction.paymentStatus)}`}>
                          {transaction.paymentStatus}
                        </span>
                      )}

                      {/* Invoice badge */}
                      {transaction.invoiceId && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hidden lg:inline">
                          {transaction.invoiceId.status}
                        </span>
                      )}

                      {/* Mobile compact price + payment status */}
                      <div className="sm:hidden text-right">
                        <p className="text-[10px] font-semibold text-gray-900 dark:text-white">
                          ₹{transaction.summary.grandTotal?.toFixed(2) || '0.00'}
                        </p>
                        {transaction.paymentStatus !== 'not-applicable' && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {transaction.paymentStatus}
                          </p>
                        )}
                      </div>

                      {/* 3-dot Action Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white/90 dark:bg-gray-900/90" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); viewTransaction(transaction); }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>

                          {transaction.type === 'sale' && transaction.status === 'confirmed' && !transaction.invoiceId && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); generateInvoiceForTransaction(transaction); }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Generate Invoice
                            </DropdownMenuItem>
                          )}

                          {transaction.invoiceId && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleViewInvoice(transaction.invoiceId!._id); }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Invoice
                            </DropdownMenuItem>
                          )}

                          {transaction.status === 'draft' && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleEditDraft(transaction); }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Draft
                            </DropdownMenuItem>
                          )}

                          {transaction.status === 'draft' && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusUpdate(transaction, 'confirmed'); }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Confirm Draft
                            </DropdownMenuItem>
                          )}

                          {(transaction.status === 'draft' || transaction.status === 'confirmed') && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelClick(transaction); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Cancel Transaction
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>

                          {transaction.status === 'draft' && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(transaction); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Draft
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white/90 max-w-none! w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Draft Transaction</DialogTitle>
            <DialogDescription>
              Update the draft details, then save or confirm it from this form.
            </DialogDescription>
          </DialogHeader>
          {draftTransactionToEdit && (
            <TransactionForm
              mode={(getTransactionEditMode(draftTransactionToEdit.type) as 'sale' | 'purchase' | 'sale-return' | 'purchase-return') ?? 'sale'}
              isOpen={editDialogOpen}
              editingTransactionId={getTransactionId(draftTransactionToEdit)}
              initialValues={draftTransactionInitialValues}
              onSuccess={() => {
                setEditDialogOpen(false);
                setDraftTransactionToEdit(null);
                loadTransactions();
                toast.success('Draft updated successfully');
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setDraftTransactionToEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Transaction Dialog */}
      <TransactionDetailDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        transaction={selectedTransaction}
      />

      {/* Cancel Transaction Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this transaction?
              {transactionToCancel && (
                <>
                  <span className="mt-2 font-medium block">{transactionToCancel.transactionNumber}</span>
                  {transactionToCancel.invoiceId && (
                    <span className="mt-1 text-amber-600 block">The linked invoice will also be cancelled.</span>
                  )}
                </>
              )}
              This will reverse any inventory movements and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Transaction</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isCancelling}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
            >
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment In Edit Dialog */}
      {paymentInEditTransaction && (
        <CreatePaymentInDialog
          open={paymentInEditOpen}
          onOpenChange={(open) => {
            setPaymentInEditOpen(open);
            if (!open) setPaymentInEditTransaction(null);
          }}
          editingTransactionId={getTransactionId(paymentInEditTransaction)}
          initialValues={{
            party: (paymentInEditTransaction.party as { _id?: string } | null)?._id || paymentInEditTransaction.party?.id || '',
            transactionDate: new Date(paymentInEditTransaction.transactionDate),
            amount: paymentInEditTransaction.summary.grandTotal || 0,
            settlementDiscount: 0,
            payment: paymentInEditTransaction.payment || null,
            notes: paymentInEditTransaction.notes || null,
          }}
          onCreated={() => {
            setPaymentInEditOpen(false);
            setPaymentInEditTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {/* Payment Out Edit Dialog */}
      {paymentOutEditTransaction && (
        <CreatePaymentOutDialog
          open={paymentOutEditOpen}
          onOpenChange={(open) => {
            setPaymentOutEditOpen(open);
            if (!open) setPaymentOutEditTransaction(null);
          }}
          editingTransactionId={getTransactionId(paymentOutEditTransaction)}
          initialValues={{
            party: (paymentOutEditTransaction.party as { _id?: string } | null)?._id || paymentOutEditTransaction.party?.id || '',
            transactionDate: new Date(paymentOutEditTransaction.transactionDate),
            amount: paymentOutEditTransaction.summary.grandTotal || 0,
            payment: paymentOutEditTransaction.payment || null,
            notes: paymentOutEditTransaction.notes || null,
          }}
          onCreated={() => {
            setPaymentOutEditOpen(false);
            setPaymentOutEditTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              {transactionToDelete && (
                <span className="mt-2 font-medium block">{transactionToDelete.transactionNumber}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteTransaction}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {invoiceToPreview && (
        <InvoicePreviewModal
          open={!!invoiceToPreview}
          onOpenChange={(open) => {
            if (!open) setInvoiceToPreview(null);
          }}
          invoice={invoiceToPreview}
          onDownload={() => downloadInvoice(invoiceToPreview)}
          onPrint={() => printInvoice(invoiceToPreview)}
        />
      )}
    </div>
  );
}