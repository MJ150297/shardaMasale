'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertTriangle, TrendingUp, DollarSign, TrendingDown, Calculator } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import { ExportButton } from './export-button';

interface StockReportProps {
  shopId?: string;
}

export function StockReport({ shopId }: StockReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [costingMethod, setCostingMethod] = useState<'latest' | 'fifo' | 'average'>('latest');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (shopId) params.append('shopId', shopId);
        params.append('method', costingMethod);
        
        const res = await fetch(`/api/reports/stock?${params}`);
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error('Failed to load stock report', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shopId, costingMethod]);

  const stockColumns = [
    { key: 'name', label: 'Item Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'stock.currentQuantity', label: 'Stock' },
    { key: 'pricing.costPrice', label: 'Cost Price' },
    { key: 'pricing.sellingPrice', label: 'Selling Price' },
  ];

  // Get the effective cost price and value for an item based on the selected costing method
  const getItemCostPrice = (item: any) => {
    if (costingMethod === 'latest') return item.pricing.costPrice;
    if (costingMethod === 'fifo') return item.valuation?.averageCost || item.pricing.costPrice;
    if (costingMethod === 'average') return item.valuation?.averageCost || item.pricing.costPrice;
    return item.pricing.costPrice;
  };

  const getItemValue = (item: any) => {
    const qty = item.stock.currentQuantity || 0;
    if (costingMethod === 'latest') return qty * item.pricing.costPrice;
    if (costingMethod === 'fifo') return item.valuation?.fifo || qty * item.pricing.costPrice;
    if (costingMethod === 'average') return item.valuation?.average || qty * item.pricing.costPrice;
    return qty * item.pricing.costPrice;
  };

  const movementColumns = [
    { key: 'createdAt', label: 'Date' },
    { key: 'item.name', label: 'Item' },
    { key: 'type', label: 'Type' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'referenceType', label: 'Reference' },
  ];

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96" />
    </div>;
  }

  if (!data) return <div>Failed to load stock report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.summary.totalStockValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FIFO Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(data.summary.totalFIFOValue || data.summary.totalStockValue).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
            <Calculator className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(data.summary.totalAverageValue || data.summary.totalStockValue).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{data.summary.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.summary.outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <h3 className="text-lg font-semibold">Stock Report</h3>
        <div className="flex items-center gap-3">
          <Select value={costingMethod} onValueChange={(v: any) => setCostingMethod(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Costing Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Cost</SelectItem>
              <SelectItem value="fifo">FIFO Method</SelectItem>
              <SelectItem value="average">Weighted Average</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton data={data.items} filename="stock-report" columns={stockColumns} />
        </div>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Stock</TabsTrigger>
          <TabsTrigger value="lowstock">Low Stock Alert</TabsTrigger>
          <TabsTrigger value="movements">Movement History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="current">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku || '-'}</TableCell>
                      <TableCell>{item.category || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.stock.currentQuantity > 5 ? 'default' : item.stock.currentQuantity > 0 ? 'outline' : 'destructive'}>
                          {item.stock.currentQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">₹{getItemCostPrice(item)}</TableCell>
                      <TableCell className="text-right">₹{item.pricing.sellingPrice}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{getItemValue(item).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lowstock">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead className="text-right">Reorder Qty</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.filter((item: any) => item.isLowStock || item.isOutOfStock).map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.stock.currentQuantity > 0 ? 'outline' : 'destructive'}>
                          {item.stock.currentQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.stock.reorderLevel}</TableCell>
                      <TableCell className="text-right">{item.stock.reorderQuantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.isOutOfStock ? 'destructive' : 'secondary'}>
                          {item.isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.filter((item: any) => item.isLowStock || item.isOutOfStock).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        All items are sufficiently stocked.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.movements.map((movement: any) => (
                    <TableRow key={movement._id}>
                      <TableCell>{formatDate(movement.createdAt)}</TableCell>
                      <TableCell>{movement.item?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={movement.type === 'IN' ? 'default' : 'destructive'}>
                          {movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{movement.quantity}</TableCell>
                      <TableCell>{movement.referenceType}</TableCell>
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