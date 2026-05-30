'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  Package, Receipt,
  ArrowDownRight, Clock, DollarSign,
  ReceiptIndianRupee,
  FileText,
} from 'lucide-react';
import { usePageActions } from '@/components/layout/dashboard-shell';
import CreatePaymentInDialog from '@/components/create-payment-in-dialog';
import CreatePaymentOutDialog from '@/components/create-payment-out-dialog';
import CreateInvoice from '@/modules/billing/create-invoice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { DateRangeFilter } from '@/modules/reports/date-range-filter';
import Link from 'next/link';
import { toast } from 'sonner';
import { getPartyId, getPartyName, getPartyPhone, type PartyLike } from '@/lib/party-helpers';
import { cn } from '@/lib/utils';
import { useActiveShop } from '@/components/providers/shop-provider';
import OnboardingBanner from '@/components/onboarding-banner';

interface LowStockItem {
  _id: string;
  name: string;
  sku?: string | null;
  stock: {
    currentQuantity: number;
    reorderLevel: number;
  };
}

interface RecentTransaction {
  transactionId?: string;
  id: string;
  type: string;
  customer: string;
  partyId?: string | null;
  invoiceId?: string | null;
  customerPhone?: string | null;
  amount: string;
  paymentStatus: string;
  date: string;
  dateIso: string;
  time: string;
}

interface DashboardTransactionRecord {
  _id: string;
  transactionNumber: string;
  type: string;
  party?: PartyLike | string | null;
  invoiceId?: string | { _id?: string | { toString(): string }; id?: string | null } | null;
  summary: {
    grandTotal: number;
  };
  paymentStatus: string;
  transactionDate: string | Date;
  createdAt: string | Date;
}

interface DashboardTransactionsResponse {
  data: DashboardTransactionRecord[];
  pagination?: {
    totalPages?: number;
    total?: number;
  };
}

function getInvoiceId(
  invoice?: string | { _id?: string | { toString(): string }; id?: string | null } | null,
): string | null {
  if (!invoice) {
    return null;
  }

  if (typeof invoice === 'string') {
    return invoice;
  }

  const invoiceId = invoice._id ?? invoice.id;

  if (!invoiceId) {
    return null;
  }

  return typeof invoiceId === 'string' ? invoiceId : invoiceId.toString();
}

interface DashboardClientProps {
  userName: string;
  stats: {
    totalItems: number;
    lowStockCount: number;
    todayTransactions: number;
    todayRevenue: number;
  };
  lowStockItems: LowStockItem[];
  recentTransactions: RecentTransaction[];
}


export default function DashboardClient({ userName, stats, lowStockItems, recentTransactions }: DashboardClientProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { setActions } = usePageActions();
  const { availableShops, isLoading: shopIsLoading } = useActiveShop();

  // Compute dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  }, []);

  // Dialog open states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  // Set page action buttons
  useEffect(() => {
    setActions([
      {
        label: 'Payment In',
        icon: ArrowDownRight,
        onClick: () => setPaymentDialogOpen(true),
        variant: 'default'
      },
      {
        label: 'Add Bill',
        icon: FileText,
        onClick: () => setCreateInvoiceOpen(true),
        variant: 'secondary'
      }
    ]);

    return () => setActions([]);
  }, [setActions]);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  // Chart date range and data
  const [chartStartDate, setChartStartDate] = useState<Date | undefined>();
  const [chartEndDate, setChartEndDate] = useState<Date | undefined>();

  const getChartKey = () => {
    let url = '/api/reports/dashboard-charts';
    if (chartStartDate) url += `?startDate=${chartStartDate.toISOString()}`;
    if (chartEndDate) url += `${chartStartDate ? '&' : '?'}endDate=${chartEndDate.toISOString()}`;
    return url;
  };

  const { data: chartResponse } = useSWR<{ data: Array<{ name: string; sales: number; orders: number }> }>(
    getChartKey(),
    (url) => fetch(url).then(res => res.json()),
    { revalidateOnFocus: false }
  );

  const chartData = chartResponse?.data || [];

  const PAGE_SIZE = 4;

  const getKey = () => {
    let url = `/api/transactions?page=${page}&limit=${PAGE_SIZE}&status=confirmed`;
    if (startDate) url += `&startDate=${startDate.toISOString()}`;
    if (endDate) url += `&endDate=${endDate.toISOString()}`;
    return url;
  };

  const { data, isLoading, mutate } = useSWR<DashboardTransactionsResponse>(getKey(),
    (url) => fetch(url).then(res => res.json()),
    {
      revalidateOnFocus: false,
      revalidateOnMount: false,
    }
  );

  // Format raw transaction data to match display format
  const formatTransaction = (tx: DashboardTransactionRecord): RecentTransaction => ({
    transactionId: tx._id,
    id: tx.transactionNumber,
    type: tx.type,
    customer: getPartyName(tx.party, 'Cash Sale'),
    partyId: getPartyId(tx.party),
    invoiceId: getInvoiceId(tx.invoiceId),
    customerPhone: getPartyPhone(tx.party),
    amount: `₹ ${tx.summary.grandTotal.toLocaleString('en-IN')}`,
    paymentStatus: tx.paymentStatus,
    date: new Date(tx.transactionDate).toLocaleDateString('en-IN'),
    dateIso: new Date(tx.transactionDate).toISOString(),
    time: new Date(tx.createdAt).toLocaleString()
  });

  const handleShareTransaction = (transaction: RecentTransaction) => {
    const phone = transaction.customerPhone?.replace(/\D/g, '');

    if (!phone) {
      toast.error(`No phone number found for ${transaction.customer}.`);
      return;
    }

    const message = `*Transaction Details*\n-------------------\nInvoice #: ${transaction.id}\nCustomer: ${transaction.customer}\nAmount: ${transaction.amount}\nStatus: ${transaction.paymentStatus}\n\nSent from GSMS Shop Management System`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const transactions = data
    ? data.data.map(formatTransaction)
    : recentTransactions;
  const totalPages = data?.pagination?.totalPages || 0;
  const total = data?.pagination?.total || 0;

  const statsCards = [
    {
      title: 'Today Revenue',
      value: `₹ ${stats.todayRevenue.toLocaleString('en-IN')}`,
      change: 'Today',
      positive: true,
      icon: <DollarSign className="h-6 w-6" />,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Today Transactions',
      value: stats.todayTransactions.toString(),
      change: 'Today',
      positive: true,
      icon: <Receipt className="h-6 w-6" />,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockCount.toString(),
      change: stats.lowStockCount > 0 ? 'Attention' : 'Good',
      positive: stats.lowStockCount === 0,
      icon: <Package className="h-6 w-6" />,
      gradient: stats.lowStockCount > 0 ? 'from-red-500 to-orange-500' : 'from-emerald-500 to-green-500',
    },
    {
      title: 'Total Items',
      value: stats.totalItems.toString(),
      change: 'Active',
      positive: true,
      icon: <Package className="h-6 w-6" />,
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {greeting}, {userName}
        </h1>
        <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
          <Clock className="size-3.5" />
          <span>Updated just now</span>
        </div>
      </div>

      {/* First-run onboarding banner */}
      {!shopIsLoading && availableShops.length === 0 && <OnboardingBanner />}

      {/* Stats Grid - Fully Mobile Optimized */}
      <div className="grid gap-3 md:gap-5 grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
            <div className="px-2 md:px-3">
              <div className="mt-3 md:mt-4">
                <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</h3>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Low Stock Alert
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} below reorder level
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {lowStockItems.map((item) => (
              <div key={item._id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {item.stock.currentQuantity} / {item.stock.reorderLevel}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Current / Minimum</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 dark:border-gray-800">

          {/* Desktop Layout */}
          <div className="hidden md:flex items-start justify-between">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onDateChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
                setPage(1);
              }}
            />
            <div className="text-right">
              <Link href="/dashboard/transactions" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-1">
                View all
              </Link>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Latest Transactions</h3>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Latest Transactions</h3>
            <div className="flex items-center justify-between">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onDateChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                  setPage(1);
                }}
              />
              <Link href="/dashboard/transactions" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                View all
              </Link>
            </div>
          </div>

        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {transactions.map((transaction: RecentTransaction, index: number) => (
            <div key={index} className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Receipt className="w-4 h-4 md:w-5 md:h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white">{transaction.id} - {transaction.customer}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${transaction.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          transaction.type === 'purchase' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            transaction.type === 'payment-in' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              transaction.type === 'payment-out' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                          {transaction.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">{transaction.amount}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${transaction.paymentStatus === 'paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      transaction.paymentStatus === 'partial' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        transaction.paymentStatus === 'unpaid' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                      {transaction.paymentStatus}
                    </span>
                  </div>
                </div>

                {(transaction.paymentStatus === 'unpaid' || transaction.paymentStatus === 'partial') && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {transaction.type === 'sale' ? (
                      <CreatePaymentInDialog
                        initialPartyId={transaction.partyId}
                        initialPartyName={transaction.customer}
                        initialPartyPhone={transaction.customerPhone}
                        initialSelectedInvoiceIds={
                          transaction.invoiceId ? [transaction.invoiceId] : []
                        }
                        onCreated={() => mutate()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                          <ReceiptIndianRupee className="h-4 w-4 mr-1.5" />
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
                        onCreated={() => mutate()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                        >
                          <ReceiptIndianRupee className="h-4 w-4 mr-1.5" />
                          Record Payment
                        </Button>
                      </CreatePaymentOutDialog>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-9 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                      onClick={() => handleShareTransaction(transaction)}
                    >
                      <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                      </svg>
                      Share
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination buttons - ALL SCREEN SIZES */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages} ({total} total)</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Charts - Date Range Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Charts</h2>
        <DateRangeFilter
          startDate={chartStartDate}
          endDate={chartEndDate}
          onDateChange={(start, end) => {
            setChartStartDate(start);
            setChartEndDate(end);
          }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sales Overview</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {chartStartDate && chartEndDate
                  ? `${chartStartDate.toLocaleDateString('en-IN')} - ${chartEndDate.toLocaleDateString('en-IN')}`
                  : 'Monthly sales performance'}
              </p>
            </div>
          </div>
          <div className="h-72 w-full min-w-72">
            <ResponsiveContainer width="100%" height={280} minWidth={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Orders Trend</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {chartStartDate && chartEndDate
                  ? `${chartStartDate.toLocaleDateString('en-IN')} - ${chartEndDate.toLocaleDateString('en-IN')}`
                  : 'Monthly order count'}
              </p>
            </div>
          </div>
          <div className="h-72 w-full min-w-72">
            <ResponsiveContainer width="100%" height={280} minWidth={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="orders" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment In Dialog - controlled from mobile action buttons */}
      <CreatePaymentInDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onCreated={() => {
          setPaymentDialogOpen(false);
          mutate();
        }}
      />

      {/* Add Bill / Create Invoice Dialog - controlled from mobile action buttons */}
      <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
        <DialogContent className="bg-white/80 max-w-none! w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <CreateInvoice
            onSuccess={() => {
              setCreateInvoiceOpen(false);
              mutate();
            }}
            onCancel={() => setCreateInvoiceOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
