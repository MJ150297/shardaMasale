'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, AlertTriangle,
  Users, Package, Clock, ArrowUpRight, ArrowDownLeft, Wallet,
} from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';

interface SnapshotReportProps {
  shopId?: string;
}

export function SnapshotReport({ shopId }: SnapshotReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());

        const res = await fetch(`/api/reports/snapshot?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load snapshot', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div>Failed to load dashboard snapshot</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      </div>

      {/* Sales & Purchases */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ₹{data.sales.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{data.sales.count} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ₹{data.purchases.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{data.purchases.count} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className={`h-4 w-4 ${data.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{data.netProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.invoices.draft + data.invoices.sent + data.invoices.paid + data.invoices.overdue}
            </div>
            <div className="flex gap-2 mt-1 text-xs">
              <Badge variant="outline" className="text-xs px-1 py-0">Sent: {data.invoices.sent}</Badge>
              <Badge variant="outline" className="text-xs px-1 py-0">Paid: {data.invoices.paid}</Badge>
              {data.invoices.overdue > 0 && (
                <Badge variant="destructive" className="text-xs px-1 py-0">Overdue: {data.invoices.overdue}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue & Party Info */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card className={data.invoices.totalOverdueAmount > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ₹{data.invoices.totalOverdueAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{data.invoices.overdue} overdue invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receivables</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              ₹{data.parties.totalReceivables.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From {data.parties.customers} customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payables</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              ₹{data.parties.totalPayables.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">To {data.parties.suppliers} suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory & Party Count */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{data.parties.customers + data.parties.suppliers + data.parties.both}</div>
                <p className="text-xs text-muted-foreground">Total parties</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>👤 {data.parties.customers} customers</div>
                <div>🏭 {data.parties.suppliers} suppliers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Status</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {data.inventory.lowStock > 0 && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-2xl font-bold">{data.inventory.lowStock}</span>
                  <span className="text-xs">low</span>
                </div>
              )}
              {data.inventory.outOfStock > 0 && (
                <div className="flex items-center gap-1 text-red-500">
                  <TrendingDown className="h-5 w-5" />
                  <span className="text-2xl font-bold">{data.inventory.outOfStock}</span>
                  <span className="text-xs">out</span>
                </div>
              )}
              {data.inventory.lowStock === 0 && data.inventory.outOfStock === 0 && (
                <div className="text-sm text-muted-foreground">All items well-stocked ✅</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(data.sales.total - data.purchases.total).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Net cash flow (Sales - Purchases)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}