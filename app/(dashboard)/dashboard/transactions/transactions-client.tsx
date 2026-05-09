'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, Printer, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { roundCurrency, debounce } from '@/lib/utils';
import DataTableToolbar from '@/components/data-table-toolbar';
import CreateSaleDialog from '@/components/create-sale-dialog';
import CreatePurchaseDialog from '@/components/create-purchase-dialog';
import CreatePaymentDialog from '@/components/create-payment-dialog';
import CreateSaleReturnDialog from '@/components/create-sale-return-dialog';
import CreatePurchaseReturnDialog from '@/components/create-purchase-return-dialog';

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

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [searchQuery, setSearchQuery] = useState('');

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
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const getPaymentBadgeClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getItemTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'product': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'service': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'mixed': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View and manage all sales, purchases and payments</p>
        </div>
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
            <CreatePaymentDialog type="payment-in" onCreated={loadTransactions}>
              <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                Payment In (Receive)
              </DropdownMenuItem>
            </CreatePaymentDialog>
            <CreatePaymentDialog type="payment-out" onCreated={loadTransactions}>
              <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                Payment Out (Pay)
              </DropdownMenuItem>
            </CreatePaymentDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="" value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Party</th>
                <th className="px-4 py-3 text-left font-medium">Item Type</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredTransactions.length === 0 ? (
                <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <span className="text-2xl">📋</span>
                    </div>
                    <h3 className="text-lg font-medium">No transactions found</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Record your first sale or purchase to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={getTransactionId(transaction)} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getPartyName(transaction.party)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getItemTypeBadgeClass(getTransactionItemType(transaction))}>
                        {getTransactionItemType(transaction)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getTypeBadgeClass(transaction.type)}>
                        {transaction.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      ₹{transaction.summary.grandTotal?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getStatusBadgeClass(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getPaymentBadgeClass(transaction.paymentStatus)}>
                        {transaction.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {transaction.invoiceId ? (
                        <Badge>
                          {transaction.invoiceId.status}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600">
                          None
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className='bg-white/80'>
                           <DropdownMenuItem onClick={() => viewTransaction(transaction)}>
                             <Eye className="mr-2 h-4 w-4" />
                             View
                           </DropdownMenuItem>
                           
                           {transaction.type === 'sale' && transaction.status === 'confirmed' && !transaction.invoiceId && (
                             <DropdownMenuItem onClick={() => generateInvoiceForTransaction(transaction)}>
                               <FileText className="mr-2 h-4 w-4" />
                               Generate Invoice
                             </DropdownMenuItem>
                           )}

                           {transaction.invoiceId && (
                             <DropdownMenuItem onClick={() => {
                               window.open(`/api/invoices/${transaction.invoiceId!._id}/pdf`, '_blank');
                             }}>
                               <FileText className="mr-2 h-4 w-4" />
                               View Invoice
                             </DropdownMenuItem>
                           )}
                          {transaction.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleStatusUpdate(transaction, 'confirmed')}>
                              <Edit className="mr-2 h-4 w-4" />
                              Confirm Draft
                            </DropdownMenuItem>
                          )}
                          {(transaction.status === 'draft' || transaction.status === 'confirmed') && (
                            <DropdownMenuItem onClick={() => handleStatusUpdate(transaction, 'cancelled')}>
                              <Edit className="mr-2 h-4 w-4" />
                              Cancel Transaction
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                          {transaction.status === 'draft' && (
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => confirmDelete(transaction)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Draft
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
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
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

      {/* View Transaction Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl bg-white/80">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction?.transactionNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedTransaction.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{selectedTransaction.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Party</p>
                  <p className="font-medium">{getPartyName(selectedTransaction.party)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedTransaction.transactionDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border rounded-md p-4">
                <p className="font-medium mb-2">Total: ₹{selectedTransaction.summary.grandTotal.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{selectedTransaction.lineItems.length} items</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              {transactionToDelete && (
                <p className="mt-2 font-medium">{transactionToDelete.transactionNumber}</p>
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
    </div>
  );
}
