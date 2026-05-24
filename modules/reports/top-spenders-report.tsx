'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, DollarSign, ShoppingBag } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

export function TopSpendersReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [sortBy, setSortBy] = useState('totalSpent');
  const [limit, setLimit] = useState('20');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      params.append('sortBy', sortBy);
      params.append('limit', limit);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/top-spenders?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, sortBy, limit, startDate, endDate]);

  const tsColumns = [
    { key: 'rank', label: '#' },
    { key: 'displayName', label: 'Customer' },
    { key: 'totalSpent', label: 'Total Spent' },
    { key: 'transactionCount', label: 'Orders' },
    { key: 'avgOrderValue', label: 'Avg Order' },
    { key: 'loyaltyTier', label: 'Tier' },
    { key: 'lastPurchase', label: 'Last Purchase' },
  ];

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load top spenders report</div>;

  const tierColors: Record<string, string> = {
    Platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    Gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    Silver: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    Bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Customers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.summary.totalCustomers}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">₹{data.summary.totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Avg Customer Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">₹{data.summary.avgCustomerValue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active (90 days)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{data.summary.activeCustomers}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(data.summary.tierDistribution).map(([tier, count]) => (
          <Card key={tier}>
            <CardHeader className="pb-2"><CardTitle className="text-xs">{tier}</CardTitle></CardHeader>
            <CardContent><div className={`text-lg font-bold ${tier === 'Platinum' ? 'text-purple-500' : tier === 'Gold' ? 'text-yellow-500' : ''}`}>{count as number}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="totalSpent">Total Spent</SelectItem>
              <SelectItem value="frequency">Order Frequency</SelectItem>
              <SelectItem value="avgOrder">Avg Order Value</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Limit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
              <SelectItem value="100">Top 100</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
        <ExportButton data={data.customers} filename="top-spenders" columns={tsColumns} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Avg Order</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Last Purchase</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customers.map((c: any, idx: number) => (
                <TableRow key={c._id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{c.displayName}</TableCell>
                  <TableCell className="text-right font-bold">₹{c.totalSpent.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{c.transactionCount}</TableCell>
                  <TableCell className="text-right">₹{c.avgOrderValue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{c.totalItems}</TableCell>
                  <TableCell className="text-sm">{c.lastPurchase ? formatDate(c.lastPurchase) : '-'}</TableCell>
                  <TableCell><Badge className={tierColors[c.loyaltyTier]}>{c.loyaltyTier}</Badge></TableCell>
                  <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}