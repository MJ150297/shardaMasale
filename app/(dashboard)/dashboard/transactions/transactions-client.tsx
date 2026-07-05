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
import TransactionListCard, { type TransactionListItem, type TransactionListPagination } from '@/components/transaction-list-card';
import { useTransactionActions, type ActionableTransaction } from '@/hooks/use-transaction-actions';

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

  // Shared transaction actions hook
  const actions = useTransactionActions({ onRefresh: loadTransactions });

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
            <DropdownMenuContent align="end" className="w-56 bg-background dark:bg-gray-900">
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

      {/* Transaction List Card */}
      <TransactionListCard
        transactions={filteredTransactions.map((tx): TransactionListItem => ({
          id: getTransactionId(tx),
          transactionNumber: tx.transactionNumber,
          type: tx.type,
          status: tx.status,
          paymentStatus: tx.paymentStatus,
          partyName: getPartyName(tx.party),
          grandTotal: tx.summary.grandTotal || 0,
          transactionDate: tx.transactionDate,
          lineItemCount: tx.lineItems?.length || 0,
          invoiceId: tx.invoiceId || null,
        }))}
        loading={loading}
        pagination={pagination as TransactionListPagination}
        onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
        onView={(item) => {
          const tx = transactions.find(t => getTransactionId(t) === item.id);
          if (tx) actions.viewTransaction(tx as unknown as ActionableTransaction);
        }}
        onGenerateInvoice={(item) => {
          const tx = transactions.find(t => getTransactionId(t) === item.id);
          if (tx) actions.generateInvoiceForTransaction(tx as unknown as ActionableTransaction);
        }}
        onViewInvoice={(item) => {
          if (item.invoiceId) actions.handleViewInvoice(item.invoiceId._id);
        }}
        extraActions={(item) => {
          const tx = transactions.find(t => getTransactionId(t) === item.id);
          if (!tx) return null;
          return actions.renderExtraActions(tx as unknown as ActionableTransaction);
        }}
      />

      {/* Edit Draft Dialog */}
      <Dialog open={actions.editDialogOpen} onOpenChange={actions.setEditDialogOpen}>
        <DialogContent className="bg-background dark:bg-gray-900 max-w-none! w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Draft Transaction</DialogTitle>
            <DialogDescription>
              Update the draft details, then save or confirm it from this form.
            </DialogDescription>
          </DialogHeader>
          {actions.draftTransactionToEdit && (
            <TransactionForm
              mode={(getTransactionEditMode(actions.draftTransactionToEdit.type as Transaction['type']) as 'sale' | 'purchase' | 'sale-return' | 'purchase-return') ?? 'sale'}
              isOpen={actions.editDialogOpen}
              editingTransactionId={actions.getTransactionId(actions.draftTransactionToEdit)}
              initialValues={actions.draftTransactionInitialValues}
              onSuccess={() => {
                actions.setEditDialogOpen(false);
                actions.setDraftTransactionToEdit(null);
                loadTransactions();
                toast.success('Draft updated successfully');
              }}
              onCancel={() => {
                actions.setEditDialogOpen(false);
                actions.setDraftTransactionToEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Transaction Dialog */}
      <TransactionDetailDialog
        open={actions.viewDialogOpen}
        onOpenChange={actions.setViewDialogOpen}
        transaction={actions.selectedTransaction as any}
      />

      {/* Cancel Transaction Confirmation Dialog */}
      <AlertDialog open={actions.cancelDialogOpen} onOpenChange={actions.setCancelDialogOpen}>
        <AlertDialogContent className="bg-background dark:bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this transaction?
              {actions.transactionToCancel && (
                <>
                  <span className="mt-2 font-medium block">{actions.transactionToCancel.transactionNumber}</span>
                  {actions.transactionToCancel.invoiceId && (
                    <span className="mt-1 text-amber-600 block">The linked invoice will also be cancelled.</span>
                  )}
                </>
              )}
              This will reverse any inventory movements and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.isCancelling}>Keep Transaction</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={actions.isCancelling}
              onClick={(e) => {
                e.preventDefault();
                actions.handleConfirmCancel();
              }}
            >
              {actions.isCancelling ? 'Cancelling...' : 'Yes, Cancel Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment In Edit Dialog */}
      {actions.paymentInEditTransaction && (
        <CreatePaymentInDialog
          open={actions.paymentInEditOpen}
          onOpenChange={(open) => {
            actions.setPaymentInEditOpen(open);
            if (!open) actions.setPaymentInEditTransaction(null);
          }}
          editingTransactionId={actions.getTransactionId(actions.paymentInEditTransaction)}
          initialValues={{
            party: (actions.paymentInEditTransaction.party as { _id?: string } | null)?._id || (actions.paymentInEditTransaction.party as { id?: string } | null)?.id || '',
            transactionDate: new Date(actions.paymentInEditTransaction.transactionDate),
            amount: actions.paymentInEditTransaction.summary.grandTotal || 0,
            settlementDiscount: 0,
            payment: actions.paymentInEditTransaction.payment || null,
            notes: actions.paymentInEditTransaction.notes || null,
          }}
          onCreated={() => {
            actions.setPaymentInEditOpen(false);
            actions.setPaymentInEditTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {/* Payment Out Edit Dialog */}
      {actions.paymentOutEditTransaction && (
        <CreatePaymentOutDialog
          open={actions.paymentOutEditOpen}
          onOpenChange={(open) => {
            actions.setPaymentOutEditOpen(open);
            if (!open) actions.setPaymentOutEditTransaction(null);
          }}
          editingTransactionId={actions.getTransactionId(actions.paymentOutEditTransaction)}
          initialValues={{
            party: (actions.paymentOutEditTransaction.party as { _id?: string } | null)?._id || (actions.paymentOutEditTransaction.party as { id?: string } | null)?.id || '',
            transactionDate: new Date(actions.paymentOutEditTransaction.transactionDate),
            amount: actions.paymentOutEditTransaction.summary.grandTotal || 0,
            payment: actions.paymentOutEditTransaction.payment || null,
            notes: actions.paymentOutEditTransaction.notes || null,
          }}
          onCreated={() => {
            actions.setPaymentOutEditOpen(false);
            actions.setPaymentOutEditTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={actions.deleteDialogOpen} onOpenChange={actions.setDeleteDialogOpen}>
        <AlertDialogContent className="bg-background dark:bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              {actions.transactionToDelete && (
                <span className="mt-2 font-medium block">{actions.transactionToDelete.transactionNumber}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={actions.handleDeleteTransaction}
              disabled={actions.isDeleting}
            >
              {actions.isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {actions.invoiceToPreview && (
        <InvoicePreviewModal
          open={!!actions.invoiceToPreview}
          onOpenChange={(open) => {
            if (!open) actions.setInvoiceToPreview(null);
          }}
          invoice={actions.invoiceToPreview}
          onDownload={() => actions.downloadInvoice(actions.invoiceToPreview!)}
          onPrint={() => actions.printInvoice(actions.invoiceToPreview!)}
        />
      )}
    </div>
  );
}