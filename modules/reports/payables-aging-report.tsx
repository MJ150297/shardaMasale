'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle } from 'lucide-react';

export function PayablesAgingReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      const res = await fetch(`/api/reports/payables-aging?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load payables aging report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Suppliers with Dues</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.totalSuppliers}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Payable</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">₹{data.totals.grandTotalDue.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.agingBuckets.map((bucket: any) => (
          <Card key={bucket.label} className={bucket.label.includes('90') ? 'border-red-200' : ''}>
            <CardHeader className="pb-2"><CardTitle className="text-xs">{bucket.label}</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${bucket.label.includes('90') ? 'text-red-500' : ''}`}>
                ₹{bucket.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">0-30 days</TableHead>
                <TableHead className="text-right">31-60 days</TableHead>
                <TableHead className="text-right">61-90 days</TableHead>
                <TableHead className="text-right">90+ days</TableHead>
                <TableHead className="text-right">Total Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.suppliers.map((s: any) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.displayName}</TableCell>
                  <TableCell className="text-right">₹{s.currentBalance.toLocaleString()}</TableCell>
                  {s.buckets.map((b: any, idx: number) => (
                    <TableCell key={idx} className={`text-right ${b.total > 0 && idx >= 2 ? 'text-red-500 font-medium' : ''}`}>
                      ₹{b.total.toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold text-red-500">₹{s.totalDue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}