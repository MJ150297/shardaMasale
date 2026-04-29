'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Printer, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { roundCurrency } from '@/lib/utils';

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
  id: string;
  _id: string;
  transactionNumber: string;
  type: 'sale' | 'purchase' | 'sale-return' | 'purchase-return' | 'payment-in' | 'payment-out' | 'adjustment' | 'opening-balance';
  status: 'draft' | 'confirmed' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'void' | 'not-applicable';
  party?: { id: string; name: string; phone?: string; email?: string } | null;
  transactionDate: string | Date;
  dueDate?: string | Date | null;
  lineItems: TransactionLineItem[];
  summary: TransactionSummary;
  notes?: string | null;
  tags: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
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
        setTransactions(data.data);
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
      const res = await fetch(`/api/transactions/${transactionToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== transactionToDelete.id));
        setDeleteDialogOpen(false);
        setTransactionToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setIsDeleting(false);
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

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'purchase': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View and manage all sales, purchases and payments</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" />
                New Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create New Sale</DialogTitle>
                <DialogDescription>Record a new sales transaction</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-center text-muted-foreground">Transaction form will be implemented here</p>
              </div>
              <DialogFooter>
                <Button type="submit">Create Sale</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="mr-2 h-4 w-4" />
                New Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create New Purchase</DialogTitle>
                <DialogDescription>Record a new purchase transaction</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-center text-muted-foreground">Transaction form will be implemented here</p>
              </div>
              <DialogFooter>
                <Button type="submit">Create Purchase</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="sale">Sales</option>
            <option value="purchase">Purchases</option>
            <option value="payment-in">Payments In</option>
            <option value="payment-out">Payments Out</option>
          </select>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Party</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
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
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {transaction.transactionNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={getTypeBadgeClass(transaction.type)}>
                        {transaction.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {transaction.party?.name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {transaction.lineItems?.length || 0} items
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
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewTransaction(transaction)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => confirmDelete(transaction)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
        <DialogContent className="max-w-3xl">
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
                  <p className="font-medium">{selectedTransaction.party?.name || '-'}</p>
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