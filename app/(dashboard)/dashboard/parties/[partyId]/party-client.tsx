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
import { ArrowLeft, Edit, Trash2, ChevronLeft, ChevronRight, Clock, FileText, ShoppingCart, ArrowUpDown, Eye, Printer, Pin, PinOff, Search, History, Plus, X, Tag, StickyNote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

interface PartyNote {
  _id: string;
  content: string;
  category: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  history: Array<{ content: string; editedAt: string }>;
}

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
  notesList?: PartyNote[];
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

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'follow-up', label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'important', label: 'Important', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'payment', label: 'Payment', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'delivery', label: 'Delivery', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
];

const MAX_NOTE_CHARS = 2000;

function getCategoryInfo(category: string) {
  return NOTE_CATEGORIES.find(c => c.value === category) || NOTE_CATEGORIES[0];
}

function NotesTabContent({ party, onRefresh }: { party: Party; onRefresh: () => void }) {
  const [notes, setNotes] = useState<PartyNote[]>(party.notesList || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PartyNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [historyNote, setHistoryNote] = useState<PartyNote | null>(null);

  // Load notes from API when tab opens
  useEffect(() => {
    let isMounted = true;
    async function loadNotes() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/parties/${party._id}/notes`);
        const data = await res.json();
        if (res.ok && isMounted) {
          setNotes(data.notes || []);
        }
      } catch (error) {
        console.error('Failed to load notes:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadNotes();
    return () => { isMounted = false; };
  }, [party._id]);

  // Filter notes
  const filteredNotes = notes.filter(note => {
    // Category filter
    if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
    // Pinned filter
    if (showPinnedOnly && !note.pinned) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const contentMatch = note.content.toLowerCase().includes(q);
      const tagMatch = note.tags.some(tag => tag.toLowerCase().includes(q));
      if (!contentMatch && !tagMatch) return false;
    }
    return true;
  });

  // Sort: pinned first, then by createdAt desc
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleAddNote = async (noteData: { content: string; category: string; tags: string[]; pinned: boolean }) => {
    try {
      const res = await fetch(`/api/parties/${party._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add note');
      }
      const newNote = await res.json();
      setNotes(prev => [newNote, ...prev]);
      toast.success('Note added successfully');
      setIsComposerOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    }
  };

  const handleUpdateNote = async (noteId: string, noteData: { content: string; category: string; tags: string[]; pinned: boolean }) => {
    try {
      const res = await fetch(`/api/parties/${party._id}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update note');
      }
      const updatedNote = await res.json();
      setNotes(prev => prev.map(n => n._id === noteId ? updatedNote : n));
      toast.success('Note updated successfully');
      setEditingNote(null);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/parties/${party._id}/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete note');
      }
      setNotes(prev => prev.filter(n => n._id !== noteId));
      toast.success('Note deleted successfully');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete note');
    }
  };

  const handleTogglePin = async (note: PartyNote) => {
    try {
      const res = await fetch(`/api/parties/${party._id}/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update note');
      }
      const updatedNote = await res.json();
      setNotes(prev => prev.map(n => n._id === note._id ? updatedNote : n));
      toast.success(note.pinned ? 'Note unpinned' : 'Note pinned');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update note');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Party Notes</h3>
          {notes.length > 0 && (
            <Badge variant="secondary">{notes.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditingNote(null); setIsComposerOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Note
        </Button>
      </div>

      {/* Filters */}
      {notes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search notes by content or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {NOTE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showPinnedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className="shrink-0"
          >
            <Pin className="w-3.5 h-3.5 mr-1.5" />
            Pinned
          </Button>
        </div>
      )}

      {/* Composer */}
      {(isComposerOpen || editingNote) && (
        <NoteComposer
          initialNote={editingNote}
          onCancel={() => { setIsComposerOpen(false); setEditingNote(null); }}
          onSave={async (data) => {
            if (editingNote) {
              await handleUpdateNote(editingNote._id, data);
            } else {
              await handleAddNote(data);
            }
          }}
        />
      )}

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : sortedNotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-center py-12 text-gray-500">
          <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm font-medium">
            {notes.length === 0 ? 'No notes added yet' : 'No notes match your filters'}
          </p>
          <p className="text-xs mt-1">
            {notes.length === 0 ? 'Click "Add Note" to start writing' : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map(note => (
            <NoteCard
              key={note._id}
              note={note}
              onEdit={() => { setIsComposerOpen(false); setEditingNote(note); }}
              onDelete={() => handleDeleteNote(note._id)}
              onTogglePin={() => handleTogglePin(note)}
              onViewHistory={() => setHistoryNote(note)}
            />
          ))}
        </div>
      )}

      {/* History Dialog */}
      <Dialog open={!!historyNote} onOpenChange={(open) => { if (!open) setHistoryNote(null); }}>
        <DialogContent className="sm:max-w-lg bg-background dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Note History</DialogTitle>
            <DialogDescription>
              View the edit history for this note
            </DialogDescription>
          </DialogHeader>
          {historyNote && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Current version */}
              <div className="border-l-2 border-green-500 pl-4">
                <p className="text-xs font-medium text-green-600 mb-1">Current Version</p>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                  <ReactMarkdown>{historyNote.content}</ReactMarkdown>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Updated {formatDate(historyNote.updatedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* History entries */}
              {historyNote.history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No edit history available</p>
              ) : (
                historyNote.history.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Version {historyNote.history.length - idx}
                    </p>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                      <ReactMarkdown>{entry.content}</ReactMarkdown>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Edited {formatDate(entry.editedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Note Composer Component ---

function NoteComposer({
  initialNote,
  onCancel,
  onSave,
}: {
  initialNote: PartyNote | null;
  onCancel: () => void;
  onSave: (data: { content: string; category: string; tags: string[]; pinned: boolean }) => Promise<void>;
}) {
  const [content, setContent] = useState(initialNote?.content || '');
  const [category, setCategory] = useState(initialNote?.category || 'general');
  const [tags, setTags] = useState<string[]>(initialNote?.tags || []);
  const [pinned, setPinned] = useState(initialNote?.pinned || false);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_NOTE_CHARS;

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Note content is required');
      return;
    }
    if (isOverLimit) {
      toast.error(`Note must be under ${MAX_NOTE_CHARS} characters`);
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ content: content.trim(), category, tags, pinned });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">
            {initialNote ? 'Edit Note' : 'Add New Note'}
          </h4>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note... Use **bold**, *italic*, - lists, # headings for formatting"
          className={`min-h-[120px] ${isOverLimit ? 'border-red-500 focus:ring-red-500' : ''}`}
        />

        <div className="flex items-center justify-between">
          <span className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {charCount}/{MAX_NOTE_CHARS}
          </span>
          {isOverLimit && (
            <span className="text-xs text-red-500">Character limit exceeded</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Tags</label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="pin-note"
            checked={pinned}
            onCheckedChange={(checked) => setPinned(checked === true)}
          />
          <label htmlFor="pin-note" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            Pin this note to top
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || isOverLimit || !content.trim()}>
            {isSaving ? 'Saving...' : initialNote ? 'Update Note' : 'Add Note'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Note Card Component ---

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onViewHistory,
}: {
  note: PartyNote;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onViewHistory: () => void;
}) {
  const categoryInfo = getCategoryInfo(note.category);
  const hasHistory = note.history.length > 0;
  const isEdited = note.updatedAt !== note.createdAt;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border overflow-hidden ${note.pinned ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="p-4 md:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
            {note.pinned && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                <Pin className="w-2.5 h-2.5 mr-1" />Pinned
              </Badge>
            )}
            {note.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="w-2.5 h-2.5 mr-1" />{tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePin} title={note.pinned ? 'Unpin' : 'Pin'}>
              {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit note">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={onDelete} title="Delete note">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <ReactMarkdown>{note.content}</ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(note.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            {isEdited && (
              <span className="flex items-center gap-1">
                <Edit className="w-3 h-3" />
                Edited {formatDate(note.updatedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {hasHistory && (
            <button
              onClick={onViewHistory}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium"
            >
              <History className="w-3 h-3" />
              History ({note.history.length})
            </button>
          )}
        </div>
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