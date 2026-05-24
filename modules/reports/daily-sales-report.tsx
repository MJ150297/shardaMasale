'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Wallet, TrendingUp, CreditCard } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

export function DailySalesReport({ shopId }: { shopId?: string }) {
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
      const res = await fetch(`/api/reports/daily-sales?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  const dsColumns = [
    { key: 'date', label: 'Date' },
    { key: 'invoiceCount', label: 'Invoices' },
    { key: 'totalSales', label: 'Total Sales' },
    { key: 'cash', label: 'Cash' },
    { key: 'card', label: 'Card' },
    { key: 'upi', label: 'UPI' },
    { key: 'avgTicketSize', label: 'Avg Ticket' },
  ];

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load daily sales report</div>;

  const { totals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">₹{totals.totalSales.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invoices</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.totalInvoices}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cash</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{totals.cash.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Card</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{totals.card.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">UPI</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{totals.upi.toLocaleString()}</div></CardContent></Card>
      </div>

      {totals.avgTicketSize > 0 && (
        <div className="text-sm text-muted-foreground">
          Average Ticket Size: <span className="font-bold">₹{totals.avgTicketSize.toLocaleString()}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        <ExportButton data={data.dailyBreakdown} filename="daily-sales" columns={dsColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="text-right">Card</TableHead>
                <TableHead className="text-right">UPI</TableHead>
                <TableHead className="text-right">Bank</TableHead>
                <TableHead className="text-right">Avg Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dailyBreakdown.map((day: any) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">{day.date}</TableCell>
                  <TableCell className="text-right">{day.invoiceCount}</TableCell>
                  <TableCell className="text-right text-green-500">₹{day.totalSales.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.totalPaid.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-500">₹{day.totalDue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.cash.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.card.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.upi.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.bankTransfer.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{day.avgTicketSize.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}