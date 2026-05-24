'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, RotateCcw, IndianRupee } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

export function SalesReturnsReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/sales-returns?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  const retColumns = [
    { key: 'transactionNumber', label: 'Return #' },
    { key: 'transactionDate', label: 'Date' },
    { key: 'party', label: 'Party' },
    { key: 'grandTotal', label: 'Amount' },
    { key: 'refunded', label: 'Refunded' },
    { key: 'notes', label: 'Notes' },
  ];

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load returns report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RotateCcw className="h-4 w-4" />Total Returns</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.summary.totalReturns}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" />Return Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{data.summary.totalReturnAmount.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />Refund Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-500">₹{data.summary.outstandingRefunds.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        <ExportButton data={data.returns} filename="sales-returns" columns={retColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.returns.map((ret: any) => (
                <TableRow key={ret._id}>
                  <TableCell className="font-medium">{ret.transactionNumber}</TableCell>
                  <TableCell>{formatDate(ret.transactionDate)}</TableCell>
                  <TableCell>{ret.party?.displayName || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {ret.items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}
                  </TableCell>
                  <TableCell className="text-right text-red-500">₹{ret.grandTotal.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{ret.refunded > 0 ? `₹${ret.refunded.toLocaleString()}` : <Badge variant="destructive">Unpaid</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}