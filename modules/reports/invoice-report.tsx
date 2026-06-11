'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { ExportButton } from './export-button';
import { DateRangeFilter } from './date-range-filter';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface InvoiceReportProps {
  shopId?: string;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  sent: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'outline',
};

export function InvoiceReport({ shopId }: InvoiceReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        if (statusFilter) params.append('status', statusFilter);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        const res = await fetch(`/api/reports/invoices?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load invoice report', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId, statusFilter, startDate, endDate, page]);

  const invoiceColumns = [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'party.displayName', label: 'Party' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'transaction.summary.grandTotal', label: 'Amount' },
    { key: 'transaction.summary.dueAmount', label: 'Due' },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) return <div>Failed to load invoice report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">Amount: ₹{data.summary.totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.summary.paidCount}</div>
            <p className="text-xs text-muted-foreground">₹{data.summary.paidAmount.toLocaleString()} collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{data.summary.totalInvoices - data.summary.paidCount - data.summary.overdueCount}</div>
            <p className="text-xs text-muted-foreground">Due: ₹{data.summary.totalDue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.summary.overdueCount}</div>
            <p className="text-xs text-muted-foreground">₹{data.summary.overdueAmount.toLocaleString()} overdue</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
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

        <ExportButton data={data.invoices} filename="invoice-report" columns={invoiceColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invoices.map((inv: any) => (
                <TableRow key={inv._id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.party?.displayName || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[inv.status] || 'outline'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(inv.dueDate)}</TableCell>
                  <TableCell className="text-right">
                    ₹{(inv.transaction?.summary?.grandTotal || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={inv.transaction?.summary?.dueAmount > 0 ? 'text-red-500' : 'text-green-500'}>
                      ₹{(inv.transaction?.summary?.dueAmount || 0).toLocaleString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {data.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No invoices found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {data.pagination && (
          <PaginationControls
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}