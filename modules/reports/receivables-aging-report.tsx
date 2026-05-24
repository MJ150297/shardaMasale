'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign, AlertTriangle } from 'lucide-react';

export function ReceivablesAgingReport({ shopId }: { shopId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (shopId) params.append('shopId', shopId);
      const res = await fetch(`/api/reports/receivables-aging?${params}`);
      const result = await res.json();
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [shopId]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Failed to load receivables aging report</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Customers Owing</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.totalCustomers}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Receivables</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">₹{data.totals.grandTotalDue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Credit Utilization</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totals.creditUtilization}%</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.agingBuckets.map((bucket: any) => (
          <Card key={bucket.label} className={bucket.label.includes('90') ? 'border-red-200' : ''}>
            <CardHeader className="pb-2"><CardTitle className="text-xs">{bucket.label}</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${parseInt(bucket.label) >= 61 ? 'text-red-500' : ''}`}>
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
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="text-right">0-30 days</TableHead>
                <TableHead className="text-right">31-60 days</TableHead>
                <TableHead className="text-right">61-90 days</TableHead>
                <TableHead className="text-right">90+ days</TableHead>
                <TableHead className="text-right">Total Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customers.map((c: any) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">{c.displayName}</TableCell>
                  <TableCell className="text-right">₹{c.currentBalance.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{c.creditLimit.toLocaleString()}</TableCell>
                  {c.buckets.map((b: any, idx: number) => (
                    <TableCell key={idx} className={`text-right ${b.total > 0 && idx >= 2 ? 'text-red-500 font-medium' : ''}`}>
                      ₹{b.total.toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold text-red-500">₹{c.totalDue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}