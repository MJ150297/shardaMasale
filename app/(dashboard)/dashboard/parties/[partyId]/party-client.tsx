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
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  // Transaction detail dialog
  const [viewTxn, setViewTxn] = useState<Transaction | null>(null);
  const [viewTxnDialogOpen, setViewTxnDialogOpen] = useState(false);

  // Invoice preview modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Invoice preview for transactions tab
  const [txnInvoicePreview, setTxnInvoicePreview] = useState<any>(null);
  const [txnInvoicePreviewOpen, setTxnInvoicePreviewOpen] = useState(false);

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
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Trigger transaction load when tab is "transactions" or "overview"
  useEffect(() => {
    if (activeTab === 'transactions' || activeTab === 'overview') {
      loadTransactions();
    }
  }, [activeTab, transactionPage, loadTransactions]);

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
              <Badge className={partyStatusColors[party.status]}>
                {party.status}
              </Badge>
              <Badge variant="secondary">
                {partyTypeLabels[party.partyType]}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Created {formatDate(party.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

        </div>

        <div className="flex gap-2">
          <EditPartyDialog party={party} onPartyUpdated={handlePartyUpdated}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </EditPartyDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Party</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this party? This action cannot be undone.
                  All associated transactions and history will remain but this party will no longer be selectable.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
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
          <button
            role="tab"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'overview'
              ? 'bg-white dark:bg-gray-800 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            role="tab"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'transactions'
              ? 'bg-white dark:bg-gray-800 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
          <button
            role="tab"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'invoices'
              ? 'bg-white dark:bg-gray-800 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('invoices')}
          >
            Invoices
          </button>
          <button
            role="tab"
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'notes'
              ? 'bg-white dark:bg-gray-800 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
        </div>

        <div className="flex gap-2 shrink-0">
          {(party.partyType === 'customer' || party.partyType === 'both') && (
            <CreateSaleDialog
              onSaleCreated={() => { router.refresh(); }}
              initialParty={party._id}
            >
              <Button variant="outline" size="sm">
                <ShoppingCart className="w-4 h-4 mr-2" />
                New Sale
              </Button>
            </CreateSaleDialog>
          )}
          {(party.partyType === 'supplier' || party.partyType === 'both') && (
            <CreatePurchaseDialog
              onPurchaseCreated={() => { router.refresh(); }}
              initialParty={party._id}
            >
              <Button variant="outline" size="sm">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                New Purchase
              </Button>
            </CreatePurchaseDialog>
          )}
        </div>
      </div>

      {/* === TRANSACTIONS TAB === */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length > 0 && (
            <DataTableToolbar
              onSearch={setTxnSearchQuery}
              searchPlaceholder="Search transactions..."
            />
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Transaction #</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Items</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Payment</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-500">No transactions found</h3>
                        <p className="text-sm text-gray-400 mt-1">No transactions for this party yet</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => (
                      <tr key={txn._id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(txn.transactionDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {txn.transactionNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={getTypeBadgeClass(txn.type)}>
                            {txn.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {txn.lineItems?.length || 0} items
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          ₹{(txn.summary.grandTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={getPaymentBadgeClass(txn.paymentStatus || 'unpaid')}>
                            {txn.paymentStatus || 'unpaid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={getStatusBadgeClass(txn.status)}>
                            {txn.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white/80">
                              <DropdownMenuItem onClick={() => {
                                setViewTxn(txn);
                                setViewTxnDialogOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              {txn.type === 'sale' && txn.status === 'confirmed' && !txn.invoiceId && (
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    const res = await fetch('/api/invoices/generate', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ transactionId: txn._id || txn.transactionNumber }),
                                    });
                                    if (res.ok) {
                                      toast.success('Invoice generated');
                                      loadTransactions();
                                    } else {
                                      const err = await res.json();
                                      toast.error(err.message || 'Failed to generate invoice');
                                    }
                                  } catch {
                                    toast.error('Failed to generate invoice');
                                  }
                                }}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Generate Invoice
                                </DropdownMenuItem>
                              )}
                              {txn.invoiceId && (
                                <DropdownMenuItem onClick={() => {
                                  setTxnInvoicePreview(txn.invoiceId);
                                  setTxnInvoicePreviewOpen(true);
                                }}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Invoice
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((transPagination.page - 1) * transPagination.limit) + 1} to {Math.min(transPagination.page * transPagination.limit, transPagination.total)} of {transPagination.total}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setTransactionPage(prev => Math.max(prev - 1, 1))}
                    disabled={transPagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setTransactionPage(prev => Math.min(prev + 1, transPagination.totalPages))}
                    disabled={transPagination.page >= transPagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === INVOICES TAB === */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {invoices.length > 0 && (
            <DataTableToolbar
              onSearch={setInvSearchQuery}
              searchPlaceholder="Search invoices..."
            />
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                    <th className="px-4 py-3 text-left font-medium">Due Date</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Payment</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-500">No invoices found</h3>
                        <p className="text-sm text-gray-400 mt-1">No invoices for this party yet</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv._id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(inv.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          ₹{(inv.transactionId?.summary?.grandTotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={getPaymentBadgeClass(inv.transactionId?.paymentStatus || 'unpaid')}>
                            {inv.transactionId?.paymentStatus || 'unpaid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={getInvoiceStatusBadgeClass(inv.status)}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white/80">
                              <DropdownMenuItem onClick={() => {
                                window.open(`/api/invoices/${inv._id}/pdf`, '_blank');
                              }}>
                                <FileText className="mr-2 h-4 w-4" />
                                View PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setPreviewInvoice(inv);
                                setPreviewOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {invPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((invPagination.page - 1) * invPagination.limit) + 1} to {Math.min(invPagination.page * invPagination.limit, invPagination.total)} of {invPagination.total}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setInvoicePage(prev => Math.max(prev - 1, 1))}
                    disabled={invPagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setInvoicePage(prev => Math.min(prev + 1, invPagination.totalPages))}
                    disabled={invPagination.page >= invPagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Detail Dialog - shared component */}
      <TransactionDetailDialog
        open={viewTxnDialogOpen}
        onOpenChange={setViewTxnDialogOpen}
        transaction={viewTxn ? (viewTxn as any) : null}
      />

      {/* Invoice Preview Modal for Transactions tab */}
      {txnInvoicePreview && (
        <InvoicePreviewModal
          open={txnInvoicePreviewOpen}
          onOpenChange={setTxnInvoicePreviewOpen}
          invoice={txnInvoicePreview}
          onDownload={() => {
            window.open(`/api/invoices/${txnInvoicePreview._id}/pdf`, '_blank');
          }}
          onPrint={() => {
            window.open(`/api/invoices/${txnInvoicePreview._id}/pdf`, '_blank');
          }}
        />
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          invoice={previewInvoice}
          onDownload={() => {
            window.open(`/api/invoices/${previewInvoice._id}/pdf`, '_blank');
          }}
          onPrint={() => {
            window.open(`/api/invoices/${previewInvoice._id}/pdf`, '_blank');
          }}
        />
      )}

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {children}

          {/* Activity Summary */}
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
                <p className="text-lg font-medium">
                  {formatDate(party.createdAt, { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Party Type</p>
                <p className="text-lg font-medium capitalize">{partyTypeLabels[party.partyType]}</p>
              </div>
            </div>
          </div>

          {/* Recent Activity Timeline */}
          {!transactionsLoading && filteredTransactions.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
              <div className="space-y-3">
                {filteredTransactions.slice(0, 10).map((txn) => (
                  <div key={txn._id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {txn.transactionNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(txn.transactionDate)} &middot; {txn.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ₹{(txn.summary.grandTotal || 0).toFixed(2)}
                      </p>
                      <Badge className={getStatusBadgeClass(txn.status)}>
                        {txn.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === NOTES TAB === */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {party.notes ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-3">Party Notes</h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {party.notes}
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No notes added yet</p>
            </div>
          )}
        </div>
      )}
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

