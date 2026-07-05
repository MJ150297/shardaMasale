'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  ArrowDownRight, Clock,
  FileText,
  CalendarClock,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import { usePageActions } from '@/components/layout/dashboard-shell';
import CreatePaymentInDialog from '@/components/create-payment-in-dialog';
import CreateInvoice from '@/modules/billing/create-invoice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from 'next-themes';
import { DateRangeFilter } from '@/modules/reports/date-range-filter';
import { getPartyId, getPartyName, getPartyPhone, getInvoiceId, type PartyLike } from '@/lib/party-helpers';
import { useActiveShop } from '@/components/providers/shop-provider';
import OnboardingBanner from '@/components/onboarding-banner';
import RecentTransactionsCard, { type RecentTransactionItem } from '@/components/recent-transactions-card';
import type { ShareBusinessProfile, ShareMessageTemplates } from '@/lib/share-messages';

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

interface DashboardClientProps {
  userName: string;
  shopName: string;
  businessProfile?: ShareBusinessProfile | null;
  shareMessageTemplates?: ShareMessageTemplates | null;
  stats: {
    totalItems: number;
    lowStockCount: number;
    todayTransactions: number;
    todayRevenue: number;
  };
  dueToday: {
    unpaid: number;
    partial: number;
    total: number;
    totalDue: number;
  };
  overdue: {
    count: number;
    totalDue: number;
  };
  outstanding: {
    count: number;
    totalDue: number;
  };
  monthlySales: number;
  lastMonthSales: number;
  lowStockItems: LowStockItem[];
  recentTransactions: RecentTransaction[];
}


export default function DashboardClient({
  userName,
  shopName,
  businessProfile,
  shareMessageTemplates,
  stats,
  dueToday,
  overdue,
  outstanding,
  monthlySales,
  lastMonthSales,
  lowStockItems,
  recentTransactions: initialTransactions,
}: DashboardClientProps) {
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

  // Format SSR initial transactions as fallback for SWR
  const initialFallback: DashboardTransactionsResponse = {
    data: [],
    pagination: { totalPages: 0, total: 0 },
  };

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
      revalidateOnMount: true,
      keepPreviousData: true,
      fallbackData: initialFallback,
    }
  );

  // Format raw transaction data to match RecentTransactionItem for the card component
  const formatForCard = (tx: DashboardTransactionRecord): RecentTransactionItem => ({
    _id: tx._id,
    transactionId: tx._id,
    transactionNumber: tx.transactionNumber,
    type: tx.type,
    customer: getPartyName(tx.party, 'Cash Sale'),
    partyId: getPartyId(tx.party),
    invoiceId: getInvoiceId(tx.invoiceId),
    customerPhone: getPartyPhone(tx.party),
    amount: tx.summary.grandTotal,
    amountFormatted: `₹ ${tx.summary.grandTotal.toLocaleString('en-IN')}`,
    paymentStatus: tx.paymentStatus,
    date: new Date(tx.transactionDate).toLocaleDateString('en-IN'),
    dateIso: new Date(tx.transactionDate).toISOString(),
  });

  const recordData = data ?? initialFallback;
  // Use SSR data as initial display, SWR updates seamlessly
  const cardTransactions = recordData.data && recordData.data.length > 0
    ? recordData.data.map(formatForCard)
    : initialTransactions.map((tx): RecentTransactionItem => ({
        _id: tx.transactionId || tx.id,
        transactionId: tx.transactionId,
        transactionNumber: tx.id,
        type: tx.type,
        customer: tx.customer,
        partyId: tx.partyId,
        invoiceId: tx.invoiceId,
        customerPhone: tx.customerPhone,
        amount: parseFloat(tx.amount.replace(/[₹,]/g, '')) || 0,
        amountFormatted: tx.amount,
        paymentStatus: tx.paymentStatus,
        date: tx.date,
        dateIso: tx.dateIso,
      }));
  const totalPages = recordData.pagination?.totalPages || 0;
  const total = recordData.pagination?.total || 0;

  const monthlySalesChange = lastMonthSales > 0
    ? ((monthlySales - lastMonthSales) / lastMonthSales) * 100
    : monthlySales > 0 ? 100 : 0;

  const statsCards = [
    {
      title: 'Due Today',
      value: dueToday.total.toString(),
      subtitle: dueToday.total > 0
        ? `${dueToday.unpaid} unpaid · ${dueToday.partial} partial`
        : 'No payments due',
      change: dueToday.totalDue > 0 ? `₹ ${dueToday.totalDue.toLocaleString('en-IN')} pending` : 'All clear',
      positive: dueToday.total === 0,
      icon: <CalendarClock className="h-6 w-6" />,
      gradient: dueToday.total > 0 ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-green-500',
    },
    {
      title: 'Outstanding Dues',
      value: `₹ ${outstanding.totalDue.toLocaleString('en-IN')}`,
      subtitle: outstanding.count > 0 ? `${outstanding.count} transactions` : 'No pending dues',
      change: outstanding.count > 0 ? `${outstanding.count} need attention` : 'All settled',
      positive: outstanding.count === 0,
      icon: <IndianRupee className="h-6 w-6" />,
      gradient: outstanding.count > 0 ? 'from-red-500 to-rose-500' : 'from-emerald-500 to-green-500',
    },
    {
      title: 'Overdue',
      value: overdue.count.toString(),
      subtitle: overdue.count > 0
        ? `₹ ${overdue.totalDue.toLocaleString('en-IN')} overdue`
        : 'No overdue payments',
      change: overdue.count > 0 ? 'Action needed' : 'On track',
      positive: overdue.count === 0,
      icon: <AlertTriangle className="h-6 w-6" />,
      gradient: overdue.count > 0 ? 'from-red-600 to-red-400' : 'from-emerald-500 to-green-500',
    },
    {
      title: "This Month's Sales",
      value: `₹ ${monthlySales.toLocaleString('en-IN')}`,
      subtitle: lastMonthSales > 0 ? `Last month: ₹ ${lastMonthSales.toLocaleString('en-IN')}` : 'First month data',
      change: monthlySalesChange !== 0
        ? `${monthlySalesChange > 0 ? '↑' : '↓'} ${Math.abs(monthlySalesChange).toFixed(1)}% vs last month`
        : 'No change',
      positive: monthlySalesChange >= 0,
      icon: <TrendingUp className="h-6 w-6" />,
      gradient: monthlySalesChange >= 0 ? 'from-blue-500 to-indigo-500' : 'from-orange-500 to-red-500',
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
                <div className="flex items-center gap-1.5">
                  <span className={`${stat.positive ? 'text-emerald-500' : 'text-red-500'}`}>{stat.icon}</span>
                  <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</h3>
                </div>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.subtitle}</p>
                )}
                {stat.change && (
                  <p className={`text-xs font-medium mt-1 ${stat.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {stat.change}
                  </p>
                )}
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

      {/* Recent Transactions */}
      <RecentTransactionsCard
        transactions={cardTransactions}
        currentPage={page}
        totalPages={totalPages}
        total={total}
        isLoading={isLoading}
        onPageChange={setPage}
        onMutate={mutate}
        businessProfile={businessProfile}
        shareMessageTemplates={shareMessageTemplates}
        shopName={shopName}
        title="Latest Transactions"
        viewAllLink="/dashboard/transactions"
        dateFilterComponent={
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setPage(1);
            }}
          />
        }
      />

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
        <DialogContent className="bg-background dark:bg-gray-900 max-w-none! w-[90vw] max-h-[90vh] overflow-y-auto">
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