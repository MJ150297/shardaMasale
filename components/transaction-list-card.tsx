'use client';

import { useState } from 'react';
import { Eye, FileText, MoreHorizontal, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/date-utils';

// --- Types ---

export interface TransactionListItem {
  id: string;
  transactionNumber: string;
  type: string;
  status: string;
  paymentStatus: string;
  partyName: string;
  grandTotal: number;
  transactionDate: string | Date;
  lineItemCount?: number;
  invoiceId?: { _id: string; invoiceNumber: string; status: string } | null;
}

export interface TransactionListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionListCardProps {
  transactions: TransactionListItem[];
  loading: boolean;
  pagination: TransactionListPagination;
  onPageChange: (page: number) => void;
  onView: (transaction: TransactionListItem) => void;
  onGenerateInvoice?: (transaction: TransactionListItem) => void;
  onViewInvoice?: (transaction: TransactionListItem) => void;
  /** Optional extra action items to add to the dropdown menu */
  extraActions?: (transaction: TransactionListItem) => React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
}

// --- Helpers ---

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

// --- Component ---

export default function TransactionListCard({
  transactions,
  loading,
  pagination,
  onPageChange,
  onView,
  onGenerateInvoice,
  onViewInvoice,
  extraActions,
  emptyMessage = 'No transactions found',
  emptyDescription = 'Record your first sale or purchase to get started',
}: TransactionListCardProps) {
  return (
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
      ) : transactions.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-medium">{emptyMessage}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{emptyDescription}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => onView(transaction)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  onView(transaction);
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
                        <span className="hidden sm:inline">{transaction.transactionNumber} - </span>
                        {transaction.partyName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTypeBadgeClass(transaction.type)}`}>
                          {transaction.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(transaction.transactionDate)}
                        </span>
                        {transaction.lineItemCount !== undefined && transaction.lineItemCount > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 hidden md:inline">
                            {transaction.lineItemCount} items
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount + Badges + Actions */}
                  <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    {/* Amount - desktop only */}
                    <div className="text-right hidden sm:block">
                      <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
                        ₹{transaction.grandTotal?.toFixed(2) || '0.00'}
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
                        ₹{transaction.grandTotal?.toFixed(2) || '0.00'}
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
                      <DropdownMenuContent align="end" className="bg-background dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onSelect={(e) => { e.preventDefault(); e.stopPropagation(); onView(transaction); }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>

                        {transaction.type === 'sale' && transaction.status === 'confirmed' && !transaction.invoiceId && onGenerateInvoice && (
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); onGenerateInvoice(transaction); }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Invoice
                          </DropdownMenuItem>
                        )}

                        {transaction.invoiceId && onViewInvoice && (
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); e.stopPropagation(); onViewInvoice(transaction); }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            View Invoice
                          </DropdownMenuItem>
                        )}

                        {extraActions?.(transaction)}
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
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}