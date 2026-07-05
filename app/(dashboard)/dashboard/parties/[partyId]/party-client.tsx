'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EditPartyDialog from '@/components/edit-party-dialog';
import InvoicePreviewModal from '@/modules/billing/invoice-preview-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import TransactionDetailDialog from '@/components/transaction-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, ChevronLeft, ChevronRight, Clock, FileText, ShoppingCart, ArrowUpDown, Eye, Printer } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import DataTableToolbar from '@/components/data-table-toolbar';
import CreateSaleDialog from '@/components/create-sale-dialog';
import CreatePurchaseDialog from '@/components/create-purchase-dialog';
import CreatePaymentInDialog from '@/components/create-payment-in-dialog';
import CreatePaymentOutDialog from '@/components/create-payment-out-dialog';
import RecentTransactionsCard, { type RecentTransactionItem } from '@/components/recent-transactions-card';
import TransactionListCard, { type TransactionListItem, type TransactionListPagination } from '@/components/transaction-list-card';
import { useTransactionActions, type ActionableTransaction } from '@/hooks/use-transaction-actions';
import InvoiceListCard, { type InvoiceListItem, type InvoiceListPagination } from '@/components/invoice-list-card';

interface Party {
  _id: string;
  name: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  gstin?: string | null;
  pan?: string | null;
  partyType: 'customer' | 'supplier' | 'both';
  status: 'active' | 'inactive' | 'blocked';
  creditLimit?: number;
  currentBalance?: number;
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

interface PartyClientWrapperProps {
  party: Party;
  children: React.ReactNode;
}

interface TransactionLineItem {
  item?: { itemType?: string } | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface TransactionSummary {
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
}

interface Transaction {
  _id: string;
  transactionNumber: string;
  type: 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'payment-in' | 'payment-out' | 'adjustment' | 'opening-balance';
  status: 'draft' | 'confirmed' | 'cancelled';
  paymentStatus?: string;
  transactionDate: string;
  summary: TransactionSummary;
  lineItems: TransactionLineItem[];
  invoiceId?: { _id: string; invoiceNumber: string; status: string } | null;
}

interface InvoiceTransactionParty {
  displayName?: string;
  name?: string;
}

interface InvoiceTransaction {
  _id: string;
  summary: { grandTotal: number; paidAmount: number; dueAmount: number };
  paymentStatus: string;
  party?: InvoiceTransactionParty | null;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  transactionId: InvoiceTransaction;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PartyClientWrapper({ party, children }: PartyClientWrapperProps) {
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialTab = searchParams.get('tab') === 'transactions' ? 'transactions' : 'overview';
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Transactions state (separate page state to avoid infinite loop with useCallback)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transPagination, setTransPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invPagination, setInvPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Invoice preview modal (for invoices tab)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Overview recent transactions pagination (separate from full transactions tab)
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPagination, setOverviewPagination] = useState<Pagination>({ page: 1, limit: 4, total: 0, totalPages: 0 });

  // Search filters
  const [txnSearchQuery, setTxnSearchQuery] = useState('');
  const [invSearchQuery, setInvSearchQuery] = useState('');

  // Stable ref for partyId to avoid useCallback dependency churn
  const partyIdRef = useRef(party._id);
  partyIdRef.current = party._id;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/parties', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: party._id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete party');
      }
      toast.success('Party deleted successfully');
      router.push('/dashboard/parties');
      router.refresh();
    } catch (error) {
      console.error('Error deleting party:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete party');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePartyUpdated = () => {
    router.refresh();
  };

  // Load transactions - stable callback, depends only on numeric page
  const loadTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      const params = new URLSearchParams({
        page: transactionPage.toString(),
        limit: '20',
        party: partyIdRef.current,
      });
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.data || []);
        setTransPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [transactionPage]);

  // Shared transaction actions hook (uses ref to avoid stale closure)
  const loadTransactionsRef = useRef(loadTransactions);
  loadTransactionsRef.current = loadTransactions;
  const partyActions = useTransactionActions({ onRefresh: () => loadTransactionsRef.current() });

  // Load invoices - stable callback, depends only on numeric page
  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const params = new URLSearchParams({
        page: invoicePage.toString(),
        limit: '20',
        party: partyIdRef.current,
      });
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.data || []);
        setInvPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setInvoicesLoading(false);
    }
  }, [invoicePage]);

  // Load overview transactions with small page size
  const [overviewTransactions, setOverviewTransactions] = useState<RecentTransactionItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverviewTransactions = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const params = new URLSearchParams({
        page: overviewPage.toString(),
        limit: '4',
        party: partyIdRef.current,
      });
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      if (res.ok) {
        const txns: Transaction[] = data.data || [];
        setOverviewTransactions(txns.map((txn) => ({
          _id: txn._id,
          transactionId: txn._id,
          transactionNumber: txn.transactionNumber,
          type: txn.type,
          customer: party.displayName,
          partyId: partyIdRef.current,
          invoiceId: txn.invoiceId?._id || null,
          customerPhone: party.phoneNumber,
          amount: txn.summary.grandTotal,
          amountFormatted: `₹${(txn.summary.grandTotal || 0).toFixed(2)}`,
          paymentStatus: txn.paymentStatus || 'unpaid',
          date: formatDate(txn.transactionDate),
          dateIso: txn.transactionDate,
        })));
        setOverviewPagination(data.pagination || { page: 1, limit: 4, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error('Failed to load overview transactions:', error);
    } finally {
      setOverviewLoading(false);
    }
  }, [overviewPage, party.displayName, party.phoneNumber, partyIdRef]);

  // Trigger transaction load when tab is "transactions"
  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    }
  }, [activeTab, transactionPage, loadTransactions]);

  // Trigger overview transaction load
  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverviewTransactions();
    }
  }, [activeTab, overviewPage, loadOverviewTransactions]);

  // Trigger invoice load when tab is "invoices" or "overview"
  useEffect(() => {
    if (activeTab === 'invoices' || activeTab === 'overview') {
      loadInvoices();
    }
  }, [activeTab, invoicePage, loadInvoices]);

  // Filter transactions by search
  const filteredTransactions = transactions.filter(txn => {
    if (txnSearchQuery === '') return true;
    const q = txnSearchQuery.toLowerCase();
    return (
      txn.transactionNumber.toLowerCase().includes(q) ||
      txn.type.toLowerCase().includes(q) ||
      txn.status.toLowerCase().includes(q)
    );
  });

  // Filter invoices by search
  const filteredInvoices = invoices.filter(inv => {
    if (invSearchQuery === '') return true;
    const q = invSearchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'purchase': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'sale-return': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'purchase-return': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'payment-in': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'payment-out': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getInvoiceStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getPaymentBadgeClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'unpaid': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className='flex items-start gap-2'>
          <div className='mt-1'>
            <Link href="/dashboard/parties" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-5" />
            </Link>
          </div>
          <div className='flex flex-col'>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{party.displayName}</h1>
              <Badge className={partyStatusColors[party.status]}>{party.status}</Badge>
              <Badge variant="secondary">{partyTypeLabels[party.partyType]}</Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Created {formatDate(party.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <EditPartyDialog party={party} onPartyUpdated={handlePartyUpdated}>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-2" />Edit</Button>
          </EditPartyDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Party</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete this party? This action cannot be undone. All associated transactions and history will remain but this party will no longer be selectable.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tab Navigation + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-1 bg-muted rounded-lg p-1" role="tablist">
          {['overview', 'transactions', 'invoices', 'notes'].map((tab) => (
            <button
              key={tab}
              role="tab"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-800 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          {(party.partyType === 'customer' || party.partyType === 'both') && (
            <CreateSaleDialog onSaleCreated={() => { router.refresh(); }} initialParty={party._id}>
              <Button variant="outline" size="sm"><ShoppingCart className="w-4 h-4 mr-2" />New Sale</Button>
            </CreateSaleDialog>
          )}
          {(party.partyType === 'supplier' || party.partyType === 'both') && (
            <CreatePurchaseDialog onPurchaseCreated={() => { router.refresh(); }} initialParty={party._id}>
              <Button variant="outline" size="sm"><ArrowUpDown className="w-4 h-4 mr-2" />New Purchase</Button>
            </CreatePurchaseDialog>
          )}
        </div>
      </div>

      {/* === TRANSACTIONS TAB === */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length > 0 && (
            <DataTableToolbar onSearch={setTxnSearchQuery} searchPlaceholder="Search transactions..." />
          )}
          <TransactionListCard
            transactions={filteredTransactions.map((txn): TransactionListItem => ({
              id: txn._id,
              transactionNumber: txn.transactionNumber,
              type: txn.type,
              status: txn.status,
              paymentStatus: txn.paymentStatus || 'unpaid',
              partyName: party.displayName,
              grandTotal: txn.summary.grandTotal || 0,
              transactionDate: txn.transactionDate,
              lineItemCount: txn.lineItems?.length || 0,
              invoiceId: txn.invoiceId || null,
            }))}
            loading={transactionsLoading}
            pagination={transPagination as TransactionListPagination}
            onPageChange={(page) => setTransactionPage(page)}
            onView={(item) => {
              const txn = transactions.find(t => t._id === item.id);
              if (txn) partyActions.viewTransaction(txn as unknown as ActionableTransaction);
            }}
            onGenerateInvoice={(item) => {
              const txn = transactions.find(t => t._id === item.id);
              if (txn) partyActions.generateInvoiceForTransaction(txn as unknown as ActionableTransaction);
            }}
            onViewInvoice={(item) => {
              if (item.invoiceId) partyActions.handleViewInvoice(item.invoiceId._id);
            }}
            extraActions={(item) => {
              const txn = transactions.find(t => t._id === item.id);
              if (!txn) return null;
              return partyActions.renderExtraActions(txn as unknown as ActionableTransaction);
            }}
            emptyMessage="No transactions found"
            emptyDescription="No transactions for this party yet"
          />
        </div>
      )}

      {/* === INVOICES TAB === */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {invoices.length > 0 && (
            <DataTableToolbar onSearch={setInvSearchQuery} searchPlaceholder="Search invoices..." />
          )}
          <InvoiceListCard
            invoices={filteredInvoices.map((inv): InvoiceListItem => ({
              id: inv._id,
              invoiceNumber: inv.invoiceNumber,
              status: inv.status,
              partyName: party.displayName,
              grandTotal: inv.transactionId?.summary?.grandTotal || 0,
              paymentStatus: inv.transactionId?.paymentStatus || 'unpaid',
              createdAt: inv.createdAt,
              dueDate: inv.dueDate,
            }))}
            loading={invoicesLoading}
            pagination={invPagination as unknown as InvoiceListPagination}
            onPageChange={(page) => setInvoicePage(page)}
            onView={(item) => {
              const inv = invoices.find(i => i._id === item.id);
              if (inv) { setPreviewInvoice(inv); setPreviewOpen(true); }
            }}
            onDownload={(item) => {
              const inv = invoices.find(i => i._id === item.id);
              if (inv) window.open(`/api/invoices/${inv._id}/pdf`, '_blank');
            }}
            onPrint={(item) => {
              const inv = invoices.find(i => i._id === item.id);
              if (inv) window.open(`/api/invoices/${inv._id}/pdf#toolbar=0`, '_blank');
            }}
            emptyMessage="No invoices found"
            emptyDescription="No invoices for this party yet"
          />
        </div>
      )}

      {/* Dialogs from shared hook */}
      <TransactionDetailDialog
        open={partyActions.viewDialogOpen}
        onOpenChange={partyActions.setViewDialogOpen}
        transaction={partyActions.selectedTransaction as any}
      />

      {/* Cancel Transaction Confirmation Dialog */}
      <AlertDialog open={partyActions.cancelDialogOpen} onOpenChange={partyActions.setCancelDialogOpen}>
        <AlertDialogContent className="bg-background dark:bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this transaction?
              {partyActions.transactionToCancel && (
                <>
                  <span className="mt-2 font-medium block">{partyActions.transactionToCancel.transactionNumber}</span>
                  {partyActions.transactionToCancel.invoiceId && (
                    <span className="mt-1 text-amber-600 block">The linked invoice will also be cancelled.</span>
                  )}
                </>
              )}
              This will reverse any inventory movements and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={partyActions.isCancelling}>Keep Transaction</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={partyActions.isCancelling} onClick={(e) => { e.preventDefault(); partyActions.handleConfirmCancel(); }}>
              {partyActions.isCancelling ? 'Cancelling...' : 'Yes, Cancel Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={partyActions.deleteDialogOpen} onOpenChange={partyActions.setDeleteDialogOpen}>
        <AlertDialogContent className="bg-background dark:bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              {partyActions.transactionToDelete && (
                <span className="mt-2 font-medium block">{partyActions.transactionToDelete.transactionNumber}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={partyActions.isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={partyActions.handleDeleteTransaction} disabled={partyActions.isDeleting}>
              {partyActions.isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Preview Modal from shared hook */}
      {partyActions.invoiceToPreview && (
        <InvoicePreviewModal
          open={!!partyActions.invoiceToPreview}
          onOpenChange={(open) => { if (!open) partyActions.setInvoiceToPreview(null); }}
          invoice={partyActions.invoiceToPreview}
          onDownload={() => partyActions.downloadInvoice(partyActions.invoiceToPreview!)}
          onPrint={() => partyActions.printInvoice(partyActions.invoiceToPreview!)}
        />
      )}

      {/* Invoice Preview Modal (for invoices tab) */}
      {previewInvoice && (
        <InvoicePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          invoice={previewInvoice}
          onDownload={() => window.open(`/api/invoices/${previewInvoice._id}/pdf`, '_blank')}
          onPrint={() => window.open(`/api/invoices/${previewInvoice._id}/pdf`, '_blank')}
        />
      )}

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {children}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4">Activity Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold">{transPagination.total || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold">{invPagination.total || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Active Since</p>
                <p className="text-lg font-medium">{formatDate(party.createdAt, { month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Party Type</p>
                <p className="text-lg font-medium capitalize">{partyTypeLabels[party.partyType]}</p>
              </div>
            </div>
          </div>
          <RecentTransactionsCard
            transactions={overviewTransactions}
            currentPage={overviewPage}
            totalPages={overviewPagination.totalPages}
            total={overviewPagination.total}
            isLoading={overviewLoading}
            onPageChange={setOverviewPage}
            onMutate={() => { loadOverviewTransactions(); loadTransactions(); }}
            title="Recent Transactions"
            viewAllLink={`/dashboard/parties/${party._id}?tab=transactions`}
          />
        </div>
      )}

      {/* === NOTES TAB === */}
      {activeTab === 'notes' && <NotesTabContent party={party} onRefresh={handlePartyUpdated} />}
    </div>
  );
}

// --- Notes Tab Component ---

function NotesTabContent({ party, onRefresh }: { party: Party; onRefresh: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(party.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = notes.length;
  const maxChars = 2000;
  const isOverLimit = charCount > maxChars;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(notes.length, notes.length);
    }
  }, [isEditing, notes.length]);

  const handleSave = async () => {
    if (isOverLimit) {
      toast.error(`Notes must be under ${maxChars} characters`);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/parties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: party._id, notes: notes || null }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save notes');
      }
      toast.success('Notes saved successfully');
      setIsEditing(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(party.notes || '');
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Party Notes</h3>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            {party.notes ? 'Edit Notes' : 'Add Notes'}
          </Button>
        )}
      </div>

      {/* Editor / Viewer */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isEditing ? (
          <div className="p-4 md:p-6">
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes about this party..."
              className={`w-full min-h-[200px] p-3 text-sm rounded-lg border resize-y focus:outline-none focus:ring-2 bg-background ${
                isOverLimit
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'
              }`}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  {charCount}/{maxChars}
                </span>
                {isOverLimit && (
                  <span className="text-xs text-red-500">Character limit exceeded</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving || isOverLimit}>
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Notes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : notes ? (
          <div className="p-4 md:p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {notes}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              <FileText className="w-3.5 h-3.5" />
              <span>{charCount} characters</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">No notes added yet</p>
            <p className="text-xs mt-1">Click "Add Notes" to start writing</p>
          </div>
        )}
      </div>
    </div>
  );
}

const partyStatusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const partyTypeLabels: Record<string, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  both: 'Customer & Supplier',
};