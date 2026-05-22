'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { ExportButton } from './export-button';
import { DateRangeFilter } from './date-range-filter';

interface TransactionReportProps {
  shopId?: string;
}

export function TransactionReport({ shopId }: TransactionReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        if (typeFilter) params.append('type', typeFilter);
        if (statusFilter) params.append('status', statusFilter);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
        
        const res = await fetch(`/api/reports/transactions?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load transaction report', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shopId, typeFilter, statusFilter, startDate, endDate]);

  const transactionColumns = [
    { key: 'createdAt', label: 'Date' },
    { key: 'party.name', label: 'Party' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Amount' },
  ];

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96" />
    </div>;
  }

  if (!data) return <div>Failed to load transaction report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">₹{data.totals.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{data.totals.salesCount} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{data.totals.totalPurchases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{data.totals.purchasesCount} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(data.totals.totalSales - data.totals.totalPurchases).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sales</SelectItem>
              <SelectItem value="purchase">Purchases</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <DateRangeFilter 
            startDate={startDate} 
            endDate={endDate} 
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }} 
          />
        </div>

        <ExportButton data={data.transactions} filename="transaction-report" columns={transactionColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.map((tx: any) => (
                <TableRow key={tx._id}>
                  <TableCell>{formatDate(tx.createdAt)}</TableCell>
                  <TableCell>{tx.party?.displayName || tx.party?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'sale' ? 'default' : 'secondary'}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.status === 'confirmed' ? 'default' : tx.status === 'pending' ? 'outline' : 'destructive'}>
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₹{(tx.summary?.grandTotal || 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}