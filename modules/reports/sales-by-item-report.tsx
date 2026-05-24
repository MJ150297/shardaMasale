'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Package, DollarSign, BarChart3 } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';
import { ExportButton } from './export-button';

export function SalesByItemReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [category, setCategory] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      if (category && category !== 'all') params.append('category', category);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      const res = await fetch(`/api/reports/sales-by-item?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, category, startDate, endDate]);

  const columns = [
    { key: 'itemName', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'unitsSold', label: 'Units Sold' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'costOfGoods', label: 'COGS' },
    { key: 'profit', label: 'Profit' },
    { key: 'margin', label: 'Margin' },
  ];

  if (loading) return <div className="space-y-4">{['1','2','3','4'].map(i => <Skeleton key={i} className="h-24" />)}<Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load sales by item report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">₹{data.totals.totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total COGS</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{data.totals.totalCost.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">₹{data.totals.totalProfit.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Units Sold</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.totalUnits.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {data.categories?.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>
        <ExportButton data={data.items} filename="sales-by-item" columns={columns} />
      </div>

      {/* Category Summary */}
      {data.categorySummary?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.categorySummary.map((cat: any) => (
            <Card key={cat.category}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{cat.category}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-lg font-bold">₹{cat.totalRevenue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {cat.itemCount} items · {cat.unitsSold} units · {cat.margin} margin
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item: any) => (
                <TableRow key={item.itemId || item.itemName}>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                  <TableCell className="text-right">{item.unitsSold}</TableCell>
                  <TableCell className="text-right">₹{item.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-500">₹{item.costOfGoods.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${item.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{item.profit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{item.margin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}