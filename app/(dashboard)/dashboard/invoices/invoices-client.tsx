'use client';

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Download, Eye, FileText, ChevronLeft, ChevronRight, Printer, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/date-utils';
import InvoicePreviewModal from '@/modules/billing/invoice-preview-modal';
import DataTableToolbar from '@/components/data-table-toolbar';
import CreateInvoice, { type InvoiceFormValues } from '@/modules/billing/create-invoice';
import InvoiceShareSheet from '@/components/invoice-share-sheet';
import RequireShopGuard from '@/components/require-shop-guard';

interface TransactionSummary {
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  roundOff?: number;
  totalDiscountType?: 'percentage' | 'fixed' | null;
  totalDiscountValue?: number | null;
}

interface Transaction {
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';
  lineItems: unknown[];
  additionalCharges?: Array<{ name: string; amount: number }>;
  summary: TransactionSummary;
  party?: {
    _id: string;
    displayName?: string;
    name?: string;
  } | null;
  transactionDate?: string | Date;
  dueDate?: string | Date | null;
  notes?: string | null;
  tags?: string[];
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

function getInvoiceId(invoice: Invoice) {
  return invoice.id || invoice._id || invoice.invoiceNumber;
}

function getPartyName(invoice: Invoice) {
  return invoice.transactionId?.party?.displayName 
      || invoice.transactionId?.party?.name 
      || invoice.party?.displayName 
      || invoice.party?.name 
      || '-';
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
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

export default function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, filters]);

  async function handleCancelInvoice(invoice: Invoice) {
    const invoiceId = getInvoiceId(invoice);
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Invoice cancelled successfully');
        setCancelDialogOpen(false);
        loadInvoices();
      } else {
        toast.error(data.error || 'Failed to cancel invoice');
      }
    } catch (error) {
      toast.error('Failed to cancel invoice');
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleMarkAsPaid(invoice: Invoice) {
    const invoiceId = getInvoiceId(invoice);
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-paid' }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Invoice marked as paid');
        loadInvoices();
      } else {
        toast.error(data.error || 'Failed to mark invoice as paid');
      }
    } catch (error) {
      toast.error('Failed to mark invoice as paid');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteDraftInvoice(invoice: Invoice) {
    const invoiceId = getInvoiceId(invoice);
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Draft invoice deleted successfully');
        setDeleteDialogOpen(false);
        loadInvoices();
      } else {
        toast.error(data.error || 'Failed to delete draft invoice');
      }
    } catch (error) {
      toast.error('Failed to delete draft invoice');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleConfirmDraftInvoice(invoice: Invoice) {
    const invoiceId = getInvoiceId(invoice);
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Invoice confirmed successfully');
        loadInvoices();
      } else {
        toast.error(data.error || 'Failed to confirm invoice');
      }
    } catch (error) {
      toast.error('Failed to confirm invoice');
    } finally {
      setActionLoading(null);
    }
  }

  function mapInvoiceToInitialValues(invoice: Invoice): Partial<InvoiceFormValues> {
    const transaction = invoice.transactionId;

    return {
      party: (transaction.party as { _id?: string } | null)?._id || (invoice.party as { _id?: string } | null)?._id || '',
      transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate) : new Date(),
      dueDate: transaction.dueDate ? new Date(transaction.dueDate) : new Date(invoice.dueDate),
      lineItems: (transaction.lineItems || []).map((item) => ({
        item: (item as { item?: string | null }).item ?? null,
        itemName: (item as { itemName: string }).itemName,
        sku: (item as { sku?: string | null }).sku ?? null,
        description: (item as { description?: string | null }).description ?? null,
        unit: (item as { unit: string }).unit,
        quantity: (item as { quantity: number }).quantity,
        unitPrice: (item as { unitPrice: number }).unitPrice,
        discountAmount: (item as { discountAmount?: number }).discountAmount ?? 0,
        taxRate: (item as { taxRate?: number }).taxRate ?? 0,
        costPrice: (item as { costPrice?: number | null }).costPrice ?? null,
      })),
      additionalCharges: transaction.additionalCharges ?? [],
      summary: {
        roundOff: transaction.summary.roundOff ?? 0,
        paidAmount: transaction.summary.paidAmount ?? 0,
        totalDiscountType: (transaction.summary as TransactionSummary & {
          totalDiscountType?: 'percentage' | 'fixed' | null;
        }).totalDiscountType ?? null,
        totalDiscountValue: (transaction.summary as TransactionSummary & {
          totalDiscountValue?: number | null;
        }).totalDiscountValue ?? 0,
      },
      payment: null,
      notes: invoice.notes ?? transaction.notes ?? '',
      termsAndConditions: invoice.termsAndConditions ?? '',
      status: 'draft' as const,
    };
  }

  function handleEditDraftInvoice(invoice: Invoice) {
    setInvoiceToEdit(invoice);
    setEditDialogOpen(true);
  }

  const draftInvoiceInitialValues = useMemo(
    () => (invoiceToEdit ? mapInvoiceToInitialValues(invoiceToEdit) : null),
    [invoiceToEdit],
  );

  async function loadInvoices() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
      });

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();

      if (res.ok) {
        setInvoices(
          (data.data || []).map((invoice: Invoice) => ({
            ...invoice,
            id: invoice.id || invoice._id || invoice.invoiceNumber,
          }))
        );
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  function viewInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  }

  function downloadInvoice(invoice: Invoice) {
    toast.info('Downloading invoice...');
    window.open(`/api/invoices/${getInvoiceId(invoice)}/pdf`, '_blank');
  }

  function printInvoice(invoice: Invoice) {
    toast.info('Preparing invoice for print...');
    const printWindow = window.open(`/api/invoices/${getInvoiceId(invoice)}/pdf#toolbar=0`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      getPartyName(invoice).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">View and manage all invoices</p>
        </div>
        <RequireShopGuard>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </RequireShopGuard>
      </div>

      <Tabs defaultValue="" value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))} className="w-full">
        <TabsList variant="segmented" className="w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTableToolbar
        onSearch={setSearchQuery}
        searchPlaceholder="Search invoices by number, party name..."
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
        ) : filteredInvoices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-6 w-6 opacity-50" />
            </div>
            <h3 className="text-lg font-medium">No invoices found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredInvoices.map((invoice) => (
              <div
                key={getInvoiceId(invoice)}
                className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => viewInvoice(invoice)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    viewInvoice(invoice);
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
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                          <span className="hidden sm:inline">{invoice.invoiceNumber} - </span>{getPartyName(invoice)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getStatusBadgeClass(invoice.status)}`}>
                            {invoice.status}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(invoice.createdAt)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                            Due: {formatDate(invoice.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount + Badges + Actions */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                      {/* Amount - desktop only */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
                          ₹{(invoice.totalAmount || invoice.transactionId?.summary?.grandTotal || 0).toFixed(2)}
                        </p>
                      </div>

                      {/* Payment status badge - desktop only */}
                      {invoice.transactionId?.paymentStatus && invoice.transactionId.paymentStatus !== 'not-applicable' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline ${getPaymentBadgeClass(invoice.transactionId.paymentStatus)}`}>
                          {invoice.transactionId.paymentStatus}
                        </span>
                      )}

                      {/* Mobile compact amount */}
                      <div className="sm:hidden text-right">
                        <p className="text-[10px] font-semibold text-gray-900 dark:text-white">
                          ₹{(invoice.totalAmount || invoice.transactionId?.summary?.grandTotal || 0).toFixed(2)}
                        </p>
                        {invoice.transactionId?.paymentStatus && invoice.transactionId.paymentStatus !== 'not-applicable' && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {invoice.transactionId.paymentStatus}
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
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); viewInvoice(invoice); }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); downloadInvoice(invoice); }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); printInvoice(invoice); }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>

                          {invoice.status === 'draft' && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleEditDraftInvoice(invoice); }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Draft
                            </DropdownMenuItem>
                          )}

                          {invoice.status === 'draft' && (
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirmDraftInvoice(invoice); }}
                              disabled={actionLoading === getInvoiceId(invoice)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Confirm Draft
                            </DropdownMenuItem>
                          )}

                          {invoice.status === 'draft' && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedInvoice(invoice); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Draft
                            </DropdownMenuItem>
                          )}

                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <>
                              <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsPaid(invoice); }}
                                disabled={actionLoading === getInvoiceId(invoice)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedInvoice(invoice); setCancelDialogOpen(true); }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel Invoice
                              </DropdownMenuItem>
                            </>
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

      {/* View Invoice Dialog - Full Invoice Preview */}
      {selectedInvoice && (
        <InvoicePreviewModal
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          invoice={selectedInvoice}
          onDownload={() => downloadInvoice(selectedInvoice)}
          onPrint={() => printInvoice(selectedInvoice)}
        />
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-white/80 max-w-none! w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Create New Invoice</DialogTitle>
            </div>
          </DialogHeader>
          <CreateInvoice
            onSuccess={() => {
              setCreateDialogOpen(false);
              loadInvoices();
              toast.success('Invoice created successfully');
            }}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Draft Invoice Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white/80 max-w-none! w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Edit Draft Invoice</DialogTitle>
            </div>
          </DialogHeader>
          {invoiceToEdit && (
            <CreateInvoice
              editingInvoiceId={getInvoiceId(invoiceToEdit)}
              initialValues={draftInvoiceInitialValues}
              onSuccess={() => {
                setEditDialogOpen(false);
                setInvoiceToEdit(null);
                loadInvoices();
                toast.success('Invoice updated successfully');
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setInvoiceToEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Invoice Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel invoice <strong>{selectedInvoice?.invoiceNumber}</strong>?
              This will reverse all inventory movements and mark the invoice as cancelled.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={cancelLoading}
              onClick={(e) => {
                e.preventDefault();
                if (selectedInvoice) {
                  handleCancelInvoice(selectedInvoice);
                }
              }}
            >
              {cancelLoading ? 'Cancelling...' : 'Yes, Cancel Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Draft Invoice Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className='bg-white/80'>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete draft invoice <strong>{selectedInvoice?.invoiceNumber}</strong>?
              This will remove the invoice and its linked transaction entirely.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault();
                if (selectedInvoice) {
                  handleDeleteDraftInvoice(selectedInvoice);
                }
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}