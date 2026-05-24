'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

export function PurchaseOrdersReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/purchase-orders?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, statusFilter, startDate, endDate]);

  const poColumns = [
    { key: 'orderNumber', label: 'PO #' },
    { key: 'date', label: 'Date' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'status', label: 'Status' },
    { key: 'totalAmount', label: 'Amount' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'dueAmount', label: 'Due' },
  ];

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load purchase orders report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Orders</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.totalOrders}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">₹{data.totals.totalAmount.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">₹{data.totals.totalPaid.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Due</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{data.totals.totalDue.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
        <ExportButton data={data.orders} filename="purchase-orders" columns={poColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.map((order: any) => (
                <TableRow key={order._id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.date)}</TableCell>
                  <TableCell>{order.supplier?.displayName || '-'}</TableCell>
                  <TableCell><Badge variant={order.status === 'confirmed' ? 'default' : order.status === 'draft' ? 'secondary' : 'destructive'}>{order.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{order.paymentStatus}</Badge></TableCell>
                  <TableCell className="text-right">{order.items.length}</TableCell>
                  <TableCell className="text-right">₹{order.totalAmount.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${order.dueAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>₹{order.dueAmount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}