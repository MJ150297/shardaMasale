'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Truck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { DateRangeFilter } from './date-range-filter';

export function SupplierPerformanceReport({ shopId }: { shopId?: string }) {
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
      const res = await fetch(`/api/reports/supplier-performance?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId, startDate, endDate]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load supplier performance report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active Suppliers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.summary.totalSuppliers}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Orders</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.summary.totalOrders}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Avg Lead Time</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.summary.avgOverallLeadTime} days</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">On-Time Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{data.summary.onTimeRate}%</div></CardContent></Card>
      </div>

      <div className="flex items-center">
        <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Avg Lead</TableHead>
                <TableHead className="text-right">On-Time</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.suppliers.map((s: any) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.displayName}</TableCell>
                  <TableCell className="text-right">{s.totalOrders}</TableCell>
                  <TableCell className="text-right">₹{s.totalAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.avgLeadTime}</TableCell>
                  <TableCell className="text-right text-green-500">{s.onTimeDeliveries}</TableCell>
                  <TableCell className="text-right text-red-500">{s.lateDeliveries}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={parseInt(s.performance) >= 80 ? 'default' : parseInt(s.performance) >= 50 ? 'secondary' : 'destructive'}>
                      {s.performance}
                    </Badge>
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