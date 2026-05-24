'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';

export function StockAgingReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      const res = await fetch(`/api/reports/stock-aging?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load stock aging report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.totalItems}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Stock Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">₹{data.totals.totalStockValue.toLocaleString()}</div></CardContent></Card>
        <Card className="border-amber-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Clock className="h-4 w-4 text-amber-500" />Slow Moving (90+)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-500">{data.totals.slowMovingCount}</div></CardContent></Card>
        <Card className="border-red-200"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-500" />Stuck Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{data.totals.slowMovingValue.toLocaleString()}</div></CardContent></Card>
      </div>

      {/* Aging Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.agingSummary.map((bucket: any, index: number) => (
          <Card key={bucket.label || index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">{bucket.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{bucket.count}</div>
              <div className="text-xs text-muted-foreground">{bucket.totalQty} units</div>
              <div className="text-xs">₹{bucket.totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="slow">Slow Moving (90+ days)</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Bucket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item: any, index: number) => (
                    <TableRow key={item._id || index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.currentQuantity}</TableCell>
                      <TableCell className="text-right">{item.daysInStock}d</TableCell>
                      <TableCell className="text-right">₹{item.stockValue.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={item.daysInStock >= 90 ? 'destructive' : item.daysInStock >= 60 ? 'secondary' : 'outline'}>{item.bucket}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Last Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowMovingItems.map((item: any, index: number) => (
                    <TableRow key={item._id || index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.currentQuantity}</TableCell>
                      <TableCell className="text-right">{item.daysInStock}d</TableCell>
                      <TableCell className="text-right">₹{item.stockValue.toLocaleString()}</TableCell>
                      <TableCell>{formatDate(item.lastReceivedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}