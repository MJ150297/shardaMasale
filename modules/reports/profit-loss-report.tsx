'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { ExportButton } from './export-button';
import { DateRangeFilter } from './date-range-filter';

interface ProfitLossReportProps {
  shopId?: string;
}

export function ProfitLossReport({ shopId }: ProfitLossReportProps) {
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
        
        const res = await fetch(`/api/reports/profit-loss?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load profit & loss report', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shopId, period, startDate, endDate]);

  const plColumns = [
    { key: 'date', label: 'Period' },
    { key: 'sales', label: 'Sales' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'profit', label: 'Profit' },
    { key: 'margin', label: 'Margin %' },
  ];

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96" />
    </div>;
  }

  if (!data) return <div>Failed to load profit & loss report</div>;

  const isProfit = data.totals.totalProfit >= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.totals.totalSales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.totals.totalPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {isProfit ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              ₹{data.totals.totalProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totals.margin}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-37.5">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
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

        <ExportButton data={data.summary} filename="profit-loss-report" columns={plColumns} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map((item: any, index: number) => {
                const profitPositive = item.profit >= 0;
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.date}</TableCell>
                    <TableCell className="text-right">₹{item.sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{item.purchases.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-medium ${profitPositive ? 'text-green-500' : 'text-red-500'}`}>
                      ₹{item.profit.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={profitPositive ? 'default' : 'destructive'}>
                        {item.margin}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}