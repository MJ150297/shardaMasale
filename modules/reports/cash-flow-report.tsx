'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

interface CashFlowReportProps {
  shopId?: string;
}

export function CashFlowReport({ shopId }: CashFlowReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('daily');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        params.append('period', period);
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
        const res = await fetch(`/api/reports/cash-flow?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load cash flow', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId, period, startDate, endDate]);

  const cfColumns = [
    { key: 'date', label: 'Period' },
    { key: 'sales', label: 'Sales' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'salesReturns', label: 'Sales Returns' },
    { key: 'paymentIn', label: 'Other Inflow' },
    { key: 'paymentOut', label: 'Other Outflow' },
    { key: 'netCashFlow', label: 'Net Cash Flow' },
  ];

  if (loading) return <div className="space-y-4">{['1','2','3','4'].map(i => <Skeleton key={i} className="h-24" />)}<Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load cash flow report</div>;

  const isPositive = data.totals.netCashFlow >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Inflow</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">₹{data.totals.totalOperatingIn.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Outflow</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{data.totals.totalOperatingOut.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            <Wallet className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              ₹{data.totals.netCashFlow.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Other</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <span className="text-green-500">In: ₹{data.totals.totalPaymentIn.toLocaleString()}</span>
              <br />
              <span className="text-red-500">Out: ₹{data.totals.totalPaymentOut.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
        <ExportButton data={data.summary} filename="cash-flow-report" columns={cfColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Returns</TableHead>
                <TableHead className="text-right">Other In</TableHead>
                <TableHead className="text-right">Other Out</TableHead>
                <TableHead className="text-right">Net Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map((item: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.date}</TableCell>
                  <TableCell className="text-right text-green-500">₹{item.sales.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-500">₹{item.purchases.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-orange-500">₹{item.salesReturns.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-500">₹{item.paymentIn.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-500">₹{item.paymentOut.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-bold ${item.netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ₹{item.netCashFlow.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}